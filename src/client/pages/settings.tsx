import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import { formatBytes } from "../lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, AlertTriangle, Send, Plus, X } from "lucide-react";
import type { AppSettings, MemoryEvent } from "@shared/types";

export function SettingsPage() {
	const navigate = useNavigate();
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [memoryMB, setMemoryMB] = useState("");
	const [saving, setSaving] = useState(false);
	const [events, setEvents] = useState<MemoryEvent[]>([]);

	// Telegram fields
	const [tgToken, setTgToken] = useState("");
	const [tgChatIds, setTgChatIds] = useState<string[]>([]);
	const [newChatId, setNewChatId] = useState("");
	const [savingTg, setSavingTg] = useState(false);
	const [tgStatus, setTgStatus] = useState<{ connected: boolean } | null>(null);

	useEffect(() => {
		apiFetch<AppSettings>("/api/settings").then((res) => {
			if (res.data) {
				setSettings(res.data);
				setMemoryMB(String(res.data.defaultMaxMemoryMB));
				setTgToken(res.data.telegramBotToken);
				setTgChatIds(res.data.telegramChatIds);
			}
		});
		apiFetch<MemoryEvent[]>("/api/events").then((res) => {
			if (res.data) setEvents(res.data.reverse());
		});
		apiFetch<{ connected: boolean }>("/api/telegram/status").then((res) => {
			if (res.data) setTgStatus(res.data);
		});
	}, []);

	const handleSave = async () => {
		const val = Number(memoryMB);
		if (Number.isNaN(val) || val < 0) {
			toast.error("Invalid memory value");
			return;
		}
		setSaving(true);
		try {
			const res = await apiFetch<AppSettings>("/api/settings", {
				method: "PUT",
				body: JSON.stringify({ defaultMaxMemoryMB: val }),
			});
			if (res.data) setSettings(res.data);
			toast.success("Settings saved");
		} catch (err) {
			toast.error(`Failed: ${(err as Error).message}`);
		} finally {
			setSaving(false);
		}
	};

	const handleSaveTelegram = async () => {
		setSavingTg(true);
		try {
			const res = await apiFetch<AppSettings>("/api/settings", {
				method: "PUT",
				body: JSON.stringify({ telegramBotToken: tgToken, telegramChatIds: tgChatIds }),
			});
			if (res.data) {
				setSettings(res.data);
				setTgToken(res.data.telegramBotToken);
				setTgChatIds(res.data.telegramChatIds);
			}
			// Refresh status
			const statusRes = await apiFetch<{ connected: boolean }>("/api/telegram/status");
			if (statusRes.data) setTgStatus(statusRes.data);
			toast.success(tgToken ? "Telegram bot updated" : "Telegram bot disconnected");
		} catch (err) {
			toast.error(`Failed: ${(err as Error).message}`);
		} finally {
			setSavingTg(false);
		}
	};

	const addChatId = () => {
		const id = newChatId.trim();
		if (id && !tgChatIds.includes(id)) {
			setTgChatIds([...tgChatIds, id]);
			setNewChatId("");
		}
	};

	const removeChatId = (id: string) => {
		setTgChatIds(tgChatIds.filter((c) => c !== id));
	};

	const isDirty = settings && memoryMB !== String(settings.defaultMaxMemoryMB);
	const isTgDirty =
		settings &&
		(tgToken !== settings.telegramBotToken ||
			JSON.stringify(tgChatIds) !== JSON.stringify(settings.telegramChatIds));

	return (
		<div className="mx-auto max-w-2xl px-6 py-8">
			{/* Header */}
			<div className="flex items-center gap-3 mb-8">
				<button
					type="button"
					onClick={() => navigate("/")}
					className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
				>
					<ArrowLeft className="h-4 w-4" />
				</button>
				<h1 className="text-lg font-semibold text-foreground">Settings</h1>
			</div>

			{/* Memory Limits */}
			<section className="mb-10">
				<h2 className="text-sm font-medium text-foreground mb-1">Memory Limits</h2>
				<p className="text-xs text-muted-foreground mb-4">
					Default max memory per process. Processes exceeding this limit will trigger alerts.
					You can override this per-process in the Config tab.
				</p>

				<div className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-end gap-3">
						<div className="flex-1">
							<label htmlFor="maxMemory" className="block text-xs font-medium text-foreground mb-1.5">
								Default Max Memory (MB)
							</label>
							<input
								id="maxMemory"
								type="number"
								min="0"
								step="256"
								value={memoryMB}
								onChange={(e) => setMemoryMB(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && isDirty && handleSave()}
								className="input-field w-full text-sm font-mono"
								placeholder="4096"
							/>
							<p className="text-[10px] text-muted-foreground mt-1">
								0 = no limit. Common values: 1024 (1GB), 2048 (2GB), 4096 (4GB)
							</p>
						</div>
						<button
							type="button"
							onClick={handleSave}
							disabled={saving || !isDirty}
							className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-4 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
						>
							{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
							Save
						</button>
					</div>
				</div>
			</section>

			{/* Telegram Bot */}
			<section className="mb-10">
				<div className="flex items-center gap-2 mb-1">
					<h2 className="text-sm font-medium text-foreground">Telegram Bot</h2>
					{tgStatus && (
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
								tgStatus.connected
									? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
									: "bg-muted text-muted-foreground border border-border"
							}`}
						>
							<span className={`h-1.5 w-1.5 rounded-full ${tgStatus.connected ? "bg-emerald-400" : "bg-muted-foreground"}`} />
							{tgStatus.connected ? "Connected" : "Not configured"}
						</span>
					)}
				</div>
				<p className="text-xs text-muted-foreground mb-4">
					Connect a Telegram bot for process alerts, remote commands, and status updates.
					Get a token from{" "}
					<a
						href="https://t.me/BotFather"
						target="_blank"
						rel="noopener noreferrer"
						className="text-emerald-400 hover:underline"
					>
						@BotFather
					</a>
					.
				</p>

				<div className="rounded-lg border border-border bg-card p-4 space-y-4">
					{/* Bot Token */}
					<div>
						<label htmlFor="tgToken" className="block text-xs font-medium text-foreground mb-1.5">
							Bot Token
						</label>
						<input
							id="tgToken"
							type="password"
							value={tgToken}
							onChange={(e) => setTgToken(e.target.value)}
							className="input-field w-full text-sm font-mono"
							placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
							autoComplete="off"
						/>
					</div>

					{/* Chat IDs */}
					<div>
						<label className="block text-xs font-medium text-foreground mb-1.5">
							Alert Chat IDs
						</label>
						<div className="flex flex-wrap gap-2 mb-2">
							{tgChatIds.map((id) => (
								<span
									key={id}
									className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-mono text-foreground border border-border"
								>
									{id}
									<button
										type="button"
										onClick={() => removeChatId(id)}
										className="text-muted-foreground hover:text-red-400 transition-colors"
									>
										<X className="h-3 w-3" />
									</button>
								</span>
							))}
						</div>
						<div className="flex gap-2">
							<input
								type="text"
								value={newChatId}
								onChange={(e) => setNewChatId(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChatId())}
								className="input-field flex-1 text-sm font-mono"
								placeholder="Chat ID (e.g. -1001234567890)"
							/>
							<button
								type="button"
								onClick={addChatId}
								disabled={!newChatId.trim()}
								className="inline-flex items-center gap-1 rounded-md bg-muted border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
							>
								<Plus className="h-3.5 w-3.5" />
								Add
							</button>
						</div>
						<p className="text-[10px] text-muted-foreground mt-1">
							Send /start to your bot, then use @userinfobot or @RawDataBot to find your chat ID.
						</p>
					</div>

					{/* Save Button */}
					<div className="flex items-center gap-3 pt-1">
						<button
							type="button"
							onClick={handleSaveTelegram}
							disabled={savingTg || !isTgDirty}
							className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-4 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
						>
							{savingTg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
							{tgToken ? "Save & Reconnect" : "Save"}
						</button>
						{tgStatus?.connected && tgToken && (
							<button
								type="button"
								onClick={() => {
									setTgToken("");
									setTgChatIds([]);
									// Trigger save immediately with empty values
									setSavingTg(true);
									apiFetch<AppSettings>("/api/settings", {
										method: "PUT",
										body: JSON.stringify({ telegramBotToken: "", telegramChatIds: [] }),
									})
										.then(async (res) => {
											if (res.data) {
												setSettings(res.data);
												setTgToken("");
												setTgChatIds([]);
											}
											const statusRes = await apiFetch<{ connected: boolean }>("/api/telegram/status");
											if (statusRes.data) setTgStatus(statusRes.data);
											toast.success("Telegram bot disconnected");
										})
										.catch((err) => toast.error(`Failed: ${(err as Error).message}`))
										.finally(() => setSavingTg(false));
								}}
								className="text-xs text-red-400 hover:text-red-300 transition-colors"
							>
								Disconnect
							</button>
						)}
					</div>
				</div>
			</section>

			{/* Memory Events Log */}
			<section>
				<h2 className="text-sm font-medium text-foreground mb-1">Memory Events</h2>
				<p className="text-xs text-muted-foreground mb-4">
					History of processes that exceeded their memory limit.
				</p>

				<div className="rounded-lg border border-border bg-card divide-y divide-border">
					{events.length === 0 ? (
						<div className="px-4 py-8 text-center text-xs text-muted-foreground">
							No memory events recorded
						</div>
					) : (
						events.slice(0, 50).map((ev) => (
							<div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
								<AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
								<span className="text-xs font-medium text-foreground min-w-[120px]">{ev.processName}</span>
								<span className="text-xs text-muted-foreground font-mono">
									{formatBytes(ev.memoryBytes)} / {formatBytes(ev.limitBytes)}
								</span>
								<span className="text-xs text-muted-foreground ml-auto">
									{new Date(ev.timestamp).toLocaleString()}
								</span>
							</div>
						))
					)}
				</div>
			</section>
		</div>
	);
}
