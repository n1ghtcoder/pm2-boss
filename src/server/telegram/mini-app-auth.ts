import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import type { ApiResponse } from "../../shared/types.js";
import { createSession, type AuthUser } from "../auth.js";

/**
 * Validate Telegram Mini App initData.
 *
 * Algorithm (per Telegram docs):
 * 1. Parse initData as URLSearchParams
 * 2. Extract `hash` param, remove it from params
 * 3. Sort remaining params alphabetically
 * 4. Join as "key=value\n" (data-check-string)
 * 5. secret_key = HMAC-SHA256("WebAppData", bot_token)
 * 6. computed_hash = HMAC-SHA256(secret_key, data_check_string)
 * 7. Compare computed_hash with received hash
 */
export function validateInitData(
	initData: string,
	botToken: string,
): { userId: number; username: string; firstName: string } | null {
	try {
		const params = new URLSearchParams(initData);
		const hash = params.get("hash");
		if (!hash) return null;

		// Remove hash from params for verification
		params.delete("hash");

		// Sort and build data-check-string
		const entries = Array.from(params.entries());
		entries.sort(([a], [b]) => a.localeCompare(b));
		const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

		// HMAC-SHA256 validation
		const secretKey = createHmac("sha256", "WebAppData")
			.update(botToken)
			.digest();
		const computedHash = createHmac("sha256", secretKey)
			.update(dataCheckString)
			.digest("hex");

		if (!timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(hash, "hex"))) return null;

		// Check auth_date is not too old (allow 24h)
		const authDate = Number(params.get("auth_date"));
		if (authDate && Date.now() / 1000 - authDate > 86400) return null;

		// Extract user data
		const userStr = params.get("user");
		if (!userStr) return null;

		const user = JSON.parse(userStr);
		return {
			userId: user.id,
			username: user.username || user.first_name || `tg_${user.id}`,
			firstName: user.first_name || "User",
		};
	} catch {
		return null;
	}
}

/**
 * Create routes for Telegram Mini App authentication.
 */
export function createTelegramAuthRoutes(botToken: string) {
	const app = new Hono();

	// POST /telegram/auth — validate initData, return session token
	app.post("/auth", async (c) => {
		let body: { initData?: string };
		try {
			body = await c.req.json();
		} catch {
			return c.json<ApiResponse>(
				{ data: null, error: "Invalid JSON body", timestamp: Date.now() },
				400,
			);
		}

		const { initData } = body;
		if (!initData) {
			return c.json<ApiResponse>(
				{ data: null, error: "initData is required", timestamp: Date.now() },
				400,
			);
		}

		const user = validateInitData(initData, botToken);
		if (!user) {
			return c.json<ApiResponse>(
				{ data: null, error: "Invalid Telegram credentials", timestamp: Date.now() },
				401,
			);
		}

		const authUser: AuthUser = {
			username: user.username,
			type: "token", // Telegram users are treated as token-based auth
		};

		const token = createSession(authUser);
		return c.json<ApiResponse>({
			data: {
				token,
				username: user.username,
				firstName: user.firstName,
				telegramId: user.userId,
			},
			error: null,
			timestamp: Date.now(),
		});
	});

	return app;
}
