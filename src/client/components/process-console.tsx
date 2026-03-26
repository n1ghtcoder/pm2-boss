import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";
import { useConsoleStore, createConsoleMessage } from "../stores/console-store";
import { Send, Trash2, ArrowDown, Terminal, Copy, Check } from "lucide-react";
import { apiFetch } from "../lib/api-client";
import { toast } from "sonner";
import { JsonHighlight } from "./json-highlight";
import type { ConsoleMessage } from "../stores/console-store";

const EMPTY_MSGS: ConsoleMessage[] = [];

export function ProcessConsole({ pmId }: { pmId: number }) {
	const messages = useConsoleStore((s) => s.messages.get(pmId) ?? EMPTY_MSGS);
	const addMessage = useConsoleStore((s) => s.addMessage);
	const clearMessages = useConsoleStore((s) => s.clearMessages);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [stickToBottom, setStickToBottom] = useState(true);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Auto-scroll
	useEffect(() => {
		if (stickToBottom && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, stickToBottom]);

	const handleScroll = useCallback(() => {
		if (!scrollRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		setStickToBottom(scrollHeight - scrollTop - clientHeight < 50);
	}, []);

	const handleSend = async () => {
		const trimmed = input.trim();
		if (!trimmed || sending) return;

		// Try to parse as JSON, fallback to string
		let data: unknown;
		try {
			data = JSON.parse(trimmed);
		} catch {
			data = trimmed;
		}

		setSending(true);
		try {
			await apiFetch(`/api/processes/${pmId}/send-data`, {
				method: "POST",
				body: JSON.stringify({ data }),
			});

			addMessage(pmId, createConsoleMessage(pmId, "sent", data));
			setInput("");
			inputRef.current?.focus();
		} catch (err) {
			toast.error(`IPC failed: ${(err as Error).message}`);
		} finally {
			setSending(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0">
				<div className="flex items-center gap-2">
					<Terminal className="h-3.5 w-3.5 text-muted-foreground" />
					<h3 className="text-sm font-medium text-foreground">IPC Console</h3>
					<span className="text-[10px] text-muted-foreground tabular-nums">
						{messages.length} messages
					</span>
				</div>
				<button
					type="button"
					onClick={() => clearMessages(pmId)}
					className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					title="Clear console"
				>
					<Trash2 className="h-3.5 w-3.5" />
				</button>
			</div>

			{/* Messages */}
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				className="flex-1 overflow-y-auto px-4 py-3 space-y-2 relative"
			>
				{messages.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-center py-12">
						<Terminal className="h-8 w-8 text-muted-foreground/30 mb-3" />
						<p className="text-sm text-muted-foreground mb-1">IPC Console</p>
						<p className="text-xs text-muted-foreground/70 max-w-sm">
							Send messages to this process via PM2 IPC.
							The process must handle{" "}
							<code className="bg-muted px-1 rounded text-[10px]">
								process.on('message', cb)
							</code>{" "}
							to receive and respond.
						</p>
					</div>
				) : (
					messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
				)}

				{/* Scroll to bottom */}
				{!stickToBottom && messages.length > 0 && (
					<button
						type="button"
						onClick={() => {
							setStickToBottom(true);
							if (scrollRef.current)
								scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
						}}
						className="sticky bottom-2 float-right rounded-full bg-muted border border-ring p-2 text-muted-foreground hover:text-foreground shadow-lg transition-colors"
					>
						<ArrowDown className="h-3.5 w-3.5" />
					</button>
				)}
			</div>

			{/* Input */}
			<div className="shrink-0 border-t border-border px-4 py-3">
				<div className="flex gap-2">
					<input
						ref={inputRef}
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder='Type a message or JSON (e.g. {"action":"ping"})...'
						disabled={sending}
						className="flex-1 rounded-md bg-card border border-border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none disabled:opacity-50 font-mono"
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={!input.trim() || sending}
						className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-30"
					>
						<Send className="h-3.5 w-3.5" />
					</button>
				</div>
				<p className="text-[10px] text-muted-foreground/60 mt-1.5">
					Press Enter to send. Strings sent as-is, valid JSON parsed automatically.
				</p>
			</div>
		</div>
	);
}

function formatTime(ts: string): string {
	try {
		const d = new Date(ts);
		if (Number.isNaN(d.getTime())) return "";
		return d.toLocaleTimeString("en-GB", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	} catch {
		return "";
	}
}

function formatDataRaw(data: unknown): string {
	if (typeof data === "string") return data;
	try {
		return JSON.stringify(data, null, 2);
	} catch {
		return String(data);
	}
}

function MessageBubble({ msg }: { msg: ConsoleMessage }) {
	const [copied, setCopied] = useState(false);
	const isSent = msg.direction === "sent";
	const time = formatTime(msg.timestamp);

	const handleCopy = () => {
		const text = formatDataRaw(msg.data);
		navigator.clipboard.writeText(text).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	};

	return (
		<div className={cn("flex", isSent ? "justify-end" : "justify-start")}>
			<div
				className={cn(
					"group relative max-w-[80%] rounded-lg px-3 py-2 text-xs",
					isSent
						? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
						: "bg-muted border border-border text-foreground",
				)}
			>
				<div className="flex items-center gap-2 mb-1">
					<span
						className={cn(
							"text-[10px] font-medium uppercase tracking-wider",
							isSent ? "text-emerald-400/70" : "text-muted-foreground",
						)}
					>
						{isSent ? "Sent" : "Received"}
					</span>
					{time && (
						<span className="text-[10px] text-muted-foreground/50 tabular-nums">
							{time}
						</span>
					)}
					<button
						type="button"
						onClick={handleCopy}
						className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 text-muted-foreground hover:text-foreground"
						title="Copy to clipboard"
					>
						{copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
					</button>
				</div>
				<JsonHighlight data={msg.data} />
			</div>
		</div>
	);
}
