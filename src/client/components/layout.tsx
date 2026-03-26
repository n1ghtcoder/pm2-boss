import { Outlet } from "react-router-dom";
import { ConnectionBanner } from "./connection-banner";
import { PM2Error } from "./pm2-error";
import { SystemBar } from "./system-bar";
import { useConnectionStore } from "../stores/connection-store";
import { isTelegramWebApp } from "../lib/telegram";

export function Layout() {
	const pm2Connected = useConnectionStore((s) => s.pm2Connected);
	const isTg = isTelegramWebApp();

	if (!pm2Connected) {
		return <PM2Error />;
	}

	return (
		<div className="min-h-screen bg-background">
			<ConnectionBanner />
			{!isTg && <SystemBar />}
			<Outlet />
		</div>
	);
}
