import { useEffect, useCallback, useRef } from "react";
import { useProcessStore } from "../stores/process-store";
import { useConnectionStore } from "../stores/connection-store";
import { useLogStore } from "../stores/log-store";
import { useMetricsStore } from "../stores/metrics-store";
import { useConsoleStore, createConsoleMessage } from "../stores/console-store";
import { useEventsStore } from "../stores/events-store";
import { getWsUrl } from "../lib/api-client";
import { formatBytes } from "../lib/utils";
import { toast } from "sonner";
import type { WsMessageFromServer, WsMessageFromClient } from "@shared/types";

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

// ── Singleton WebSocket ─────────────────────────────────────────────
// Only one physical connection is ever created. Multiple hook calls
// share the same underlying socket.
let ws: WebSocket | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let initialized = false;

function handleMessage(evt: MessageEvent) {
	try {
		const msg: WsMessageFromServer = JSON.parse(evt.data);
		switch (msg.type) {
			case "processes":
				useProcessStore.getState().setProcesses(msg.payload);
				break;
			case "pm2:status":
				useConnectionStore.getState().setPm2Status(msg.payload.connected, msg.payload.error);
				break;
			case "metrics":
				useMetricsStore.getState().setHistory(msg.payload);
				break;
			case "system":
				useMetricsStore.getState().setSystem(msg.payload);
				break;
			case "logs:data":
				useLogStore.getState().addLog(msg.payload);
				break;
			case "logs:history":
				useLogStore.getState().setHistory(msg.payload.pm_id, msg.payload.lines);
				break;
			case "process:ipc": {
				const ipc = msg.payload;
				useConsoleStore.getState().addMessage(
					ipc.pm_id,
					createConsoleMessage(ipc.pm_id, "received", ipc.data),
				);
				break;
			}
			case "memory_event": {
				const ev = msg.payload;
				toast.warning(`${ev.processName} exceeded memory limit`, {
					description: `${formatBytes(ev.memoryBytes)} / ${formatBytes(ev.limitBytes)} limit`,
					duration: 8000,
				});
				useEventsStore.getState().incrementCount(ev.pmId);
				break;
			}
		}
	} catch {
		// Ignore parse errors
	}
}

function scheduleReconnect() {
	const delay = Math.min(
		RECONNECT_BASE_DELAY * 2 ** reconnectAttempt,
		RECONNECT_MAX_DELAY,
	);
	reconnectAttempt++;
	reconnectTimer = setTimeout(connect, delay);
}

function connect() {
	// Demo mode — no real server connection
	if (new URLSearchParams(window.location.search).has("demo")) return;
	if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;

	useConnectionStore.getState().setStatus("connecting");
	const socket = new WebSocket(getWsUrl());
	ws = socket;

	socket.onopen = () => {
		useConnectionStore.getState().setStatus("connected");
		reconnectAttempt = 0;
		useEventsStore.getState().fetchCounts();
	};

	socket.onmessage = handleMessage;

	socket.onclose = () => {
		useConnectionStore.getState().setStatus("disconnected");
		ws = null;
		scheduleReconnect();
	};

	socket.onerror = () => {
		socket.close();
	};
}

function disconnect() {
	clearTimeout(reconnectTimer);
	ws?.close();
	ws = null;
	initialized = false;
}

// ── Public send function (can be imported directly) ─────────────────
export function wsSend(msg: WsMessageFromClient) {
	if (ws?.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(msg));
	}
}

// ── React hook ──────────────────────────────────────────────────────
// Call once in the app root (AuthenticatedApp) to start the connection.
// Additional calls from child components are no-ops — they just get
// the shared `send` function.
export function useWebSocket() {
	const mountedRef = useRef(false);

	useEffect(() => {
		if (!initialized) {
			initialized = true;
			connect();
		}
		mountedRef.current = true;

		return () => {
			// Only disconnect when the root unmounts (StrictMode double-invokes
			// this, so we defer to let re-mount happen first)
			mountedRef.current = false;
			setTimeout(() => {
				if (!mountedRef.current && initialized) {
					disconnect();
				}
			}, 100);
		};
	}, []);

	const send = useCallback((msg: WsMessageFromClient) => {
		wsSend(msg);
	}, []);

	return { send };
}
