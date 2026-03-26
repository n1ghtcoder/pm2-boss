import { create } from "zustand";

type ThemePreference = "dark" | "light" | "auto";
type ResolvedTheme = "dark" | "light";

interface ThemeState {
	/** User preference (may be "auto") */
	preference: ThemePreference;
	/** Actual resolved theme applied to DOM */
	theme: ResolvedTheme;
	setPreference: (pref: ThemePreference) => void;
	/** Cycle: dark → light → auto → dark */
	cycle: () => void;
}

const STORAGE_KEY = "pm2-boss-theme";

function getSystemTheme(): ResolvedTheme {
	return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
	if (pref === "auto") return getSystemTheme();
	return pref;
}

function getInitialPreference(): ThemePreference {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "light" || stored === "dark" || stored === "auto") return stored;
	return "dark";
}

function applyTheme(resolved: ResolvedTheme) {
	const root = document.documentElement;
	root.classList.toggle("dark", resolved === "dark");
	root.classList.toggle("light", resolved === "light");
}

const initialPref = getInitialPreference();
const initialResolved = resolveTheme(initialPref);
applyTheme(initialResolved);

const cycleOrder: ThemePreference[] = ["dark", "light", "auto"];

export const useThemeStore = create<ThemeState>()((set, get) => ({
	preference: initialPref,
	theme: initialResolved,
	setPreference: (pref) => {
		const resolved = resolveTheme(pref);
		applyTheme(resolved);
		localStorage.setItem(STORAGE_KEY, pref);
		set({ preference: pref, theme: resolved });
	},
	cycle: () => {
		const current = get().preference;
		const idx = cycleOrder.indexOf(current);
		const next = cycleOrder[(idx + 1) % cycleOrder.length];
		get().setPreference(next);
	},
}));

// Listen for system theme changes when preference is "auto"
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
	const state = useThemeStore.getState();
	if (state.preference === "auto") {
		const resolved = getSystemTheme();
		applyTheme(resolved);
		useThemeStore.setState({ theme: resolved });
	}
});
