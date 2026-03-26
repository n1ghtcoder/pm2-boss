import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { pm2Manager } from "./pm2-manager.js";
import { createProcessRoutes } from "./routes/processes.js";
import { createGroupRoutes } from "./groups.js";
import { createSettingsRoutes } from "./routes/settings.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createWsHandler, connectionManager } from "./ws-handler.js";
import { type AuthConfig, createAuthMiddleware, createWsAuthMiddleware } from "./auth.js";
import type { TelegramConfig } from "./telegram/types.js";
import type { ApiResponse } from "../shared/types.js";

const DEFAULT_AUTH: AuthConfig = { tokens: [], users: [], enabled: false };
const DEFAULT_TELEGRAM: TelegramConfig = { botToken: "", chatIds: [], enabled: false };

export async function createApp(
	authConfig: AuthConfig = DEFAULT_AUTH,
	telegramConfig: TelegramConfig = DEFAULT_TELEGRAM,
) {
	const app = new Hono();
	const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

	app.use("*", logger());

	// Auth middleware — applied to /api/* (skips public paths internally)
	app.use("/api/*", createAuthMiddleware(authConfig));

	// Auth routes (login/status are public, me/logout require auth)
	const authRoutes = createAuthRoutes(authConfig);
	app.route("/api/auth", authRoutes);

	// Telegram Mini App auth route (public — exempted inside middleware)
	if (telegramConfig.enabled) {
		const { createTelegramAuthRoutes } = await import("./telegram/mini-app-auth.js");
		const tgAuthRoutes = createTelegramAuthRoutes(telegramConfig.botToken);
		app.route("/api/telegram", tgAuthRoutes);
	}

	// Health check (public — exempted inside middleware)
	app.get("/api/health", (c) => {
		const status = pm2Manager.isConnected();
		return c.json<ApiResponse>({
			data: { connected: status, pm2Version: process.env.PM2_VERSION ?? "unknown" },
			error: status ? null : "PM2 daemon not connected",
			timestamp: Date.now(),
		});
	});

	// API routes
	const processRoutes = createProcessRoutes();
	app.route("/api", processRoutes);

	const groupRoutes = createGroupRoutes();
	app.route("/api", groupRoutes);

	const settingsRoutes = createSettingsRoutes();
	app.route("/api", settingsRoutes);

	// WebSocket with auth
	const wsHandler = createWsHandler();
	app.get("/ws", createWsAuthMiddleware(authConfig), upgradeWebSocket(() => wsHandler));

	// Static files (production) — always served, SPA needs to load for login page
	app.use("/*", serveStatic({ root: "./dist/client" }));
	app.get("/*", serveStatic({ root: "./dist/client", path: "index.html" }));

	return { app, injectWebSocket, wsHandler };
}

export async function startServer(
	port: number,
	authConfig: AuthConfig = DEFAULT_AUTH,
	telegramConfig: TelegramConfig = DEFAULT_TELEGRAM,
) {
	// Connect to PM2 first
	const pm2Connected = await pm2Manager.connect();
	if (!pm2Connected) {
		console.error("\x1b[31m[pm2-boss] Failed to connect to PM2 daemon.\x1b[0m");
		console.error("\x1b[33mMake sure PM2 is installed and running: pm2 start <app>\x1b[0m");
	}

	const { app, injectWebSocket, wsHandler } = await createApp(authConfig, telegramConfig);

	const server = serve({ fetch: app.fetch, port }, (info) => {
		console.log(`\n\x1b[32m  pm2-boss\x1b[0m running at \x1b[36mhttp://localhost:${info.port}\x1b[0m`);
		if (authConfig.enabled) {
			const parts: string[] = [];
			if (authConfig.tokens.length > 0) parts.push(`${authConfig.tokens.length} token(s)`);
			if (authConfig.users.length > 0) parts.push(`${authConfig.users.length} user(s)`);
			console.log(`  \x1b[33m🔒 Auth enabled\x1b[0m: ${parts.join(", ")}`);
		}
		console.log();
	});

	injectWebSocket(server);

	// Start broadcasting process list
	wsHandler.startBroadcasting();

	// Start Telegram bot — merge CLI flags with saved settings
	const { applyTelegramConfig, stopTelegram } = await import("./telegram-manager.js");
	if (telegramConfig.enabled) {
		// CLI flags take priority
		await applyTelegramConfig(telegramConfig);
	} else {
		// Check if settings file has telegram config
		const { loadSettings } = await import("./settings-store.js");
		const settings = loadSettings();
		if (settings.telegramBotToken) {
			await applyTelegramConfig({
				botToken: settings.telegramBotToken,
				chatIds: settings.telegramChatIds,
				enabled: true,
			});
		}
	}

	// Graceful shutdown
	const shutdown = async () => {
		console.log("\n\x1b[33m[pm2-boss] Shutting down...\x1b[0m");
		wsHandler.stopBroadcasting();
		await stopTelegram();
		await pm2Manager.disconnect();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	return server;
}
