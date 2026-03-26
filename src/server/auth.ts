import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";

// ── Auth Types ──────────────────────────────────────────────────────

export interface AuthConfig {
	tokens: string[];
	users: Array<{ username: string; password: string }>;
	enabled: boolean;
}

export interface AuthUser {
	username: string;
	type: "token" | "user";
}

// ── Session Store (in-memory) ───────────────────────────────────────

const sessions = new Map<string, { user: AuthUser; expiresAt: number }>();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function createSession(user: AuthUser): string {
	const token = randomBytes(32).toString("hex");
	sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL });
	return token;
}

export function validateSession(token: string): AuthUser | null {
	const session = sessions.get(token);
	if (!session) return null;
	if (Date.now() > session.expiresAt) {
		sessions.delete(token);
		return null;
	}
	return session.user;
}

export function revokeSession(token: string): void {
	sessions.delete(token);
}

// Periodic cleanup of expired sessions (every 10 minutes)
setInterval(() => {
	const now = Date.now();
	for (const [token, session] of sessions) {
		if (now > session.expiresAt) sessions.delete(token);
	}
}, 10 * 60 * 1000).unref();

// ── Credential Validation ───────────────────────────────────────────

function safeEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

export function validateApiToken(token: string, config: AuthConfig): boolean {
	return config.tokens.some((t) => safeEqual(token, t));
}

export function validateCredentials(
	username: string,
	password: string,
	config: AuthConfig,
): AuthUser | null {
	const user = config.users.find(
		(u) => safeEqual(username, u.username) && safeEqual(password, u.password),
	);
	if (!user) return null;
	return { username: user.username, type: "user" };
}

// ── Resolve bearer token or session ─────────────────────────────────

function resolveAuth(
	bearerToken: string | null,
	cookieToken: string | null,
	config: AuthConfig,
): AuthUser | null {
	// Check bearer token first
	if (bearerToken) {
		if (validateApiToken(bearerToken, config)) {
			return { username: "api", type: "token" };
		}
		const sessionUser = validateSession(bearerToken);
		if (sessionUser) return sessionUser;
	}

	// Fall back to cookie
	if (cookieToken) {
		const sessionUser = validateSession(cookieToken);
		if (sessionUser) return sessionUser;
	}

	return null;
}

// ── Hono Middleware — API routes ─────────────────────────────────────

const PUBLIC_PATHS = new Set(["/api/health", "/api/auth/login", "/api/auth/status", "/api/telegram/auth"]);

export function createAuthMiddleware(config: AuthConfig) {
	return async (c: Context, next: Next) => {
		if (!config.enabled) return next();

		const path = c.req.path;

		// Public endpoints
		if (PUBLIC_PATHS.has(path)) return next();

		// Static files — always serve (SPA needs to load for login page)
		if (!path.startsWith("/api/") && path !== "/ws") return next();

		// Resolve auth
		const authHeader = c.req.header("Authorization");
		const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
		const cookieToken = getCookie(c, "pm2boss_session") ?? null;

		const user = resolveAuth(bearerToken, cookieToken, config);
		if (user) {
			c.set("user", user);
			return next();
		}

		return c.json(
			{ data: null, error: "Unauthorized", timestamp: Date.now() },
			401,
		);
	};
}

// ── Hono Middleware — WebSocket upgrade ──────────────────────────────

export function createWsAuthMiddleware(config: AuthConfig) {
	return async (c: Context, next: Next) => {
		if (!config.enabled) return next();

		// WS clients can send token via query param (browser WS API has no custom headers)
		const queryToken = c.req.query("token") ?? null;
		const authHeader = c.req.header("Authorization");
		const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
		const cookieToken = getCookie(c, "pm2boss_session") ?? null;

		const user = resolveAuth(queryToken ?? bearerToken, cookieToken, config);
		if (user) {
			c.set("user", user);
			return next();
		}

		return c.json(
			{ data: null, error: "Unauthorized", timestamp: Date.now() },
			401,
		);
	};
}
