import { create } from "zustand";
import type { LogEntry } from "@shared/types";

interface LogState {
	logs: Map<number, LogEntry[]>;
	addLog: (entry: LogEntry) => void;
	setHistory: (pmId: number, lines: LogEntry[]) => void;
	clearLogs: (pmId: number) => void;
}

const MAX_LOGS = 2000;

export const useLogStore = create<LogState>()((set) => ({
	logs: new Map(),
	addLog: (entry) =>
		set((state) => {
			const newMap = new Map(state.logs);
			const existing = newMap.get(entry.pm_id) ?? [];
			const updated = [...existing, entry];
			newMap.set(entry.pm_id, updated.length > MAX_LOGS ? updated.slice(-MAX_LOGS) : updated);
			return { logs: newMap };
		}),
	setHistory: (pmId, lines) =>
		set((state) => {
			const newMap = new Map(state.logs);
			newMap.set(pmId, lines);
			return { logs: newMap };
		}),
	clearLogs: (pmId) =>
		set((state) => {
			const newMap = new Map(state.logs);
			newMap.set(pmId, []);
			return { logs: newMap };
		}),
}));
