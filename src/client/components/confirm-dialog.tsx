import { useEffect, useCallback } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
	title: string;
	description: string;
	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;
	destructive?: boolean;
}

export function ConfirmDialog({
	title,
	description,
	confirmLabel,
	onConfirm,
	onCancel,
	destructive = false,
}: ConfirmDialogProps) {
	// Escape key to dismiss
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
		},
		[onCancel],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	return (
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={onCancel}
			onKeyDown={() => {}}
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirm-title"
			aria-describedby="confirm-desc"
		>
			<div
				className="w-full max-w-sm rounded-lg border border-ring bg-card shadow-2xl"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div className="px-5 pt-5 pb-4">
					<div className="flex items-start gap-3">
						<div
							className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
								destructive
									? "bg-red-500/15 text-red-400"
									: "bg-emerald-500/15 text-emerald-400"
							}`}
						>
							<AlertTriangle className="h-4 w-4" />
						</div>
						<div>
							<h3
								id="confirm-title"
								className="text-sm font-semibold text-foreground"
							>
								{title}
							</h3>
							<p
								id="confirm-desc"
								className="mt-1 text-xs text-muted-foreground leading-relaxed"
							>
								{description}
							</p>
						</div>
					</div>
				</div>

				<div className="flex justify-end gap-2 border-t border-border px-5 py-3">
					<button
						type="button"
						onClick={onCancel}
						className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
							destructive
								? "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
								: "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
						}`}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
