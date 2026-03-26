import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`;
}

export function formatUptime(ms: number): string {
	if (ms <= 0) return "0s";
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ${hours % 24}h`;
	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
	return `${seconds}s`;
}

export function formatCpu(cpu: number): string {
	return `${cpu.toFixed(1)}%`;
}

export const statusColors = {
	online: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
	stopping: "bg-amber-500/15 text-amber-400 border-amber-500/30",
	stopped: "bg-zinc-500/10 text-muted-foreground border-zinc-500/20",
	launching: "bg-blue-500/15 text-blue-400 border-blue-500/30",
	errored: "bg-red-500/15 text-red-400 border-red-500/30",
	"one-launch-status": "bg-amber-500/15 text-amber-400 border-amber-500/30",
} as const;

export const statusDotColors = {
	online: "bg-emerald-400",
	stopping: "bg-amber-400",
	stopped: "bg-zinc-500",
	launching: "bg-blue-400",
	errored: "bg-red-400",
	"one-launch-status": "bg-amber-400",
} as const;
