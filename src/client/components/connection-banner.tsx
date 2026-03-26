import { useConnectionStore } from "../stores/connection-store";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

export function ConnectionBanner() {
	const status = useConnectionStore((s) => s.status);

	if (status === "connected") return null;

	return (
		<div className="flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-sm text-amber-400">
			{status === "connecting" ? (
				<>
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
					<span>Reconnecting to server...</span>
				</>
			) : (
				<>
					<WifiOff className="h-3.5 w-3.5" />
					<span>Connection lost. Retrying...</span>
				</>
			)}
		</div>
	);
}

export function ConnectionDot() {
	const status = useConnectionStore((s) => s.status);

	const colors = {
		connected: "bg-emerald-400",
		connecting: "bg-amber-400 animate-pulse",
		disconnected: "bg-red-400",
	};

	return (
		<div className="flex items-center gap-2 text-xs text-muted-foreground">
			<div className={`h-1.5 w-1.5 rounded-full ${colors[status]}`} />
			{status !== "connected" && <span>{status}</span>}
		</div>
	);
}
