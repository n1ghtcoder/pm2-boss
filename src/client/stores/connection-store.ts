import { create } from "zustand";

type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface ConnectionState {
	status: ConnectionStatus;
	pm2Connected: boolean;
	pm2Error: string | null;
	setStatus: (status: ConnectionStatus) => void;
	setPm2Status: (connected: boolean, error?: string) => void;
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
	status: "connecting",
	pm2Connected: true,
	pm2Error: null,
	setStatus: (status) => set({ status }),
	setPm2Status: (connected, error) => set({ pm2Connected: connected, pm2Error: error ?? null }),
}));
