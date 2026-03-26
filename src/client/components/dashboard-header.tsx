import { useState } from "react";
import { useProcessStore } from "../stores/process-store";
import { useAuthStore } from "../stores/auth-store";
import { ConnectionDot } from "./connection-banner";
import { PM2ActionsMenu } from "./pm2-actions-menu";
import { ThemeToggle } from "./theme-toggle";
import { Activity, Zap, Plus, LogOut, Layers, Star, ExternalLink, X } from "lucide-react";
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

	const [aboutOpen, setAboutOpen] = useState(false);

	// Contextual button: "Start All" when no processes online, "Restart All" otherwise
	const isAllStopped = onlineCount === 0 && processes.length > 0;
	const restartLabel = isAllStopped ? "Start All" : "Restart All";
	const restartLoadingLabel = isAllStopped ? "Starting..." : "Restarting...";
	const isTg = isTelegramWebApp();

	return (
		<>
		<header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
			<div className={`mx-auto max-w-[1600px] flex items-center justify-between py-3 ${isTg ? "px-3" : "px-6"}`}>
				{/* Left: Brand + Stats (compact in TG) */}
				<div className="flex items-center gap-6">
					{!isTg && (
						<button
							type="button"
							onClick={() => setAboutOpen(true)}
							className="flex items-center gap-2 select-none cursor-pointer group"
						>
							<Zap className="h-5 w-5 text-emerald-400 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
							<h1 className="text-base font-semibold text-foreground">pm2-boss</h1>
							<ConnectionDot />
						</button>
					)}

					<div className="flex items-center gap-4 text-xs text-muted-foreground">
						<div className="flex items-center gap-1.5">
							<Activity className="h-3 w-3" />
							<span>
								<span className="text-foreground font-medium">{onlineCount}</span>
								<span className="text-muted-foreground">/{processes.length}</span>
							</span>
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
		{aboutOpen && <AboutPopup onClose={() => setAboutOpen(false)} />}
		</>
	);
}

function AboutPopup({ onClose }: { onClose: () => void }) {
	return (
		<>
			<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} onKeyDown={() => {}} />
			<div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 rounded-xl border border-ring bg-card p-6 shadow-2xl">
				<button
					type="button"
					onClick={onClose}
					className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
				>
					<X className="h-4 w-4" />
				</button>

				<div className="flex items-center gap-3 mb-4">
					<div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
						<Zap className="h-5 w-5 text-emerald-400" />
					</div>
					<div>
						<h2 className="text-base font-semibold text-foreground">pm2-boss</h2>
						<p className="text-xs text-muted-foreground">v{__PM2_BOSS_VERSION__}</p>
					</div>
				</div>

				<p className="text-sm text-muted-foreground mb-5 leading-relaxed">
					A beautiful, free PM2 dashboard. Built for ourselves, shared for everyone.
				</p>

				<div className="flex flex-col gap-2">
					<a
						href="https://github.com/n1ghtcoder/pm2-boss"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors"
					>
						<Star className="h-4 w-4" />
						Star on GitHub
						<ExternalLink className="h-3 w-3 ml-auto opacity-50" />
					</a>
					<a
						href="https://github.com/n1ghtcoder/pm2-boss/issues"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center justify-center gap-2 rounded-lg bg-muted border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						Report an issue
						<ExternalLink className="h-3 w-3 ml-auto opacity-50" />
					</a>
				</div>
			</div>
		</>
	);
}

declare const __PM2_BOSS_VERSION__: string;

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
