import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { cn } from "../lib/utils";
import type { PM2Process } from "@shared/types";
import { CustomSelect } from "./custom-select";

const STATUS_FILTERS = ["all", "online", "stopped", "errored"] as const;
const SORT_OPTIONS = [
	{ value: "name-asc", label: "Name A-Z" },
	{ value: "cpu-desc", label: "CPU High-Low" },
	{ value: "memory-desc", label: "Memory High-Low" },
	{ value: "uptime-desc", label: "Uptime" },
	{ value: "restarts-desc", label: "Restarts" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export function useProcessFilters() {
	const [searchParams, setSearchParams] = useSearchParams();

	const query = searchParams.get("q") ?? "";
	const status = searchParams.get("status") ?? "all";
	const sort = (searchParams.get("sort") ?? "name-asc") as SortValue;
	const namespace = searchParams.get("ns") ?? "";

	const setFilter = (key: string, value: string) => {
		setSearchParams((prev) => {
			const next = new URLSearchParams(prev);
			if (!value || value === "all" || value === "name-asc") {
				next.delete(key);
			} else {
				next.set(key, value);
			}
			return next;
		});
	};

	const clearAll = () => setSearchParams({});

	const activeCount = [query, status !== "all" ? status : "", sort !== "name-asc" ? sort : "", namespace].filter(Boolean).length;

	const filterProcesses = (processes: PM2Process[]): PM2Process[] => {
		let filtered = processes;

		if (query) {
			const q = query.toLowerCase();
			filtered = filtered.filter(
				(p) =>
					p.name.toLowerCase().includes(q) ||
					p.script.toLowerCase().includes(q) ||
					p.namespace.toLowerCase().includes(q),
			);
		}

		if (status !== "all") {
			filtered = filtered.filter((p) => p.status === status);
		}

		if (namespace) {
			filtered = filtered.filter((p) => p.namespace === namespace);
		}

		const [field, dir] = sort.split("-") as [string, "asc" | "desc"];
		filtered = [...filtered].sort((a, b) => {
			let cmp = 0;
			switch (field) {
				case "name":
					cmp = a.name.localeCompare(b.name);
					break;
				case "cpu":
					cmp = a.cpu - b.cpu;
					break;
				case "memory":
					cmp = a.memory - b.memory;
					break;
				case "uptime":
					cmp = a.uptime - b.uptime;
					break;
				case "restarts":
					cmp = a.restarts - b.restarts;
					break;
			}
			return dir === "desc" ? -cmp : cmp;
		});

		return filtered;
	};

	return { query, status, sort, namespace, setFilter, clearAll, activeCount, filterProcesses };
}

export function SearchFilterBar({
	namespaces,
	query,
	status,
	sort,
	namespace,
	activeCount,
	setFilter,
	clearAll,
}: {
	namespaces: string[];
	query: string;
	status: string;
	sort: SortValue;
	namespace: string;
	activeCount: number;
	setFilter: (key: string, value: string) => void;
	clearAll: () => void;
}) {
	return (
		<div className="space-y-2 mb-4">
			<div className="flex items-center gap-2">
				{/* Search */}
				<div className="relative flex-1 max-w-xs">
					<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search processes..."
						value={query}
						onChange={(e) => setFilter("q", e.target.value)}
						className="w-full rounded-md bg-card border border-border py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
					/>
					{query && (
						<button
							type="button"
							onClick={() => setFilter("q", "")}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						>
							<X className="h-3 w-3" />
						</button>
					)}
				</div>

				{/* Sort */}
				<CustomSelect
					value={sort}
					onChange={(v) => setFilter("sort", v)}
					options={SORT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
				/>

				{/* Namespace filter */}
				{namespaces.length > 1 && (
					<CustomSelect
						value={namespace}
						onChange={(v) => setFilter("ns", v)}
						options={[
							{ value: "", label: "All namespaces" },
							...namespaces.map((ns) => ({ value: ns, label: ns })),
						]}
					/>
				)}

				{activeCount > 0 && (
					<button
						type="button"
						onClick={clearAll}
						className="flex items-center gap-1 rounded-md border border-ring px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
					>
						<X className="h-3 w-3" />
						Clear ({activeCount})
					</button>
				)}
			</div>

			{/* Status chips */}
			<div className="flex gap-1">
				{STATUS_FILTERS.map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => setFilter("status", s)}
						className={cn(
							"rounded-full border px-2.5 py-0.5 text-[10px] font-medium capitalize transition-colors",
							status === s
								? "border-ring bg-muted text-foreground"
								: "border-border text-muted-foreground hover:text-foreground",
						)}
					>
						{s}
					</button>
				))}
			</div>
		</div>
	);
}
