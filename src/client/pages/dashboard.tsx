import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardHeader } from "../components/dashboard-header";
import { ProcessGrid } from "../components/process-grid";
import { LogViewer } from "../components/log-viewer";
import { ProcessDetailModal } from "../components/process-detail-modal";
import { NewProcessDialog } from "../components/new-process-dialog";
import { GroupManagerModal } from "../components/group-manager";
import { ConfirmDialog } from "../components/confirm-dialog";
import { SearchFilterBar, useProcessFilters } from "../components/search-filter";
import { CommandPalette } from "../components/command-palette";
import { ErrorBoundary } from "../components/error-boundary";
import { useProcessStore } from "../stores/process-store";
import { useGroupStore } from "../stores/group-store";
import { wsSend } from "../hooks/use-websocket";
import { apiFetch } from "../lib/api-client";
import { toast } from "sonner";
import type { ProcessGroup } from "@shared/types";

interface PendingAction {
	action: string;
	label: string;
	title: string;
	description: string;
	confirmLabel: string;
	destructive: boolean;
}

export function Dashboard() {
	const [searchParams, setSearchParams] = useSearchParams();
	const [logsOpen, setLogsOpen] = useState<number | null>(null);
	const [bulkLoading, setBulkLoading] = useState<string | null>(null);
	const [newProcessOpen, setNewProcessOpen] = useState(false);
	const [groupManagerOpen, setGroupManagerOpen] = useState(false);
	const [editingGroup, setEditingGroup] = useState<ProcessGroup | null>(null);
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
	const processes = useProcessStore((s) => s.processes);
	const onlineCount = useProcessStore((s) => s.onlineCount);
	const fetchGroups = useGroupStore((s) => s.fetchGroups);

	// Fetch groups on mount
	useEffect(() => {
		fetchGroups();
	}, [fetchGroups]);

	// Process detail modal — driven by ?detail=<pmId> search param
	const detailPmId = searchParams.get("detail");
	const selectedDetailId = detailPmId !== null ? Number(detailPmId) : null;

	const openDetail = useCallback((pmId: number) => {
		setSearchParams((prev) => {
			const next = new URLSearchParams(prev);
			next.set("detail", String(pmId));
			return next;
		});
	}, [setSearchParams]);

	const closeDetail = useCallback(() => {
		setSearchParams((prev) => {
			const next = new URLSearchParams(prev);
			next.delete("detail");
			return next;
		});
	}, [setSearchParams]);

	const { query, status, sort, namespace, setFilter, clearAll, activeCount, filterProcesses } = useProcessFilters();

	const filteredProcesses = filterProcesses(processes);
	const namespaces = useMemo(() => [...new Set(processes.map((p) => p.namespace))].sort(), [processes]);

	const selectedProcess = logsOpen !== null ? processes.find((p) => p.pm_id === logsOpen) : null;

	const handleBulkAction = async (action: string, label: string) => {
		setBulkLoading(action);
		try {
			await apiFetch(`/api/processes/action/${action}`, { method: "POST" });
			toast.success(label);
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setBulkLoading(null);
		}
	};

	const isAllStopped = onlineCount === 0 && processes.length > 0;

	const requestStopAll = () => {
		setPendingAction({
			action: "stop-all",
			label: "All processes stopped",
			title: "Stop All Processes",
			description: `This will immediately stop all ${onlineCount} running process${onlineCount === 1 ? "" : "es"}. Any in-flight requests will be terminated.`,
			confirmLabel: "Stop All",
			destructive: true,
		});
	};

	const requestRestartAll = () => {
		if (isAllStopped) {
			setPendingAction({
				action: "restart-all",
				label: "All processes started",
				title: "Start All Processes",
				description: `This will start all ${processes.length} process${processes.length === 1 ? "" : "es"}.`,
				confirmLabel: "Start All",
				destructive: false,
			});
		} else {
			setPendingAction({
				action: "restart-all",
				label: "All processes restarted",
				title: "Restart All Processes",
				description: `This will restart all ${processes.length} process${processes.length === 1 ? "" : "es"}. Running processes will experience brief downtime.`,
				confirmLabel: "Restart All",
				destructive: true,
			});
		}
	};

	const confirmAction = () => {
		if (pendingAction) {
			handleBulkAction(pendingAction.action, pendingAction.label);
			setPendingAction(null);
		}
	};

	const handleEditGroup = useCallback((group: ProcessGroup) => {
		setEditingGroup(group);
		setGroupManagerOpen(true);
	}, []);

	const handleCloseGroupManager = useCallback(() => {
		setGroupManagerOpen(false);
		setEditingGroup(null);
	}, []);

	return (
		<>
			<DashboardHeader
				onStopAll={requestStopAll}
				onRestartAll={requestRestartAll}
				onNewProcess={() => setNewProcessOpen(true)}
				onManageGroups={() => setGroupManagerOpen(true)}
				loading={bulkLoading}
			/>
			<main className="mx-auto max-w-[1600px] px-6 py-6">
				<SearchFilterBar
					namespaces={namespaces}
					query={query}
					status={status}
					sort={sort as any}
					namespace={namespace}
					activeCount={activeCount}
					setFilter={setFilter}
					clearAll={clearAll}
				/>
				<ErrorBoundary fallbackLabel="Failed to load process grid">
					<ProcessGrid
						processes={filteredProcesses}
						onLogsOpen={setLogsOpen}
						onSelect={openDetail}
						onEditGroup={handleEditGroup}
					/>
				</ErrorBoundary>
			</main>

			{/* Process detail modal */}
			{selectedDetailId !== null && (
				<ErrorBoundary fallbackLabel="Failed to load process details">
					<ProcessDetailModal pmId={selectedDetailId} onClose={closeDetail} />
				</ErrorBoundary>
			)}

			{/* Logs side panel */}
			{logsOpen !== null && selectedProcess && (
				<ErrorBoundary fallbackLabel="Failed to load logs">
					<LogViewer
						pmId={logsOpen}
						processName={selectedProcess.name}
						onClose={() => setLogsOpen(null)}
						send={wsSend}
					/>
				</ErrorBoundary>
			)}

			{/* Confirmation dialog for bulk actions */}
			{pendingAction && (
				<ConfirmDialog
					title={pendingAction.title}
					description={pendingAction.description}
					confirmLabel={pendingAction.confirmLabel}
					onConfirm={confirmAction}
					onCancel={() => setPendingAction(null)}
					destructive={pendingAction.destructive}
				/>
			)}

			<NewProcessDialog open={newProcessOpen} onClose={() => setNewProcessOpen(false)} />

			{/* Group manager modal */}
			<GroupManagerModal
				open={groupManagerOpen}
				onClose={handleCloseGroupManager}
				editGroup={editingGroup}
			/>

			<CommandPalette />
		</>
	);
}
