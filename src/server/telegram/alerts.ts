import type { Bot } from "grammy";
import type { PM2Process, MemoryEvent } from "../../shared/types.js";
import type { TelegramConfig } from "./types.js";

function esc(text: string): string {
	return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

/** Previous snapshot of process statuses for diff detection */
let prevSnapshot = new Map<number, { status: string; restarts: number }>();

/** Throttle: track last alert time per process */
const lastAlertTime = new Map<number, number>();
const ALERT_COOLDOWN = 60_000; // 1 alert per process per 60s

/** Restart loop detection: track restart timestamps */
const restartTimestamps = new Map<number, number[]>();
const RESTART_LOOP_THRESHOLD = 5; // 5 restarts
const RESTART_LOOP_WINDOW = 60_000; // within 60 seconds

export function createAlertSystem(bot: Bot, config: TelegramConfig) {
	/**
	 * Called with each process list update from WsConnectionManager.
	 * Diffs against previous snapshot to detect crashes and restart loops.
	 */
	function onProcessUpdate(processes: PM2Process[]) {
		const now = Date.now();

		for (const proc of processes) {
			const prev = prevSnapshot.get(proc.pm_id);

			if (!prev) continue; // First time seeing this process — skip

			// Detect crash: was online, now stopped/errored
			if (
				prev.status === "online" &&
				(proc.status === "stopped" || proc.status === "errored")
			) {
				sendAlert(proc, "crash", now);
			}

			// Detect restart loop: restart count increased
			if (proc.restarts > prev.restarts) {
				const timestamps = restartTimestamps.get(proc.pm_id) ?? [];
				timestamps.push(now);
				// Keep only timestamps within the window
				const recent = timestamps.filter((t) => now - t < RESTART_LOOP_WINDOW);
				restartTimestamps.set(proc.pm_id, recent);

				if (recent.length >= RESTART_LOOP_THRESHOLD) {
					sendAlert(proc, "restart_loop", now);
					restartTimestamps.set(proc.pm_id, []); // Reset after alert
				}
			}
		}

		// Update snapshot
		prevSnapshot = new Map(
			processes.map((p) => [p.pm_id, { status: p.status, restarts: p.restarts }]),
		);
	}

	function sendAlert(proc: PM2Process, type: "crash" | "restart_loop", now: number) {
		// Throttle check
		const lastTime = lastAlertTime.get(proc.pm_id) ?? 0;
		if (now - lastTime < ALERT_COOLDOWN) return;
		lastAlertTime.set(proc.pm_id, now);

		let text: string;
		const time = new Date().toLocaleTimeString("en-GB", { hour12: false });

		if (type === "crash") {
			text =
				`🔴 *Process crashed*\n\n` +
				`Name: \`${esc(proc.name)}\`\n` +
				`PM2 ID: ${proc.pm_id}\n` +
				`Restarts: ${proc.restarts}\n` +
				`Time: ${esc(time)}`;
		} else {
			text =
				`⚠️ *Restart loop detected*\n\n` +
				`Name: \`${esc(proc.name)}\`\n` +
				`PM2 ID: ${proc.pm_id}\n` +
				`${RESTART_LOOP_THRESHOLD} restarts in ${RESTART_LOOP_WINDOW / 1000}s\n` +
				`Time: ${esc(time)}`;
		}

		const buttons =
			type === "crash"
				? [
						{ text: "🔄 Restart", callback_data: `restart:${proc.name}` },
						{ text: "📋 Logs", callback_data: `logs_alert:${proc.pm_id}` },
					]
				: [
						{ text: "⏹ Stop", callback_data: `stop:${proc.name}` },
						{ text: "📋 Logs", callback_data: `logs_alert:${proc.pm_id}` },
					];

		for (const chatId of config.chatIds) {
			bot.api
				.sendMessage(chatId, text, {
					parse_mode: "MarkdownV2",
					reply_markup: { inline_keyboard: [buttons] },
				})
				.catch((err) => {
					console.error(`[pm2-boss] TG alert failed for chat ${chatId}:`, err.message);
				});
		}
	}

	/** Handle memory limit exceeded events */
	function onMemoryEvent(event: MemoryEvent) {
		const usedMB = (event.memoryBytes / 1024 / 1024).toFixed(0);
		const limitMB = (event.limitBytes / 1024 / 1024).toFixed(0);
		const time = new Date(event.timestamp).toLocaleTimeString("en-GB", { hour12: false });

		const text =
			`⚠️ *Memory limit exceeded*\n\n` +
			`Name: \`${esc(event.processName)}\`\n` +
			`PM2 ID: ${event.pmId}\n` +
			`Usage: ${esc(usedMB)} MB / ${esc(limitMB)} MB limit\n` +
			`Time: ${esc(time)}`;

		const buttons = [
			{ text: "🔄 Restart", callback_data: `restart:${event.processName}` },
			{ text: "📋 Logs", callback_data: `logs_alert:${event.pmId}` },
		];

		for (const chatId of config.chatIds) {
			bot.api
				.sendMessage(chatId, text, {
					parse_mode: "MarkdownV2",
					reply_markup: { inline_keyboard: [buttons] },
				})
				.catch((err) => {
					console.error(`[pm2-boss] TG memory alert failed for chat ${chatId}:`, err.message);
				});
		}
	}

	/** Initialize the snapshot without triggering alerts */
	function initSnapshot(processes: PM2Process[]) {
		prevSnapshot = new Map(
			processes.map((p) => [p.pm_id, { status: p.status, restarts: p.restarts }]),
		);
	}

	return { onProcessUpdate, onMemoryEvent, initSnapshot };
}
