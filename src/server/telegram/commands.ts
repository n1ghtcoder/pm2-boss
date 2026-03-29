import { open as fsOpen } from "node:fs/promises";
import type { Bot, Context } from "grammy";

/** Read last N lines from a file without loading it entirely into memory */
async function tailLines(filePath: string, n: number): Promise<string[]> {
	const CHUNK_SIZE = 64 * 1024;
	const fh = await fsOpen(filePath, "r");
	try {
		const { size } = await fh.stat();
		if (size === 0) return [];
		const readSize = Math.min(size, CHUNK_SIZE);
		const buffer = Buffer.alloc(readSize);
		await fh.read(buffer, 0, readSize, size - readSize);
		return buffer.toString("utf-8").split("\n").filter(Boolean).slice(-n);
	} finally {
		await fh.close();
	}
}
import { pm2Manager } from "../pm2-manager.js";
import type { TelegramConfig } from "./types.js";

function esc(text: string): string {
	return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function statusEmoji(status: string): string {
	switch (status) {
		case "online":
			return "🟢";
		case "stopped":
		case "stopping":
			return "🔴";
		case "errored":
			return "🟡";
		default:
			return "⚪";
	}
}

function fmtBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`;
}

export function registerCommands(bot: Bot, config: TelegramConfig) {
	const allowedChats = new Set(config.chatIds);

	function isAllowed(ctx: Context): boolean {
		const chatId = ctx.chat?.id?.toString();
		if (!chatId) return false;
		if (allowedChats.size === 0) return true;
		return allowedChats.has(chatId);
	}

	/** Resolve target: number → pm_id, string → name lookup */
	async function resolveTarget(target: string): Promise<number | string> {
		const num = Number(target);
		return Number.isNaN(num) ? target : num;
	}

	// /start
	bot.command("start", async (ctx) => {
		if (!isAllowed(ctx)) return;
		await ctx.reply(
			"⚡ *pm2\\-boss* — PM2 Process Manager\n\n" +
				"/status — Process list\n" +
				"/restart `name` — Restart process\n" +
				"/stop `name` — Stop process\n" +
				"/logs `name` — Recent logs\n" +
				"/faq — Setup tips \\& Mini App\n" +
				"/help — All commands",
			{ parse_mode: "MarkdownV2" },
		);
	});

	// /help
	bot.command("help", async (ctx) => {
		if (!isAllowed(ctx)) return;
		await ctx.reply(
			"⚡ *pm2\\-boss Commands*\n\n" +
				"/status — Show all processes\n" +
				"/restart `name|id` — Restart a process\n" +
				"/stop `name|id` — Stop a process\n" +
				"/logs `name|id` — Last 20 log lines\n" +
				"/faq — Setup tips \\& Mini App\n" +
				"/help — This message",
			{ parse_mode: "MarkdownV2" },
		);
	});

	// /faq
	bot.command("faq", async (ctx) => {
		if (!isAllowed(ctx)) return;
		await ctx.reply(
			"📖 *pm2\\-boss FAQ*\n\n" +
				"*🔹 Mini App \\(full dashboard in Telegram\\):*\n" +
				"1\\. Open @BotFather → /mybots → select this bot\n" +
				"2\\. Bot Settings → Menu Button\n" +
				"3\\. Set URL to your pm2\\-boss address\n" +
				"   \\(e\\.g\\. `https://pm2\\.example\\.com`\\)\n" +
				"4\\. A ☰ button appears — full dashboard inside Telegram\\!\n\n" +
				"*🔹 Alerts:*\n" +
				"The bot automatically notifies you when:\n" +
				"• A process crashes or enters a restart loop\n" +
				"• A process exceeds its memory limit\n" +
				"Configure limits in the web dashboard → Settings\\.\n\n" +
				"*🔹 Multiple servers:*\n" +
				"Create a separate bot for each server via @BotFather\\.\n" +
				"Group them in a Telegram folder for easy access\\.\n\n" +
				"*🔹 Chat ID:*\n" +
				"Send /start to @userinfobot or @RawDataBot to get your chat ID\\.\n" +
				"For group chats — add the bot to the group and use the group chat ID\\.",
			{ parse_mode: "MarkdownV2" },
		);
	});

	// /status
	bot.command("status", async (ctx) => {
		if (!isAllowed(ctx)) return;
		try {
			// First call warms up pidusage (returns 0 CPU), second gets real metrics
			await pm2Manager.list();
			await new Promise((r) => setTimeout(r, 500));
			const processes = await pm2Manager.list();
			if (processes.length === 0) {
				await ctx.reply("No PM2 processes found\\.", { parse_mode: "MarkdownV2" });
				return;
			}

			const online = processes.filter((p) => p.status === "online").length;
			let totalCpu = 0;
			let totalMem = 0;

			const lines = processes.map((p) => {
				totalCpu += p.cpu;
				totalMem += p.memory;
				return `${statusEmoji(p.status)} \`${esc(p.name)}\`  CPU ${esc(p.cpu.toFixed(1))}%  MEM ${esc(fmtBytes(p.memory))}`;
			});

			const text =
				`📊 *PM2 Status*\n\n` +
				lines.join("\n") +
				`\n\nOnline: ${online}/${processes.length} \\| CPU: ${esc(totalCpu.toFixed(1))}% \\| RAM: ${esc(fmtBytes(totalMem))}`;

			await ctx.reply(text, { parse_mode: "MarkdownV2" });
		} catch {
			await ctx.reply("Failed to get process list. Is PM2 running?");
		}
	});

	// /restart <target>
	bot.command("restart", async (ctx) => {
		if (!isAllowed(ctx)) return;
		const target = ctx.match?.trim();
		if (!target) {
			await ctx.reply("Usage: /restart `name` or /restart `id`", { parse_mode: "MarkdownV2" });
			return;
		}
		await ctx.reply(`Restart *${esc(target)}*?`, {
			parse_mode: "MarkdownV2",
			reply_markup: {
				inline_keyboard: [[
					{ text: "✅ Restart", callback_data: `restart:${target}` },
					{ text: "❌ Cancel", callback_data: "cancel" },
				]],
			},
		});
	});

	// /stop <target>
	bot.command("stop", async (ctx) => {
		if (!isAllowed(ctx)) return;
		const target = ctx.match?.trim();
		if (!target) {
			await ctx.reply("Usage: /stop `name` or /stop `id`", { parse_mode: "MarkdownV2" });
			return;
		}
		await ctx.reply(`Stop *${esc(target)}*?`, {
			parse_mode: "MarkdownV2",
			reply_markup: {
				inline_keyboard: [[
					{ text: "✅ Stop", callback_data: `stop:${target}` },
					{ text: "❌ Cancel", callback_data: "cancel" },
				]],
			},
		});
	});

	// /logs <target>
	bot.command("logs", async (ctx) => {
		if (!isAllowed(ctx)) return;
		const target = ctx.match?.trim();
		if (!target) {
			await ctx.reply("Usage: /logs `name` or /logs `id`", { parse_mode: "MarkdownV2" });
			return;
		}

		try {
			const id = await resolveTarget(target);
			const pmId = typeof id === "number" ? id : await findPmId(target);
			if (pmId === null) {
				await ctx.reply(`Process *${esc(target)}* not found`, { parse_mode: "MarkdownV2" });
				return;
			}
			const detail = await pm2Manager.describe(pmId);
			if (!detail) {
				await ctx.reply(`Process *${esc(target)}* not found`, { parse_mode: "MarkdownV2" });
				return;
			}

			let logLines: string[] = [];
			for (const path of [detail.pm_out_log_path, detail.pm_err_log_path]) {
				if (!path) continue;
				try {
					const lines = await tailLines(path, 20);
					logLines.push(...lines);
				} catch {
					// File may not exist
				}
			}

			if (logLines.length === 0) {
				await ctx.reply(`No logs for *${esc(target)}*`, { parse_mode: "MarkdownV2" });
				return;
			}

			// Take last 20 lines, truncate to TG limit
			logLines = logLines.slice(-20);
			const logText = logLines.join("\n").slice(0, 3800);
			await ctx.reply(
				`📋 *${esc(target)}* logs:\n\n\`\`\`\n${esc(logText)}\n\`\`\``,
				{ parse_mode: "MarkdownV2" },
			);
		} catch {
			await ctx.reply(`Failed to read logs for *${esc(target)}*`, { parse_mode: "MarkdownV2" });
		}
	});

	// /open — Open door via bridge API (restricted to authorized users)
	const DOOR_AUTHORIZED_USERS = new Set(["83772876"]); // Telegram user IDs
	const DOOR_AUTHORIZED_USERNAMES = new Set(["nightcoder"]); // Telegram @usernames

	bot.command("open", async (ctx) => {
		if (!isAllowed(ctx)) return;
		const userId = ctx.from?.id?.toString();
		const username = ctx.from?.username?.toLowerCase();
		if (!userId || (!DOOR_AUTHORIZED_USERS.has(userId) && (!username || !DOOR_AUTHORIZED_USERNAMES.has(username)))) {
			await ctx.reply("⛔ You are not authorized to open the door.");
			return;
		}

		const target = ctx.match?.trim() || "1";
		const duration = 5;

		await ctx.reply(`🚪 Open door ${esc(target)}?`, {
			parse_mode: "MarkdownV2",
			reply_markup: {
				inline_keyboard: [[
					{ text: "🔓 Open", callback_data: `opendoor:${target}:${duration}` },
					{ text: "❌ Cancel", callback_data: "cancel" },
				]],
			},
		});
	});

	// Inline button callbacks
	bot.on("callback_query:data", async (ctx) => {
		if (!isAllowed(ctx)) {
			await ctx.answerCallbackQuery({ text: "Unauthorized" });
			return;
		}
		const data = ctx.callbackQuery.data;

		if (data === "cancel") {
			await ctx.editMessageText("Cancelled ✓");
			await ctx.answerCallbackQuery();
			return;
		}

		const colonIdx = data.indexOf(":");
		if (colonIdx === -1) {
			await ctx.answerCallbackQuery({ text: "Invalid action" });
			return;
		}

		const action = data.slice(0, colonIdx);
		const target = data.slice(colonIdx + 1);
		const id = await resolveTarget(target);

		try {
			if (action === "restart") {
				await pm2Manager.action(id, "restart");
				await ctx.editMessageText(`🔄 *${esc(target)}* restarted`, { parse_mode: "MarkdownV2" });
			} else if (action === "stop") {
				await pm2Manager.action(id, "stop");
				await ctx.editMessageText(`⏹ *${esc(target)}* stopped`, { parse_mode: "MarkdownV2" });
			} else if (action === "startproc") {
				await pm2Manager.action(id, "restart");
				await ctx.editMessageText(`🟢 *${esc(target)}* started`, { parse_mode: "MarkdownV2" });
			} else if (action === "opendoor") {
				const userId = ctx.from?.id?.toString();
				const username = ctx.from?.username?.toLowerCase();
				const DOOR_AUTH_USERS = new Set(["83772876"]);
				const DOOR_AUTH_NAMES = new Set(["nightcoder"]);
				if (!userId || (!DOOR_AUTH_USERS.has(userId) && (!username || !DOOR_AUTH_NAMES.has(username)))) {
					await ctx.answerCallbackQuery({ text: "⛔ Unauthorized" });
					return;
				}
				// target format: "door:duration" e.g. "1:5"
				const parts = target.split(":");
				const door = parts[0] || "1";
				const dur = parts[1] || "5";
				try {
					const bridgeUrl = process.env.BRIDGE_URL || "http://127.0.0.1:5555";
					const sn = process.env.DEVICE_SN || "VDE2254800266";
					const res = await fetch(`${bridgeUrl}/api/device/${sn}/open?door=${door}&duration=${dur}`);
					const json = await res.json();
					if (json.queued || json.cmdId) {
						await ctx.editMessageText(`🔓 Door opened \\(${esc(dur)}s\\)`, { parse_mode: "MarkdownV2" });
					} else {
						await ctx.editMessageText(`❌ Failed to open door: ${esc(JSON.stringify(json))}`, { parse_mode: "MarkdownV2" });
					}
				} catch (err) {
					await ctx.editMessageText(`❌ Bridge error: ${esc(err instanceof Error ? err.message : "unknown")}`, { parse_mode: "MarkdownV2" });
				}
				await ctx.answerCallbackQuery({ text: "Done ✓" });
				return;
			} else {
				await ctx.answerCallbackQuery({ text: "Unknown action" });
				return;
			}
			await ctx.answerCallbackQuery({ text: "Done ✓" });
		} catch (err) {
			await ctx.answerCallbackQuery({
				text: `Failed: ${err instanceof Error ? err.message : "unknown error"}`,
			});
		}
	});
}

/** Find pm_id by process name */
async function findPmId(name: string): Promise<number | null> {
	const processes = await pm2Manager.list();
	const found = processes.find((p) => p.name === name);
	return found ? found.pm_id : null;
}
