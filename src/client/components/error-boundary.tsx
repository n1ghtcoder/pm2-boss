import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

interface Props {
	children: ReactNode;
	fallbackLabel?: string;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		console.error("[ErrorBoundary]", error, info.componentStack);
	}

	handleRetry = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
						<AlertTriangle className="h-5 w-5 text-red-400" />
					</div>
					<h3 className="text-sm font-medium text-foreground mb-1">
						{this.props.fallbackLabel ?? "Something went wrong"}
					</h3>
					<p className="text-xs text-muted-foreground max-w-xs mb-3">
						{this.state.error?.message ?? "An unexpected error occurred"}
					</p>
					<button
						type="button"
						onClick={this.handleRetry}
						className="inline-flex items-center gap-1.5 rounded-md bg-muted border border-ring px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted hover:text-foreground transition-colors"
					>
						<RotateCw className="h-3 w-3" />
						Retry
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}
