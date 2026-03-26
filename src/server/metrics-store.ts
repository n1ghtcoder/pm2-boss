import { pm2Manager } from "./pm2-manager.js";

export interface MetricsPoint {
	cpu: number;
	memory: number;
	timestamp: number;
}

const RING_SIZE = 60; // 60 seconds of history

class MetricsStore {
	// pm_id -> ring buffer of metrics
	private buffers = new Map<number, MetricsPoint[]>();
	private collectInterval: ReturnType<typeof setInterval> | null = null;

	start() {
		if (this.collectInterval) return;
		this.collectInterval = setInterval(() => this.collect(), 1000);
	}

	stop() {
		if (this.collectInterval) {
			clearInterval(this.collectInterval);
			this.collectInterval = null;
		}
	}

	getHistory(pmId: number): MetricsPoint[] {
		return this.buffers.get(pmId) ?? [];
	}

	getAllHistory(): Record<number, MetricsPoint[]> {
		const result: Record<number, MetricsPoint[]> = {};
		for (const [pmId, buffer] of this.buffers) {
			result[pmId] = buffer;
		}
		return result;
	}

	private async collect() {
		try {
			const processes = await pm2Manager.list();
			const now = Date.now();
			const activeIds = new Set<number>();

			for (const proc of processes) {
				activeIds.add(proc.pm_id);
				let buffer = this.buffers.get(proc.pm_id);
				if (!buffer) {
					buffer = [];
					this.buffers.set(proc.pm_id, buffer);
				}
				buffer.push({ cpu: proc.cpu, memory: proc.memory, timestamp: now });
				if (buffer.length > RING_SIZE) {
					buffer.splice(0, buffer.length - RING_SIZE);
				}
			}

			// Clean up buffers for deleted processes
			for (const pmId of this.buffers.keys()) {
				if (!activeIds.has(pmId)) {
					this.buffers.delete(pmId);
				}
			}
		} catch {
			// PM2 may be disconnected
		}
	}
}

export const metricsStore = new MetricsStore();
