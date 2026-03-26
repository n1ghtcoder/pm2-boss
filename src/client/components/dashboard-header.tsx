import { useProcessStore } from "../stores/process-store";
import { useAuthStore } from "../stores/auth-store";
import { ConnectionDot } from "./connection-banner";
import { PM2ActionsMenu } from "./pm2-actions-menu";
import { ThemeToggle } from "./theme-toggle";
import { formatBytes, formatCpu } from "../lib/utils";
import { Activity, Cpu, HardDrive, Zap, Plus, LogOut, Layers } from "lucide-react";
import { isTelegramWebApp } from "../lib/telegram";

export function DashboardHeader({
	onStopAll,
	onRestartAll,
	onNewProcess,
	onManageGroups,
	loading,
}: {
	onStopAll: () => void;
	onRestartAll: () => void;
	onNewProcess: () => void;
	onManageGroups: () => void;
	loading: string | null;
}) {
	const processes = useProcessStore((s) => s.processes);
	const onlineCount = useProcessStore((s) => s.onlineCount);
	const totalCpu = useProcessStore((s) => s.totalCpu);
	const totalMemory = useProcessStore((s) => s.totalMemory);

	// Contextual button: "Start All" when no processes online, "Restart All" otherwise
	const isAllStopped = onlineCount === 0 && processes.length > 0;
	const restartLabel = isAllStopped ? "Start All" : "Restart All";
	const restartLoadingLabel = isAllStopped ? "Starting..." : "Restarting...";
	const isTg = isTelegramWebApp();

	return (
		<header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
			<div className={`mx-auto max-w-[1600px] flex items-center justify-between py-3 ${isTg ? "px-3" : "px-6"}`}>
				{/* Left: Brand + Stats (compact in TG) */}
				<div className="flex items-center gap-6">
					{!isTg && (
						<div className="flex items-center gap-2">
							<Zap className="h-5 w-5 text-emerald-400" />
							<h1 className="text-base font-semibold text-foreground">pm2-boss</h1>
							<ConnectionDot />
						</div>
					)}

					<div className="flex items-center gap-4 text-xs text-muted-foreground">
						<div className="flex items-center gap-1.5">
							<Activity className="h-3 w-3" />
							<span>
								<span className="text-foreground font-medium">{onlineCount}</span>
								<span className="text-muted-foreground">/{processes.length}</span>
							</span>
						</div>
						<div className="flex items-center gap-1.5">
							<Cpu className="h-3 w-3" />
							<span className="text-foreground font-medium">{formatCpu(totalCpu)}</span>
						</div>
						<div className={`flex items-center gap-1.5 ${isTg ? "" : "hidden sm:flex"}`}>
							<HardDrive className="h-3 w-3" />
							<span className="text-foreground font-medium">{formatBytes(totalMemory)}</span>
						</div>
					</div>
				</div>

				{/* Right: Actions */}
				<div className="flex items-center gap-2">
					{!isTg && (
						<>
							<button
								type="button"
								onClick={onManageGroups}
								className="inline-flex items-center gap-1.5 rounded-md bg-muted border border-ring px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted hover:text-foreground transition-colors"
								title="Manage process groups"
							>
								<Layers className="h-3.5 w-3.5" />
								Groups
							</button>
							<button
								type="button"
								onClick={onNewProcess}
								className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors"
							>
								<Plus className="h-3.5 w-3.5" />
								New
							</button>
						</>
					)}
					<button
						type="button"
						onClick={onRestartAll}
						disabled={loading !== null || processes.length === 0}
						className="rounded-md bg-muted border border-ring px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
					>
						{loading === "restart-all" ? restartLoadingLabel : restartLabel}
					</button>
					<button
						type="button"
						onClick={onStopAll}
						disabled={loading !== null || onlineCount === 0}
						className="rounded-md bg-muted border border-ring px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
					>
						{loading === "stop-all" ? "Stopping..." : "Stop All"}
					</button>
					{!isTg && (
						<>
							<div className="w-px h-5 bg-border mx-1" />
							<ThemeToggle />
							<PM2ActionsMenu />
							<UserMenu />
						</>
					)}
				</div>
			</div>
		</header>
	);
}

function UserMenu() {
	const authEnabled = useAuthStore((s) => s.authEnabled);
	const username = useAuthStore((s) => s.username);
	const logout = useAuthStore((s) => s.logout);

	if (!authEnabled) return null;

	return (
		<>
			<div className="w-px h-5 bg-border mx-1" />
			<div className="flex items-center gap-2">
				<span className="text-xs text-muted-foreground hidden sm:inline">
					{username}
				</span>
				<button
					type="button"
					onClick={logout}
					title="Sign out"
					className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
				>
					<LogOut className="h-3.5 w-3.5" />
				</button>
			</div>
		</>
	);
}
