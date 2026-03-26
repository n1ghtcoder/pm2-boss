import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLogStore } from "../stores/log-store";
import { cn } from "../lib/utils";
import { parseAnsi, stripAnsi } from "../lib/ansi-parser";
import { X, ArrowDown, Search, Trash2, Copy, Check } from "lucide-react";
import type { LogEntry } from "@shared/types";
import { toast } from "sonner";

const EMPTY_LOGS: LogEntry[] = [];

type LogLevel = "error" | "warn" | "info" | "debug";
type LevelFilter = "all" | LogLevel;

/** Detect log level from message content and stream */
function detectLogLevel(entry: LogEntry): LogLevel {
	const msg = entry.message.toLowerCase();
	// Check stderr first
	if (entry.stream === "stderr") {
		// Some stderr is just warnings or deprecation notices
		if (/warn(ing)?\b/i.test(entry.message) || /deprecat/i.test(entry.message)) return "warn";
		return "error";
	}
	// Explicit level patterns
	if (/\[error\]|\berror[\s:]/i.test(entry.message) || /\bERR!?\b/.test(entry.message)) return "error";
	if (/\[warn(ing)?\]|\bwarn(ing)?[\s:]/i.test(entry.message)) return "warn";
	if (/\[debug\]|\bdebug[\s:]/i.test(entry.message)) return "debug";
	return "info";
}

const levelStyles: Record<LogLevel, string> = {
	error: "border-l-2 border-l-red-500/70 bg-red-500/5",
	warn: "border-l-2 border-l-amber-500/60 bg-amber-500/5",
	info: "",
	debug: "opacity-60",
};

/**
 * LogViewer — supports two modes:
 *  - Panel (default): fixed side-panel overlay for the dashboard
 *  - Embedded (embedded=true): fills parent container, for use inside modals
 */
export function LogViewer({
	pmId,
	processName,
	onClose,
	send,
	embedded = false,
}: {
	pmId: number;
	processName: string;
	onClose: () => void;
	send: (msg: any) => void;
	embedded?: boolean;
}) {
	const logs = useLogStore((s) => s.logs.get(pmId) ?? EMPTY_LOGS);
	const clearLogs = useLogStore((s) => s.clearLogs);
	const [filter, setFilter] = useState("");
	const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
	const [stickToBottom, setStickToBottom] = useState(true);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Subscribe to logs on mount
	useEffect(() => {
		send({ type: "logs:subscribe", payload: { pm_id: pmId } });
		return () => {
			send({ type: "logs:unsubscribe", payload: { pm_id: pmId } });
		};
	}, [pmId, send]);

	// Auto-scroll
	useEffect(() => {
		if (stickToBottom && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [logs, stickToBottom]);

	const handleScroll = useCallback(() => {
		if (!scrollRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		setStickToBottom(scrollHeight - scrollTop - clientHeight < 50);
	}, []);

	// Annotate logs with detected levels
	const annotatedLogs = useMemo(
		() => logs.map((entry) => ({ entry, level: detectLogLevel(entry) })),
		[logs],
	);

	// Count by level for filter badges
	const levelCounts = useMemo(() => {
		const counts = { error: 0, warn: 0, info: 0, debug: 0 };
		for (const { level } of annotatedLogs) counts[level]++;
		return counts;
	}, [annotatedLogs]);

	// Apply both text filter and level filter
	const filteredLogs = useMemo(() => {
		let result = annotatedLogs;
		if (filter) {
			const lc = filter.toLowerCase();
			result = result.filter(({ entry }) => entry.message.toLowerCase().includes(lc));
		}
		if (levelFilter !== "all") {
			result = result.filter(({ level }) => level === levelFilter);
		}
		return result;
	}, [annotatedLogs, filter, levelFilter]);

	const logContent = (
		<>
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0">
				<div className="flex items-center gap-3">
					<h2 className="text-sm font-medium text-foreground">Logs</h2>
					{!embedded && <span className="text-xs text-muted-foreground">{processName}</span>}
					<span className="text-[10px] text-muted-foreground tabular-nums">{filteredLogs.length} lines</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => clearLogs(pmId)}
						className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						title="Clear logs"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</button>
					{!embedded && (
						<button
							type="button"
							onClick={onClose}
							className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>
			</div>

			{/* Search */}
			<div className="border-b border-border px-4 py-2 shrink-0">
				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Filter logs..."
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						className="w-full rounded-md bg-card border border-border py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
					/>
				</div>
			</div>

			{/* Level filter chips */}
			<div className="flex items-center gap-1.5 border-b border-border px-4 py-1.5 shrink-0">
				<LevelChip
					label="All"
					active={levelFilter === "all"}
					onClick={() => setLevelFilter("all")}
				/>
				<LevelChip
					label="Errors"
					count={levelCounts.error}
					active={levelFilter === "error"}
					onClick={() => setLevelFilter("error")}
					variant="error"
				/>
				<LevelChip
					label="Warnings"
					count={levelCounts.warn}
					active={levelFilter === "warn"}
					onClick={() => setLevelFilter("warn")}
					variant="warn"
				/>
				<LevelChip
					label="Debug"
					count={levelCounts.debug}
					active={levelFilter === "debug"}
					onClick={() => setLevelFilter("debug")}
					variant="debug"
				/>
			</div>

			{/* Log content */}
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed relative"
			>
				{filteredLogs.length === 0 ? (
					<div className="text-center text-muted-foreground py-12">
						{logs.length === 0 ? "Waiting for logs..." : "No matching logs"}
					</div>
				) : (
					<div className="py-1">
						{filteredLogs.map(({ entry, level }, i) => (
							<LogLine key={`${entry.timestamp}-${i}`} entry={entry} level={level} />
						))}
					</div>
				)}

				{/* Stick to bottom button */}
				{!stickToBottom && (
					<button
						type="button"
						onClick={() => {
							setStickToBottom(true);
							if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
						}}
						className="sticky bottom-3 float-right mr-3 rounded-full bg-muted border border-ring p-2 text-muted-foreground hover:text-foreground shadow-lg transition-colors"
					>
						<ArrowDown className="h-4 w-4" />
					</button>
				)}
			</div>
		</>
	);

	// Embedded mode: fill parent container
	if (embedded) {
		return <div className="flex flex-col h-full">{logContent}</div>;
	}

	// Panel mode: fixed side-panel overlay
	return (
		<div className="fixed inset-0 z-50 flex">
			{/* Backdrop */}
			<div className="flex-1" onClick={onClose} onKeyDown={() => {}} />

			{/* Panel */}
			<div className="w-full max-w-2xl border-l border-border bg-background flex flex-col">
				{logContent}
			</div>
		</div>
	);
}

/** Level filter chip button */
const chipVariants: Record<string, { active: string; inactive: string }> = {
	default: {
		active: "bg-foreground/10 text-foreground border-foreground/20",
		inactive: "text-muted-foreground hover:bg-muted",
	},
	error: {
		active: "bg-red-500/15 text-red-400 border-red-500/30",
		inactive: "text-muted-foreground hover:bg-muted",
	},
	warn: {
		active: "bg-amber-500/15 text-amber-400 border-amber-500/30",
		inactive: "text-muted-foreground hover:bg-muted",
	},
	debug: {
		active: "bg-muted text-muted-foreground border-border",
		inactive: "text-muted-foreground hover:bg-muted",
	},
};

function LevelChip({
	label,
	count,
	active,
	onClick,
	variant = "default",
}: {
	label: string;
	count?: number;
	active: boolean;
	onClick: () => void;
	variant?: string;
}) {
	const styles = chipVariants[variant] ?? chipVariants.default;
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors",
				active ? styles.active : cn(styles.inactive, "border-transparent"),
			)}
		>
			{label}
			{count !== undefined && count > 0 && (
				<span className="ml-1 tabular-nums">({count})</span>
			)}
		</button>
	);
}

/** Format timestamp to HH:MM:SS */
function formatTimestamp(ts: string): string {
	try {
		const d = new Date(ts);
		if (Number.isNaN(d.getTime())) return "";
		return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
	} catch {
		return "";
	}
}

/** Single log line with timestamp, ANSI colors, level styling, and click-to-copy */
function LogLine({ entry, level }: { entry: LogEntry; level: LogLevel }) {
	const [copied, setCopied] = useState(false);
	const ts = formatTimestamp(entry.timestamp);
	const segments = parseAnsi(entry.message);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(stripAnsi(entry.message));
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error("Failed to copy");
		}
	};

	return (
		<div
			className={cn(
				"group flex items-start gap-0 px-3 py-[1px] hover:bg-muted/50 transition-colors cursor-pointer",
				levelStyles[level],
			)}
			onClick={handleCopy}
			onKeyDown={(e) => { if (e.key === "Enter") handleCopy(); }}
			role="button"
			tabIndex={0}
			title="Click to copy"
		>
			{/* Timestamp */}
			{ts && (
				<span className="shrink-0 select-none text-muted-foreground/60 mr-3 tabular-nums">
					{ts}
				</span>
			)}

			{/* Message with ANSI colors */}
			<span className={cn(
				"flex-1 break-all",
				level === "error" && !segments.some(s => s.color) ? "text-red-400" : "text-foreground",
			)}>
				{segments.map((seg, i) => (
					<span
						key={i}
						style={{
							color: seg.color || undefined,
							fontWeight: seg.bold ? 600 : undefined,
						}}
					>
						{seg.text}
					</span>
				))}
			</span>

			{/* Copy indicator */}
			<span className="shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
				{copied ? (
					<Check className="h-3 w-3 text-emerald-400" />
				) : (
					<Copy className="h-3 w-3 text-muted-foreground" />
				)}
			</span>
		</div>
	);
}
