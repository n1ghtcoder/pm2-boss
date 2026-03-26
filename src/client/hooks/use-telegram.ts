import { useEffect, useState } from "react";
import {
	isTelegramWebApp,
	initTelegramApp,
	getTelegramColorScheme,
	haptic,
} from "../lib/telegram";
import { useThemeStore } from "../stores/theme-store";

/**
 * Hook for Telegram Mini App integration.
 * - Initializes the Telegram SDK
 * - Syncs theme with Telegram
 * - Provides haptic feedback helper
 * - Returns whether we're in Telegram context
 */
export function useTelegram() {
	const [isTg, setIsTg] = useState(false);
	const setPreference = useThemeStore((s) => s.setPreference);

	useEffect(() => {
		if (!isTelegramWebApp()) return;

		setIsTg(true);
		initTelegramApp();

		// Sync our theme store with Telegram's color scheme
		const tgScheme = getTelegramColorScheme();
		setPreference(tgScheme);
	}, [setPreference]);

	return { isTelegram: isTg, haptic };
}
