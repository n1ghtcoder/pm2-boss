import { Sun, Moon, Monitor } from "lucide-react";
import { useThemeStore } from "../stores/theme-store";

const labels = {
	dark: "Dark",
	light: "Light",
	auto: "Auto",
} as const;

export function ThemeToggle() {
	const preference = useThemeStore((s) => s.preference);
	const cycle = useThemeStore((s) => s.cycle);

	const Icon = preference === "dark" ? Moon : preference === "light" ? Sun : Monitor;

	return (
		<button
			type="button"
			onClick={cycle}
			className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
			title={`Theme: ${labels[preference]}`}
		>
			<Icon className="h-4 w-4" />
			<span className="text-[10px] font-medium hidden sm:inline">{labels[preference]}</span>
		</button>
	);
}
