import { useState, type FormEvent } from "react";
import { useAuthStore } from "../stores/auth-store";
import { Zap, Loader2 } from "lucide-react";

export function LoginPage() {
	const login = useAuthStore((s) => s.login);
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await login(username.trim(), password.trim());
		} catch (err) {
			setError((err as Error).message === "Unauthorized" ? "Invalid credentials" : (err as Error).message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-background flex items-center justify-center px-4">
			<div className="w-full max-w-sm">
				{/* Logo */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center gap-2 mb-2">
						<Zap className="h-6 w-6 text-emerald-400" />
						<h1 className="text-xl font-semibold text-foreground">pm2-boss</h1>
					</div>
					<p className="text-sm text-muted-foreground">Sign in to continue</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label
							htmlFor="username"
							className="block text-xs font-medium text-foreground mb-1.5"
						>
							Username
						</label>
						<input
							id="username"
							type="text"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							className="w-full rounded-md border border-ring bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
							placeholder="admin"
							autoFocus
							autoComplete="username"
							required
						/>
					</div>

					<div>
						<label
							htmlFor="password"
							className="block text-xs font-medium text-foreground mb-1.5"
						>
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full rounded-md border border-ring bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
							placeholder="Enter password or API token"
							autoComplete="current-password"
							required
						/>
					</div>

					{error && (
						<div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
							{error}
						</div>
					)}

					<button
						type="submit"
						disabled={loading || !username || !password}
						className="w-full rounded-md bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
					>
						{loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
						{loading ? "Signing in..." : "Sign In"}
					</button>
				</form>

				<p className="text-center text-[10px] text-muted-foreground/50 mt-6">
					You can use your API token as the password
				</p>
			</div>
		</div>
	);
}
