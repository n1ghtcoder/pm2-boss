import pm2 from "pm2";
import pidusage from "pidusage";
import { execSync } from "node:child_process";
import type { PM2Process, PM2ProcessDetail } from "../shared/types.js";

class PM2Manager {
	private connected = false;
	/** Deduplicates concurrent pm2.list() IPC calls — all callers share one in-flight request */
	private _listRaw: Promise<any[]> | null = null;

	private _pmList(): Promise<any[]> {
		if (this._listRaw) return this._listRaw;
		this._listRaw = new Promise<any[]>((resolve, reject) => {
			pm2.list((err, list) => {
				if (err) reject(err);
				else resolve(list);
			});
		}).finally(() => {
			this._listRaw = null;
		}) as Promise<any[]>;
		return this._listRaw;
	}

	async connect(): Promise<boolean> {
		return new Promise((resolve) => {
			pm2.connect((err) => {
				if (err) {
					console.error("[pm2-boss] PM2 connect error:", err.message);
					this.connected = false;
					resolve(false);
					return;
				}
				this.connected = true;
				console.log("[pm2-boss] Connected to PM2 daemon");
				resolve(true);
			});
		});
	}

	async disconnect(): Promise<void> {
		if (this.connected) {
			pm2.disconnect();
			this.connected = false;
			console.log("[pm2-boss] Disconnected from PM2 daemon");
		}
	}

	isConnected(): boolean {
		return this.connected;
	}

	async list(): Promise<PM2Process[]> {
		if (!this.connected) return [];
		const raw = await this._pmList();
		const procs = raw.map(mapProcess);
		return enrichWithPidusage(procs);
	}

	async describe(pmId: number): Promise<PM2ProcessDetail | null> {
		if (!this.connected) return null;
		// Shares the in-flight list() IPC call — no separate pm2.describe() round-trip
		const raw = await this._pmList();
		const proc = raw.find((p: any) => (p.pm2_env?.pm_id ?? p.pm_id) === pmId);
		if (!proc) return null;
		const detail = mapProcessDetail(proc);
		const [enriched] = await enrichWithPidusage([detail]);
		return enriched as PM2ProcessDetail;
	}

	async action(pmId: number | string, action: "stop" | "restart" | "reload" | "delete"): Promise<void> {
		if (!this.connected) throw new Error("PM2 not connected");
		return new Promise((resolve, reject) => {
			const fn = pm2[action] as (target: number | string, cb: (err: Error | null) => void) => void;
			fn.call(pm2, pmId, (err: Error | null) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async reset(pmId: number): Promise<void> {
		if (!this.connected) throw new Error("PM2 not connected");
		return new Promise((resolve, reject) => {
			(pm2 as any).reset(pmId, (err: Error | null) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async scale(name: string, instances: number): Promise<void> {
		if (!this.connected) throw new Error("PM2 not connected");
		return new Promise((resolve, reject) => {
			(pm2 as any).scale(name, instances, (err: Error | null) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async start(options: {
		script: string;
		name?: string;
		cwd?: string;
		interpreter?: string;
		args?: string;
		instances?: number;
		exec_mode?: "fork" | "cluster";
		watch?: boolean;
	}): Promise<void> {
		if (!this.connected) throw new Error("PM2 not connected");
		return new Promise((resolve, reject) => {
			pm2.start(
				{
					script: options.script,
					name: options.name,
					cwd: options.cwd,
					interpreter: options.interpreter,
					args: options.args,
					instances: options.instances,
					exec_mode: options.exec_mode === "cluster" ? "cluster" : "fork",
					watch: options.watch,
				} as any,
				(err) => {
					if (err) reject(err);
					else resolve();
				},
			);
		});
	}

	async sendSignal(signal: string, pmId: number): Promise<void> {
		if (!this.connected) throw new Error("PM2 not connected");
		return new Promise((resolve, reject) => {
			(pm2 as any).sendSignalToProcessId(signal, pmId, (err: Error | null) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async trigger(pmId: number, actionName: string): Promise<void> {
		if (!this.connected) throw new Error("PM2 not connected");
		return new Promise((resolve, reject) => {
			(pm2 as any).trigger(pmId, actionName, (err: Error | null) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async dump(): Promise<void> {
		if (!this.connected) throw new Error("PM2 not connected");
		return new Promise((resolve, reject) => {
			(pm2 as any).dump((err: Error | null) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async resurrect(): Promise<void> {
		if (!this.connected) throw new Error("PM2 not connected");
		return new Promise((resolve, reject) => {
			(pm2 as any).resurrect((err: Error | null) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async flush(): Promise<void> {
		if (!this.connected) throw new Error("PM2 not connected");
		return new Promise((resolve, reject) => {
			(pm2 as any).flush("all", (err: Error | null) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async sendData(pmId: number, data: unknown, topic?: string): Promise<void> {
		if (!this.connected) throw new Error("PM2 not connected");
		return new Promise((resolve, reject) => {
			const packet: any = {
				id: pmId,
				type: "process:msg",
				data,
				topic: topic || "pm2-boss:message",
			};
			(pm2 as any).sendDataToProcessId(pmId, packet, (err: Error | null) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	/**
	 * Update process config by deleting and re-starting with merged options.
	 * Returns the new process name (unchanged).
	 */
	async updateConfig(
		pmId: number,
		updates: {
			script?: string;
			cwd?: string;
			interpreter?: string;
			args?: string;
			exec_mode?: "fork" | "cluster";
			watch?: boolean;
			max_memory_restart?: string;
		},
	): Promise<void> {
		if (!this.connected) throw new Error("PM2 not connected");

		// 1. Get current raw process data
		const raw = await this._pmList();
		const proc = raw.find((p: any) => (p.pm2_env?.pm_id ?? p.pm_id) === pmId);
		if (!proc) throw new Error("Process not found");

		const env = proc.pm2_env || {};
		const name = env.name ?? proc.name;

		// 2. Build merged start options
		const startOpts: any = {
			name,
			script: updates.script ?? env.pm_exec_path ?? "",
			cwd: updates.cwd ?? env.pm_cwd ?? undefined,
			interpreter: updates.interpreter ?? env.exec_interpreter ?? "node",
			args: updates.args !== undefined ? updates.args : (env.args ?? []).join(" "),
			exec_mode: updates.exec_mode ?? ((env.exec_mode ?? "fork_mode").replace("_mode", "") as "fork" | "cluster"),
			watch: updates.watch !== undefined ? updates.watch : !!env.watch,
			// Preserve env vars
			env: env.env ?? {},
			// Preserve log paths if not default
			output: env.pm_out_log_path || undefined,
			error: env.pm_err_log_path || undefined,
			// Preserve other settings
			instances: env.instances ?? 1,
			max_memory_restart: updates.max_memory_restart !== undefined
				? (updates.max_memory_restart === "0" ? undefined : updates.max_memory_restart)
				: (env.max_memory_restart || undefined),
			node_args: env.node_args?.join(" ") || undefined,
		};

		// 3. Delete old process
		await this.action(pmId, "delete");

		// 4. Start with new config
		await new Promise<void>((resolve, reject) => {
			pm2.start(startOpts, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	launchBus(callback: (err: Error | null, bus: any) => void): void {
		if (!this.connected) {
			callback(new Error("PM2 not connected"), null);
			return;
		}
		pm2.launchBus(callback);
	}
}

// ── Port Detection ──
// Uses OS-level lsof/ss to find which ports a PID actually listens on.
// Cached and refreshed every 5 seconds to avoid excessive shell calls.

let portCache: Map<number, number[]> = new Map();
let portCacheTime = 0;
const PORT_CACHE_TTL = 5000; // 5 seconds

function refreshPortCache(): void {
	const now = Date.now();
	if (now - portCacheTime < PORT_CACHE_TTL) return;
	portCacheTime = now;

	try {
		const isMac = process.platform === "darwin";
		const cmd = isMac
			? "lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null"
			: "ss -tlnp 2>/dev/null";
		const output = execSync(cmd, { timeout: 3000 }).toString();

		const newCache = new Map<number, number[]>();

		if (isMac) {
			// lsof output: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
			// NAME examples: *:3000  127.0.0.1:4343  [::1]:18789
			for (const line of output.split("\n")) {
				const parts = line.trim().split(/\s+/);
				if (parts.length < 9) continue;
				const pid = Number(parts[1]);
				if (!pid) continue;
				const nameField = parts[8];
				// Handle IPv4 (*:3000, 127.0.0.1:3000) and IPv6 ([::1]:3000)
				const portMatch = nameField.match(/:(\d+)$/);
				if (portMatch) {
					const port = Number(portMatch[1]);
					if (port > 0 && port < 65536) {
						const existing = newCache.get(pid) ?? [];
						if (!existing.includes(port)) existing.push(port);
						newCache.set(pid, existing);
					}
				}
			}
		} else {
			// ss output: State  Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process
			// Process looks like: users:(("node",pid=1234,fd=22))
			for (const line of output.split("\n")) {
				const pidMatch = line.match(/pid=(\d+)/);
				const portMatch = line.match(/:(\d+)\s/);
				if (pidMatch && portMatch) {
					const pid = Number(pidMatch[1]);
					const port = Number(portMatch[1]);
					if (pid && port > 0 && port < 65536) {
						const existing = newCache.get(pid) ?? [];
						if (!existing.includes(port)) existing.push(port);
						newCache.set(pid, existing);
					}
				}
			}
		}

		portCache = newCache;
	} catch {
		// lsof/ss failed — keep stale cache
	}
}

/**
 * Recursively collect all descendant PIDs (children, grandchildren, etc.)
 * PM2 forks wrappers → npm → node, so the actual listening process
 * can be 2-3 levels deep.
 */
function getDescendantPids(pid: number, maxDepth = 4): number[] {
	const result: number[] = [];
	const queue: Array<{ pid: number; depth: number }> = [{ pid, depth: 0 }];

	while (queue.length > 0) {
		const current = queue.shift()!;
		if (current.depth >= maxDepth) continue;
		try {
			const output = execSync(`pgrep -P ${current.pid} 2>/dev/null`, {
				timeout: 1000,
			}).toString();
			const children = output
				.trim()
				.split("\n")
				.filter(Boolean)
				.map(Number)
				.filter(Boolean);
			for (const child of children) {
				result.push(child);
				queue.push({ pid: child, depth: current.depth + 1 });
			}
		} catch {
			// No children or pgrep failed
		}
	}
	return result;
}

/**
 * Detect all listening ports for a process and its descendants.
 * Returns sorted array of unique ports, or undefined if none found.
 *
 * Priority:
 * 1. OS-level listening ports (via lsof/ss) — most accurate
 * 2. env.PORT / env.port
 * 3. Command args --port / -p
 */
function detectPorts(
	pid: number,
	env: any,
	args: string[] | undefined,
): number[] | undefined {
	const allPorts: number[] = [];

	// 1. Check OS-level ports (pid + all descendants recursively)
	if (pid > 0) {
		refreshPortCache();
		const allPids = [pid, ...getDescendantPids(pid)];
		for (const p of allPids) {
			const ports = portCache.get(p);
			if (ports) {
				for (const port of ports) {
					if (!allPorts.includes(port)) allPorts.push(port);
				}
			}
		}
	}

	// 2. Check env.PORT or env.port (if not already found via OS)
	if (allPorts.length === 0) {
		const envPort =
			env?.env?.PORT ?? env?.env?.port ?? env?.PORT ?? env?.port;
		if (envPort) {
			const p = Number(envPort);
			if (p > 0 && p < 65536) allPorts.push(p);
		}
	}

	// 3. Check command-line args for --port <n> or -p <n>
	if (allPorts.length === 0) {
		const argList: string[] = args ?? env?.args ?? [];
		for (let i = 0; i < argList.length; i++) {
			const arg = argList[i];
			if (/^(--port|-p)=/.test(arg)) {
				const p = Number(arg.split("=")[1]);
				if (p > 0 && p < 65536 && !allPorts.includes(p)) allPorts.push(p);
			}
			if (arg === "--port" || arg === "-p") {
				const next = argList[i + 1];
				if (next) {
					const p = Number(next);
					if (p > 0 && p < 65536 && !allPorts.includes(p)) allPorts.push(p);
				}
			}
		}
	}

	if (allPorts.length === 0) return undefined;
	return allPorts.sort((a, b) => a - b);
}

/** Enrich processes with real CPU/memory from pidusage (PM2 v6 monit is broken) */
async function enrichWithPidusage<T extends PM2Process>(procs: T[]): Promise<T[]> {
	const pids = procs.filter((p) => p.pid > 0).map((p) => p.pid);
	if (pids.length === 0) return procs;
	try {
		const stats = await pidusage(pids);
		for (const p of procs) {
			const s = stats[p.pid];
			if (s) {
				p.cpu = Math.max(0, Math.round(s.cpu * 10) / 10);
				p.memory = s.memory;
			}
		}
	} catch {
		// pidusage can fail for dead PIDs — keep existing (zero) values
	}
	return procs;
}

// biome-ignore lint/suspicious/noExplicitAny: PM2 types are incomplete
function mapProcess(proc: any): PM2Process {
	const env = proc.pm2_env || {};
	return {
		pm_id: env.pm_id ?? proc.pm_id ?? 0,
		name: env.name ?? proc.name ?? "unknown",
		pid: proc.pid ?? 0,
		status: env.status ?? "stopped",
		cpu: proc.monit?.cpu ?? 0,
		memory: proc.monit?.memory ?? 0, // RSS in bytes (Resident Set Size)
		uptime: env.pm_uptime ? Date.now() - env.pm_uptime : 0,
		restarts: env.restart_time ?? 0,
		exec_mode: (env.exec_mode ?? "fork_mode").replace("_mode", "") as "fork" | "cluster",
		namespace: env.namespace ?? "default",
		script: env.pm_exec_path ?? "",
		cwd: env.pm_cwd ?? "",
		watch: !!env.watch,
		max_memory_restart: env.max_memory_restart ?? 0,
		ports: detectPorts(proc.pid ?? 0, env, env.args),
	};
}

// biome-ignore lint/suspicious/noExplicitAny: PM2 types are incomplete
function mapProcessDetail(proc: any): PM2ProcessDetail {
	const base = mapProcess(proc);
	const env = proc.pm2_env || {};
	return {
		...base,
		args: env.args ?? [],
		interpreter: env.exec_interpreter ?? "node",
		interpreter_args: env.node_args?.join(" ") ?? "",
		instances: env.instances ?? 1,
		max_memory_restart: env.max_memory_restart ?? 0,
		pm_out_log_path: env.pm_out_log_path ?? "",
		pm_err_log_path: env.pm_err_log_path ?? "",
		pm_pid_path: env.pm_pid_path ?? "",
		created_at: env.created_at ?? 0,
		env: env.env ?? {},
		axm_actions: env.axm_actions ?? [],
		versioning: env.versioning ?? undefined,
	};
}

export const pm2Manager = new PM2Manager();
