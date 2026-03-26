import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Layout } from "./components/layout";
import { Dashboard } from "./pages/dashboard";
import { SettingsPage } from "./pages/settings";
import { LoginPage } from "./pages/login";
import { ErrorBoundary } from "./components/error-boundary";
import { useWebSocket } from "./hooks/use-websocket";
import { useThemeStore } from "./stores/theme-store";
import { useAuthStore } from "./stores/auth-store";
import { useProcessStore } from "./stores/process-store";
import { useMetricsStore } from "./stores/metrics-store";
import { useConnectionStore } from "./stores/connection-store";
import { useGroupStore } from "./stores/group-store";
import { ShortcutHelp } from "./components/shortcut-help";
import { useTelegram } from "./hooks/use-telegram";

/** Check if demo mode is active (for screenshots or GitHub Pages) */
const isDemo =
	new URLSearchParams(window.location.search).has("demo") ||
	window.location.hostname.endsWith("github.io");

/** Authenticated app — WebSocket only starts after auth succeeds */
function AuthenticatedApp() {
	useWebSocket();

	return (
		<Routes>
			<Route element={<Layout />}>
				<Route path="/" element={<Dashboard />} />
				<Route path="/settings" element={<SettingsPage />} />
				{/* Legacy route: redirect /process/:pmId to dashboard with modal open */}
				<Route path="/process/:pmId" element={<LegacyRedirect />} />
			</Route>
		</Routes>
	);
}

/** Demo mode — no server, just mock data for screenshots */
function DemoApp() {
	useEffect(() => {
		import("./lib/demo-data").then(({ demoData }) => {
			useProcessStore.getState().setProcesses(demoData.processes);
			useMetricsStore.getState().setHistory(demoData.metrics);
			useMetricsStore.getState().setSystem(demoData.system);
			useConnectionStore.getState().setStatus("connected");
			useGroupStore.setState({ groups: demoData.groups });
		});
	}, []);

	return (
		<Routes>
			<Route element={<Layout />}>
				<Route path="/" element={<Dashboard />} />
				<Route path="/settings" element={<SettingsPage />} />
			</Route>
		</Routes>
	);
}

/** Redirects old /process/:pmId URLs to /?detail=:pmId */
function LegacyRedirect() {
	const pmId = window.location.pathname.split("/").pop();
	return <Navigate to={`/?detail=${pmId}`} replace />;
}

/** Auth-aware root — shows login or app based on auth state */
function AppInner() {
	const authStatus = useAuthStore((s) => s.status);
	const checkAuth = useAuthStore((s) => s.checkAuth);
	const { isTelegram } = useTelegram();

	useEffect(() => {
		checkAuth();
	}, [checkAuth]);

	// Loading while checking auth
	if (authStatus === "loading") {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
			</div>
		);
	}

	// Auth required but not authenticated
	if (authStatus === "unauthenticated") {
		return <LoginPage />;
	}

	// Auth disabled or authenticated — render the full app
	return <AuthenticatedApp />;
}

/** Demo-aware root — skips auth entirely in demo mode */
function AppRoot() {
	if (isDemo) return <DemoApp />;
	return <AppInner />;
}

export function App() {
	const theme = useThemeStore((s) => s.theme);

	return (
		<ErrorBoundary fallbackLabel="Application error">
			<BrowserRouter>
				<AppRoot />
				<ShortcutHelp />
				<Toaster
					theme={theme}
					position="bottom-right"
					toastOptions={{
						style: {
							background: "var(--color-card)",
							border: "1px solid var(--color-border)",
							color: "var(--color-foreground)",
						},
					}}
				/>
			</BrowserRouter>
		</ErrorBoundary>
	);
}
