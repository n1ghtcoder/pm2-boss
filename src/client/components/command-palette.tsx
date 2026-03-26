import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { cn } from "../lib/utils";
import { useProcessStore } from "../stores/process-store";
import { apiFetch } from "../lib/api-client";
import { toast } from "sonner";

interface Command {
	id: string;
	label: string;
	category: string;
	action: () => void;
}

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const navigate = useNavigate();
	const [, setSearchParams] = useSearchParams();
	const processes = useProcessStore((s) => s.processes);

	// Hotkey: Cmd+K / Ctrl+K
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
				setQuery("");
				setSelected(0);
			}
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	useEffect(() => {
		if (open) inputRef.current?.focus();
	}, [open]);

	const processAction = useCallback(
		async (pmId: number, action: string) => {
			try {
				await apiFetch(`/api/processes/${pmId}/${action}`, { method: "POST" });
				toast.success(`${action} successful`);
			} catch (err) {
				toast.error((err as Error).message);
			}
			setOpen(false);
		},
		[],
	);

	const globalAction = useCallback(
		async (action: string) => {
			try {
				await apiFetch(`/api/pm2/${action}`, { method: "POST" });
				toast.success(`${action} successful`);
			} catch (err) {
				toast.error((err as Error).message);
			}
			setOpen(false);
		},
		[],
	);

	const commands: Command[] = [
		// Process navigation
		...processes.map((p) => ({
			id: `go-${p.pm_id}`,
			label: `Go to ${p.name}`,
			category: "Navigate",
			action: () => {
				setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("detail", String(p.pm_id)); return next; });
				setOpen(false);
			},
		})),
		// Process actions
		...processes
			.filter((p) => p.status === "online")
			.flatMap((p) => [
				{
					id: `restart-${p.pm_id}`,
					label: `Restart ${p.name}`,
					category: "Actions",
					action: () => processAction(p.pm_id, "restart"),
				},
				{
					id: `stop-${p.pm_id}`,
					label: `Stop ${p.name}`,
					category: "Actions",
					action: () => processAction(p.pm_id, "stop"),
				},
			]),
		...processes
			.filter((p) => p.status !== "online")
			.map((p) => ({
				id: `start-${p.pm_id}`,
				label: `Start ${p.name}`,
				category: "Actions",
				action: () => processAction(p.pm_id, "restart"),
			})),
		// Global
		{ id: "go-home", label: "Go to Dashboard", category: "Navigate", action: () => { navigate("/"); setOpen(false); } },
		{ id: "dump", label: "Save process list (dump)", category: "Global", action: () => globalAction("dump") },
		{ id: "resurrect", label: "Restore process list (resurrect)", category: "Global", action: () => globalAction("resurrect") },
		{ id: "flush", label: "Flush all logs", category: "Global", action: () => globalAction("flush") },
	];

	const filtered = query
		? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
		: commands;

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelected((prev) => Math.min(prev + 1, filtered.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelected((prev) => Math.max(prev - 1, 0));
		} else if (e.key === "Enter" && filtered[selected]) {
			filtered[selected].action();
		}
	};

	if (!open) return null;

	let lastCategory = "";

	return (
		<div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} onKeyDown={() => {}}>
			<div
				className="w-full max-w-md rounded-lg border border-ring bg-card shadow-2xl overflow-hidden"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div className="flex items-center gap-2 border-b border-border px-3 py-2">
					<Search className="h-4 w-4 text-muted-foreground shrink-0" />
					<input
						ref={inputRef}
						type="text"
						placeholder="Type a command..."
						value={query}
						onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
						onKeyDown={handleKeyDown}
						className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
					/>
					<kbd className="rounded border border-ring bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">esc</kbd>
				</div>

				<div className="max-h-72 overflow-y-auto py-1">
					{filtered.length === 0 && (
						<div className="px-3 py-6 text-center text-xs text-muted-foreground">No matching commands</div>
					)}
					{filtered.map((cmd, i) => {
						const showCategory = cmd.category !== lastCategory;
						lastCategory = cmd.category;
						return (
							<div key={cmd.id}>
								{showCategory && (
									<div className="px-3 pt-2 pb-1 text-[10px] text-muted-foreground uppercase tracking-wider">
										{cmd.category}
									</div>
								)}
								<button
									type="button"
									onClick={cmd.action}
									onMouseEnter={() => setSelected(i)}
									className={cn(
										"flex w-full items-center px-3 py-1.5 text-xs transition-colors",
										i === selected ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
									)}
								>
									{cmd.label}
								</button>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
