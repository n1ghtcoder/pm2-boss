// ── Process Types ──

export interface PM2Process {
	pm_id: number;
	name: string;
	pid: number;
	status: "online" | "stopping" | "stopped" | "launching" | "errored" | "one-launch-status";
	cpu: number;
	memory: number;
	uptime: number;
	restarts: number;
	exec_mode: "fork" | "cluster";
	namespace: string;
	script: string;
	cwd: string;
	watch: boolean;
	max_memory_restart: number; // bytes, 0 = use global default
	ports?: number[];
	node_version?: string;
	pm2_env_version?: string;
}

export interface PM2ProcessDetail extends PM2Process {
	args: string[];
	interpreter: string;
	interpreter_args: string;
	instances: number;
	max_memory_restart: number; // bytes, 0 = no limit
	pm_out_log_path: string;
	pm_err_log_path: string;
	pm_pid_path: string;
	created_at: number;
	env: Record<string, string>;
	axm_actions: Array<{ action_name: string }>;
	versioning?: {
		branch: string;
		revision: string;
		comment: string;
		repo_path: string;
		repo_url: string;
	};
}

// ── Metrics Types ──

export interface MetricsPoint {
	cpu: number;
	memory: number;
	timestamp: number;
}

export interface SystemMetrics {
	cpuCount: number;
	loadAvg: [number, number, number];
	totalMemory: number;
	freeMemory: number;
	usedMemory: number;
	uptime: number;
	platform: string;
	hostname: string;
	nodeVersion: string;
}

// ── WebSocket Protocol ──

export type WsMessageFromServer =
	| { type: "processes"; payload: PM2Process[] }
	| { type: "process:update"; payload: PM2Process }
	| { type: "metrics"; payload: Record<number, MetricsPoint[]> }
	| { type: "system"; payload: SystemMetrics }
	| { type: "logs:data"; payload: LogEntry }
	| { type: "logs:history"; payload: { pm_id: number; lines: LogEntry[] } }
	| { type: "pm2:status"; payload: { connected: boolean; error?: string } }
	| { type: "process:ipc"; payload: ProcessIpcMessage }
	| { type: "memory_event"; payload: MemoryEvent };

export type WsMessageFromClient =
	| { type: "logs:subscribe"; payload: { pm_id: number } }
	| { type: "logs:unsubscribe"; payload: { pm_id: number } };

// ── Log Types ──

export interface LogEntry {
	pm_id: number;
	process_name: string;
	timestamp: string;
	message: string;
	stream: "stdout" | "stderr";
}

// ── IPC Message Types ──

export interface ProcessIpcMessage {
	pm_id: number;
	process_name: string;
	data: unknown;
	timestamp: string;
}

// ── Process Groups ──

export interface ProcessGroup {
	id: string;
	name: string;
	processNames: string[];
	color?: string;
	collapsed: boolean;
	order: number;
}

// ── Settings ──

export interface AppSettings {
	defaultMaxMemoryMB: number; // default 4096 (4GB)
	telegramBotToken: string; // from @BotFather
	telegramChatIds: string[]; // chat IDs for alerts
}

// ── Memory Events ──

export interface MemoryEvent {
	id: string;
	timestamp: number;
	pmId: number;
	processName: string;
	memoryBytes: number;
	limitBytes: number;
	type: "memory_limit_exceeded";
}

// ── API Response Envelope ──

export interface ApiResponse<T = unknown> {
	data: T | null;
	error: string | null;
	timestamp: number;
}
