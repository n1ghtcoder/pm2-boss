const TOKEN_KEY = "pm2boss_token";

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
	onUnauthorized = handler;
}

export function getToken(): string | null {
	return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
	localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
	localStorage.removeItem(TOKEN_KEY);
}

/**
 * Fetch wrapper that injects auth headers, parses ApiResponse, and handles 401.
 * Drop-in replacement for inline fetch() + json() + error check pattern.
 */
export async function apiFetch<T = unknown>(
	url: string,
	options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; timestamp: number }> {
	const token = getToken();
	const headers = new Headers(options.headers);

	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}

	if (options.body && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	const res = await fetch(url, { ...options, headers });

	if (res.status === 401) {
		clearToken();
		onUnauthorized?.();
		throw new Error("Unauthorized");
	}

	const json = await res.json();
	if (json.error) throw new Error(json.error);
	return json;
}

/**
 * Build WebSocket URL with auth token in query param.
 */
export function getWsUrl(): string {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const base = `${protocol}//${window.location.host}/ws`;
	const token = getToken();
	return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
