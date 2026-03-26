import { useMemo } from "react";
import type { MetricsPoint } from "@shared/types";

interface SparklineProps {
	data: MetricsPoint[];
	dataKey: "cpu" | "memory";
	width?: number;
	height?: number;
	color?: string;
	warnColor?: string;
	warnThreshold?: number;
}

export function Sparkline({
	data,
	dataKey,
	width = 120,
	height = 28,
	color = "#10b981",
	warnColor = "#f59e0b",
	warnThreshold,
}: SparklineProps) {
	const path = useMemo(() => {
		if (data.length < 2) return "";

		const values = data.map((d) => d[dataKey]);
		const max = dataKey === "cpu" ? 100 : Math.max(...values, 1);
		const min = 0;
		const range = max - min || 1;

		const points = values.map((v, i) => {
			const x = (i / (data.length - 1)) * width;
			const y = height - ((v - min) / range) * (height - 2) - 1;
			return `${x},${y}`;
		});

		return `M${points.join("L")}`;
	}, [data, dataKey, width, height]);

	const fillPath = useMemo(() => {
		if (data.length < 2) return "";
		return `${path}L${width},${height}L0,${height}Z`;
	}, [path, width, height, data.length]);

	const lastValue = data.length > 0 ? data[data.length - 1][dataKey] : 0;
	const isWarn = warnThreshold !== undefined && lastValue > warnThreshold;

	if (data.length < 2) {
		return (
			<div style={{ width, height }} className="flex items-center justify-center">
				<span className="text-[9px] text-muted-foreground">no data</span>
			</div>
		);
	}

	return (
		<svg width={width} height={height} className="overflow-visible">
			<defs>
				<linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={isWarn ? warnColor : color} stopOpacity={0.2} />
					<stop offset="100%" stopColor={isWarn ? warnColor : color} stopOpacity={0} />
				</linearGradient>
			</defs>
			<path d={fillPath} fill={`url(#grad-${dataKey})`} />
			<path d={path} fill="none" stroke={isWarn ? warnColor : color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
		</svg>
	);
}
