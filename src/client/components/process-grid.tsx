import { useMemo } from "react";
import { useConnectionStore } from "../stores/connection-store";
import { useGroupStore } from "../stores/group-store";
import { ProcessCard } from "./process-card";
import { ProcessGroupSection } from "./process-group";
import { Inbox } from "lucide-react";
import type { PM2Process, ProcessGroup } from "@shared/types";

export function ProcessGrid({
	processes,
	onLogsOpen,
	onSelect,
	onEditGroup,
}: {
	processes: PM2Process[];
	onLogsOpen: (pmId: number) => void;
	onSelect: (pmId: number) => void;
	onEditGroup: (group: ProcessGroup) => void;
}) {
	const wsStatus = useConnectionStore((s) => s.status);
	const stale = wsStatus !== "connected";
	const groups = useGroupStore((s) => s.groups);

	// Split processes into grouped and ungrouped
	const { groupedSections, ungrouped } = useMemo(() => {
		const nameToProcess = new Map<string, PM2Process[]>();
		for (const proc of processes) {
			const existing = nameToProcess.get(proc.name);
			if (existing) existing.push(proc);
			else nameToProcess.set(proc.name, [proc]);
		}

		const assigned = new Set<string>();
		const sections: { group: ProcessGroup; procs: PM2Process[] }[] = [];

		for (const group of groups) {
			const procs: PM2Process[] = [];
			for (const gName of group.processNames) {
				const matching = nameToProcess.get(gName);
				if (matching) {
					procs.push(...matching);
					assigned.add(gName);
				}
			}
			if (procs.length > 0) {
				sections.push({ group, procs });
			}
		}

		const remaining = processes.filter((p) => !assigned.has(p.name));
		return { groupedSections: sections, ungrouped: remaining };
	}, [processes, groups]);

	if (processes.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-24 text-center">
				<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 border border-border">
					<Inbox className="h-6 w-6 text-muted-foreground" />
				</div>
				<h2 className="text-base font-medium text-foreground mb-1">No processes found</h2>
				<p className="text-sm text-muted-foreground max-w-sm">
					Start a process with PM2 and it will appear here automatically.
				</p>
				<code className="mt-3 rounded-md bg-card border border-border px-3 py-1.5 text-xs text-emerald-400 font-mono">
					pm2 start your-app.js
				</code>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Grouped sections */}
			{groupedSections.map(({ group, procs }) => (
				<ProcessGroupSection
					key={group.id}
					group={group}
					processes={procs}
					onLogsOpen={onLogsOpen}
					onSelect={onSelect}
					onEdit={onEditGroup}
					stale={stale}
				/>
			))}

			{/* Ungrouped processes */}
			{ungrouped.length > 0 && (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{ungrouped.map((proc) => (
						<ProcessCard
							key={proc.pm_id}
							process={proc}
							onLogsOpen={onLogsOpen}
							onSelect={onSelect}
							stale={stale}
						/>
					))}
				</div>
			)}
		</div>
	);
}
