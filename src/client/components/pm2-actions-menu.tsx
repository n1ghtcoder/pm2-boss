import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Archive, RotateCw, Trash2, SlidersHorizontal } from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/api-client";
import { toast } from "sonner";

export function PM2ActionsMenu() {
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [confirm, setConfirm] = useState<"resurrect" | "flush" | null>(null);
	const [loading, setLoading] = useState(false);

	const handleAction = async (action: "dump" | "resurrect" | "flush") => {
		setLoading(true);
		try {
			await apiFetch(`/api/pm2/${action}`, { method: "POST" });
			const messages = {
				dump: "Process list saved (~/.pm2/dump.pm2)",
				resurrect: "Saved processes restored",
				flush: "All log files cleared",
			};
			toast.success(messages[action]);
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setLoading(false);
			setConfirm(null);
			setOpen(false);
		}
	};

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
				title="PM2 Actions"
			>
				<Settings className="h-4 w-4" />
			</button>

			{open && (
				<>
					<div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setConfirm(null); }} onKeyDown={() => {}} />
					<div className="absolute right-0 top-9 z-50 w-48 rounded-md border border-ring bg-card py-1 shadow-xl">
						{confirm ? (
							<div className="px-3 py-2">
								<p className="text-xs text-foreground mb-2">
									{confirm === "resurrect" ? "Restore all saved processes?" : "Clear all log files permanently?"}
								</p>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => handleAction(confirm)}
										disabled={loading}
										className={cn(
											"rounded px-2 py-1 text-xs font-medium border",
											confirm === "flush"
												? "text-red-400 bg-red-500/15 hover:bg-red-500/25 border-red-500/30"
												: "text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30",
										)}
									>
										{loading ? "..." : "Confirm"}
									</button>
									<button type="button" onClick={() => setConfirm(null)} className="text-xs text-muted-foreground hover:text-foreground">
										Cancel
									</button>
								</div>
							</div>
						) : (
							<>
								<button
									type="button"
									onClick={() => { setOpen(false); navigate("/settings"); }}
									className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
								>
									<SlidersHorizontal className="h-3.5 w-3.5" />
									Settings
								</button>
								<div className="my-1 border-t border-border" />
								<button
									type="button"
									onClick={() => handleAction("dump")}
									disabled={loading}
									className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
								>
									<Archive className="h-3.5 w-3.5" />
									Save (Dump)
								</button>
								<button
									type="button"
									onClick={() => setConfirm("resurrect")}
									className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
								>
									<RotateCw className="h-3.5 w-3.5" />
									Restore (Resurrect)
								</button>
								<div className="my-1 border-t border-border" />
								<button
									type="button"
									onClick={() => setConfirm("flush")}
									className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
								>
									<Trash2 className="h-3.5 w-3.5" />
									Flush Logs
								</button>
							</>
						)}
					</div>
				</>
			)}
		</div>
	);
}
