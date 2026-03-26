import type { TelegramConfig } from "./telegram/types.js";
import type { PM2Process, MemoryEvent } from "../shared/types.js";
import { connectionManager } from "./ws-handler.js";

type ProcessObserver = (processes: PM2Process[]) => void;
type MemoryEventObserver = (event: MemoryEvent) => void;

let currentProcessObserver: ProcessObserver | null = null;
let currentMemoryObserver: MemoryEventObserver | null = null;
let currentConfig: TelegramConfig = { botToken: "", chatIds: [], enabled: false };

/**
 * Start or restart the Telegram bot with a new config.
 * Stops the previous bot if running, then starts fresh.
 */
export async function applyTelegramConfig(config: TelegramConfig): Promise<void> {
	// Stop existing bot first
	await stopTelegram();

	currentConfig = config;

	if (!config.enabled || !config.botToken) {
		return;
	}

	try {
		const { startTelegramBot } = await import("./telegram/bot.js");
		const { onProcessUpdate, onMemoryEvent } = await startTelegramBot(config);

		// Store references so we can unregister on restart
		currentProcessObserver = onProcessUpdate;
		currentMemoryObserver = onMemoryEvent;

		connectionManager.onProcessUpdate(onProcessUpdate);
		connectionManager.onMemoryEvent(onMemoryEvent);
	} catch (err) {
		console.error("[pm2-boss] Failed to start Telegram bot:", err instanceof Error ? err.message : err);
	}
}

/** Stop the current bot and unregister observers */
export async function stopTelegram(): Promise<void> {
	// Unregister observers first
	if (currentProcessObserver) {
		connectionManager.removeProcessObserver(currentProcessObserver);
		currentProcessObserver = null;
	}
	if (currentMemoryObserver) {
		connectionManager.removeMemoryEventObserver(currentMemoryObserver);
		currentMemoryObserver = null;
	}

	try {
		const { stopTelegramBot } = await import("./telegram/bot.js");
		await stopTelegramBot();
	} catch {
		// Bot may not be running
	}
}

/** Get the current running config */
export function getCurrentTelegramConfig(): TelegramConfig {
	return currentConfig;
}
