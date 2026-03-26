import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { PM2ProcessDetail, MetricsPoint } from "@shared/types";
import { cn, formatBytes, formatUptime, formatCpu, statusColors, statusDotColors } from "../lib/utils";
import { LogViewer } from "../components/log-viewer";
import { EnvViewer } from "../components/env-viewer";
import { GitSection } from "../components/git-info";
import { Sparkline } from "../components/sparkline";
import { ScaleControl } from "../components/scale-control";
import { SignalMenu, TriggerActions } from "../components/signal-menu";
import { useMetricsStore } from "../stores/metrics-store";
import { useWebSocket } from "../hooks/use-websocket";
import { toast } from "sonner";

const EMPTY_METRICS: MetricsPoint[] = [];
import {
	ArrowLeft,
	Play,
	Square,
	RotateCw,
	RefreshCw,
	Trash2,
	Terminal,
	Pencil,
	Save,
	XCircle,
	Copy,
	Check,
	Loader2,
} from "lucide-react";
import { apiFetch } from "../lib/api-client";

type Tab = "overview" | "config" | "env" | "git" | "logs";

export function ProcessDetail() {
	const { pmId } = useParams();
	const navigate = useNavigate();
	const { send } = useWebSocket();
	const [detail, setDetail] = useState<PM2ProcessDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<Tab>("overview");
	const [actionLoading, setActionLoading] = useState<string | null>(null);

	const numericPmId = Number(pmId);

	useEffect(() => {
		async function fetchDetail() {
			try {
				const res = await fetch(`/api/processes/${pmId}`);
				const json = await res.json();
				if (json.data) setDetail(json.data);
			} catch {
				// Ignore
			} finally {
				setLoading(false);
			}
		}
		fetchDetail();
		const interval = setInterval(fetchDetail, 2000);
		return () => clearInterval(interval);
	}, [pmId]);

	const handleAction = async (action: string, label: string) => {
		setActionLoading(action);
		try {
			const res = await fetch(`/api/processes/${pmId}/${action}`, { method: "POST" });
			const json = await res.json();
			if (json.error) throw new Error(json.error);
			toast.success(label);
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setActionLoading(null);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-24">
				<div className="h-6 w-6 animate-spin rounded-full border-2 border-ring border-t-muted-foreground" />
			</div>
		);
	}

	if (!detail) {
		return (
			<div className="flex flex-col items-center justify-center py-24 text-center">
				<p className="text-sm text-muted-foreground">Process not found</p>
				<button type="button" onClick={() => navigate("/")} className="mt-4 text-sm text-emerald-400 hover:underline">
					Back to dashboard
				</button>
			</div>
		);
	}

	const isOnline = detail.status === "online";

	return (
		<div className="mx-auto max-w-4xl px-6 py-6">
			{/* Breadcrumb + Actions */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => navigate("/")}
						className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					>
						<ArrowLeft className="h-4 w-4" />
					</button>
					<div>
						<h1 className="text-lg font-semibold text-foreground">{detail.name}</h1>
						<div className="flex items-center gap-2 mt-0.5">
							<span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", statusColors[detail.status])}>
								<span className={cn("h-1.5 w-1.5 rounded-full", statusDotColors[detail.status])} />
								{detail.status}
							</span>
							<span className="text-xs text-muted-foreground">{detail.exec_mode} mode</span>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{isOnline ? (
						<ActionBtn icon={Square} label="Stop" onClick={() => handleAction("stop", "Stopped")} loading={actionLoading === "stop"} />
					) : (
						<ActionBtn icon={Play} label="Start" onClick={() => handleAction("restart", "Started")} loading={actionLoading === "restart"} />
					)}
					<ActionBtn icon={RotateCw} label="Restart" onClick={() => handleAction("restart", "Restarted")} loading={actionLoading === "restart"} />
					{detail.exec_mode === "cluster" && (
						<ActionBtn icon={RefreshCw} label="Reload" onClick={() => handleAction("reload", "Reloaded")} loading={actionLoading === "reload"} />
					)}
					{isOnline && <SignalMenu pmId={numericPmId} />}
				</div>
			</div>

			{/* Tabs */}
			<div className="flex gap-1 border-b border-border mb-6">
				{(["overview", "config", "env", "git", "logs"] as const).map((tab) => (
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

			{/* Tab content */}
			{activeTab === "overview" && <OverviewTab detail={detail} pmId={numericPmId} />}
			{activeTab === "config" && <ConfigTab detail={detail} />}
			{activeTab === "env" && <EnvViewer pmId={numericPmId} />}
			{activeTab === "git" && <GitSection versioning={detail.versioning} />}
			{activeTab === "logs" && (
				<div className="rounded-lg border border-border bg-card h-[600px] flex flex-col overflow-hidden">
					<LogViewer pmId={numericPmId} processName={detail.name} onClose={() => setActiveTab("overview")} send={send} />
				</div>
			)}
		</div>
	);
}

function OverviewTab({ detail, pmId }: { detail: PM2ProcessDetail; pmId: number }) {
	const metricsData = useMetricsStore((s) => s.history[pmId] ?? EMPTY_METRICS);
	const stats = [
		{ label: "PID", value: detail.pid > 0 ? String(detail.pid) : "--", mono: true },
		{ label: "PM2 ID", value: String(detail.pm_id), mono: true },
		{ label: "CPU", value: formatCpu(detail.cpu) },
		{ label: "Memory", value: formatBytes(detail.memory) },
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

	type ConfigItem = { label: string; key: string; value: string; editable: boolean };

	const items: ConfigItem[] = [
		{ label: "Script", key: "script", value: detail.script, editable: true },
		{ label: "CWD", key: "cwd", value: detail.cwd, editable: true },
		{ label: "Interpreter", key: "interpreter", value: detail.interpreter, editable: true },
		{ label: "Args", key: "args", value: detail.args.join(" ") || "–", editable: true },
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

	const cancelEdit = () => { setEditing(null); setEditValue(""); };

	const saveEdit = async (key: string) => {
		setSaving(true);
		try {
			await apiFetch(`/api/processes/${detail.pm_id}/config`, {
				method: "PUT",
				body: JSON.stringify({ [key]: editValue }),
			});
			toast.success(`Config updated — process restarting`, { description: `${key}: ${editValue}` });
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
			<p className="text-xs text-muted-foreground">Editing a field will restart the process with the new configuration.</p>
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
									onKeyDown={(e) => { if (e.key === "Enter") saveEdit(item.key); if (e.key === "Escape") cancelEdit(); }}
									className="input-field flex-1 text-xs font-mono"
									autoFocus
									disabled={saving}
								/>
								<button type="button" onClick={() => saveEdit(item.key)} disabled={saving || editValue === item.value} className="shrink-0 rounded p-1 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40" title="Save">
									{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
								</button>
								<button type="button" onClick={cancelEdit} disabled={saving} className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40" title="Cancel (Esc)">
									<XCircle className="h-3.5 w-3.5" />
								</button>
							</div>
						) : (
							<>
								<span className="flex-1 text-xs text-foreground font-mono break-all pt-0.5">{item.value}</span>
								<div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
									{item.editable && (
										<button type="button" onClick={() => startEdit(item)} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Edit">
											<Pencil className="h-3 w-3" />
										</button>
									)}
									<button type="button" onClick={() => copyValue(item.label, item.value)} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Copy">
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
			<Icon className="h-3.5 w-3.5" />
			{loading ? "..." : label}
		</button>
	);
}
