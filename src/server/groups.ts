import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { Hono } from "hono";
import type { ProcessGroup, ApiResponse } from "../shared/types.js";

const DATA_DIR = path.join(os.homedir(), ".pm2-boss");
const GROUPS_FILE = path.join(DATA_DIR, "groups.json");

function ensureDataDir() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
}

function loadGroups(): ProcessGroup[] {
	try {
		ensureDataDir();
		if (!fs.existsSync(GROUPS_FILE)) return [];
		const raw = fs.readFileSync(GROUPS_FILE, "utf-8");
		return JSON.parse(raw) as ProcessGroup[];
	} catch {
		return [];
	}
}

function saveGroups(groups: ProcessGroup[]) {
	ensureDataDir();
	const tmp = `${GROUPS_FILE}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(groups, null, "\t"), "utf-8");
	fs.renameSync(tmp, GROUPS_FILE);
}

function generateId(): string {
	return crypto.randomBytes(8).toString("hex");
}

export function createGroupRoutes() {
	const app = new Hono();

	// List all groups
	app.get("/groups", (c) => {
		const groups = loadGroups();
		return c.json<ApiResponse>({ data: groups, error: null, timestamp: Date.now() });
	});

	// Create group
	app.post("/groups", async (c) => {
		try {
			const body = await c.req.json<{ name: string; processNames: string[]; color?: string }>();
			if (!body.name || typeof body.name !== "string") {
				return c.json<ApiResponse>({ data: null, error: "name is required", timestamp: Date.now() }, 400);
			}
			if (!Array.isArray(body.processNames) || body.processNames.length === 0) {
				return c.json<ApiResponse>({ data: null, error: "processNames must be a non-empty array", timestamp: Date.now() }, 400);
			}

			const groups = loadGroups();
			const group: ProcessGroup = {
				id: generateId(),
				name: body.name.trim(),
				processNames: body.processNames.map((n) => n.trim()).filter(Boolean),
				color: body.color || undefined,
				collapsed: false,
				order: groups.length,
			};
			groups.push(group);
			saveGroups(groups);

			return c.json<ApiResponse>({ data: group, error: null, timestamp: Date.now() }, 201);
		} catch (err) {
			return c.json<ApiResponse>({ data: null, error: (err as Error).message, timestamp: Date.now() }, 500);
		}
	});

	// Reorder groups — must be before :id to avoid matching "reorder" as an id
	app.put("/groups/reorder", async (c) => {
		try {
			const body = await c.req.json<{ ids: string[] }>();
			if (!Array.isArray(body.ids)) {
				return c.json<ApiResponse>({ data: null, error: "ids must be an array", timestamp: Date.now() }, 400);
			}
			const groups = loadGroups();
			const byId = new Map(groups.map((g) => [g.id, g]));
			const reordered: ProcessGroup[] = [];
			for (let i = 0; i < body.ids.length; i++) {
				const g = byId.get(body.ids[i]);
				if (g) {
					g.order = i;
					reordered.push(g);
					byId.delete(body.ids[i]);
				}
			}
			// Append any groups not in the reorder list
			for (const g of byId.values()) {
				g.order = reordered.length;
				reordered.push(g);
			}
			saveGroups(reordered);

			return c.json<ApiResponse>({ data: reordered, error: null, timestamp: Date.now() });
		} catch (err) {
			return c.json<ApiResponse>({ data: null, error: (err as Error).message, timestamp: Date.now() }, 500);
		}
	});

	// Update group
	app.put("/groups/:id", async (c) => {
		try {
			const id = c.req.param("id");
			const groups = loadGroups();
			const idx = groups.findIndex((g) => g.id === id);
			if (idx === -1) {
				return c.json<ApiResponse>({ data: null, error: "Group not found", timestamp: Date.now() }, 404);
			}

			const body = await c.req.json<Partial<Omit<ProcessGroup, "id">>>();
			const group = groups[idx];

			if (body.name !== undefined) group.name = body.name.trim();
			if (body.processNames !== undefined) group.processNames = body.processNames.map((n) => n.trim()).filter(Boolean);
			if (body.color !== undefined) group.color = body.color || undefined;
			if (body.collapsed !== undefined) group.collapsed = body.collapsed;
			if (body.order !== undefined) group.order = body.order;

			groups[idx] = group;
			saveGroups(groups);

			return c.json<ApiResponse>({ data: group, error: null, timestamp: Date.now() });
		} catch (err) {
			return c.json<ApiResponse>({ data: null, error: (err as Error).message, timestamp: Date.now() }, 500);
		}
	});

	// Delete group
	app.delete("/groups/:id", (c) => {
		const id = c.req.param("id");
		const groups = loadGroups();
		const idx = groups.findIndex((g) => g.id === id);
		if (idx === -1) {
			return c.json<ApiResponse>({ data: null, error: "Group not found", timestamp: Date.now() }, 404);
		}
		groups.splice(idx, 1);
		// Recompute order
		for (let i = 0; i < groups.length; i++) groups[i].order = i;
		saveGroups(groups);

		return c.json<ApiResponse>({ data: { success: true }, error: null, timestamp: Date.now() });
	});

	return app;
}
