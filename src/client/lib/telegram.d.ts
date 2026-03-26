/** Telegram WebApp SDK type declarations (window.Telegram.WebApp) */

interface TelegramWebAppUser {
	id: number;
	is_bot?: boolean;
	first_name: string;
	last_name?: string;
	username?: string;
	language_code?: string;
	is_premium?: boolean;
	photo_url?: string;
}

interface TelegramWebAppThemeParams {
	bg_color?: string;
	text_color?: string;
	hint_color?: string;
	link_color?: string;
	button_color?: string;
	button_text_color?: string;
	secondary_bg_color?: string;
	header_bg_color?: string;
	accent_text_color?: string;
	section_bg_color?: string;
	section_header_text_color?: string;
	subtitle_text_color?: string;
	destructive_text_color?: string;
}

interface TelegramBackButton {
	isVisible: boolean;
	show(): void;
	hide(): void;
	onClick(callback: () => void): void;
	offClick(callback: () => void): void;
}

interface TelegramHapticFeedback {
	impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
	notificationOccurred(type: "error" | "success" | "warning"): void;
	selectionChanged(): void;
}

interface TelegramWebApp {
	initData: string;
	initDataUnsafe: {
		query_id?: string;
		user?: TelegramWebAppUser;
		auth_date?: number;
		hash?: string;
	};
	version: string;
	platform: string;
	colorScheme: "light" | "dark";
	themeParams: TelegramWebAppThemeParams;
	isExpanded: boolean;
	viewportHeight: number;
	viewportStableHeight: number;
	BackButton: TelegramBackButton;
	HapticFeedback: TelegramHapticFeedback;
	ready(): void;
	expand(): void;
	close(): void;
	setHeaderColor(color: string): void;
	setBackgroundColor(color: string): void;
	onEvent(eventType: string, callback: () => void): void;
	offEvent(eventType: string, callback: () => void): void;
}

interface Window {
	Telegram?: {
		WebApp: TelegramWebApp;
	};
}
