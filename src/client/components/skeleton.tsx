import { cn } from "../lib/utils";

/** Animated skeleton placeholder for loading states */
export function Skeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"animate-pulse rounded-md bg-muted",
				className,
			)}
		/>
	);
}

/** Skeleton card mimicking a stats grid item */
export function StatSkeleton() {
	return (
		<div className="rounded-lg border border-border bg-card p-3">
			<Skeleton className="h-2.5 w-16 mb-2" />
			<Skeleton className="h-4 w-20" />
		</div>
	);
}

/** Skeleton for a sparkline chart area */
export function SparklineSkeleton() {
	return (
		<div className="rounded-lg border border-border bg-card p-3">
			<Skeleton className="h-2.5 w-24 mb-2" />
			<Skeleton className="h-10 w-full" />
		</div>
	);
}

/** Skeleton for a config/env row */
export function RowSkeleton() {
	return (
		<div className="flex items-start gap-4 px-4 py-3">
			<Skeleton className="h-3 w-20 shrink-0" />
			<Skeleton className="h-3 w-48" />
		</div>
	);
}

/** Full modal overview skeleton */
export function OverviewSkeleton() {
	return (
		<div className="space-y-4">
			{/* Sparkline area */}
			<div className="grid grid-cols-2 gap-4">
				<SparklineSkeleton />
				<SparklineSkeleton />
			</div>
			{/* Stats grid */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				{Array.from({ length: 8 }).map((_, i) => (
					<StatSkeleton key={i} />
				))}
			</div>
		</div>
	);
}

/** Config tab skeleton */
export function ConfigSkeleton() {
	return (
		<div className="rounded-lg border border-border bg-card divide-y divide-border">
			{Array.from({ length: 6 }).map((_, i) => (
				<RowSkeleton key={i} />
			))}
		</div>
	);
}

/** Env tab skeleton */
export function EnvSkeleton() {
	return (
		<div className="space-y-2">
			<Skeleton className="h-8 w-full rounded-md" />
			<div className="rounded-lg border border-border bg-card divide-y divide-border">
				{Array.from({ length: 10 }).map((_, i) => (
					<RowSkeleton key={i} />
				))}
			</div>
		</div>
	);
}
