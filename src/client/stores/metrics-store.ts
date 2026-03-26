import { create } from "zustand";
import type { MetricsPoint, SystemMetrics } from "@shared/types";

interface MetricsState {
	history: Record<number, MetricsPoint[]>;
	system: SystemMetrics | null;
	setHistory: (history: Record<number, MetricsPoint[]>) => void;
	setSystem: (system: SystemMetrics) => void;
}

export const useMetricsStore = create<MetricsState>()((set) => ({
	history: {},
	system: null,
	setHistory: (history) => set({ history }),
	setSystem: (system) => set({ system }),
}));
