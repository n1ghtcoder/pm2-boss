import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import type { MemoryEvent } from "../shared/types.js";

const DATA_DIR = path.join(os.homedir(), ".pm2-boss");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const MAX_EVENTS = 1000;

function ensureDataDir() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
}

/** In-memory cache — loaded once from disk, written through on add */
let cached: MemoryEvent[] | null = null;

function getEvents(): MemoryEvent[] {
	if (cached) return cached;
	try {
		ensureDataDir();
		if (!fs.existsSync(EVENTS_FILE)) {
			cached = [];
			return cached;
		}
		const raw = fs.readFileSync(EVENTS_FILE, "utf-8");
		cached = JSON.parse(raw) as MemoryEvent[];
		return cached;
	} catch {
		cached = [];
		return cached;
	}
}

function flush() {
	if (!cached) return;
	ensureDataDir();
	const tmp = `${EVENTS_FILE}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(cached, null, "\t"), "utf-8");
	fs.renameSync(tmp, EVENTS_FILE);
}

export function addMemoryEvent(
	pmId: number,
	processName: string,
	memoryBytes: number,
	limitBytes: number,
): MemoryEvent {
	const event: MemoryEvent = {
		id: crypto.randomBytes(8).toString("hex"),
		timestamp: Date.now(),
		pmId,
		processName,
		memoryBytes,
		limitBytes,
		type: "memory_limit_exceeded",
	};
	const events = getEvents();
	events.push(event);
	// Trim to max
	if (events.length > MAX_EVENTS) {
		events.splice(0, events.length - MAX_EVENTS);
	}
	flush();
	return event;
}

export function queryEvents(pmId?: number): MemoryEvent[] {
	const events = getEvents();
	if (pmId !== undefined) {
		return events.filter((e) => e.pmId === pmId);
	}
	return events;
}

/** Count events per process in the last N hours */
export function getRecentEventCounts(hours = 24): Record<number, number> {
	const cutoff = Date.now() - hours * 60 * 60 * 1000;
	const events = getEvents();
	const counts: Record<number, number> = {};
	for (const e of events) {
		if (e.timestamp >= cutoff) {
			counts[e.pmId] = (counts[e.pmId] ?? 0) + 1;
		}
	}
	return counts;
}
