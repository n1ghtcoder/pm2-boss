import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { apiFetch } from "../lib/api-client";
import { toast } from "sonner";

export function ScaleControl({ name, currentInstances }: { name: string; currentInstances: number }) {
	const [target, setTarget] = useState(currentInstances);
	const [loading, setLoading] = useState(false);
	const [confirmDown, setConfirmDown] = useState(false);

	const applyScale = async (instances: number) => {
		setLoading(true);
		try {
			await apiFetch(`/api/processes/${encodeURIComponent(name)}/scale`, {
				method: "POST",
				body: JSON.stringify({ instances }),
			});
			toast.success(`Scaled ${name} to ${instances} instances`);
			setTarget(instances);
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setLoading(false);
			setConfirmDown(false);
		}
	};

	const handleScale = (newTarget: number) => {
		const clamped = Math.max(1, Math.min(64, newTarget));
		if (clamped < currentInstances) {
			setTarget(clamped);
			setConfirmDown(true);
		} else {
			applyScale(clamped);
		}
	};

	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Cluster Scaling</div>
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => handleScale(target - 1)}
					disabled={loading || target <= 1}
					className="rounded-md border border-ring bg-muted p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
				>
					<Minus className="h-3.5 w-3.5" />
				</button>
				<input
					type="number"
					min={1}
					max={64}
					value={target}
					onChange={(e) => setTarget(Math.max(1, Math.min(64, Number(e.target.value) || 1)))}
					onBlur={() => {
						if (target !== currentInstances) handleScale(target);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" && target !== currentInstances) handleScale(target);
					}}
					className="w-14 rounded-md border border-ring bg-muted px-2 py-1 text-center text-sm font-medium text-foreground focus:border-ring focus:outline-none"
				/>
				<button
					type="button"
					onClick={() => handleScale(target + 1)}
					disabled={loading || target >= 64}
					className="rounded-md border border-ring bg-muted p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
				>
					<Plus className="h-3.5 w-3.5" />
				</button>
				<span className="text-xs text-muted-foreground">
					{loading ? "Scaling..." : `${currentInstances} instance${currentInstances !== 1 ? "s" : ""}`}
				</span>
			</div>

			{confirmDown && (
				<div className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
					<span className="text-xs text-amber-300">Scale down to {target}? This may drop in-flight requests.</span>
					<button
						type="button"
						onClick={() => applyScale(target)}
						disabled={loading}
						className="rounded px-2 py-0.5 text-xs font-medium text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
					>
						Confirm
					</button>
					<button
						type="button"
						onClick={() => {
							setTarget(currentInstances);
							setConfirmDown(false);
						}}
						className="text-xs text-muted-foreground hover:text-foreground"
					>
						Cancel
					</button>
				</div>
			)}
		</div>
	);
}
