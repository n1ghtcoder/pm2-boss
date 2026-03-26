# CLAUDE.md — pm2-boss

Instructions for AI assistants (Claude, etc.) working on this codebase.

## What is this?

pm2-boss is a web dashboard for PM2 process management. It has a Hono server backend and a React frontend, both written in TypeScript.

## Commands

```bash
npm run dev          # Start dev server + Vite client (hot reload)
npm run build        # Build everything (server via tsup, client via Vite)
npm run typecheck    # TypeScript strict check (always run before committing)
npm run lint         # Biome linter
npm run lint:fix     # Auto-fix lint issues
```

There are no tests yet. Always run `npm run typecheck` after changes.

## Project Layout

```
src/
├── cli/index.ts              # CLI entry — parses args, starts server
├── server/                   # Hono backend (Node.js)
│   ├── index.ts              # App creation + server startup
│   ├── auth.ts               # Session-based auth middleware
│   ├── pm2-manager.ts        # PM2 API wrapper (list, describe, restart, etc.)
│   ├── ws-handler.ts         # WebSocket handler — broadcasts process updates
│   ├── log-manager.ts        # Log streaming from PM2 bus
│   ├── metrics-store.ts      # In-memory CPU/memory history ring buffers
│   ├── groups.ts             # Process groups CRUD (~/.pm2-boss/groups.json)
│   ├── events-store.ts       # Memory event persistence (~/.pm2-boss/events.json)
│   ├── routes/               # Hono route factories
│   │   ├── processes.ts      # /api/processes/* — CRUD + actions
│   │   ├── settings.ts       # /api/settings — global config
│   │   └── auth.ts           # /api/auth/* — login/logout/status
│   └── telegram/             # Telegram bot integration
│       ├── bot.ts            # Grammy bot setup
│       ├── commands.ts       # /status, /restart, /logs commands
│       ├── alerts.ts         # Process crash + memory alerts
│       ├── mini-app-auth.ts  # Telegram Mini App auth
│       └── types.ts          # Telegram config types
├── client/                   # React frontend (Vite + Tailwind v4)
│   ├── main.tsx              # Entry point
│   ├── app.tsx               # Router setup
│   ├── index.html            # HTML template
│   ├── pages/                # Route pages
│   │   ├── dashboard.tsx     # Main process grid
│   │   ├── login.tsx         # Login form
│   │   ├── settings.tsx      # Memory limit settings
│   │   └── process-detail.tsx # Process detail page (fallback)
│   ├── components/           # React components
│   │   ├── process-card.tsx  # Process card in grid
│   │   ├── process-grid.tsx  # Grid layout with group support
│   │   ├── process-group.tsx # Collapsible group section
│   │   ├── group-manager.tsx # Group create/edit dialog
│   │   ├── process-detail-modal.tsx  # Detail modal (logs, config, env, events)
│   │   ├── log-viewer.tsx    # ANSI log viewer with search
│   │   ├── command-palette.tsx # Cmd+K palette
│   │   ├── dashboard-header.tsx # Header bar
│   │   ├── pm2-actions-menu.tsx # Gear menu (settings, dump, resurrect, flush)
│   │   └── ...               # Other UI components
│   ├── stores/               # Zustand state
│   │   ├── process-store.ts  # Process list + actions
│   │   ├── auth-store.ts     # Auth state + login/logout
│   │   ├── group-store.ts    # Process groups
│   │   ├── settings-store.ts # Global settings
│   │   └── ...               # Other stores
│   ├── hooks/                # Custom hooks (WebSocket, Telegram)
│   └── lib/                  # Utilities
│       ├── api-client.ts     # Typed fetch wrapper with auth
│       ├── ansi.ts           # ANSI escape code parser
│       └── utils.ts          # cn() and helpers
└── shared/
    └── types.ts              # Types shared between server and client
```

## Architecture

### Server

- **Hono** framework on Node.js with `@hono/node-server`
- WebSocket via `@hono/node-ws` — broadcasts process list every 2s
- PM2 interaction through `pm2` npm package (programmatic API)
- CPU/memory metrics via `pidusage` (PM2 v6's `monit` object is broken)
- Auth: session cookies for browser, Bearer tokens for API
- Data files stored in `~/.pm2-boss/` (groups.json, settings.json, events.json)

### Client

- React 19 with React Router v7
- State management: Zustand (one store per domain)
- Styling: Tailwind CSS v4 (CSS-first config, no tailwind.config.js)
- Icons: lucide-react
- Toasts: sonner
- Charts: recharts (sparklines in process cards)
- Build: Vite with `@tailwindcss/vite` plugin

### Build

- Server: tsup (ESM output, Node 18 target, `pm2` and `pidusage` externalized)
- Client: Vite (output to `dist/client/`)
- Final output: `dist/cli.js` (server + CLI), `dist/server.js`, `dist/client/`
- Published as npm package with `bin.pm2-boss` pointing to `dist/cli.js`

## Conventions

- **Formatting**: Tabs, 100 char line width (Biome)
- **Imports**: ESM (`import`/`export`), `.js` extensions in server imports for Node ESM compat
- **Types**: Strict TypeScript. Shared types in `src/shared/types.ts`. No `any` unless unavoidable.
- **API responses**: Always wrapped in `ApiResponse<T>` envelope: `{ data, error, timestamp }`
- **Server routes**: Factory functions (`createXxxRoutes()`) returning Hono instances, mounted in `server/index.ts`
- **Client stores**: Zustand with `apiFetch()` for API calls. Stores handle loading/error states internally.
- **Components**: Functional components, no class components. Props interfaces defined inline or co-located.
- **CSS**: Tailwind utility classes. Color tokens: `bg-background`, `text-foreground`, `border-ring`, `bg-muted`, `text-muted-foreground`. Accent: emerald for primary actions, red for destructive.
- **No default export** for components — use named exports.

## Key Patterns

### Adding a new API endpoint

1. Create or extend a route file in `src/server/routes/`
2. Use factory pattern: `export function createXxxRoutes() { const app = new Hono(); ... return app; }`
3. Mount in `src/server/index.ts`: `app.route("/api", xxxRoutes)`
4. Auth middleware already covers `/api/*`

### Adding a new client page

1. Create page in `src/client/pages/`
2. Add route in `src/client/app.tsx`
3. Create Zustand store if needed in `src/client/stores/`

### Data persistence

Server-side JSON files in `~/.pm2-boss/`:
- Read with `JSON.parse(await readFile(...))` + catch for missing file
- Write atomically: write to `.tmp` then rename

### PM2 v6 monit bug

PM2 v6's daemon doesn't populate `monit.cpu`/`monit.memory`. We use `pidusage` directly to get real metrics. The first `pidusage` call for a PID returns CPU 0 (needs a previous measurement for delta). This is handled in `pm2-manager.ts:enrichWithPidusage()`.

## What NOT to do

- Don't add `pm2` or `pidusage` to the Vite client bundle — they're server-only
- Don't use default exports for components
- Don't add `tailwind.config.js` — Tailwind v4 uses CSS-first config
- Don't use `pm2.describe()` monit values — they're always 0 in PM2 v6
- Don't store process groups by `pm_id` — IDs change on PM2 restart, use `name` instead
