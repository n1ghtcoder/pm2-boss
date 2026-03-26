import { useState } from "react";
import type { PM2Process } from "@shared/types";
import { cn, formatBytes, formatUptime, formatCpu, statusColors, statusDotColors } from "../lib/utils";
import { useMetricsStore } from "../stores/metrics-store";
import { Sparkline } from "./sparkline";
import { GlowCard } from "./ui/glow-card";
import type { MetricsPoint } from "@shared/types";

const EMPTY_METRICS: MetricsPoint[] = [];
import {
	Play,
	Square,
	RotateCw,
	RefreshCw,
	Trash2,
	Terminal,
	MoreVertical,
	Eye,
	Globe,
	Loader2,
} from "lucide-react";
import { apiFetch } from "../lib/api-client";
import { useEventsStore } from "../stores/events-store";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

/** Memory threshold in bytes (500 MB) — highlight in amber when exceeded */
const MEMORY_WARN_BYTES = 500 * 1024 * 1024;

const API = "/api/processes";

async function processAction(pmId: number, action: string) {
	const res = await apiFetch(`${API}/${pmId}/${action}`, { method: "POST" });
	return res.data;
}

export function ProcessCard({
	process: proc,
	onLogsOpen,
	onSelect,
	stale,
}: {
	process: PM2Process;
	onLogsOpen: (pmId: number) => void;
	onSelect: (pmId: number) => void;
	stale?: boolean;
}) {
	const metricsData = useMetricsStore((s) => s.history[proc.pm_id] ?? EMPTY_METRICS);
	const [loading, setLoading] = useState<string | null>(null);
	const [showMenu, setShowMenu] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const isOnline = proc.status === "online";

	const handleAction = async (action: string, label: string) => {
		setLoading(action);
		setShowMenu(false);
		try {
			await processAction(proc.pm_id, action);
			toast.success(`${proc.name}: ${label}`, {
				action: {
					label: "View Logs",
					onClick: () => onSelect(proc.pm_id),
				},
			});
		} catch (err) {
			toast.error(`${proc.name}: ${(err as Error).message}`, {
				action: {
					label: "Retry",
					onClick: () => handleAction(action, label),
				},
			});
		} finally {
			setLoading(null);
		}
	};

	const handleDelete = async () => {
		setLoading("delete");
		try {
			await processAction(proc.pm_id, "delete");
			toast.success(`${proc.name}: deleted`);
		} catch (err) {
			toast.error(`${proc.name}: ${(err as Error).message}`);
		} finally {
			setLoading(null);
			setConfirmDelete(false);
		}
	};

	return (
		<>
			<GlowCard
				className={cn(
					"group relative rounded-lg border bg-card p-4 transition-all",
					"hover:border-ring cursor-pointer",
					stale && "opacity-50",
					loading ? "border-ring/50 animate-pulse" : isOnline ? "border-border" : "border-border/60",
				)}
				glowColor={isOnline ? undefined : proc.status === "errored" ? "var(--color-red-500)" : undefined}
				onClick={() => onSelect(proc.pm_id)}
				onKeyDown={(e) => e.key === "Enter" && onSelect(proc.pm_id)}
			>
				{/* Header */}
				<div className="flex items-start justify-between mb-3">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h3 className="truncate text-sm font-medium text-foreground">{proc.name}</h3>
							<MemoryBadge pmId={proc.pm_id} />
							{proc.watch && <Eye className="h-3 w-3 text-muted-foreground shrink-0" />}
						</div>
						<div className="mt-0.5 flex items-center gap-2">
							<span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", statusColors[proc.status])}>
								<span className={cn("h-1.5 w-1.5 rounded-full", statusDotColors[proc.status])} />
								{proc.status}
							</span>
							<span className="text-[10px] text-muted-foreground">{proc.exec_mode}</span>
							{proc.ports?.map((port) => (
								<a
									key={port}
									href={`http://localhost:${port}`}
									target="_blank"
									rel="noopener noreferrer"
									onClick={(e) => e.stopPropagation()}
									className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
								>
									<Globe className="h-2.5 w-2.5" />
									:{port}
								</a>
							))}








						</div>
					</div>

					{/* Actions dropdown */}
					<div className="relative" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
						<button
							type="button"
							onClick={() => setShowMenu(!showMenu)}
							className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						>
							<MoreVertical className="h-4 w-4" />
						</button>
						{showMenu && (
							<>
								<div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} onKeyDown={() => {}} />
								<div className="absolute right-0 top-8 z-50 w-40 rounded-md border border-ring bg-card py-1 shadow-xl">
									{isOnline ? (
										<MenuItem icon={Square} label="Stop" onClick={() => handleAction("stop", "stopped")} loading={loading === "stop"} />
									) : (
										<MenuItem icon={Play} label="Start" onClick={() => handleAction("restart", "started")} loading={loading === "restart"} />
									)}
									<MenuItem icon={RotateCw} label="Restart" onClick={() => handleAction("restart", "restarted")} loading={loading === "restart"} />
									{proc.exec_mode === "cluster" && (
										<MenuItem icon={RefreshCw} label="Reload" onClick={() => handleAction("reload", "reloaded")} loading={loading === "reload"} />
									)}
									<MenuItem icon={Terminal} label="Logs" onClick={() => { onLogsOpen(proc.pm_id); setShowMenu(false); }} />
									<div className="my-1 border-t border-border" />
									<MenuItem icon={Trash2} label="Delete" onClick={() => { setConfirmDelete(true); setShowMenu(false); }} destructive />
								</div>
							</>
						)}
					</div>
				</div>

				{/* Sparklines */}
				{metricsData.length >= 2 && (
					<div className="flex items-center gap-3 mb-3">
						<div className="flex-1">
							<div className="text-[10px] text-muted-foreground mb-1">CPU {formatCpu(proc.cpu)}</div>
							<Sparkline data={metricsData} dataKey="cpu" color="#10b981" warnColor="#f59e0b" warnThreshold={80} />
						</div>
						<div className="flex-1">
							<div className="text-[10px] text-muted-foreground mb-1">MEM {formatBytes(proc.memory)}</div>
							<Sparkline data={metricsData} dataKey="memory" color="#3b82f6" />
						</div>
					</div>
				)}

				{/* Stats grid */}
				<div className="grid grid-cols-3 gap-3 text-xs">
					<Stat label="CPU" value={formatCpu(proc.cpu)} highlight={proc.cpu > 80} />
					<Stat label="MEM" value={formatBytes(proc.memory)} title="Resident Set Size (RSS) — actual RAM used by this process" highlight={proc.memory > MEMORY_WARN_BYTES} />
					<Stat label="Uptime" value={formatUptime(proc.uptime)} />
					<Stat label="PID" value={proc.pid > 0 ? String(proc.pid) : "–"} mono />
					<Stat label="Restarts" value={String(proc.restarts)} highlight={proc.restarts > 10} />
					<Stat label="PM2 ID" value={String(proc.pm_id)} mono />
				</div>
			</GlowCard>

			{/* Delete confirmation */}
			{confirmDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} onKeyDown={() => {}}>
					<div className="w-80 rounded-lg border border-ring bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
						<h3 className="text-base font-semibold text-foreground mb-2">Delete Process</h3>
						<p className="text-sm text-muted-foreground mb-5">
							Are you sure you want to delete <span className="text-foreground font-medium">{proc.name}</span>? This cannot be undone.
						</p>
						<div className="flex gap-2 justify-end">
							<button
								type="button"
								onClick={() => setConfirmDelete(false)}
								className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleDelete}
								disabled={loading === "delete"}
								className="rounded-md bg-red-500/15 border border-red-500/30 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
							>
								{loading === "delete" ? "Deleting..." : "Delete"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

function MemoryBadge({ pmId }: { pmId: number }) {
	const count = useEventsStore((s) => s.counts[pmId]);
	if (!count) return null;
	return (
		<span
			className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-medium text-amber-400 shrink-0"
			title={`${count} memory limit exceeded in last 24h`}
		>
			<AlertTriangle className="h-2.5 w-2.5" />
			{count}
		</span>
	);
}

function MenuItem({
	icon: Icon,
	label,
	onClick,
	loading,
	destructive,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	onClick: () => void;
	loading?: boolean;
	destructive?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={loading}
			className={cn(
				"flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors",
				destructive
					? "text-red-400 hover:bg-red-500/10"
					: "text-foreground hover:bg-muted",
				loading && "opacity-50",
			)}
		>
			{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
			{label}
		</button>
	);
}

function Stat({
	label,
	value,
	mono,
	highlight,
	title,
}: {
	label: string;
	value: string;
	mono?: boolean;
	highlight?: boolean;
	title?: string;
}) {
	return (
		<div title={title}>
			<div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
			<div
				className={cn(
					"mt-0.5 text-xs",
					mono ? "font-mono text-muted-foreground" : "text-foreground",
					highlight && "text-amber-400",
				)}
			>
				{value}
			</div>
		</div>
	);
}
