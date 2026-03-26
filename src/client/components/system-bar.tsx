import { useMetricsStore } from "../stores/metrics-store";
import { formatBytes } from "../lib/utils";
import { Cpu, HardDrive, Server, Clock } from "lucide-react";

function formatSystemUptime(seconds: number): string {
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	if (days > 0) return `${days}d ${hours}h`;
	const minutes = Math.floor((seconds % 3600) / 60);
	return `${hours}h ${minutes}m`;
}

export function SystemBar() {
	const system = useMetricsStore((s) => s.system);

	if (!system) return null;

	const memPercent = ((system.usedMemory / system.totalMemory) * 100).toFixed(0);
	const loadPercent = ((system.loadAvg[0] / system.cpuCount) * 100).toFixed(0);

	return (
		<div className="border-b border-border/50 bg-background">
		<div className="mx-auto max-w-[1600px] flex items-center gap-5 px-6 py-2">
			<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
				<Server className="h-3 w-3" />
				<span className="text-muted-foreground">{system.hostname}</span>
				<span className="text-muted-foreground">|</span>
				<span>{system.platform}</span>
				<span className="text-muted-foreground">|</span>
				<span>Node {system.nodeVersion}</span>
			</div>

			<div className="ml-auto flex items-center gap-4 text-[11px]">
				<div className="flex items-center gap-1.5">
					<Cpu className="h-3 w-3 text-muted-foreground" />
					<span className="text-muted-foreground">Load</span>
					<span className="text-foreground font-medium">{loadPercent}%</span>
					<div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
						<div
							className="h-full rounded-full bg-emerald-500 transition-all duration-500"
							style={{ width: `${Math.min(Number(loadPercent), 100)}%` }}
						/>
					</div>
				</div>

				<div className="flex items-center gap-1.5">
					<HardDrive className="h-3 w-3 text-muted-foreground" />
					<span className="text-muted-foreground">RAM</span>
					<span className="text-foreground font-medium">
						{formatBytes(system.usedMemory)} / {formatBytes(system.totalMemory)}
					</span>
					<div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
						<div
							className="h-full rounded-full bg-blue-500 transition-all duration-500"
							style={{ width: `${memPercent}%` }}
						/>
					</div>
				</div>

				<div className="flex items-center gap-1.5">
					<Clock className="h-3 w-3 text-muted-foreground" />
					<span className="text-muted-foreground">Uptime</span>
					<span className="text-foreground font-medium">{formatSystemUptime(system.uptime)}</span>
				</div>
			</div>
		</div>
		</div>
	);
}
