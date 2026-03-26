import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import type { ApiResponse } from "../../shared/types.js";
import {
	type AuthConfig,
	type AuthUser,
	validateCredentials,
	validateApiToken,
	createSession,
	revokeSession,
} from "../auth.js";

export function createAuthRoutes(config: AuthConfig) {
	const app = new Hono();

	// GET /auth/status — public, tells client if auth is required
	app.get("/status", (c) => {
		return c.json<ApiResponse>({
			data: {
				authEnabled: config.enabled,
				hasUsers: config.users.length > 0,
				hasToken: config.tokens.length > 0,
			},
			error: null,
			timestamp: Date.now(),
		});
	});

	// POST /auth/login — public, authenticates user or API token
	app.post("/login", async (c) => {
		if (!config.enabled) {
			return c.json<ApiResponse>({
				data: { token: null, username: "anonymous" },
				error: null,
				timestamp: Date.now(),
			});
		}

		let body: { username?: string; password?: string };
		try {
			body = await c.req.json();
		} catch {
			return c.json<ApiResponse>(
				{ data: null, error: "Invalid JSON body", timestamp: Date.now() },
				400,
			);
		}

		const username = typeof body.username === "string" ? body.username.trim() : "";
		const password = typeof body.password === "string" ? body.password.trim() : "";
		if (!username || !password) {
			return c.json<ApiResponse>(
				{ data: null, error: "Username and password required", timestamp: Date.now() },
				400,
			);
		}

		// Try user/password credentials first
		const user = validateCredentials(username, password, config);
		if (user) {
			const token = createSession(user);
			setCookie(c, "pm2boss_session", token, {
				httpOnly: true,
				sameSite: "Lax",
				path: "/",
				maxAge: 86400,
			});
			return c.json<ApiResponse>({
				data: { token, username: user.username },
				error: null,
				timestamp: Date.now(),
			});
		}

		// Also allow logging in with a static API token in the password field
		if (validateApiToken(password, config)) {
			const tokenUser: AuthUser = { username: username || "api", type: "token" };
			const token = createSession(tokenUser);
			setCookie(c, "pm2boss_session", token, {
				httpOnly: true,
				sameSite: "Lax",
				path: "/",
				maxAge: 86400,
			});
			return c.json<ApiResponse>({
				data: { token, username: tokenUser.username },
				error: null,
				timestamp: Date.now(),
			});
		}

		return c.json<ApiResponse>(
			{ data: null, error: "Invalid credentials", timestamp: Date.now() },
			401,
		);
	});

	// POST /auth/logout — revoke session
	app.post("/logout", (c) => {
		const cookieToken = getCookie(c, "pm2boss_session");
		const authHeader = c.req.header("Authorization");
		const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
		const token = bearerToken ?? cookieToken;

		if (token) revokeSession(token);

		deleteCookie(c, "pm2boss_session", { path: "/" });
		return c.json<ApiResponse>({
			data: { success: true },
			error: null,
			timestamp: Date.now(),
		});
	});

	// GET /auth/me — returns current authenticated user info
	app.get("/me", (c) => {
		if (!config.enabled) {
			return c.json<ApiResponse>({
				data: { username: "anonymous", type: "none", authEnabled: false },
				error: null,
				timestamp: Date.now(),
			});
		}

		// User is set by auth middleware via c.set("user", …)
		const user = c.get("user" as never) as AuthUser | undefined;
		if (!user) {
			return c.json<ApiResponse>(
				{ data: null, error: "Unauthorized", timestamp: Date.now() },
				401,
			);
		}

		return c.json<ApiResponse>({
			data: { username: user.username, type: user.type, authEnabled: true },
			error: null,
			timestamp: Date.now(),
		});
	});

	return app;
}
