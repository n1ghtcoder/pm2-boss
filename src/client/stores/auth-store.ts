import { create } from "zustand";
import {
	apiFetch,
	setToken,
	clearToken,
	getToken,
	setUnauthorizedHandler,
} from "../lib/api-client";
import { isTelegramWebApp, getInitData } from "../lib/telegram";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "disabled";

interface AuthState {
	status: AuthStatus;
	username: string | null;
	authEnabled: boolean;
	checkAuth: () => Promise<void>;
	login: (username: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	handleUnauthorized: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
	status: "loading",
	username: null,
	authEnabled: true,

	checkAuth: async () => {
		try {
			// Check if auth is enabled (public endpoint, no auth needed)
			const statusRes = await fetch("/api/auth/status");
			const statusJson = await statusRes.json();

			if (!statusJson.data?.authEnabled) {
				set({ status: "disabled", authEnabled: false, username: "anonymous" });
				return;
			}

			set({ authEnabled: true });

			// Telegram Mini App: authenticate via initData
			if (isTelegramWebApp() && !getToken()) {
				const initData = getInitData();
				if (initData) {
					try {
						const tgRes = await apiFetch<{ token: string; username: string }>(
							"/api/telegram/auth",
							{
								method: "POST",
								body: JSON.stringify({ initData }),
							},
						);
						if (tgRes.data?.token) {
							setToken(tgRes.data.token);
							set({ status: "authenticated", username: tgRes.data.username });
							return;
						}
					} catch {
						// Telegram auth failed — fall through to regular auth
					}
				}
			}

			// If we have a saved token, validate it
			if (getToken()) {
				try {
					const meRes = await apiFetch<{ username: string }>("/api/auth/me");
					set({
						status: "authenticated",
						username: meRes.data?.username ?? null,
					});
					return;
				} catch {
					clearToken();
				}
			}

			set({ status: "unauthenticated", username: null });
		} catch {
			// Server unreachable or no auth endpoints — assume disabled
			set({ status: "disabled", authEnabled: false, username: "anonymous" });
		}
	},

	login: async (username: string, password: string) => {
		const res = await apiFetch<{ token: string; username: string }>(
			"/api/auth/login",
			{
				method: "POST",
				body: JSON.stringify({ username, password }),
			},
		);
		if (res.data?.token) {
			setToken(res.data.token);
			set({ status: "authenticated", username: res.data.username });
		}
	},

	logout: async () => {
		try {
			await apiFetch("/api/auth/logout", { method: "POST" });
		} catch {
			// Best-effort
		}
		clearToken();
		set({ status: "unauthenticated", username: null });
	},

	handleUnauthorized: () => {
		clearToken();
		set({ status: "unauthenticated", username: null });
	},
}));

// Wire up the 401 handler so apiFetch can trigger login page
setUnauthorizedHandler(() => {
	useAuthStore.getState().handleUnauthorized();
});
