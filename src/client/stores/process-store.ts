import { create } from "zustand";
import type { PM2Process } from "@shared/types";

interface ProcessState {
	processes: PM2Process[];
	setProcesses: (processes: PM2Process[]) => void;

	// Derived
	totalCpu: number;
	totalMemory: number;
	onlineCount: number;
	stoppedCount: number;
	erroredCount: number;
}

export const useProcessStore = create<ProcessState>()((set) => ({
	processes: [],
	totalCpu: 0,
	totalMemory: 0,
	onlineCount: 0,
	stoppedCount: 0,
	erroredCount: 0,
	setProcesses: (processes) =>
		set({
			processes,
			totalCpu: processes.reduce((sum, p) => sum + p.cpu, 0),
			totalMemory: processes.reduce((sum, p) => sum + p.memory, 0),
			onlineCount: processes.filter((p) => p.status === "online").length,
			stoppedCount: processes.filter((p) => p.status === "stopped").length,
			erroredCount: processes.filter((p) => p.status === "errored").length,
		}),
}));
