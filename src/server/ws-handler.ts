import * as os from "node:os";
import type { WSEvents } from "hono/ws";
import { pm2Manager } from "./pm2-manager.js";
import { logManager } from "./log-manager.js";
import { metricsStore } from "./metrics-store.js";
import { loadSettings } from "./settings-store.js";
import { addMemoryEvent } from "./events-store.js";
import type { WsMessageFromClient, WsMessageFromServer, SystemMetrics, ProcessIpcMessage, MemoryEvent } from "../shared/types.js";

type WsConnection = {
	send: (data: string) => void;
	close: () => void;
};

type ProcessObserver = (processes: import("../shared/types.js").PM2Process[]) => void;
type MemoryEventObserver = (event: MemoryEvent) => void;

/** Throttle: one memory alert per process per 60s */
const memoryAlertCooldown = new Map<number, number>();
const MEMORY_ALERT_COOLDOWN = 60_000;

class WsConnectionManager {
	private clients = new Set<WsConnection>();
	private broadcastInterval: ReturnType<typeof setInterval> | null = null;
	private metricsInterval: ReturnType<typeof setInterval> | null = null;
	private systemInterval: ReturnType<typeof setInterval> | null = null;
	private processObservers: ProcessObserver[] = [];
	private memoryEventObservers: MemoryEventObserver[] = [];

	/** Register an observer that receives process list on every broadcast cycle */
	onProcessUpdate(callback: ProcessObserver) {
		this.processObservers.push(callback);
	}

	/** Register an observer for memory limit events (e.g. Telegram alerts) */
	onMemoryEvent(callback: MemoryEventObserver) {
		this.memoryEventObservers.push(callback);
	}

	/** Remove a previously registered process observer */
	removeProcessObserver(callback: ProcessObserver) {
		this.processObservers = this.processObservers.filter((cb) => cb !== callback);
	}

	/** Remove a previously registered memory event observer */
	removeMemoryEventObserver(callback: MemoryEventObserver) {
		this.memoryEventObservers = this.memoryEventObservers.filter((cb) => cb !== callback);
	}

	addClient(ws: WsConnection) {
		this.clients.add(ws);
		// Send initial PM2 status
		this.sendTo(ws, {
			type: "pm2:status",
			payload: { connected: pm2Manager.isConnected() },
		});
		// Send current process list immediately
		this.sendProcessList(ws);
		// Send metrics history
		this.sendTo(ws, { type: "metrics", payload: metricsStore.getAllHistory() });
		// Send system metrics
		this.sendTo(ws, { type: "system", payload: getSystemMetrics() });
	}

	removeClient(ws: WsConnection) {
		logManager.unsubscribeAll(ws);
		this.clients.delete(ws);
	}

	handleMessage(ws: WsConnection, raw: string) {
		try {
			const msg: WsMessageFromClient = JSON.parse(raw);
			switch (msg.type) {
				case "logs:subscribe":
					logManager.subscribe(ws, msg.payload.pm_id);
					break;
				case "logs:unsubscribe":
					logManager.unsubscribe(ws, msg.payload.pm_id);
					break;
			}
		} catch {
			// Ignore malformed messages
		}
	}

	startBroadcasting() {
		if (this.broadcastInterval) return;
		this.broadcastInterval = setInterval(() => this.broadcastProcessList(), 1000);
		this.metricsInterval = setInterval(() => this.broadcastMetrics(), 2000);
		this.systemInterval = setInterval(() => this.broadcastSystem(), 5000);
		metricsStore.start();
		logManager.start(this);
		this.startIpcBus();
	}

	/** Listen on PM2 bus for IPC messages from processes */
	private startIpcBus() {
		pm2Manager.launchBus((err, bus) => {
			if (err || !bus) {
				console.error("[pm2-boss] Failed to launch PM2 bus:", err?.message);
				return;
			}
			bus.on("process:msg", (packet: any) => {
				if (this.clients.size === 0) return;
				const msg: ProcessIpcMessage = {
					pm_id: packet.process?.pm_id ?? 0,
					process_name: packet.process?.name ?? "unknown",
					data: packet.data,
					timestamp: new Date().toISOString(),
				};
				this.broadcast({ type: "process:ipc", payload: msg });
			});
			console.log("[pm2-boss] PM2 bus listening for IPC messages");
		});
	}

	stopBroadcasting() {
		if (this.broadcastInterval) {
			clearInterval(this.broadcastInterval);
			this.broadcastInterval = null;
		}
		if (this.metricsInterval) {
			clearInterval(this.metricsInterval);
			this.metricsInterval = null;
		}
		if (this.systemInterval) {
			clearInterval(this.systemInterval);
			this.systemInterval = null;
		}
		metricsStore.stop();
		logManager.stop();
	}

	broadcast(msg: WsMessageFromServer) {
		const data = JSON.stringify(msg);
		for (const client of this.clients) {
			try {
				client.send(data);
			} catch {
				this.clients.delete(client);
			}
		}
	}

	sendTo(ws: WsConnection, msg: WsMessageFromServer) {
		try {
			ws.send(JSON.stringify(msg));
		} catch {
			// Connection may be closed
		}
	}

	get clientCount() {
		return this.clients.size;
	}

	private async broadcastProcessList() {
		try {
			const processes = await pm2Manager.list();
			// Notify observers (Telegram alerts etc.) even if no WS clients
			for (const observer of this.processObservers) {
				try { observer(processes); } catch { /* observer error */ }
			}
			// Check memory limits
			this.checkMemoryLimits(processes);
			if (this.clients.size === 0) return;
			this.broadcast({ type: "processes", payload: processes });
		} catch {
			// PM2 may be disconnected
			if (this.clients.size > 0) {
				this.broadcast({ type: "pm2:status", payload: { connected: false, error: "PM2 connection lost" } });
			}
		}
	}

	private async sendProcessList(ws: WsConnection) {
		try {
			const processes = await pm2Manager.list();
			this.sendTo(ws, { type: "processes", payload: processes });
		} catch {
			// Ignore
		}
	}

	private checkMemoryLimits(processes: import("../shared/types.js").PM2Process[]) {
		const now = Date.now();
		const settings = loadSettings();
		const defaultLimitBytes = settings.defaultMaxMemoryMB * 1024 * 1024;

		for (const proc of processes) {
			if (proc.status !== "online" || proc.memory <= 0) continue;

			// Per-process limit takes priority, otherwise use global default
			const limitBytes = proc.max_memory_restart > 0 ? proc.max_memory_restart : defaultLimitBytes;
			if (limitBytes <= 0) continue;

			if (proc.memory > limitBytes) {
				// Throttle: one event per process per 60s
				const lastAlert = memoryAlertCooldown.get(proc.pm_id) ?? 0;
				if (now - lastAlert < MEMORY_ALERT_COOLDOWN) continue;
				memoryAlertCooldown.set(proc.pm_id, now);

				const event = addMemoryEvent(proc.pm_id, proc.name, proc.memory, limitBytes);
				console.log(`[pm2-boss] Memory limit exceeded: ${proc.name} using ${(proc.memory / 1024 / 1024).toFixed(0)}MB (limit: ${settings.defaultMaxMemoryMB}MB)`);

				// Broadcast to WS clients
				this.broadcast({ type: "memory_event", payload: event });

				// Notify observers (Telegram)
				for (const observer of this.memoryEventObservers) {
					try { observer(event); } catch { /* observer error */ }
				}
			}
		}
	}

	private broadcastMetrics() {
		if (this.clients.size === 0) return;
		this.broadcast({ type: "metrics", payload: metricsStore.getAllHistory() });
	}

	private broadcastSystem() {
		if (this.clients.size === 0) return;
		this.broadcast({ type: "system", payload: getSystemMetrics() });
	}
}

function getSystemMetrics(): SystemMetrics {
	const loadAvg = os.loadavg();
	return {
		cpuCount: os.cpus().length,
		loadAvg: [loadAvg[0], loadAvg[1], loadAvg[2]],
		totalMemory: os.totalmem(),
		freeMemory: os.freemem(),
		usedMemory: os.totalmem() - os.freemem(),
		uptime: os.uptime(),
		platform: os.platform(),
		hostname: os.hostname(),
		nodeVersion: process.version,
	};
}

const connectionManager = new WsConnectionManager();

export function createWsHandler(): WSEvents & { startBroadcasting: () => void; stopBroadcasting: () => void } {
	return {
		onOpen(_evt, ws) {
			connectionManager.addClient(ws as unknown as WsConnection);
		},
		onMessage(evt, ws) {
			const data = typeof evt.data === "string" ? evt.data : evt.data.toString();
			connectionManager.handleMessage(ws as unknown as WsConnection, data);
		},
		onClose(_evt, ws) {
			connectionManager.removeClient(ws as unknown as WsConnection);
		},
		onError(_evt, ws) {
			connectionManager.removeClient(ws as unknown as WsConnection);
		},
		startBroadcasting: () => connectionManager.startBroadcasting(),
		stopBroadcasting: () => connectionManager.stopBroadcasting(),
	};
}

export { connectionManager };
