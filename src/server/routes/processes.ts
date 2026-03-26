import { Hono } from "hono";
import { pm2Manager } from "../pm2-manager.js";
import type { ApiResponse } from "../../shared/types.js";

export function createProcessRoutes() {
	const app = new Hono();

	// List all processes
	app.get("/processes", async (c) => {
		try {
			const processes = await pm2Manager.list();
			return c.json<ApiResponse>({ data: processes, error: null, timestamp: Date.now() });
		} catch (err) {
			return c.json<ApiResponse>(
				{ data: null, error: (err as Error).message, timestamp: Date.now() },
				500,
			);
		}
	});

	// Get single process detail
	app.get("/processes/:pmId", async (c) => {
		try {
			const pmId = Number.parseInt(c.req.param("pmId"), 10);
			if (Number.isNaN(pmId)) {
				return c.json<ApiResponse>(
					{ data: null, error: "Invalid pm_id", timestamp: Date.now() },
					400,
				);
			}
			const process = await pm2Manager.describe(pmId);
			if (!process) {
				return c.json<ApiResponse>(
					{ data: null, error: "Process not found", timestamp: Date.now() },
					404,
				);
			}
			return c.json<ApiResponse>({ data: process, error: null, timestamp: Date.now() });
		} catch (err) {
			return c.json<ApiResponse>(
				{ data: null, error: (err as Error).message, timestamp: Date.now() },
				500,
			);
		}
	});

	// Process actions
	for (const action of ["stop", "restart", "reload", "delete"] as const) {
		app.post(`/processes/:pmId/${action}`, async (c) => {
			try {
				const pmId = Number.parseInt(c.req.param("pmId"), 10);
				if (Number.isNaN(pmId)) {
					return c.json<ApiResponse>(
						{ data: null, error: "Invalid pm_id", timestamp: Date.now() },
						400,
					);
				}
				await pm2Manager.action(pmId, action);
				return c.json<ApiResponse>({
					data: { success: true, action, pm_id: pmId },
					error: null,
					timestamp: Date.now(),
				});
			} catch (err) {
				return c.json<ApiResponse>(
					{ data: null, error: (err as Error).message, timestamp: Date.now() },
					500,
				);
			}
		});
	}

	// Reset restart count
	app.post("/processes/:pmId/reset", async (c) => {
		try {
			const pmId = Number.parseInt(c.req.param("pmId"), 10);
			if (Number.isNaN(pmId)) {
				return c.json<ApiResponse>(
					{ data: null, error: "Invalid pm_id", timestamp: Date.now() },
					400,
				);
			}
			await pm2Manager.reset(pmId);
			return c.json<ApiResponse>({
				data: { success: true, action: "reset", pm_id: pmId },
				error: null,
				timestamp: Date.now(),
			});
		} catch (err) {
			return c.json<ApiResponse>(
				{ data: null, error: (err as Error).message, timestamp: Date.now() },
				500,
			);
		}
	});

	// Scale cluster process
	app.post("/processes/:name/scale", async (c) => {
		try {
			const name = c.req.param("name");
			const body = await c.req.json<{ instances: number }>();
			const instances = body.instances;
			if (!Number.isInteger(instances) || instances < 1 || instances > 64) {
				return c.json<ApiResponse>(
					{ data: null, error: "instances must be an integer between 1 and 64", timestamp: Date.now() },
					400,
				);
			}
			await pm2Manager.scale(name, instances);
			return c.json<ApiResponse>({
				data: { success: true, action: "scale", name, instances },
				error: null,
				timestamp: Date.now(),
			});
		} catch (err) {
			return c.json<ApiResponse>(
				{ data: null, error: (err as Error).message, timestamp: Date.now() },
				500,
			);
		}
	});

	// Send signal to process
	app.post("/processes/:pmId/signal", async (c) => {
		try {
			const pmId = Number.parseInt(c.req.param("pmId"), 10);
			if (Number.isNaN(pmId)) {
				return c.json<ApiResponse>({ data: null, error: "Invalid pm_id", timestamp: Date.now() }, 400);
			}
			const body = await c.req.json<{ signal: string }>();
			const allowed = ["SIGTERM", "SIGINT", "SIGHUP", "SIGUSR1", "SIGUSR2", "SIGKILL"];
			if (!allowed.includes(body.signal)) {
				return c.json<ApiResponse>(
					{ data: null, error: `Invalid signal. Allowed: ${allowed.join(", ")}`, timestamp: Date.now() },
					400,
				);
			}
			await pm2Manager.sendSignal(body.signal, pmId);
			return c.json<ApiResponse>({
				data: { success: true, action: "signal", signal: body.signal, pm_id: pmId },
				error: null,
				timestamp: Date.now(),
			});
		} catch (err) {
			return c.json<ApiResponse>(
				{ data: null, error: (err as Error).message, timestamp: Date.now() },
				500,
			);
		}
	});

	// Trigger custom PM2 action
	app.post("/processes/:pmId/trigger", async (c) => {
		try {
			const pmId = Number.parseInt(c.req.param("pmId"), 10);
			if (Number.isNaN(pmId)) {
				return c.json<ApiResponse>({ data: null, error: "Invalid pm_id", timestamp: Date.now() }, 400);
			}
			const body = await c.req.json<{ action: string }>();
			if (!body.action) {
				return c.json<ApiResponse>({ data: null, error: "action is required", timestamp: Date.now() }, 400);
			}
			await pm2Manager.trigger(pmId, body.action);
			return c.json<ApiResponse>({
				data: { success: true, action: "trigger", triggered: body.action, pm_id: pmId },
				error: null,
				timestamp: Date.now(),
			});
		} catch (err) {
			return c.json<ApiResponse>(
				{ data: null, error: (err as Error).message, timestamp: Date.now() },
				500,
			);
		}
	});

	// Send IPC data to process
	app.post("/processes/:pmId/send-data", async (c) => {
		try {
			const pmId = Number.parseInt(c.req.param("pmId"), 10);
			if (Number.isNaN(pmId)) {
				return c.json<ApiResponse>({ data: null, error: "Invalid pm_id", timestamp: Date.now() }, 400);
			}
			const body = await c.req.json<{ data: unknown; topic?: string }>();
			if (body.data === undefined) {
				return c.json<ApiResponse>({ data: null, error: "data field is required", timestamp: Date.now() }, 400);
			}
			await pm2Manager.sendData(pmId, body.data, body.topic);
			return c.json<ApiResponse>({
				data: { success: true, action: "send-data", pm_id: pmId },
				error: null,
				timestamp: Date.now(),
			});
		} catch (err) {
			return c.json<ApiResponse>(
				{ data: null, error: (err as Error).message, timestamp: Date.now() },
				500,
			);
		}
	});

	// Update process config (delete + re-start with merged options)
	app.put("/processes/:pmId/config", async (c) => {
		try {
			const pmId = Number.parseInt(c.req.param("pmId"), 10);
			if (Number.isNaN(pmId)) {
				return c.json<ApiResponse>({ data: null, error: "Invalid pm_id", timestamp: Date.now() }, 400);
			}
			const body = await c.req.json<{
				script?: string;
				cwd?: string;
				interpreter?: string;
				args?: string;
				exec_mode?: "fork" | "cluster";
				watch?: boolean;
				max_memory_restart?: string;
			}>();
			// At least one field must be provided
			const hasUpdate = body.script !== undefined || body.cwd !== undefined ||
				body.interpreter !== undefined || body.args !== undefined ||
				body.exec_mode !== undefined || body.watch !== undefined ||
				body.max_memory_restart !== undefined;
			if (!hasUpdate) {
				return c.json<ApiResponse>({ data: null, error: "No config fields to update", timestamp: Date.now() }, 400);
			}
			await pm2Manager.updateConfig(pmId, body);
			return c.json<ApiResponse>({
				data: { success: true, action: "update-config", pm_id: pmId },
				error: null,
				timestamp: Date.now(),
			});
		} catch (err) {
			return c.json<ApiResponse>(
				{ data: null, error: (err as Error).message, timestamp: Date.now() },
				500,
			);
		}
	});

	// Start new process
	app.post("/processes", async (c) => {
		try {
			const body = await c.req.json();
			if (!body.script || typeof body.script !== "string") {
				return c.json<ApiResponse>({ data: null, error: "script path is required", timestamp: Date.now() }, 400);
			}
			await pm2Manager.start({
				script: body.script,
				name: body.name || undefined,
				cwd: body.cwd || undefined,
				interpreter: body.interpreter || undefined,
				args: body.args || undefined,
				instances: body.instances || undefined,
				exec_mode: body.exec_mode || undefined,
				watch: body.watch ?? false,
			});
			return c.json<ApiResponse>({
				data: { success: true, action: "start" },
				error: null,
				timestamp: Date.now(),
			});
		} catch (err) {
			return c.json<ApiResponse>(
				{ data: null, error: (err as Error).message, timestamp: Date.now() },
				500,
			);
		}
	});

	// PM2 global: dump
	app.post("/pm2/dump", async (c) => {
		try {
			await pm2Manager.dump();
			return c.json<ApiResponse>({ data: { success: true, action: "dump" }, error: null, timestamp: Date.now() });
		} catch (err) {
			return c.json<ApiResponse>({ data: null, error: (err as Error).message, timestamp: Date.now() }, 500);
		}
	});

	// PM2 global: resurrect
	app.post("/pm2/resurrect", async (c) => {
		try {
			await pm2Manager.resurrect();
			return c.json<ApiResponse>({ data: { success: true, action: "resurrect" }, error: null, timestamp: Date.now() });
		} catch (err) {
			return c.json<ApiResponse>({ data: null, error: (err as Error).message, timestamp: Date.now() }, 500);
		}
	});

	// PM2 global: flush logs
	app.post("/pm2/flush", async (c) => {
		try {
			await pm2Manager.flush();
			return c.json<ApiResponse>({ data: { success: true, action: "flush" }, error: null, timestamp: Date.now() });
		} catch (err) {
			return c.json<ApiResponse>({ data: null, error: (err as Error).message, timestamp: Date.now() }, 500);
		}
	});

	// Bulk actions
	app.post("/processes/action/stop-all", async (c) => {
		try {
			await pm2Manager.action("all", "stop");
			return c.json<ApiResponse>({ data: { success: true }, error: null, timestamp: Date.now() });
		} catch (err) {
			return c.json<ApiResponse>(
				{ data: null, error: (err as Error).message, timestamp: Date.now() },
				500,
			);
		}
	});

	app.post("/processes/action/restart-all", async (c) => {
		try {
			await pm2Manager.action("all", "restart");
			return c.json<ApiResponse>({ data: { success: true }, error: null, timestamp: Date.now() });
		} catch (err) {
			return c.json<ApiResponse>(
				{ data: null, error: (err as Error).message, timestamp: Date.now() },
				500,
			);
		}
	});

	return app;
}
