import { startServer } from "../server/index.js";
import type { AuthConfig } from "../server/auth.js";
import type { TelegramConfig } from "../server/telegram/types.js";

function parseArgs(args: string[]) {
	let port = 9615;
	let open = true;
	const tokens: string[] = [];
	const users: Array<{ username: string; password: string }> = [];
	let tgBotToken = "";
	const tgChatIds: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--port" && args[i + 1]) {
			port = Number.parseInt(args[i + 1], 10);
			i++;
		} else if (arg === "--no-open") {
			open = false;
		} else if (arg === "--token" && args[i + 1]) {
			tokens.push(args[i + 1]);
			i++;
		} else if (arg === "--user" && args[i + 1]) {
			const raw = args[i + 1];
			const colonIdx = raw.indexOf(":");
			if (colonIdx <= 0) {
				console.error(`\x1b[31mInvalid --user format: "${raw}". Expected "username:password"\x1b[0m`);
				process.exit(1);
			}
			users.push({
				username: raw.slice(0, colonIdx),
				password: raw.slice(colonIdx + 1),
			});
			i++;
		} else if (arg === "--tg-bot-token" && args[i + 1]) {
			tgBotToken = args[i + 1];
			i++;
		} else if (arg === "--tg-chat-id" && args[i + 1]) {
			tgChatIds.push(args[i + 1]);
			i++;
		} else if (arg === "--help" || arg === "-h") {
			console.log(`
  pm2-boss - Beautiful PM2 dashboard

  Usage:
    npx pm2-boss [options]

  Options:
    --port <number>            Port to run on (default: 9615)
    --no-open                  Don't open browser automatically
    --token <string>           API token for authentication (repeatable)
    --user <user:pass>         Login credentials (repeatable)
    --tg-bot-token <string>    Telegram Bot token (from @BotFather)
    --tg-chat-id <string>      Chat ID for alerts (repeatable)
    -h, --help                 Show this help

  Auth:
    When no --user or --token is provided, the dashboard runs without
    authentication (local access only). Add credentials for production use.

  Examples:
    pm2-boss
    pm2-boss --port 3000
    pm2-boss --token mysecrettoken
    pm2-boss --user admin:strongpassword
    pm2-boss --tg-bot-token "<token>" --tg-chat-id "<chat_id>"
`);
			process.exit(0);
		}
	}

	const auth: AuthConfig = {
		tokens,
		users,
		enabled: tokens.length > 0 || users.length > 0,
	};

	if (!auth.enabled) {
		console.log("\x1b[33m  ⚠ No auth configured — dashboard is open to anyone who can reach this port.\x1b[0m");
		console.log("\x1b[33m    Use --user or --token for production.\x1b[0m\n");
	}

	const telegram: TelegramConfig = {
		botToken: tgBotToken,
		chatIds: tgChatIds,
		enabled: tgBotToken.length > 0,
	};

	return { port, open, auth, telegram };
}

async function main() {
	const { port, open, auth, telegram } = parseArgs(process.argv.slice(2));

	await startServer(port, auth, telegram);

	if (open) {
		const url = `http://localhost:${port}`;
		const { execFile } = await import("node:child_process");
		const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
		execFile(cmd, [url], () => {});
	}
}

main().catch((err) => {
	console.error("[pm2-boss] Fatal:", err);
	process.exit(1);
});
