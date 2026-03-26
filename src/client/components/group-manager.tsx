import { useState, useEffect, useCallback } from "react";
import { X, Trash2, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useGroupStore } from "../stores/group-store";
import { useProcessStore } from "../stores/process-store";
import { GROUP_COLOR_OPTIONS } from "./process-group";
import type { ProcessGroup } from "@shared/types";
import { toast } from "sonner";

const COLOR_SWATCHES: Record<string, string> = {
	emerald: "bg-emerald-500",
	blue: "bg-blue-500",
	amber: "bg-amber-500",
	red: "bg-red-500",
	purple: "bg-purple-500",
	pink: "bg-pink-500",
	cyan: "bg-cyan-500",
	orange: "bg-orange-500",
};

export function GroupManagerModal({
	open,
	onClose,
	editGroup,
}: {
	open: boolean;
	onClose: () => void;
	editGroup?: ProcessGroup | null;
}) {
	const processes = useProcessStore((s) => s.processes);
	const createGroup = useGroupStore((s) => s.createGroup);
	const updateGroup = useGroupStore((s) => s.updateGroup);
	const deleteGroup = useGroupStore((s) => s.deleteGroup);
	const groups = useGroupStore((s) => s.groups);

	const [name, setName] = useState("");
	const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
	const [color, setColor] = useState("emerald");
	const [loading, setLoading] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState(false);

	// Unique process names available
	const allNames = [...new Set(processes.map((p) => p.name))].sort();

	// Names already assigned to OTHER groups (not the one being edited)
	const assignedNames = new Set(
		groups
			.filter((g) => g.id !== editGroup?.id)
			.flatMap((g) => g.processNames),
	);

	// Reset form when opening/switching
	useEffect(() => {
		if (open) {
			if (editGroup) {
				setName(editGroup.name);
				setSelectedNames(new Set(editGroup.processNames));
				setColor(editGroup.color ?? "emerald");
			} else {
				setName("");
				setSelectedNames(new Set());
				setColor("emerald");
			}
			setDeleteConfirm(false);
		}
	}, [open, editGroup]);

	// Escape to close
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		},
		[onClose],
	);

	useEffect(() => {
		if (!open) return;
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, handleKeyDown]);

	if (!open) return null;

	const toggleName = (n: string) => {
		setSelectedNames((prev) => {
			const next = new Set(prev);
			if (next.has(n)) next.delete(n);
			else next.add(n);
			return next;
		});
	};

	const handleSubmit = async () => {
		if (!name.trim()) {
			toast.error("Group name is required");
			return;
		}
		if (selectedNames.size === 0) {
			toast.error("Select at least one process");
			return;
		}
		setLoading(true);
		try {
			if (editGroup) {
				await updateGroup(editGroup.id, {
					name: name.trim(),
					processNames: [...selectedNames],
					color,
				});
				toast.success("Group updated");
			} else {
				await createGroup({
					name: name.trim(),
					processNames: [...selectedNames],
					color,
				});
				toast.success("Group created");
			}
			onClose();
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async () => {
		if (!editGroup) return;
		if (!deleteConfirm) {
			setDeleteConfirm(true);
			return;
		}
		setLoading(true);
		try {
			await deleteGroup(editGroup.id);
			toast.success("Group deleted");
			onClose();
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={onClose}
			onKeyDown={() => {}}
			role="dialog"
			aria-modal="true"
			aria-labelledby="group-title"
		>
			<div
				className="w-full max-w-md rounded-lg border border-ring bg-card shadow-2xl max-h-[80vh] flex flex-col"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-5 pt-5 pb-3">
					<h3 id="group-title" className="text-sm font-semibold text-foreground">
						{editGroup ? "Edit Group" : "Create Group"}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
					{/* Name input */}
					<div>
						<label htmlFor="group-name" className="block text-xs text-muted-foreground mb-1">Name</label>
						<input
							id="group-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. 3D Office"
							className="w-full rounded-md bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
						/>
					</div>

					{/* Color picker */}
					<div>
						<label className="block text-xs text-muted-foreground mb-1.5">Color</label>
						<div className="flex gap-2">
							{GROUP_COLOR_OPTIONS.map((c) => (
								<button
									key={c}
									type="button"
									onClick={() => setColor(c)}
									className={cn(
										"h-6 w-6 rounded-full transition-all",
										COLOR_SWATCHES[c],
										color === c ? "ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110" : "opacity-60 hover:opacity-100",
									)}
									title={c}
								/>
							))}
						</div>
					</div>

					{/* Process selection */}
					<div>
						<label className="block text-xs text-muted-foreground mb-1.5">
							Processes ({selectedNames.size} selected)
						</label>
						<div className="rounded-md border border-border bg-background max-h-56 overflow-y-auto divide-y divide-border">
							{allNames.length === 0 ? (
								<div className="px-3 py-4 text-center text-xs text-muted-foreground">
									No processes found
								</div>
							) : (
								allNames.map((n) => {
									const isAssigned = assignedNames.has(n);
									const isSelected = selectedNames.has(n);
									return (
										<label
											key={n}
											className={cn(
												"flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30 transition-colors",
												isAssigned && !isSelected && "opacity-40 cursor-not-allowed",
											)}
										>
											<input
												type="checkbox"
												checked={isSelected}
												disabled={isAssigned && !isSelected}
												onChange={() => toggleName(n)}
												className="rounded border-border text-emerald-400 focus:ring-emerald-400 bg-background"
											/>
											<span className={cn("text-foreground", isAssigned && !isSelected && "line-through")}>
												{n}
											</span>
											{isAssigned && !isSelected && (
												<span className="ml-auto text-[10px] text-muted-foreground">
													in another group
												</span>
											)}
										</label>
									);
								})
							)}
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between border-t border-border px-5 py-3">
					<div>
						{editGroup && (
							<button
								type="button"
								onClick={handleDelete}
								disabled={loading}
								className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50"
							>
								<Trash2 className="h-3 w-3" />
								{deleteConfirm ? "Confirm delete" : "Delete"}
							</button>
						)}
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={loading}
							className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-4 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
						>
							{loading && <Loader2 className="h-3 w-3 animate-spin" />}
							{editGroup ? "Save" : "Create"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
