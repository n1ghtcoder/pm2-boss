/**
 * Zero-dependency JSON syntax highlighter with collapsible nodes.
 * Renders JSON with iTerm-style colored tokens.
 * Nested objects/arrays with >3 keys or >5 items start collapsed at depth >= 2.
 */

import { useState } from "react";
import { cn } from "../lib/utils";
import { ChevronRight } from "lucide-react";

interface JsonHighlightProps {
	data: unknown;
	className?: string;
}

const colors = {
	key: "text-sky-400",
	string: "text-emerald-400",
	number: "text-amber-400",
	boolean: "text-violet-400",
	null: "text-muted-foreground/60",
	punct: "text-muted-foreground/80",
	summary: "text-muted-foreground/50 italic",
};

function escapeString(s: string): string {
	return s
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t");
}

/** Threshold: collapse nested objects/arrays if they're "large" */
function shouldStartCollapsed(value: unknown, depth: number): boolean {
	if (depth < 1) return false; // top-level always expanded
	if (Array.isArray(value)) return value.length > 5;
	if (typeof value === "object" && value !== null) return Object.keys(value).length > 3;
	return false;
}

function JsonValue({ value, depth, indent }: { value: unknown; depth: number; indent: number }) {
	if (value === null) return <span className={colors.null}>null</span>;
	if (typeof value === "boolean") return <span className={colors.boolean}>{String(value)}</span>;
	if (typeof value === "number") return <span className={colors.number}>{String(value)}</span>;
	if (typeof value === "string") {
		return <span className={colors.string}>"{escapeString(value)}"</span>;
	}

	if (Array.isArray(value)) {
		return <JsonArray items={value} depth={depth} indent={indent} />;
	}

	if (typeof value === "object") {
		return <JsonObject obj={value as Record<string, unknown>} depth={depth} indent={indent} />;
	}

	return <span className={colors.string}>{String(value)}</span>;
}

function JsonObject({ obj, depth, indent }: { obj: Record<string, unknown>; depth: number; indent: number }) {
	const entries = Object.entries(obj);
	const [collapsed, setCollapsed] = useState(() => shouldStartCollapsed(obj, depth));

	if (entries.length === 0) {
		return <span className={colors.punct}>{"{}"}</span>;
	}

	const pad = "  ".repeat(indent);
	const padInner = "  ".repeat(indent + 1);

	if (collapsed) {
		return (
			<span>
				<button
					type="button"
					onClick={() => setCollapsed(false)}
					className="inline-flex items-center gap-0 hover:opacity-80 transition-opacity align-baseline"
				>
					<ChevronRight className="h-3 w-3 text-muted-foreground/60 inline shrink-0" />
					<span className={colors.punct}>{"{"}</span>
					<span className={colors.summary}>{" "}{entries.length} keys{" "}</span>
					<span className={colors.punct}>{"}"}</span>
				</button>
			</span>
		);
	}

	return (
		<span>
			{depth > 0 && (
				<button
					type="button"
					onClick={() => setCollapsed(true)}
					className="inline-flex items-center hover:opacity-80 transition-opacity align-baseline"
				>
					<ChevronRight className="h-3 w-3 text-muted-foreground/60 inline shrink-0 rotate-90 transition-transform" />
				</button>
			)}
			<span className={colors.punct}>{"{\n"}</span>
			{entries.map(([key, val], i) => (
				<span key={key}>
					<span className={colors.punct}>{padInner}</span>
					<span className={colors.key}>"{escapeString(key)}"</span>
					<span className={colors.punct}>{": "}</span>
					<JsonValue value={val} depth={depth + 1} indent={indent + 1} />
					{i < entries.length - 1 ? (
						<span className={colors.punct}>{",\n"}</span>
					) : (
						<span className={colors.punct}>{"\n"}</span>
					)}
				</span>
			))}
			<span className={colors.punct}>{pad}{"}"}</span>
		</span>
	);
}

function JsonArray({ items, depth, indent }: { items: unknown[]; depth: number; indent: number }) {
	const [collapsed, setCollapsed] = useState(() => shouldStartCollapsed(items, depth));

	if (items.length === 0) {
		return <span className={colors.punct}>{"[]"}</span>;
	}

	const pad = "  ".repeat(indent);
	const padInner = "  ".repeat(indent + 1);

	if (collapsed) {
		return (
			<span>
				<button
					type="button"
					onClick={() => setCollapsed(false)}
					className="inline-flex items-center gap-0 hover:opacity-80 transition-opacity align-baseline"
				>
					<ChevronRight className="h-3 w-3 text-muted-foreground/60 inline shrink-0" />
					<span className={colors.punct}>{"["}</span>
					<span className={colors.summary}>{" "}{items.length} items{" "}</span>
					<span className={colors.punct}>{"]"}</span>
				</button>
			</span>
		);
	}

	return (
		<span>
			{depth > 0 && (
				<button
					type="button"
					onClick={() => setCollapsed(true)}
					className="inline-flex items-center hover:opacity-80 transition-opacity align-baseline"
				>
					<ChevronRight className="h-3 w-3 text-muted-foreground/60 inline shrink-0 rotate-90 transition-transform" />
				</button>
			)}
			<span className={colors.punct}>{"[\n"}</span>
			{items.map((item, i) => (
				<span key={i}>
					<span className={colors.punct}>{padInner}</span>
					<JsonValue value={item} depth={depth + 1} indent={indent + 1} />
					{i < items.length - 1 ? (
						<span className={colors.punct}>{",\n"}</span>
					) : (
						<span className={colors.punct}>{"\n"}</span>
					)}
				</span>
			))}
			<span className={colors.punct}>{pad}{"]"}</span>
		</span>
	);
}

export function JsonHighlight({ data, className }: JsonHighlightProps) {
	const isJson = typeof data === "object" && data !== null;

	if (!isJson) {
		return (
			<pre className={cn("whitespace-pre-wrap break-all", className)}>
				{typeof data === "string" ? data : String(data)}
			</pre>
		);
	}

	return (
		<pre className={cn("whitespace-pre-wrap break-all font-mono text-[11px]", className)}>
			<JsonValue value={data} depth={0} indent={0} />
		</pre>
	);
}
