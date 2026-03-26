import { create } from "zustand";

export interface ConsoleMessage {
	id: string;
	pm_id: number;
	direction: "sent" | "received";
	data: unknown;
	timestamp: string;
}

interface ConsoleStore {
	messages: Map<number, ConsoleMessage[]>;
	addMessage: (pmId: number, msg: ConsoleMessage) => void;
	clearMessages: (pmId: number) => void;
}

let msgCounter = 0;

export function createConsoleMessage(
	pmId: number,
	direction: "sent" | "received",
	data: unknown,
): ConsoleMessage {
	return {
		id: `${Date.now()}-${++msgCounter}`,
		pm_id: pmId,
		direction,
		data,
		timestamp: new Date().toISOString(),
	};
}

export const useConsoleStore = create<ConsoleStore>((set) => ({
	messages: new Map(),

	addMessage: (pmId, msg) =>
		set((state) => {
			const newMap = new Map(state.messages);
			const existing = newMap.get(pmId) ?? [];
			// Keep last 500 messages per process
			const updated = [...existing, msg].slice(-500);
			newMap.set(pmId, updated);
			return { messages: newMap };
		}),

	clearMessages: (pmId) =>
		set((state) => {
			const newMap = new Map(state.messages);
			newMap.delete(pmId);
			return { messages: newMap };
		}),
}));
