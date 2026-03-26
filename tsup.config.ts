import { defineConfig } from "tsup";

const shared = {
	format: "esm" as const,
	target: "node18" as const,
	platform: "node" as const,
	outDir: "dist",
	splitting: true,
	sourcemap: true,
	external: ["pm2", "pidusage"],
};

export default defineConfig([
	{
		...shared,
		entry: { cli: "src/cli/index.ts" },
		banner: { js: "#!/usr/bin/env node" },
		clean: false,
	},
	{
		...shared,
		entry: { server: "src/server/index.ts" },
		clean: false,
	},
]);
