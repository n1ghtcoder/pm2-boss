import { Hono } from "hono";
import { loadSettings, saveSettings } from "../settings-store.js";
import { queryEvents, getRecentEventCounts } from "../events-store.js";
import { applyTelegramConfig, getCurrentTelegramConfig } from "../telegram-manager.js";
import type { ApiResponse, AppSettings } from "../../shared/types.js";

export function createSettingsRoutes() {
	const app = new Hono();

	app.get("/settings", (c) => {
		const settings = loadSettings();
		// Mask the bot token for security — only show last 4 chars
		const masked: AppSettings = {
			...settings,
			telegramBotToken: settings.telegramBotToken ? `${"*".repeat(Math.max(0, settings.telegramBotToken.length - 4))}${settings.telegramBotToken.slice(-4)}` : "",
		};
		return c.json<ApiResponse>({ data: masked, error: null, timestamp: Date.now() });
	});

	app.put("/settings", async (c) => {
		try {
			const body = await c.req.json<Partial<AppSettings>>();

			// Validate memory limit
			if (body.defaultMaxMemoryMB !== undefined) {
				if (typeof body.defaultMaxMemoryMB !== "number" || body.defaultMaxMemoryMB < 0 || body.defaultMaxMemoryMB > 1048576) {
					return c.json<ApiResponse>({ data: null, error: "defaultMaxMemoryMB must be 0–1048576", timestamp: Date.now() }, 400);
				}
			}

			// Validate telegram fields
			if (body.telegramBotToken !== undefined && typeof body.telegramBotToken !== "string") {
				return c.json<ApiResponse>({ data: null, error: "telegramBotToken must be a string", timestamp: Date.now() }, 400);
			}
			if (body.telegramChatIds !== undefined) {
				if (!Array.isArray(body.telegramChatIds) || !body.telegramChatIds.every((id) => typeof id === "string")) {
					return c.json<ApiResponse>({ data: null, error: "telegramChatIds must be an array of strings", timestamp: Date.now() }, 400);
				}
			}

			// If token is masked (unchanged), don't overwrite the real one
			const current = loadSettings();
			if (body.telegramBotToken && /^\*+.{4}$/.test(body.telegramBotToken)) {
				body.telegramBotToken = current.telegramBotToken;
			}

			const updated = saveSettings(body);

			// Hot-restart telegram bot if config changed
			const tokenChanged = updated.telegramBotToken !== current.telegramBotToken;
			const chatIdsChanged = JSON.stringify(updated.telegramChatIds) !== JSON.stringify(current.telegramChatIds);
			if (tokenChanged || chatIdsChanged) {
				const newEnabled = updated.telegramBotToken.length > 0;
				await applyTelegramConfig({
					botToken: updated.telegramBotToken,
					chatIds: updated.telegramChatIds,
					enabled: newEnabled,
				});
			}

			// Return masked version
			const masked: AppSettings = {
				...updated,
				telegramBotToken: updated.telegramBotToken ? `${"*".repeat(Math.max(0, updated.telegramBotToken.length - 4))}${updated.telegramBotToken.slice(-4)}` : "",
			};
			return c.json<ApiResponse>({ data: masked, error: null, timestamp: Date.now() });
		} catch (err) {
			return c.json<ApiResponse>({ data: null, error: (err as Error).message, timestamp: Date.now() }, 500);
		}
	});

	// Telegram connection status
	app.get("/telegram/status", (c) => {
		const config = getCurrentTelegramConfig();
		return c.json<ApiResponse>({
			data: { connected: config.enabled && config.botToken.length > 0, chatIds: config.chatIds },
			error: null,
			timestamp: Date.now(),
		});
	});

	// Memory events
	app.get("/events", (c) => {
		const pmId = c.req.query("pmId");
		if (pmId !== undefined && Number.isNaN(Number.parseInt(pmId, 10))) {
			return c.json<ApiResponse>({ data: null, error: "Invalid pmId", timestamp: Date.now() }, 400);
		}
		const events = queryEvents(pmId ? Number.parseInt(pmId, 10) : undefined);
		return c.json<ApiResponse>({ data: events, error: null, timestamp: Date.now() });
	});

	// Event counts for badges (last 24h)
	app.get("/events/counts", (c) => {
		const counts = getRecentEventCounts(24);
		return c.json<ApiResponse>({ data: counts, error: null, timestamp: Date.now() });
	});

	return app;
}
