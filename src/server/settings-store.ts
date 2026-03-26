import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { AppSettings } from "../shared/types.js";

const DATA_DIR = path.join(os.homedir(), ".pm2-boss");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const DEFAULTS: AppSettings = {
	defaultMaxMemoryMB: 4096,
	telegramBotToken: "",
	telegramChatIds: [],
};

function ensureDataDir() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
}

/** In-memory cache — loaded once from disk, written through on save */
let cached: AppSettings | null = null;

export function loadSettings(): AppSettings {
	if (cached) return cached;
	let result: AppSettings;
	try {
		ensureDataDir();
		if (!fs.existsSync(SETTINGS_FILE)) {
			result = { ...DEFAULTS };
		} else {
			const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
			const parsed = JSON.parse(raw);
			result = { ...DEFAULTS, ...parsed };
		}
	} catch {
		result = { ...DEFAULTS };
	}
	cached = result;
	return result;
}

export function saveSettings(updates: Partial<AppSettings>): AppSettings {
	ensureDataDir();
	const current = loadSettings();
	// Only merge known keys
	const merged: AppSettings = {
		defaultMaxMemoryMB: updates.defaultMaxMemoryMB ?? current.defaultMaxMemoryMB,
		telegramBotToken: updates.telegramBotToken ?? current.telegramBotToken,
		telegramChatIds: updates.telegramChatIds ?? current.telegramChatIds,
	};
	const tmp = `${SETTINGS_FILE}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(merged, null, "\t"), { encoding: "utf-8", mode: 0o600 });
	fs.renameSync(tmp, SETTINGS_FILE);
	cached = merged;
	return merged;
}
