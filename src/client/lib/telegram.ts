/// <reference path="./telegram.d.ts" />

/** Check if running inside Telegram Mini App WebView */
export function isTelegramWebApp(): boolean {
	return !!(window.Telegram?.WebApp?.initData);
}

/** Get the Telegram WebApp instance (or null) */
export function getTelegramWebApp(): TelegramWebApp | null {
	return window.Telegram?.WebApp ?? null;
}

/** Get raw initData string for server-side validation */
export function getInitData(): string {
	return window.Telegram?.WebApp?.initData ?? "";
}

/** Get Telegram color scheme */
export function getTelegramColorScheme(): "light" | "dark" {
	return window.Telegram?.WebApp?.colorScheme ?? "dark";
}

/** Apply Telegram theme colors to CSS custom properties */
export function applyTelegramTheme() {
	const tg = window.Telegram?.WebApp;
	if (!tg) return;

	const params = tg.themeParams;
	const root = document.documentElement;

	// Map Telegram theme to our CSS variables
	if (params.bg_color) {
		root.style.setProperty("--tg-bg", params.bg_color);
	}
	if (params.text_color) {
		root.style.setProperty("--tg-text", params.text_color);
	}
	if (params.hint_color) {
		root.style.setProperty("--tg-hint", params.hint_color);
	}
	if (params.secondary_bg_color) {
		root.style.setProperty("--tg-secondary-bg", params.secondary_bg_color);
	}
	if (params.header_bg_color) {
		root.style.setProperty("--tg-header-bg", params.header_bg_color);
	}

	// Set header/background colors to match our dark theme
	if (tg.colorScheme === "dark") {
		tg.setHeaderColor("#09090b"); // zinc-950
		tg.setBackgroundColor("#09090b");
	} else {
		tg.setHeaderColor("#ffffff");
		tg.setBackgroundColor("#ffffff");
	}
}

/** Initialize Telegram Mini App */
export function initTelegramApp() {
	const tg = window.Telegram?.WebApp;
	if (!tg) return;

	tg.ready();
	tg.expand();
	applyTelegramTheme();

	// Listen for theme changes
	tg.onEvent("themeChanged", () => {
		applyTelegramTheme();
	});
}

/** Trigger haptic feedback */
export function haptic(type: "success" | "error" | "warning" | "light" | "medium" | "heavy") {
	const tg = window.Telegram?.WebApp;
	if (!tg) return;

	switch (type) {
		case "success":
		case "error":
		case "warning":
			tg.HapticFeedback.notificationOccurred(type);
			break;
		case "light":
		case "medium":
		case "heavy":
			tg.HapticFeedback.impactOccurred(type);
			break;
	}
}

/** Show/hide Telegram back button */
export function setBackButton(visible: boolean, onClick?: () => void) {
	const tg = window.Telegram?.WebApp;
	if (!tg) return;

	if (visible) {
		tg.BackButton.show();
		if (onClick) tg.BackButton.onClick(onClick);
	} else {
		tg.BackButton.hide();
	}
}
