import { open, stat } from "node:fs/promises";
import { pm2Manager } from "./pm2-manager.js";
import type { LogEntry } from "../shared/types.js";

/** Read last N lines from a file without loading the entire file into memory */
async function tailFile(filePath: string, lines: number): Promise<string[]> {
	const CHUNK_SIZE = 64 * 1024; // 64KB
	const fh = await open(filePath, "r");
	try {
		const { size } = await fh.stat();
		if (size === 0) return [];
		const readSize = Math.min(size, CHUNK_SIZE);
		const buffer = Buffer.alloc(readSize);
		await fh.read(buffer, 0, readSize, size - readSize);
		const text = buffer.toString("utf-8");
		return text.split("\n").filter(Boolean).slice(-lines);
	} finally {
		await fh.close();
	}
}

type WsConnection = {
	send: (data: string) => void;
	close: () => void;
};

type ConnectionManager = {
	sendTo: (ws: WsConnection, msg: any) => void;
};

class LogManager {
	private subscriptions = new Map<WsConnection, Set<number>>();
	private bus: any = null;
	private connManager: ConnectionManager | null = null;

	start(connManager: ConnectionManager) {
		this.connManager = connManager;
		pm2Manager.launchBus((err, bus) => {
			if (err) {
				console.error("[pm2-boss] Failed to launch PM2 bus:", err.message);
				return;
			}
			this.bus = bus;

			bus.on("log:out", (packet: any) => {
				this.emitLog(packet, "stdout");
			});

			bus.on("log:err", (packet: any) => {
				this.emitLog(packet, "stderr");
			});
		});
	}

	stop() {
		if (this.bus) {
			this.bus.close?.();
			this.bus = null;
		}
		this.subscriptions.clear();
	}

	async subscribe(ws: WsConnection, pmId: number) {
		if (!this.subscriptions.has(ws)) {
			this.subscriptions.set(ws, new Set());
		}
		this.subscriptions.get(ws)!.add(pmId);

		// Send historical logs
		const history = await this.readHistoricalLogs(pmId);
		if (history.length > 0 && this.connManager) {
			this.connManager.sendTo(ws, {
				type: "logs:history",
				payload: { pm_id: pmId, lines: history },
			});
		}
	}

	unsubscribe(ws: WsConnection, pmId: number) {
		this.subscriptions.get(ws)?.delete(pmId);
	}

	unsubscribeAll(ws: WsConnection) {
		this.subscriptions.delete(ws);
	}

	private emitLog(packet: any, stream: "stdout" | "stderr") {
		const pmId = packet.process?.pm_id;
		if (pmId === undefined) return;

		const entry: LogEntry = {
			pm_id: pmId,
			process_name: packet.process?.name ?? "unknown",
			timestamp: new Date().toISOString(),
			message: typeof packet.data === "string" ? packet.data : String(packet.data),
			stream,
		};

		for (const [ws, pmIds] of this.subscriptions) {
			if (pmIds.has(pmId) && this.connManager) {
				this.connManager.sendTo(ws, { type: "logs:data", payload: entry });
			}
		}
	}

	private async readHistoricalLogs(pmId: number): Promise<LogEntry[]> {
		try {
			const detail = await pm2Manager.describe(pmId);
			if (!detail) return [];

			const lines: LogEntry[] = [];
			const processName = detail.name;

			for (const [path, stream] of [
				[detail.pm_out_log_path, "stdout"],
				[detail.pm_err_log_path, "stderr"],
			] as const) {
				if (!path) continue;
				try {
					const lastLines = await tailFile(path, 100);
					for (const line of lastLines) {
						lines.push({
							pm_id: pmId,
							process_name: processName,
							timestamp: new Date().toISOString(),
							message: line,
							stream,
						});
					}
				} catch {
					// Log file may not exist
				}
			}

			// Sort by position (stdout lines first, then stderr, preserving order)
			return lines.slice(-200);
		} catch {
			return [];
		}
	}
}

export const logManager = new LogManager();
