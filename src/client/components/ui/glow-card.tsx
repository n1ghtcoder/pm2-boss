import { useRef, useCallback, type HTMLAttributes, type CSSProperties } from "react";
import { cn } from "../../lib/utils";

interface GlowCardProps extends HTMLAttributes<HTMLDivElement> {
	/** Override the default accent glow color (CSS value, e.g. "var(--color-red-500)") */
	glowColor?: string;
}

/**
 * A card wrapper that renders a radial spotlight glow following the pointer.
 * Drop-in replacement for a `<div>` — passes through className, onClick, etc.
 */
export function GlowCard({ children, className, glowColor, style, onPointerMove, ...props }: GlowCardProps) {
	const ref = useRef<HTMLDivElement>(null);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const el = ref.current;
			if (!el) return;
			const rect = el.getBoundingClientRect();
			el.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
			el.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
			// Forward original handler if provided
			onPointerMove?.(e);
		},
		[onPointerMove],
	);

	const merged: CSSProperties | undefined =
		glowColor || style
			? { ...style, ...(glowColor ? ({ "--glow-color": glowColor } as CSSProperties) : {}) }
			: undefined;

	return (
		<div ref={ref} className={cn("glow-card", className)} style={merged} onPointerMove={handlePointerMove} {...props}>
			<div className="glow-spotlight" aria-hidden="true" />
			{children}
		</div>
	);
}
