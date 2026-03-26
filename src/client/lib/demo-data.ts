import type { PM2Process, PM2ProcessDetail, MetricsPoint, SystemMetrics, ProcessGroup } from "@shared/types";

const now = Date.now();
const hour = 3600_000;
const day = 86400_000;

/** Realistic process names — a SaaS indie hacker's server */
const MOCK_PROCESSES: PM2Process[] = [
	{ pm_id: 0, name: "web-app", pid: 12401, status: "online", cpu: 12.3, memory: 287 * 1024 * 1024, uptime: 14 * day, restarts: 0, exec_mode: "cluster", namespace: "default", script: "/app/dist/server.js", cwd: "/app", watch: false, max_memory_restart: 0, ports: [3000] },
	{ pm_id: 1, name: "web-app", pid: 12402, status: "online", cpu: 8.7, memory: 264 * 1024 * 1024, uptime: 14 * day, restarts: 0, exec_mode: "cluster", namespace: "default", script: "/app/dist/server.js", cwd: "/app", watch: false, max_memory_restart: 0, ports: [3000] },
	{ pm_id: 2, name: "web-app", pid: 12403, status: "online", cpu: 15.1, memory: 312 * 1024 * 1024, uptime: 14 * day, restarts: 2, exec_mode: "cluster", namespace: "default", script: "/app/dist/server.js", cwd: "/app", watch: false, max_memory_restart: 0, ports: [3000] },
	{ pm_id: 3, name: "api-gateway", pid: 12450, status: "online", cpu: 24.5, memory: 198 * 1024 * 1024, uptime: 7 * day, restarts: 1, exec_mode: "fork", namespace: "default", script: "/api/dist/index.js", cwd: "/api", watch: false, max_memory_restart: 0, ports: [4000] },
	{ pm_id: 4, name: "worker-emails", pid: 12501, status: "online", cpu: 3.2, memory: 142 * 1024 * 1024, uptime: 7 * day, restarts: 0, exec_mode: "fork", namespace: "workers", script: "/workers/email.js", cwd: "/workers", watch: false, max_memory_restart: 0 },
	{ pm_id: 5, name: "worker-payments", pid: 12502, status: "online", cpu: 1.8, memory: 98 * 1024 * 1024, uptime: 7 * day, restarts: 0, exec_mode: "fork", namespace: "workers", script: "/workers/payments.js", cwd: "/workers", watch: false, max_memory_restart: 0 },
	{ pm_id: 6, name: "cron-scheduler", pid: 12550, status: "online", cpu: 0.4, memory: 67 * 1024 * 1024, uptime: 30 * day, restarts: 0, exec_mode: "fork", namespace: "default", script: "/cron/scheduler.js", cwd: "/cron", watch: false, max_memory_restart: 0 },
	{ pm_id: 7, name: "next-marketing", pid: 12600, status: "online", cpu: 45.2, memory: 1.8 * 1024 * 1024 * 1024, uptime: 2 * day, restarts: 5, exec_mode: "fork", namespace: "frontend", script: "/marketing/node_modules/.bin/next", cwd: "/marketing", watch: false, max_memory_restart: 4294967296, ports: [3001] },
	{ pm_id: 8, name: "next-dashboard", pid: 12650, status: "online", cpu: 31.7, memory: 920 * 1024 * 1024, uptime: 2 * day, restarts: 3, exec_mode: "fork", namespace: "frontend", script: "/dashboard/node_modules/.bin/next", cwd: "/dashboard", watch: false, max_memory_restart: 4294967296, ports: [3002] },
	{ pm_id: 9, name: "redis-sync", pid: 12700, status: "online", cpu: 2.1, memory: 54 * 1024 * 1024, uptime: 30 * day, restarts: 0, exec_mode: "fork", namespace: "infra", script: "/infra/redis-sync.js", cwd: "/infra", watch: false, max_memory_restart: 0 },
	{ pm_id: 10, name: "websocket-server", pid: 12750, status: "online", cpu: 7.6, memory: 176 * 1024 * 1024, uptime: 14 * day, restarts: 1, exec_mode: "fork", namespace: "default", script: "/ws/server.js", cwd: "/ws", watch: false, max_memory_restart: 0, ports: [8080] },
	{ pm_id: 11, name: "image-processor", pid: 0, status: "errored", cpu: 0, memory: 0, uptime: 0, restarts: 12, exec_mode: "fork", namespace: "workers", script: "/workers/image-proc.js", cwd: "/workers", watch: false, max_memory_restart: 0 },
	{ pm_id: 12, name: "log-aggregator", pid: 12800, status: "online", cpu: 5.3, memory: 234 * 1024 * 1024, uptime: 7 * day, restarts: 0, exec_mode: "fork", namespace: "infra", script: "/infra/log-agg.js", cwd: "/infra", watch: true, max_memory_restart: 0 },
	{ pm_id: 13, name: "stripe-webhooks", pid: 12850, status: "online", cpu: 0.9, memory: 82 * 1024 * 1024, uptime: 14 * day, restarts: 0, exec_mode: "fork", namespace: "default", script: "/webhooks/stripe.js", cwd: "/webhooks", watch: false, max_memory_restart: 0, ports: [4100] },
	{ pm_id: 14, name: "migration-runner", pid: 0, status: "stopped", cpu: 0, memory: 0, uptime: 0, restarts: 0, exec_mode: "fork", namespace: "default", script: "/db/migrate.js", cwd: "/db", watch: false, max_memory_restart: 0 },
	{ pm_id: 15, name: "ai-inference", pid: 12900, status: "online", cpu: 67.8, memory: 3.2 * 1024 * 1024 * 1024, uptime: 1 * day, restarts: 8, exec_mode: "fork", namespace: "ml", script: "/ml/inference.js", cwd: "/ml", watch: false, max_memory_restart: 4294967296 },
];

/** Generate realistic-looking sparkline metrics for a process */
function generateMetrics(baseCpu: number, baseMem: number, points: number = 60): MetricsPoint[] {
	const result: MetricsPoint[] = [];
	const interval = 2000; // 2s between points
	let cpu = baseCpu;
	let mem = baseMem;

	for (let i = 0; i < points; i++) {
		// Random walk with mean reversion
		cpu = Math.max(0, Math.min(100, cpu + (Math.random() - 0.5) * baseCpu * 0.3 + (baseCpu - cpu) * 0.1));
		mem = Math.max(0, mem + (Math.random() - 0.5) * baseMem * 0.05 + (baseMem - mem) * 0.05);

		result.push({
			cpu: Math.round(cpu * 10) / 10,
			memory: Math.round(mem),
			timestamp: now - (points - i) * interval,
		});
	}
	return result;
}

/** Mock metrics keyed by pm_id */
function generateAllMetrics(): Record<number, MetricsPoint[]> {
	const metrics: Record<number, MetricsPoint[]> = {};
	for (const proc of MOCK_PROCESSES) {
		if (proc.pid > 0) {
			metrics[proc.pm_id] = generateMetrics(proc.cpu, proc.memory);
		}
	}
	return metrics;
}

const MOCK_SYSTEM: SystemMetrics = {
	cpuCount: 8,
	loadAvg: [2.4, 1.8, 1.5],
	totalMemory: 32 * 1024 * 1024 * 1024,
	freeMemory: 8.5 * 1024 * 1024 * 1024,
	usedMemory: 23.5 * 1024 * 1024 * 1024,
	uptime: 45 * 86400 + 7 * 3600,
	platform: "linux",
	hostname: "prod-server-01",
	nodeVersion: "20.11.0",
};

/** Create a mock PM2ProcessDetail from a base process */
function toDetail(proc: PM2Process): PM2ProcessDetail {
	return {
		...proc,
		args: [],
		interpreter: "node",
		interpreter_args: "",
		instances: proc.exec_mode === "cluster" ? 3 : 1,
		pm_out_log_path: `/home/deploy/.pm2/logs/${proc.name}-out.log`,
		pm_err_log_path: `/home/deploy/.pm2/logs/${proc.name}-error.log`,
		pm_pid_path: `/home/deploy/.pm2/pids/${proc.name}-${proc.pm_id}.pid`,
		created_at: now - proc.uptime,
		env: {
			NODE_ENV: "production",
			PORT: proc.ports?.[0]?.toString() ?? "3000",
			HOME: "/home/deploy",
			PATH: "/usr/local/bin:/usr/bin:/bin",
		},
		axm_actions: [],
		versioning: {
			branch: "main",
			revision: "a1b2c3d",
			comment: "feat: update production config",
			repo_path: proc.cwd,
			repo_url: "https://github.com/example/app.git",
		},
	};
}

const MOCK_GROUPS: ProcessGroup[] = [
	{
		id: "g1",
		name: "Frontend",
		processNames: ["web-app", "next-marketing", "next-dashboard"],
		color: "#10b981",
		collapsed: false,
		order: 0,
	},
	{
		id: "g2",
		name: "Backend",
		processNames: ["api-gateway", "websocket-server", "stripe-webhooks", "cron-scheduler"],
		color: "#3b82f6",
		collapsed: false,
		order: 1,
	},
	{
		id: "g3",
		name: "Workers",
		processNames: ["worker-emails", "worker-payments", "image-processor"],
		color: "#f59e0b",
		collapsed: false,
		order: 2,
	},
];

/** Get mock detail for a process by pm_id */
export function getDemoDetail(pmId: number): PM2ProcessDetail | null {
	const proc = MOCK_PROCESSES.find((p) => p.pm_id === pmId);
	if (!proc) return null;
	return toDetail(proc);
}

export const demoData = {
	processes: MOCK_PROCESSES,
	metrics: generateAllMetrics(),
	system: MOCK_SYSTEM,
	groups: MOCK_GROUPS,
};
