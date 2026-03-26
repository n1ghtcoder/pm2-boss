import { useEffect, useState } from "react";
import { X } from "lucide-react";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const mod = isMac ? "⌘" : "Ctrl";

const shortcuts = [
	{ keys: `${mod} K`, description: "Open command palette" },
	{ keys: "?", description: "Show this help" },
	{ keys: "Escape", description: "Close modal / dialog" },
];

export function ShortcutHelp() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			// Don't trigger when typing in inputs
			const target = e.target as HTMLElement;
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
				return;
			}
			if (e.key === "?") {
				e.preventDefault();
				setOpen((v) => !v);
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={() => setOpen(false)}
			onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
		>
			<div
				className="w-full max-w-sm rounded-xl border border-ring bg-background shadow-2xl"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-5 py-3">
					<h2 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
					<button
						type="button"
						onClick={() => setOpen(false)}
						className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Shortcuts list */}
				<div className="px-5 py-3 space-y-2">
					{shortcuts.map((s) => (
						<div key={s.keys} className="flex items-center justify-between py-1.5">
							<span className="text-sm text-muted-foreground">{s.description}</span>
							<kbd className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-mono text-foreground">
								{s.keys}
							</kbd>
						</div>
					))}
				</div>

				{/* Footer */}
				<div className="border-t border-border px-5 py-3">
					<p className="text-[10px] text-muted-foreground text-center">
						Press <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono">?</kbd> to toggle this panel
					</p>
				</div>
			</div>
		</div>
	);
}
