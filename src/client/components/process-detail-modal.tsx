import { useEffect, useState, useCallback } from "react";
import type { PM2ProcessDetail, MetricsPoint, MemoryEvent } from "@shared/types";
import { cn, formatBytes, formatUptime, formatCpu, statusColors, statusDotColors } from "../lib/utils";
import { LogViewer } from "./log-viewer";
import { EnvViewer } from "./env-viewer";
import { GitSection } from "./git-info";
import { Sparkline } from "./sparkline";
import { ScaleControl } from "./scale-control";
import { SignalMenu, TriggerActions } from "./signal-menu";
import { ProcessConsole } from "./process-console";
import { ErrorBoundary } from "./error-boundary";
import { useMetricsStore } from "../stores/metrics-store";
import { wsSend } from "../hooks/use-websocket";
import { apiFetch } from "../lib/api-client";
import { toast } from "sonner";
import {
	X,
	Play,
	Square,
	RotateCw,
	RefreshCw,
	Globe,
	Loader2,
	Copy,
	Check,
	Pencil,
	Save,
	XCircle,
	AlertTriangle,
} from "lucide-react";
import { OverviewSkeleton, ConfigSkeleton, EnvSkeleton, Skeleton } from "./skeleton";

const EMPTY_METRICS: MetricsPoint[] = [];

const isDemo =
	new URLSearchParams(window.location.search).has("demo") ||
	window.location.hostname.endsWith("github.io");

type Tab = "overview" | "config" | "env" | "events" | "git" | "logs" | "console";

export function ProcessDetailModal({
	pmId,
	onClose,
}: {
	pmId: number;
	onClose: () => void;
}) {
	const [detail, setDetail] = useState<PM2ProcessDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<Tab>("overview");
	const [actionLoading, setActionLoading] = useState<string | null>(null);

	// Fetch detail on mount + poll
	useEffect(() => {
		let mounted = true;

		if (isDemo) {
			import("../lib/demo-data").then(({ getDemoDetail }) => {
				if (mounted) {
					setDetail(getDemoDetail(pmId));
					setLoading(false);
				}
			});
			return () => { mounted = false; };
		}

		async function fetchDetail() {
			try {
				const res = await apiFetch<PM2ProcessDetail>(`/api/processes/${pmId}`);
				if (mounted && res.data) setDetail(res.data);
			} catch {
				// Ignore
			} finally {
				if (mounted) setLoading(false);
			}
		}
		fetchDetail();
		const interval = setInterval(fetchDetail, 2000);
		return () => {
			mounted = false;
			clearInterval(interval);
		};
	}, [pmId]);

	// Escape to close
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);

	// Lock body scroll
	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, []);

	const handleAction = useCallback(async (action: string, label: string) => {
		setActionLoading(action);
		try {
			await apiFetch(`/api/processes/${pmId}/${action}`, { method: "POST" });
			toast.success(label, {
				action: {
					label: "View Logs",
					onClick: () => setActiveTab("logs"),
				},
			});
		} catch (err) {
			toast.error((err as Error).message, {
				action: {
					label: "Retry",
					onClick: () => handleAction(action, label),
				},
			});
		} finally {
			setActionLoading(null);
		}
	}, [pmId]);

	const send = useCallback((msg: any) => wsSend(msg), []);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={onClose}
			onKeyDown={() => {}}
		>
			<div
				className="relative w-[90vw] max-w-[1600px] h-[80vh] flex flex-col rounded-xl border border-ring bg-background shadow-2xl"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				{/* Close button */}
				<button
					type="button"
					onClick={onClose}
					className="absolute top-3 right-3 z-10 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
				>
					<X className="h-4 w-4" />
				</button>

				{loading ? (
					<div className="px-6 pt-5 pb-5 space-y-5">
						{/* Skeleton header */}
						<div className="pr-8">
							<Skeleton className="h-5 w-40 mb-2" />
							<Skeleton className="h-4 w-24" />
						</div>
						{/* Skeleton tabs */}
						<div className="flex gap-3 border-b border-border pb-2">
							{Array.from({ length: 5 }).map((_, i) => (
								<Skeleton key={i} className="h-4 w-16" />
							))}
						</div>
						{/* Skeleton overview */}
						<OverviewSkeleton />
					</div>
				) : !detail ? (
					<div className="flex flex-1 flex-col items-center justify-center text-center">
						<p className="text-sm text-muted-foreground">Process not found</p>
					</div>
				) : (
					<>
						{/* Fixed header: name + actions */}
						<div className="shrink-0 px-6 pt-5 pb-0">
							<div className="flex items-center justify-between mb-5 pr-8">
								<div>
									<h2 className="text-lg font-semibold text-foreground">{detail.name}</h2>
									<div className="flex items-center gap-2 mt-0.5">
										<span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", statusColors[detail.status])}>
											<span className={cn("h-1.5 w-1.5 rounded-full", statusDotColors[detail.status])} />
											{detail.status}
										</span>
										<span className="text-xs text-muted-foreground">{detail.exec_mode} mode</span>
									</div>
								</div>
								<div className="flex items-center gap-2">
									{detail.status === "online" ? (
										<ActionBtn icon={Square} label="Stop" onClick={() => handleAction("stop", "Stopped")} loading={actionLoading === "stop"} />
									) : (
										<ActionBtn icon={Play} label="Start" onClick={() => handleAction("restart", "Started")} loading={actionLoading === "restart"} />
									)}
									<ActionBtn icon={RotateCw} label="Restart" onClick={() => handleAction("restart", "Restarted")} loading={actionLoading === "restart"} />
									{detail.exec_mode === "cluster" && (
										<ActionBtn icon={RefreshCw} label="Reload" onClick={() => handleAction("reload", "Reloaded")} loading={actionLoading === "reload"} />
									)}
									{detail.status === "online" && <SignalMenu pmId={pmId} />}
								</div>
							</div>

							{/* Tabs */}
							<div className="flex gap-1 border-b border-border">
								{(["overview", "config", "env", "events", "git", "logs", "console"] as const).map((tab) => (
									<button
										key={tab}
										type="button"
										onClick={() => setActiveTab(tab)}
										className={cn(
											"px-3 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
											activeTab === tab
												? "border-emerald-400 text-foreground"
												: "border-transparent text-muted-foreground hover:text-foreground",
										)}
									>
										{tab}
									</button>
								))}
							</div>
						</div>

						{/* Scrollable tab content — fills remaining height */}
						<div className="flex-1 overflow-y-auto px-6 py-5">
							<ErrorBoundary fallbackLabel={`Failed to load ${activeTab} tab`}>
								{activeTab === "overview" && <OverviewTab detail={detail} pmId={pmId} />}
								{activeTab === "config" && <ConfigTab detail={detail} />}
								{activeTab === "env" && <EnvViewer pmId={pmId} />}
								{activeTab === "events" && <EventsTab pmId={pmId} />}
								{activeTab === "git" && <GitSection versioning={detail.versioning} />}
								{activeTab === "logs" && (
									<div className="rounded-lg border border-border bg-card h-full flex flex-col overflow-hidden">
										<LogViewer pmId={pmId} processName={detail.name} onClose={() => setActiveTab("overview")} send={send} embedded />
									</div>
								)}
								{activeTab === "console" && (
									<div className="rounded-lg border border-border bg-card h-full flex flex-col overflow-hidden">
										<ProcessConsole pmId={pmId} />
									</div>
								)}
							</ErrorBoundary>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function OverviewTab({ detail, pmId }: { detail: PM2ProcessDetail; pmId: number }) {
	const metricsData = useMetricsStore((s) => s.history[pmId] ?? EMPTY_METRICS);
	const stats = [
		{ label: "PID", value: detail.pid > 0 ? String(detail.pid) : "–", mono: true },
		{ label: "PM2 ID", value: String(detail.pm_id), mono: true },
		{ label: "CPU", value: formatCpu(detail.cpu) },
		{ label: "Memory (RSS)", value: formatBytes(detail.memory) },
		{ label: "Uptime", value: formatUptime(detail.uptime) },
		{ label: "Restarts", value: String(detail.restarts) },
		{ label: "Instances", value: String(detail.instances) },
		{ label: "Namespace", value: detail.namespace },
	];

	return (
		<div className="space-y-4">
			{metricsData.length >= 2 && (
				<div className="grid grid-cols-2 gap-4">
					<div className="rounded-lg border border-border bg-card p-3">
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">CPU Usage</div>
						<Sparkline data={metricsData} dataKey="cpu" width={300} height={40} color="#10b981" warnColor="#f59e0b" warnThreshold={80} />
					</div>
					<div className="rounded-lg border border-border bg-card p-3">
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Memory Usage</div>
						<Sparkline data={metricsData} dataKey="memory" width={300} height={40} color="#3b82f6" />
					</div>
				</div>
			)}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				{stats.map((s) => (
					<div key={s.label} className="rounded-lg border border-border bg-card p-3">
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
						<div className={cn("mt-1 text-sm font-medium", s.mono ? "font-mono text-foreground" : "text-foreground")}>
							{s.value}
						</div>
					</div>
				))}
			</div>
			{detail.ports && detail.ports.length > 0 && (
				<div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
					<Globe className="h-4 w-4 text-emerald-400 shrink-0" />
					<div>
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
							{detail.ports.length === 1 ? "Port" : "Ports"}
						</div>
						<div className="flex flex-wrap gap-2">
							{detail.ports.map((port) => (
								<a
									key={port}
									href={`http://localhost:${port}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
								>
									localhost:{port}
								</a>
							))}
						</div>
					</div>
				</div>
			)}
			{detail.exec_mode === "cluster" && (
				<ScaleControl name={detail.name} currentInstances={detail.instances} />
			)}
			{detail.axm_actions.length > 0 && (
				<TriggerActions pmId={pmId} actions={detail.axm_actions} />
			)}
		</div>
	);
}

function ConfigTab({ detail }: { detail: PM2ProcessDetail }) {
	const [copied, setCopied] = useState<string | null>(null);
	const [editing, setEditing] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const [saving, setSaving] = useState(false);

	type ConfigItem = {
		label: string;
		key: string;
		value: string;
		editable: boolean;
	};

	const items: ConfigItem[] = [
		{ label: "Script", key: "script", value: detail.script, editable: true },
		{ label: "CWD", key: "cwd", value: detail.cwd, editable: true },
		{ label: "Interpreter", key: "interpreter", value: detail.interpreter, editable: true },
		{ label: "Args", key: "args", value: detail.args.join(" ") || "–", editable: true },
		{ label: "Max Memory", key: "max_memory_restart", value: detail.max_memory_restart ? `${Math.round(detail.max_memory_restart / 1024 / 1024)}M` : "default", editable: true },
		{ label: "Exec Mode", key: "exec_mode", value: detail.exec_mode, editable: false },
		{ label: "Stdout Log", key: "pm_out_log_path", value: detail.pm_out_log_path, editable: false },
		{ label: "Stderr Log", key: "pm_err_log_path", value: detail.pm_err_log_path, editable: false },
		{ label: "Watch", key: "watch", value: detail.watch ? "enabled" : "disabled", editable: false },
	];

	const copyValue = (label: string, value: string) => {
		navigator.clipboard.writeText(value);
		setCopied(label);
		setTimeout(() => setCopied(null), 1500);
	};

	const startEdit = (item: ConfigItem) => {
		setEditing(item.key);
		setEditValue(item.key === "args" && item.value === "–" ? "" : item.value);
	};

	const cancelEdit = () => {
		setEditing(null);
		setEditValue("");
	};

	const saveEdit = async (key: string) => {
		setSaving(true);
		try {
			let value: string = editValue;
			// max_memory_restart: append M if user entered just a number
			if (key === "max_memory_restart") {
				const trimmed = editValue.trim().toLowerCase();
				if (trimmed === "default" || trimmed === "0" || trimmed === "") {
					value = "0";
				} else if (/^\d+$/.test(trimmed)) {
					value = `${trimmed}M`;
				} else {
					value = trimmed;
				}
			}
			const body: Record<string, string> = { [key]: value };
			await apiFetch(`/api/processes/${detail.pm_id}/config`, {
				method: "PUT",
				body: JSON.stringify(body),
			});
			toast.success(`Config updated — process restarting`, {
				description: `${key}: ${editValue}`,
			});
			setEditing(null);
			setEditValue("");
		} catch (err) {
			toast.error(`Failed to update config: ${(err as Error).message}`);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<p className="text-xs text-muted-foreground">
					Editing a field will restart the process with the new configuration.
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card divide-y divide-border">
				{items.map((item) => (
					<div key={item.key} className="group flex items-start gap-4 px-4 py-3">
						<span className="w-28 shrink-0 text-xs text-muted-foreground pt-0.5">{item.label}</span>

						{editing === item.key ? (
							<div className="flex-1 flex items-center gap-2">
								<input
									type="text"
									value={editValue}
									onChange={(e) => setEditValue(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") saveEdit(item.key);
										if (e.key === "Escape") cancelEdit();
									}}
									className="input-field flex-1 text-xs font-mono"
									autoFocus
									disabled={saving}
								/>
								<button
									type="button"
									onClick={() => saveEdit(item.key)}
									disabled={saving || editValue === item.value}
									className="shrink-0 rounded p-1 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
									title="Save"
								>
									{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
								</button>
								<button
									type="button"
									onClick={cancelEdit}
									disabled={saving}
									className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
									title="Cancel (Esc)"
								>
									<XCircle className="h-3.5 w-3.5" />
								</button>
							</div>
						) : (
							<>
								<span className="flex-1 text-xs text-foreground font-mono break-all pt-0.5">{item.value}</span>
								<div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
									{item.editable && (
										<button
											type="button"
											onClick={() => startEdit(item)}
											className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
											title="Edit"
										>
											<Pencil className="h-3 w-3" />
										</button>
									)}
									<button
										type="button"
										onClick={() => copyValue(item.label, item.value)}
										className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
										title="Copy"
									>
										{copied === item.label ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
									</button>
								</div>
							</>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

function EventsTab({ pmId }: { pmId: number }) {
	const [events, setEvents] = useState<MemoryEvent[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		apiFetch<MemoryEvent[]>(`/api/events?pmId=${pmId}`).then((res) => {
			if (res.data) setEvents(res.data.reverse());
			setLoading(false);
		});
	}, [pmId]);

	if (loading) {
		return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
	}

	if (events.length === 0) {
		return (
			<div className="text-center py-8">
				<AlertTriangle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
				<p className="text-xs text-muted-foreground">No memory events for this process</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<p className="text-xs text-muted-foreground mb-3">
				Memory limit exceeded events ({events.length} total)
			</p>
			<div className="rounded-lg border border-border bg-card divide-y divide-border">
				{events.map((ev) => (
					<div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
						<AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
						<span className="text-xs text-muted-foreground font-mono">
							{formatBytes(ev.memoryBytes)} / {formatBytes(ev.limitBytes)}
						</span>
						<span className="text-xs text-muted-foreground ml-auto">
							{new Date(ev.timestamp).toLocaleString()}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

function ActionBtn({
	icon: Icon,
	label,
	onClick,
	loading,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	onClick: () => void;
	loading: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={loading}
			className="inline-flex items-center gap-1.5 rounded-md bg-muted border border-ring px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
		>
			{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
			{label}
		</button>
	);
}
