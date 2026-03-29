import { Bot } from "grammy";
import { pm2Manager } from "../pm2-manager.js";
import type { TelegramConfig } from "./types.js";
import { registerCommands } from "./commands.js";
import { createAlertSystem } from "./alerts.js";
import type { PM2Process } from "../../shared/types.js";

let bot: Bot | null = null;
let alertSystem: ReturnType<typeof createAlertSystem> | null = null;

/**
 * Start the Telegram bot with long polling.
 * Returns an onProcessUpdate callback for the alert system.
 */
export async function startTelegramBot(
	config: TelegramConfig,
): Promise<{ onProcessUpdate: (processes: PM2Process[]) => void; onMemoryEvent: (event: import("../../shared/types.js").MemoryEvent) => void }> {
	bot = new Bot(config.botToken);

	// Register commands
	registerCommands(bot, config);

	// Create alert system
	alertSystem = createAlertSystem(bot, config);

	// Handle logs_alert callback (from alert inline buttons)
	bot.on("callback_query:data", async (ctx) => {
		const data = ctx.callbackQuery.data;
		if (!data.startsWith("logs_alert:")) return;

		const pmId = Number(data.slice("logs_alert:".length));
		if (Number.isNaN(pmId)) {
			await ctx.answerCallbackQuery({ text: "Invalid process ID" });
			return;
		}

		try {
			const { open: fsOpen } = await import("node:fs/promises");
			const detail = await pm2Manager.describe(pmId);
			if (!detail) {
				await ctx.answerCallbackQuery({ text: "Process not found" });
				return;
			}

			let logLines: string[] = [];
			for (const path of [detail.pm_err_log_path, detail.pm_out_log_path]) {
				if (!path) continue;
				try {
					const fh = await fsOpen(path, "r");
					try {
						const { size } = await fh.stat();
						if (size > 0) {
							const readSize = Math.min(size, 64 * 1024);
							const buffer = Buffer.alloc(readSize);
							await fh.read(buffer, 0, readSize, size - readSize);
							logLines.push(...buffer.toString("utf-8").split("\n").filter(Boolean).slice(-10));
						}
					} finally {
						await fh.close();
					}
				} catch {
					// File may not exist
				}
			}

			const logText = logLines.slice(-15).join("\n").slice(0, 3800) || "No logs available";
			const escaped = logText.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
			await ctx.reply(`📋 *Recent logs:*\n\n\`\`\`\n${escaped}\n\`\`\``, {
				parse_mode: "MarkdownV2",
			});
			await ctx.answerCallbackQuery();
		} catch {
			await ctx.answerCallbackQuery({ text: "Failed to read logs" });
		}
	});

	// Initialize alert snapshot with current process list
	try {
		const processes = await pm2Manager.list();
		alertSystem.initSnapshot(processes);
	} catch {
		// PM2 may not be ready yet
	}

	// Set bot commands menu
	await bot.api.setMyCommands([
		{ command: "status", description: "Show all processes" },
		{ command: "open", description: "Open door" },
		{ command: "restart", description: "Restart a process" },
		{ command: "stop", description: "Stop a process" },
		{ command: "logs", description: "Show recent logs" },
		{ command: "faq", description: "Setup tips & Mini App" },
		{ command: "help", description: "Show all commands" },
	]).catch(() => {
		// Non-critical
	});

	// Start long polling (non-blocking)
	bot.start({
		onStart: () => {
			console.log("[pm2-boss] 🤖 Telegram bot started (long polling)");
			if (config.chatIds.length > 0) {
				console.log(`[pm2-boss]    Alert targets: ${config.chatIds.join(", ")}`);
			}
		},
	});

	return {
		onProcessUpdate: (processes: PM2Process[]) => alertSystem?.onProcessUpdate(processes),
		onMemoryEvent: (event: import("../../shared/types.js").MemoryEvent) => alertSystem?.onMemoryEvent(event),
	};
}

export async function stopTelegramBot() {
	if (bot) {
		await bot.stop();
		bot = null;
		alertSystem = null;
		console.log("[pm2-boss] Telegram bot stopped");
	}
}
