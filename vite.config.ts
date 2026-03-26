import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

export default defineConfig({
	plugins: [react(), tailwindcss()],
	define: {
		__PM2_BOSS_VERSION__: JSON.stringify(pkg.version),
	},
	root: "src/client",
	resolve: {
		alias: {
			"@": resolve(__dirname, "src/client"),
			"@shared": resolve(__dirname, "src/shared"),
		},
	},
	build: {
		outDir: "../../dist/client",
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: "http://localhost:9615",
				changeOrigin: true,
			},
			"/ws": {
				target: "http://localhost:9615",
				ws: true,
				changeOrigin: true,
			},
		},
	},
});
