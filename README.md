# pm2-boss

A beautiful, free web dashboard for [PM2](https://pm2.keymetrics.io/) process management. Built for ourselves, shared for everyone. Monitor, control, and organize your Node.js processes from a clean, real-time UI.

If you find pm2-boss useful, please consider giving it a star on GitHub — it helps others discover the project.

## Features

- **Real-time monitoring** — CPU, memory, uptime, and restart counts updated via WebSocket
- **Process control** — Start, stop, restart, reload, delete processes from the browser
- **Log viewer** — Stream stdout/stderr logs with ANSI color support and search
- **Process groups** — Organize processes into collapsible groups with aggregate stats
- **Memory alerts** — Configurable memory limits with breach notifications and event history
- **Command palette** — Quick keyboard navigation (`Cmd+K` / `Ctrl+K`)
- **Dark/light theme** — System-aware with manual toggle
- **Telegram integration** — Bot commands and alerts for remote monitoring
- **Process configuration** — Edit env vars, memory limits, cluster instances from the UI
- **Git info** — Shows branch, revision, and repo URL for deployed processes
- **PM2 actions** — Dump, resurrect, and flush logs from the dashboard
- **Authentication** — Token-based and username/password auth

## Quick Start

```bash
npx pm2-boss
```

This starts the dashboard on `http://localhost:9615` with no authentication (suitable for local use).

## Installation

```bash
npm install -g pm2-boss
```

Requires [PM2](https://pm2.keymetrics.io/) to be installed and running:

```bash
npm install -g pm2
pm2 start your-app.js
pm2-boss
```

## Usage

```
pm2-boss [options]

Options:
  --port <number>            Port to run on (default: 9615)
  --no-open                  Don't open browser automatically
  --token <string>           API token for authentication (repeatable)
  --user <user:pass>         Login credentials (repeatable)
  --tg-bot-token <string>    Telegram Bot token (from @BotFather)
  --tg-chat-id <string>      Chat ID for alerts (repeatable)
  -h, --help                 Show help
```

### Examples

```bash
# Local development — no auth
pm2-boss

# Production — with authentication
pm2-boss --user admin:strongpassword --token myapitoken

# Custom port
pm2-boss --port 3000 --user admin:secret

# With Telegram alerts
pm2-boss --user admin:secret --tg-bot-token "123456:ABC-DEF" --tg-chat-id "987654"
```

### Authentication

When `--user` or `--token` flags are provided, all API endpoints and the WebSocket connection require authentication. The web UI shows a login page.

- **`--user`** — Username and password for browser login (format: `user:password`)
- **`--token`** — API token for programmatic access (send as `Authorization: Bearer <token>` header)

Both flags are repeatable to configure multiple users/tokens.

> Without any auth flags, the dashboard is open to anyone who can reach the port. Use authentication for any non-local deployment.

### Telegram Bot

When configured with `--tg-bot-token` and `--tg-chat-id`, pm2-boss starts a Telegram bot that:

- Sends alerts when processes crash or restart
- Sends memory limit breach notifications
- Supports commands: `/status`, `/restart <name>`, `/logs <name>`
- Provides a Mini App button for full dashboard access

## Settings

The Settings page (accessible from the gear menu) lets you configure:

- **Default memory limit** — Global memory threshold for all processes (default: 4 GB)
- Per-process overrides are available in the process Config tab

Settings are stored in `~/.pm2-boss/settings.json`.

## Process Groups

Organize related processes into named groups from the dashboard. Groups show aggregate CPU/memory stats and can be collapsed. Group configuration is stored in `~/.pm2-boss/groups.json`.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Command palette |
| `?` | Show shortcut help |

## Development

```bash
git clone https://github.com/n1ghtcoder/pm2-boss.git
cd pm2-boss
npm install
npm run dev
```

This starts the server (with hot reload) and Vite dev server concurrently. The client proxies API requests to the server.

### Build

```bash
npm run build        # Build server + client
npm run typecheck    # TypeScript check
npm run lint         # Biome linter
npm run lint:fix     # Auto-fix lint issues
```

### Project Structure

```
src/
├── cli/            # CLI entry point, argument parsing
├── client/         # React frontend (Vite + Tailwind v4)
│   ├── components/ # UI components
│   ├── pages/      # Route pages (dashboard, login, settings, process detail)
│   ├── stores/     # Zustand state management
│   ├── hooks/      # Custom React hooks
│   └── lib/        # Utilities (API client, ANSI parser, etc.)
├── server/         # Hono backend
│   ├── routes/     # API route handlers
│   └── telegram/   # Telegram bot integration
└── shared/         # Shared TypeScript types
```

### Tech Stack

- **Server**: [Hono](https://hono.dev/) on Node.js with WebSocket support
- **Client**: React 19, React Router, Zustand, Tailwind CSS v4
- **Build**: tsup (server), Vite (client)
- **Linting**: Biome
- **Language**: TypeScript (strict mode)

## Support

If pm2-boss saves you time, a GitHub star is the best way to say thanks and help others find it.

## License

[MIT](LICENSE)
