import { create } from "zustand";
import type { ProcessGroup } from "@shared/types";
import { apiFetch } from "../lib/api-client";

interface GroupState {
	groups: ProcessGroup[];
	loading: boolean;
	fetchGroups: () => Promise<void>;
	createGroup: (data: { name: string; processNames: string[]; color?: string }) => Promise<ProcessGroup>;
	updateGroup: (id: string, data: Partial<Omit<ProcessGroup, "id">>) => Promise<void>;
	deleteGroup: (id: string) => Promise<void>;
	toggleCollapse: (id: string) => Promise<void>;
}

export const useGroupStore = create<GroupState>()((set, get) => ({
	groups: [],
	loading: false,

	fetchGroups: async () => {
		set({ loading: true });
		try {
			const res = await apiFetch<ProcessGroup[]>("/api/groups");
			if (res.data) {
				set({ groups: res.data.sort((a, b) => a.order - b.order) });
			}
		} catch {
			// Ignore — groups are optional
		} finally {
			set({ loading: false });
		}
	},

	createGroup: async (data) => {
		const res = await apiFetch<ProcessGroup>("/api/groups", {
			method: "POST",
			body: JSON.stringify(data),
		});
		if (res.data) {
			set((s) => ({ groups: [...s.groups, res.data!].sort((a, b) => a.order - b.order) }));
			return res.data;
		}
		throw new Error(res.error ?? "Failed to create group");
	},

	updateGroup: async (id, data) => {
		const res = await apiFetch<ProcessGroup>(`/api/groups/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
		if (res.data) {
			set((s) => ({
				groups: s.groups.map((g) => (g.id === id ? res.data! : g)).sort((a, b) => a.order - b.order),
			}));
		}
	},

	deleteGroup: async (id) => {
		await apiFetch(`/api/groups/${id}`, { method: "DELETE" });
		set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }));
	},

	toggleCollapse: async (id) => {
		const group = get().groups.find((g) => g.id === id);
		if (!group) return;
		const collapsed = !group.collapsed;
		// Optimistic update
		set((s) => ({
			groups: s.groups.map((g) => (g.id === id ? { ...g, collapsed } : g)),
		}));
		try {
			await apiFetch(`/api/groups/${id}`, {
				method: "PUT",
				body: JSON.stringify({ collapsed }),
			});
		} catch {
			// Revert on failure
			set((s) => ({
				groups: s.groups.map((g) => (g.id === id ? { ...g, collapsed: !collapsed } : g)),
			}));
		}
	},
}));
