import { useState } from "react";
import { X } from "lucide-react";
import { apiFetch } from "../lib/api-client";
import { toast } from "sonner";
import { CustomSelect } from "./custom-select";

interface FormState {
	script: string;
	name: string;
	cwd: string;
	interpreter: string;
	args: string;
	instances: number;
	exec_mode: "fork" | "cluster";
	watch: boolean;
}

const initialForm: FormState = {
	script: "",
	name: "",
	cwd: "",
	interpreter: "",
	args: "",
	instances: 1,
	exec_mode: "fork",
	watch: false,
};

export function NewProcessDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [form, setForm] = useState<FormState>(initialForm);
	const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
	const [loading, setLoading] = useState(false);

	if (!open) return null;

	const validate = (): boolean => {
		const errs: Partial<Record<keyof FormState, string>> = {};
		if (!form.script.trim()) errs.script = "Script path is required";
		if (form.instances < 1 || form.instances > 64) errs.instances = "Must be 1-64";
		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	const handleSubmit = async () => {
		if (!validate()) return;
		setLoading(true);
		try {
			const body: Record<string, unknown> = { script: form.script.trim() };
			if (form.name.trim()) body.name = form.name.trim();
			if (form.cwd.trim()) body.cwd = form.cwd.trim();
			if (form.interpreter.trim()) body.interpreter = form.interpreter.trim();
			if (form.args.trim()) body.args = form.args.trim();
			if (form.exec_mode === "cluster") {
				body.exec_mode = "cluster";
				body.instances = form.instances;
			}
			if (form.watch) body.watch = true;

			await apiFetch("/api/processes", {
				method: "POST",
				body: JSON.stringify(body),
			});
			toast.success(`Process started: ${form.name || form.script}`);
			setForm(initialForm);
			onClose();
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setLoading(false);
		}
	};

	const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
		setForm((prev) => ({ ...prev, [key]: value }));
		setErrors((prev) => ({ ...prev, [key]: undefined }));
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose} onKeyDown={() => {}}>
			<div className="w-full max-w-md rounded-lg border border-ring bg-card shadow-2xl" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
				<div className="flex items-center justify-between border-b border-border px-5 py-3">
					<h2 className="text-sm font-semibold text-foreground">New Process</h2>
					<button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted">
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="space-y-3 px-5 py-4">
					<Field label="Script path *" error={errors.script}>
						<input
							type="text"
							placeholder="/path/to/app.js"
							value={form.script}
							onChange={(e) => set("script", e.target.value)}
							className="input-field"
						/>
					</Field>
					<Field label="Process name">
						<input
							type="text"
							placeholder="my-app"
							value={form.name}
							onChange={(e) => set("name", e.target.value)}
							className="input-field"
						/>
					</Field>
					<Field label="Working directory">
						<input
							type="text"
							placeholder="/path/to/project"
							value={form.cwd}
							onChange={(e) => set("cwd", e.target.value)}
							className="input-field"
						/>
					</Field>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Interpreter">
							<input
								type="text"
								placeholder="node"
								value={form.interpreter}
								onChange={(e) => set("interpreter", e.target.value)}
								className="input-field"
							/>
						</Field>
						<Field label="Arguments">
							<input
								type="text"
								placeholder="--port 3000"
								value={form.args}
								onChange={(e) => set("args", e.target.value)}
								className="input-field"
							/>
						</Field>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Exec mode">
							<CustomSelect
								value={form.exec_mode}
								onChange={(v) => set("exec_mode", v as "fork" | "cluster")}
								options={[
									{ value: "fork", label: "Fork" },
									{ value: "cluster", label: "Cluster" },
								]}
							/>
						</Field>
						{form.exec_mode === "cluster" && (
							<Field label="Instances" error={errors.instances}>
								<input
									type="number"
									min={1}
									max={64}
									value={form.instances}
									onChange={(e) => set("instances", Number(e.target.value) || 1)}
									className="input-field"
								/>
							</Field>
						)}
					</div>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={form.watch}
							onChange={(e) => set("watch", e.target.checked)}
							className="rounded border-ring bg-muted text-emerald-500 focus:ring-emerald-500/25"
						/>
						<span className="text-xs text-foreground">Watch for file changes</span>
					</label>
				</div>

				<div className="flex justify-end gap-2 border-t border-border px-5 py-3">
					<button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={loading}
						className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-4 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
					>
						{loading ? "Starting..." : "Start Process"}
					</button>
				</div>
			</div>
		</div>
	);
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
	return (
		<div>
			<label className="block text-xs font-medium text-foreground mb-1">{label}</label>
			{children}
			{error && <p className="text-[10px] text-red-400 mt-0.5">{error}</p>}
		</div>
	);
}
