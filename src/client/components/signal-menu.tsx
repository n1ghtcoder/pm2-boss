import { useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/api-client";
import { toast } from "sonner";

const SIGNALS = [
	{ name: "SIGTERM", desc: "Graceful shutdown", destructive: true },
	{ name: "SIGINT", desc: "Interrupt", destructive: false },
	{ name: "SIGHUP", desc: "Reload configuration", destructive: false },
	{ name: "SIGUSR1", desc: "User signal 1 (debug)", destructive: false },
	{ name: "SIGUSR2", desc: "User signal 2", destructive: false },
	{ name: "SIGKILL", desc: "Force kill", destructive: true },
] as const;

export function SignalMenu({ pmId }: { pmId: number }) {
	const [open, setOpen] = useState(false);
	const [confirm, setConfirm] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const sendSignal = async (signal: string) => {
		setLoading(true);
		try {
			await apiFetch(`/api/processes/${pmId}/signal`, {
				method: "POST",
				body: JSON.stringify({ signal }),
			});
			toast.success(`Sent ${signal} to process ${pmId}`);
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setLoading(false);
			setConfirm(null);
			setOpen(false);
		}
	};

	const handleClick = (signal: string, destructive: boolean) => {
		if (destructive) {
			setConfirm(signal);
		} else {
			sendSignal(signal);
		}
	};

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="inline-flex items-center gap-1.5 rounded-md bg-muted border border-ring px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted hover:text-foreground transition-colors"
			>
				<Zap className="h-3.5 w-3.5" />
				Signal
			</button>

			{open && (
				<>
					<div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setConfirm(null); }} onKeyDown={() => {}} />
					<div className="absolute right-0 top-9 z-50 w-52 rounded-md border border-ring bg-card py-1 shadow-xl">
						{confirm ? (
							<div className="px-3 py-2">
								<p className="text-xs text-foreground mb-2">
									Send <span className="font-medium text-red-400">{confirm}</span>?
								</p>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => sendSignal(confirm)}
										disabled={loading}
										className="rounded px-2 py-1 text-xs font-medium text-red-400 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30"
									>
										{loading ? "..." : "Send"}
									</button>
									<button
										type="button"
										onClick={() => setConfirm(null)}
										className="text-xs text-muted-foreground hover:text-foreground"
									>
										Cancel
									</button>
								</div>
							</div>
						) : (
							SIGNALS.map((sig) => (
								<button
									key={sig.name}
									type="button"
									onClick={() => handleClick(sig.name, sig.destructive)}
									className={cn(
										"flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors",
										sig.destructive ? "text-red-400 hover:bg-red-500/10" : "text-foreground hover:bg-muted",
									)}
								>
									<span className="font-mono">{sig.name}</span>
									<span className="text-[10px] text-muted-foreground">{sig.desc}</span>
								</button>
							))
						)}
					</div>
				</>
			)}
		</div>
	);
}

export function TriggerActions({ pmId, actions }: { pmId: number; actions: Array<{ action_name: string }> }) {
	const [loading, setLoading] = useState<string | null>(null);

	if (actions.length === 0) return null;

	const handleTrigger = async (actionName: string) => {
		setLoading(actionName);
		try {
			await apiFetch(`/api/processes/${pmId}/trigger`, {
				method: "POST",
				body: JSON.stringify({ action: actionName }),
			});
			toast.success(`Triggered: ${actionName}`);
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setLoading(null);
		}
	};

	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Custom Actions</div>
			<div className="flex flex-wrap gap-2">
				{actions.map((a) => (
					<button
						key={a.action_name}
						type="button"
						onClick={() => handleTrigger(a.action_name)}
						disabled={loading === a.action_name}
						className="rounded-md border border-ring bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-50"
					>
						{loading === a.action_name ? "..." : a.action_name}
					</button>
				))}
			</div>
		</div>
	);
}
