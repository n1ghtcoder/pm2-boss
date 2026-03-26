import { cn } from "../lib/utils";

/**
 * Distributes total CPU usage across cores, filling from left to right.
 * e.g. 226.6% on 8 cores → [100, 100, 26.6, 0, 0, 0, 0, 0]
 */
function distributeLoad(totalCpu: number, coreCount: number): number[] {
	const cores: number[] = [];
	let remaining = totalCpu;
	for (let i = 0; i < coreCount; i++) {
		const load = Math.min(remaining, 100);
		cores.push(Math.max(0, load));
		remaining -= 100;
	}
	return cores;
}

function coreColor(load: number): string {
	if (load < 1) return "bg-muted";
	if (load < 40) return "bg-emerald-500";
	if (load < 80) return "bg-amber-500";
	return "bg-red-500";
}

/**
 * Visual CPU core usage indicator — small colored squares.
 * Green = idle/light, Yellow = medium, Red = heavy, Gray = unused.
 */
export function CpuCores({
	totalCpu,
	coreCount,
	size = "sm",
}: {
	totalCpu: number;
	coreCount: number;
	size?: "sm" | "xs";
}) {
	const cores = distributeLoad(totalCpu, coreCount);
	const usedCores = Math.ceil(totalCpu / 100);
	const sq = size === "xs" ? "h-1.5 w-1.5" : "h-2 w-2";

	return (
		<div className="flex items-center gap-1" title={`${totalCpu.toFixed(1)}% across ${coreCount} cores (${usedCores} active)`}>
			<div className={cn("flex gap-0.5", coreCount > 16 && "flex-wrap max-w-[120px]")}>
				{cores.map((load, i) => (
					<div
						key={i}
						className={cn(sq, "rounded-[2px] transition-colors duration-500", coreColor(load))}
					/>
				))}
			</div>
		</div>
	);
}
