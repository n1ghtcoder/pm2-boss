/** Minimal ANSI escape code parser → React-renderable segments */

export interface AnsiSegment {
	text: string;
	color?: string;
	bold?: boolean;
}

const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

const COLORS: Record<number, string> = {
	30: "#6b7280", // black (gray)
	31: "#ef4444", // red
	32: "#22c55e", // green
	33: "#eab308", // yellow
	34: "#3b82f6", // blue
	35: "#a855f7", // magenta
	36: "#06b6d4", // cyan
	37: "#e5e7eb", // white
	90: "#9ca3af", // bright black (gray)
	91: "#f87171", // bright red
	92: "#4ade80", // bright green
	93: "#facc15", // bright yellow
	94: "#60a5fa", // bright blue
	95: "#c084fc", // bright magenta
	96: "#22d3ee", // bright cyan
	97: "#f9fafb", // bright white
};

export function parseAnsi(raw: string): AnsiSegment[] {
	const segments: AnsiSegment[] = [];
	let currentColor: string | undefined;
	let currentBold = false;
	let lastIndex = 0;

	// Replace common non-color escapes we don't care about
	const input = raw.replace(/\x1b\[\??\d*[A-HJKSTfhlm]?/g, (match) => {
		// Keep only SGR (Select Graphic Rendition) — those ending in 'm'
		if (match.endsWith("m")) return match;
		return "";
	});

	ANSI_REGEX.lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = ANSI_REGEX.exec(input)) !== null) {
		// Push text before this escape
		if (match.index > lastIndex) {
			const text = input.slice(lastIndex, match.index);
			if (text) segments.push({ text, color: currentColor, bold: currentBold });
		}

		// Parse codes
		const codes = match[1].split(";").map(Number);
		for (const code of codes) {
			if (code === 0) {
				currentColor = undefined;
				currentBold = false;
			} else if (code === 1) {
				currentBold = true;
			} else if (code === 22) {
				currentBold = false;
			} else if (code === 39) {
				currentColor = undefined;
			} else if (COLORS[code]) {
				currentColor = COLORS[code];
			}
		}

		lastIndex = ANSI_REGEX.lastIndex;
	}

	// Remaining text
	if (lastIndex < input.length) {
		const text = input.slice(lastIndex);
		if (text) segments.push({ text, color: currentColor, bold: currentBold });
	}

	// If no segments, return raw text
	if (segments.length === 0 && raw.length > 0) {
		segments.push({ text: raw });
	}

	return segments;
}

/** Strip all ANSI escape codes from a string */
export function stripAnsi(raw: string): string {
	return raw.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\[\??\d*[A-HJKSTfhl]?/g, "");
}
