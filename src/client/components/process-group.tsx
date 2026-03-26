import type { PM2Process, ProcessGroup } from "@shared/types";
import { cn, formatBytes, formatCpu } from "../lib/utils";
import { ProcessCard } from "./process-card";
import { useGroupStore } from "../stores/group-store";
import { ChevronDown, Pencil, Activity, Cpu, HardDrive } from "lucide-react";

const GROUP_COLORS: Record<string, { border: string; bg: string; text: string }> = {
	emerald: { border: "border-l-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400" },
	blue: { border: "border-l-blue-500", bg: "bg-blue-500/10", text: "text-blue-400" },
	amber: { border: "border-l-amber-500", bg: "bg-amber-500/10", text: "text-amber-400" },
	red: { border: "border-l-red-500", bg: "bg-red-500/10", text: "text-red-400" },
	purple: { border: "border-l-purple-500", bg: "bg-purple-500/10", text: "text-purple-400" },
	pink: { border: "border-l-pink-500", bg: "bg-pink-500/10", text: "text-pink-400" },
	cyan: { border: "border-l-cyan-500", bg: "bg-cyan-500/10", text: "text-cyan-400" },
	orange: { border: "border-l-orange-500", bg: "bg-orange-500/10", text: "text-orange-400" },
};

function getColorClasses(color?: string) {
	return GROUP_COLORS[color ?? "emerald"] ?? GROUP_COLORS.emerald;
}

export const GROUP_COLOR_OPTIONS = Object.keys(GROUP_COLORS);

export function ProcessGroupSection({
	group,
	processes,
	onLogsOpen,
	onSelect,
	onEdit,
	stale,
}: {
	group: ProcessGroup;
	processes: PM2Process[];
	onLogsOpen: (pmId: number) => void;
	onSelect: (pmId: number) => void;
	onEdit: (group: ProcessGroup) => void;
	stale: boolean;
}) {
	const toggleCollapse = useGroupStore((s) => s.toggleCollapse);
	const colors = getColorClasses(group.color);

	const onlineCount = processes.filter((p) => p.status === "online").length;
	const totalCpu = processes.reduce((sum, p) => sum + p.cpu, 0);
	const totalMemory = processes.reduce((sum, p) => sum + p.memory, 0);

	return (
		<div className={cn("rounded-lg border border-border bg-card/50 overflow-hidden border-l-[3px]", colors.border)}>
			{/* Clickable header */}
			<button
				type="button"
				onClick={() => toggleCollapse(group.id)}
				className="w-full flex items-center gap-3 px-4 py-3 text-left group hover:bg-muted/30 transition-colors"
			>
				<ChevronDown
					className={cn(
						"h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
						group.collapsed && "-rotate-90",
					)}
				/>
				<span className="text-sm font-semibold text-foreground truncate">{group.name}</span>

				{/* Aggregate stats */}
				<div className="flex items-center gap-3 ml-auto text-[11px] text-muted-foreground shrink-0">
					<div className="flex items-center gap-1">
						<Activity className="h-3 w-3" />
						<span className="text-foreground font-medium">{onlineCount}</span>
						<span>/{processes.length}</span>
					</div>
					<div className="flex items-center gap-1">
						<Cpu className="h-3 w-3" />
						<span className="text-foreground font-medium">{formatCpu(totalCpu)}</span>
					</div>
					<div className="hidden sm:flex items-center gap-1">
						<HardDrive className="h-3 w-3" />
						<span className="text-foreground font-medium">{formatBytes(totalMemory)}</span>
					</div>
				</div>

				{/* Edit button — visible on hover */}
				<span
					className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
					onClick={(e) => {
						e.stopPropagation();
						onEdit(group);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.stopPropagation();
							onEdit(group);
						}
					}}
					role="button"
					tabIndex={0}
					title="Edit group"
				>
					<Pencil className="h-3 w-3" />
				</span>
			</button>

			{/* Collapsible body */}
			{!group.collapsed && (
				<div className="px-3 pb-3">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{processes.map((proc) => (
							<ProcessCard
								key={proc.pm_id}
								process={proc}
								onLogsOpen={onLogsOpen}
								onSelect={onSelect}
								stale={stale}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
