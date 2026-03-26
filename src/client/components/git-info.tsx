import { GitBranch, GitCommitHorizontal, GitFork } from "lucide-react";

interface VersioningData {
	branch: string;
	revision: string;
	comment: string;
	repo_path: string;
	repo_url: string;
}

export function GitBadge({ versioning }: { versioning?: VersioningData }) {
	if (!versioning?.branch) return null;

	return (
		<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
			<GitBranch className="h-3 w-3" />
			<span className="text-muted-foreground">{versioning.branch}</span>
			{versioning.revision && (
				<span className="text-muted-foreground font-mono">{versioning.revision.slice(0, 7)}</span>
			)}
		</div>
	);
}

export function GitSection({ versioning }: { versioning?: VersioningData }) {
	if (!versioning?.branch) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<GitFork className="h-8 w-8 text-muted-foreground/30 mb-3" />
				<p className="text-sm text-muted-foreground mb-1">No git information available</p>
				<p className="text-xs text-muted-foreground/70 max-w-sm">
					Process was not started from a git repository, or PM2 vizion is not enabled.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
				<GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
				<div>
					<div className="text-xs text-muted-foreground">Branch</div>
					<div className="text-sm text-foreground font-medium">{versioning.branch}</div>
				</div>
			</div>

			{versioning.revision && (
				<div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
					<GitCommitHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
					<div className="min-w-0">
						<div className="text-xs text-muted-foreground">Last Commit</div>
						<div className="text-sm text-foreground font-mono">
							{versioning.revision.slice(0, 7)}
						</div>
						{versioning.comment && (
							<div className="text-xs text-muted-foreground mt-0.5 truncate">{versioning.comment}</div>
						)}
					</div>
				</div>
			)}

			{versioning.repo_url && (
				<div className="rounded-lg border border-border bg-card p-3">
					<div className="text-xs text-muted-foreground mb-1">Repository</div>
					<div className="text-xs text-foreground font-mono break-all">{versioning.repo_url}</div>
				</div>
			)}
		</div>
	);
}
