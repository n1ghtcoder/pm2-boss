import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
	value: string;
	label: string;
}

interface CustomSelectProps {
	value: string;
	onChange: (value: string) => void;
	options: SelectOption[];
	placeholder?: string;
	className?: string;
}

export function CustomSelect({
	value,
	onChange,
	options,
	placeholder = "Select...",
	className,
}: CustomSelectProps) {
	const [open, setOpen] = useState(false);
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const containerRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const selectedOption = options.find((o) => o.value === value);

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	// Scroll focused item into view
	useEffect(() => {
		if (!open || focusedIndex < 0 || !listRef.current) return;
		const items = listRef.current.querySelectorAll("[data-option]");
		items[focusedIndex]?.scrollIntoView({ block: "nearest" });
	}, [focusedIndex, open]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!open) {
				if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
					e.preventDefault();
					setOpen(true);
					setFocusedIndex(options.findIndex((o) => o.value === value));
				}
				return;
			}

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
					break;
				case "ArrowUp":
					e.preventDefault();
					setFocusedIndex((i) => Math.max(i - 1, 0));
					break;
				case "Enter":
				case " ":
					e.preventDefault();
					if (focusedIndex >= 0 && focusedIndex < options.length) {
						onChange(options[focusedIndex].value);
						setOpen(false);
					}
					break;
				case "Escape":
					e.preventDefault();
					setOpen(false);
					break;
				case "Home":
					e.preventDefault();
					setFocusedIndex(0);
					break;
				case "End":
					e.preventDefault();
					setFocusedIndex(options.length - 1);
					break;
			}
		},
		[open, focusedIndex, options, onChange, value],
	);

	return (
		<div ref={containerRef} className={cn("relative", className)}>
			{/* Trigger */}
			<button
				type="button"
				role="combobox"
				aria-expanded={open}
				aria-haspopup="listbox"
				onClick={() => {
					setOpen(!open);
					if (!open) setFocusedIndex(options.findIndex((o) => o.value === value));
				}}
				onKeyDown={handleKeyDown}
				className={cn(
					"flex w-full items-center justify-between rounded-md border bg-card px-2 py-1.5 text-xs transition-colors",
					"border-border text-foreground hover:border-ring focus:border-ring focus:outline-none",
					open && "border-ring",
				)}
			>
				<span className={cn(!selectedOption && "text-muted-foreground")}>
					{selectedOption?.label ?? placeholder}
				</span>
				<ChevronDown
					className={cn(
						"ml-1.5 h-3 w-3 shrink-0 text-muted-foreground transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>

			{/* Dropdown */}
			{open && (
				<div
					ref={listRef}
					role="listbox"
					className="absolute z-50 mt-1 w-full min-w-[8rem] rounded-md border border-ring bg-card py-1 shadow-xl animate-in fade-in-0 zoom-in-95"
				>
					{options.map((opt, i) => {
						const isSelected = opt.value === value;
						const isFocused = i === focusedIndex;
						return (
							<div
								key={opt.value}
								data-option
								role="option"
								aria-selected={isSelected}
								className={cn(
									"flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer transition-colors",
									isFocused && "bg-muted",
									isSelected ? "text-foreground font-medium" : "text-foreground",
								)}
								onClick={() => {
									onChange(opt.value);
									setOpen(false);
								}}
								onMouseEnter={() => setFocusedIndex(i)}
								onKeyDown={() => {}}
							>
								<span className="w-3.5 shrink-0">
									{isSelected && <Check className="h-3 w-3 text-emerald-400" />}
								</span>
								{opt.label}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
