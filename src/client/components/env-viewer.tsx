import { useEffect, useState } from "react";
import { Search, Eye, EyeOff, Copy, Check } from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/api-client";

const SENSITIVE_PATTERN = /secret|password|token|key|api_key|apikey|auth|credential/i;
const PM2_INTERNAL_PATTERN = /^(pm_|PM2_|axm_)/;

export function EnvViewer({ pmId }: { pmId: number }) {
	const [env, setEnv] = useState<Record<string, string> | null>(null);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState("");
	const [revealed, setRevealed] = useState(new Set<string>());
	const [copied, setCopied] = useState<string | null>(null);
	const [showInternal, setShowInternal] = useState(false);

	useEffect(() => {
		async function fetchEnv() {
			try {
				const res = await apiFetch<{ env?: Record<string, string> }>(`/api/processes/${pmId}`);
				if (res.data?.env) setEnv(res.data.env);
			} catch {
				// Ignore
			} finally {
				setLoading(false);
			}
		}
		fetchEnv();
	}, [pmId]);

	if (loading) {
		return <div className="py-12 text-center text-sm text-muted-foreground">Loading environment...</div>;
	}

	if (!env || Object.keys(env).length === 0) {
		return <div className="py-12 text-center text-sm text-muted-foreground">No environment variables</div>;
	}

	const entries = Object.entries(env).filter(([key]) => {
		if (!showInternal && PM2_INTERNAL_PATTERN.test(key)) return false;
		if (filter && !key.toLowerCase().includes(filter.toLowerCase())) return false;
		return true;
	});

	const toggleReveal = (key: string) => {
		setRevealed((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	const copyValue = (key: string, value: string) => {
		navigator.clipboard.writeText(value);
		setCopied(key);
		setTimeout(() => setCopied(null), 1500);
	};

	const totalCount = Object.keys(env).length;

	return (
		<div>
			<div className="flex items-center gap-2 mb-3">
				<span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
					{totalCount} variable{totalCount !== 1 ? "s" : ""}
				</span>
				<div className="relative flex-1">
					<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Filter variables..."
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						className="w-full rounded-md bg-card border border-border py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
					/>
				</div>
				<button
					type="button"
					onClick={() => setShowInternal(!showInternal)}
					className={cn(
						"rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-colors",
						showInternal
							? "border-ring bg-muted text-foreground"
							: "border-border text-muted-foreground hover:text-foreground",
					)}
				>
					PM2 Internal
				</button>
			</div>

			<div className="rounded-lg border border-border bg-card divide-y divide-border max-h-[500px] overflow-y-auto">
				{entries.length === 0 ? (
					<div className="py-8 text-center text-xs text-muted-foreground">No matching variables</div>
				) : (
					entries.map(([key, value]) => {
						const isSensitive = SENSITIVE_PATTERN.test(key);
						const isRevealed = revealed.has(key);
						const displayValue = isSensitive && !isRevealed ? "••••••••" : String(value);

						return (
							<div key={key} className="flex items-start gap-3 px-3 py-2 group">
								<span className="w-48 shrink-0 truncate text-xs text-muted-foreground font-mono pt-0.5">
									{key}
								</span>
								<span className="flex-1 text-xs text-foreground font-mono break-all min-w-0">
									{displayValue}
								</span>
								<div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
									{isSensitive && (
										<button
											type="button"
											onClick={() => toggleReveal(key)}
											className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
										>
											{isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
										</button>
									)}
									<button
										type="button"
										onClick={() => copyValue(key, String(value))}
										className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
									>
										{copied === key ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
									</button>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
