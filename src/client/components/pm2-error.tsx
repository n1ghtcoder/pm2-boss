import { AlertTriangle, RefreshCw } from "lucide-react";
import { useConnectionStore } from "../stores/connection-store";

export function PM2Error() {
	const error = useConnectionStore((s) => s.pm2Error);

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-8">
			<div className="mx-auto max-w-md text-center">
				<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
					<AlertTriangle className="h-8 w-8 text-red-400" />
				</div>
				<h1 className="mb-2 text-xl font-semibold text-foreground">PM2 Daemon Not Detected</h1>
				<p className="mb-6 text-sm text-muted-foreground leading-relaxed">
					{error || "Could not connect to the PM2 daemon. Make sure PM2 is installed and at least one process is running."}
				</p>
				<div className="mb-6 rounded-lg bg-card border border-border p-4 text-left">
					<p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick fix</p>
					<code className="block text-sm text-emerald-400 font-mono">npm install -g pm2</code>
					<code className="mt-1 block text-sm text-emerald-400 font-mono">pm2 start your-app.js</code>
					<code className="mt-1 block text-sm text-emerald-400 font-mono">npx pm2-boss</code>
				</div>
				<button
					type="button"
					onClick={() => window.location.reload()}
					className="inline-flex items-center gap-2 rounded-md bg-muted border border-ring px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
				>
					<RefreshCw className="h-3.5 w-3.5" />
					Retry Connection
				</button>
			</div>
		</div>
	);
}
