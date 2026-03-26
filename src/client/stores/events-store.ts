import { create } from "zustand";
import { apiFetch } from "../lib/api-client";

interface EventsState {
	/** Memory event counts per process (last 24h) */
	counts: Record<number, number>;
	fetchCounts: () => void;
	incrementCount: (pmId: number) => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
	counts: {},
	fetchCounts: () => {
		apiFetch<Record<number, number>>("/api/events/counts").then((res) => {
			if (res.data) set({ counts: res.data });
		});
	},
	incrementCount: (pmId: number) => {
		const counts = { ...get().counts };
		counts[pmId] = (counts[pmId] ?? 0) + 1;
		set({ counts });
	},
}));
