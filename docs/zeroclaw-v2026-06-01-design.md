# Zeroclaw v2026.06.01 Design Spec

Date: 2026-06-01
Status: Draft for review
License target: MIT

## 1. Product Scope

Zeroclaw is an open-source lightweight AI agent runtime for Linux-based machines and low-cost VPS environments. It is designed for non-expert users who want a self-hosted AI agent without learning OpenClaw internals, gateway concepts, complex configuration, or heavy deployment workflows.

The v2026.06.01 release prioritizes a small, reliable, beginner-friendly runtime that can run on constrained machines.

### Target environment

- Linux kernel-based machine.
- Minimum target: 1GB RAM, 16GB storage.
- Low-end CPU should be acceptable for normal chat workloads.
- Node.js >=20.
- npm package manager only.
- Default installer should install Node 22 LTS when Node is missing.

### MVP interfaces

- CLI for admin, setup, debugging, and service management.
- Temporary web dashboard for beginner-friendly setup.
- Telegram private chat as the primary user-facing agent interface.

### Explicit v2026.06.01 non-goals

- No required Docker runtime.
- No required browser automation or Chromium.
- No permanent public dashboard by default.
- No vector database.
- No PostgreSQL, MySQL, or Redis requirement.
- No complex plugin/skills system in v0.
- No active Telegram group mode by default.
- No monorepo.
- No bundler.

### Roadmap candidates after v2026.06.01

- Telegram group mode with whitelist support.
- Whitelist by user ID and username, with user ID preferred for security.
- OAuth/provider-login easy mode, defaulting to OpenAI OAuth when available, without shipping private provider keys in the open-source client.
- Plugin/skills system.
- Optional browser automation.
- Discord/WhatsApp adapters.
- Advanced scheduler.
- Multi-agent mode.
- Optional persistent admin dashboard.

## 2. Architecture

Zeroclaw v2026.06.01 uses a modular single-package Node.js/TypeScript architecture. This keeps the repository approachable while leaving room for future modules.

```text
zeroclaw/
  src/
    app/
      main.ts
      bootstrap.ts

    modules/
      cli/
      core/
      dashboard/
      telegram/
      providers/
      storage/
      tools/
      system/

    shared/
      types.ts
      logger.ts
      errors.ts
      constants.ts
      paths.ts

  scripts/
  docs/
  examples/
  package.json
  tsconfig.json
  README.md
  LICENSE
```

### Runtime flow

```text
CLI / systemd
   ↓
app/bootstrap
   ↓
load config + workspace + memory + database
   ↓
core runtime
   ↓
Telegram adapter / dashboard setup / CLI command
   ↓
provider adapter
   ↓
AI model response
   ↓
SQLite state + JSONL export/fallback + markdown memory
```

### Modules

- `app`: entrypoint and bootstrap logic.
- `core`: agent loop, prompt builder, context assembly, message normalization, provider calls, response handling.
- `cli`: all `zeroclaw ...` commands.
- `dashboard`: temporary setup server on port `10212`, protected by a random token.
- `telegram`: Telegram bot integration. v2026.06.01 defaults to private chat only.
- `providers`: OpenAI-compatible provider adapter plus beginner-friendly presets.
- `storage`: config, SQLite database, markdown memory, JSONL export/fallback, sessions, state.
- `tools`: built-in safe tools.
- `system`: systemd integration, doctor checks, low-RAM checks.
- `shared`: shared types, logger, errors, constants, path helpers.

## 3. Storage and Filesystem Layout

Zeroclaw uses hybrid storage:

- Markdown for human-editable agent/user/memory files.
- SQLite as the default lightweight local runtime database.
- JSONL as export, debug, and fallback format.

### Data directory

```text
~/.zeroclaw/
  zeroclaw.json
  zeroclaw.sqlite
  agents/
    default/
      AGENT.md
      USER.md
      MEMORY.md
      TOOLS.md
      workspace/
      sessions/
        exports/
  logs/
    zeroclaw.log
```

### Markdown responsibilities

- `AGENT.md`: agent persona and behavior rules.
- `USER.md`: user preferences and basic profile.
- `MEMORY.md`: long-term memory and durable notes.
- `TOOLS.md`: local notes for tool behavior and environment-specific details.

### SQLite responsibilities

- Session index.
- Message metadata.
- Telegram chat/user mapping.
- Reminders.
- Runtime state.
- Setup state.
- Tool execution records.

### JSONL responsibilities

- Debug transcript export.
- Backup/export format.
- Fallback if SQLite is unavailable or degraded.

## 4. Configuration

The primary config file is:

```text
~/.zeroclaw/zeroclaw.json
```

Conceptual config shape:

```json
{
  "version": "2026.06.01",
  "agent": {
    "defaultAgent": "default"
  },
  "provider": {
    "preset": "openai-oauth",
    "type": "openai-oauth-compatible",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o-mini",
    "credentialRef": "oauth:openai"
  },
  "telegram": {
    "enabled": true,
    "botTokenRef": "env:ZEROCLAW_TELEGRAM_BOT_TOKEN",
    "privateChatOnly": true,
    "groupMode": "disabled"
  },
  "dashboard": {
    "setupPort": 10212,
    "mode": "temporary"
  },
  "storage": {
    "databasePath": "~/.zeroclaw/zeroclaw.sqlite",
    "jsonlFallback": true
  },
  "tools": {
    "webFetch": true,
    "webSearch": false,
    "workspaceFiles": true,
    "reminders": true,
    "shell": false
  }
}
```

Config principles:

- Use JSON instead of YAML for simple parsing and easy editing.
- Prefer environment references for secrets where practical.
- The setup dashboard may help store local secrets for beginners, but must clearly warn users.
- `zeroclaw doctor` validates config and returns human-readable repair guidance.

## 5. CLI Scope

The v2026.06.01 CLI ships with the full command set.

```text
zeroclaw init
zeroclaw setup
zeroclaw start
zeroclaw status
zeroclaw logs
zeroclaw doctor
zeroclaw update

zeroclaw config get
zeroclaw config set

zeroclaw service install
zeroclaw service start
zeroclaw service stop
zeroclaw service restart
zeroclaw service status
```

### Command responsibilities

- `init`: terminal-based setup wizard.
- `setup`: launches temporary web dashboard on port `10212` with a random token.
- `start`: runs the runtime in foreground/manual mode.
- `status`: shows agent, provider, Telegram, storage, and service status.
- `logs`: displays recent logs, defaulting to the last 100 lines.
- `doctor`: checks Node version, config validity, provider connectivity, Telegram token, port availability, filesystem permissions, SQLite health, and systemd status.
- `update`: updates Zeroclaw, usually via `npm update -g zeroclaw` for global installs.
- `config get|set`: reads and writes simple config values safely.
- `service install|start|stop|restart|status`: manages the systemd service.

System-level operations must be explicit. If elevated permissions are required, commands should explain the needed `sudo` action rather than failing with raw stack traces.

## 6. Provider Strategy

v2026.06.01 supports OpenAI-compatible API-key providers and an OAuth/provider-login easy mode. The setup UX exposes beginner-friendly presets.

### Default provider

The default provider preset is OpenAI OAuth/provider login:

- Preset: `openai-oauth`.
- Base URL: `https://api.openai.com/v1`.
- Default model: `gpt-4o-mini`.
- Credential reference: `oauth:openai`.

The goal is to let non-technical users click a login link instead of manually creating and pasting API keys, when OpenAI OAuth/provider-login support is available.

Important: Zeroclaw must not ship the project owner's private 9router/OpenGateway/API credentials inside the open-source client, encrypted or otherwise. Client-side encryption does not protect a secret when the user controls the source, binary, process memory, and network traffic. If a shared project-owned model budget is needed later, it must be implemented as a server-side Zeroclaw relay with authentication, quota, rate limits, abuse controls, and revocation.

### Fallback default API-key provider

If OAuth/provider-login is unavailable, declined, or fails in the user's environment, Zeroclaw falls back to OpenClaude's Gitlawb Opengateway-compatible preset:

- Preset: `gitlawb-opengateway`.
- Base URL: `https://opengateway.gitlawb.com/v1`.
- Default model: `mimo-v2.5-pro`.
- API key env var: `OPENGATEWAY_API_KEY`.
- Compatibility API key env var: `OPENAI_API_KEY`.

### Presets

- OpenAI OAuth default.
- Gitlawb Opengateway API-key fallback.
- OpenRouter.
- OpenAI API key.
- Groq.
- Ollama.
- Custom OpenAI-compatible endpoint.

The preset fills `baseUrl`, credential reference/env var names, and sensible model defaults. Advanced users can edit `zeroclaw.json` manually.

## 7. Telegram Behavior

For v2026.06.01:

- Private chat is enabled by default.
- Group mode is disabled/silent by default.
- If the bot is added to a group, it should not freely participate.

Future group mode should support active group behavior with whitelist controls. User ID should be preferred for stable authorization; username support can be offered for beginner convenience.

## 8. Dashboard Behavior

The dashboard is a temporary setup surface, not a permanent public admin app.

Default behavior:

- `zeroclaw setup` starts a temporary HTTP server on port `10212`.
- A random setup token is generated for the session.
- The setup URL includes or displays the token.
- The setup flow collects provider settings, OAuth/provider-login or API key credentials, Telegram token, basic agent name/persona, and optional service install/start preference.
- After setup completes, the dashboard shuts down or returns to local-only inactive mode.

The dashboard frontend should be static HTML + vanilla JS. No React, Next.js, Vite, or heavy browser framework for v2026.06.01.

## 9. Telegram BotFather CLI Guidance

`zeroclaw init` must include beginner-friendly Telegram token guidance directly in the terminal. The goal is that a non-technical user can create a Telegram bot without reading external documentation first.

Suggested CLI copy:

```text
Telegram Bot Setup
──────────────────

Zeroclaw needs a Telegram bot token so your agent can receive and reply to private chats.

How to get a token:

1. Open Telegram.
2. Search for the official account: @BotFather
3. Send this message:
   /newbot
4. BotFather will ask for a bot display name.
   Example:
   Nata Assistant
5. BotFather will ask for a bot username.
   The username must end with "bot".
   Example:
   nata_zeroclaw_bot
6. BotFather will send you a token.
7. Copy that token and paste it here.

Important:
- Do not share your bot token with anyone.
- If the token leaks, open @BotFather and use /revoke.
- Zeroclaw will not print the full token in logs, status, or doctor output.

Paste Telegram bot token:
>
```

Expected successful validation output:

```text
✓ Token format looks valid.
Testing bot token with Telegram...
✓ Telegram bot connected: @your_bot_username
```

Expected invalid-token guidance:

```text
That token does not look valid.

A Telegram bot token usually looks like:
123456789:AA...

Please copy the token again from @BotFather.
Paste Telegram bot token:
>
```

Expected Telegram connectivity failure guidance:

```text
Zeroclaw could not reach Telegram yet.

Possible causes:
- The token is wrong or revoked.
- This VPS has a network problem.
- Telegram is blocked from this network.

Try:
1. Check the token in @BotFather.
2. Run: zeroclaw doctor
3. Try again later.

Paste a new token or press Enter to skip Telegram for now:
>
```

Token storage rules:

- Store the Telegram token in `~/.zeroclaw/zeroclaw.env` with file permission `0600` when practical.
- Store only `botTokenRef` in `zeroclaw.json`.
- Never print the full token in `status`, `logs`, `doctor`, or dashboard output.
- Masked display format should look like `configured (••••••••abcd)`.

## 10. Tools

v2026.06.01 includes built-in safe tools only.

Default tools:

- Web fetch.
- Optional web search when configured.
- Workspace file read/write/list scoped to the agent workspace.
- Reminders backed by SQLite.
- Runtime/status tool.

Shell execution is disabled by default and reserved for advanced mode later.

Tool safety rules:

- File access must stay inside the agent workspace.
- External write actions must be explicit and safe.
- Dangerous/destructive operations are not part of v2026.06.01 default tools.

## 11. Build System

Zeroclaw v2026.06.01 uses a plain TypeScript build.

- Language: TypeScript.
- Runtime: Node.js >=20.
- Default installer target: Node 22 LTS.
- Module format: ESM.
- Package manager: npm.
- Build: `tsc`.
- Dev runner: `tsx`.
- No bundler in v0.
- No runtime transpilation.
- `dist/` is generated and not committed.

### NPM scripts

```json
{
  "scripts": {
    "dev": "tsx src/app/main.ts",
    "dev:cli": "tsx src/modules/cli/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/app/main.js",
    "typecheck": "tsc --noEmit",
    "test": "npm run build && node --test \"dist/**/*.test.js\"",
    "lint": "eslint .",
    "format": "prettier --write .",
    "check": "npm run typecheck && npm run test"
  }
}
```

### CLI binary

```json
{
  "bin": {
    "zeroclaw": "./dist/modules/cli/index.js"
  }
}
```

The CLI entrypoint must include:

```ts
#!/usr/bin/env node
```

## 12. Dependencies

Runtime dependencies for v2026.06.01:

- `commander` for CLI commands.
- `grammY` for Telegram.
- `fastify` for the dashboard HTTP server.
- `better-sqlite3` for SQLite.
- `zod` for config validation.
- `dotenv` for optional env file loading.
- Custom lightweight logger instead of a heavy logging framework.

Development dependencies:

- `typescript`.
- `tsx`.
- `eslint`.
- `prettier`.
- `@types/node`.

Important implementation note: `better-sqlite3` must be validated on a small VPS profile. If native installation is too fragile for beginner installs, the implementation plan must include a fallback path using JSONL and/or another SQLite strategy.

## 13. Setup Flow

```text
install zeroclaw
  ↓
zeroclaw setup
  ↓
temporary dashboard :10212 + random token
  ↓
choose provider preset
  ↓
login with OpenAI OAuth/provider login or enter provider API key
  ↓
enter Telegram bot token
  ↓
test AI provider
  ↓
test Telegram bot
  ↓
generate ~/.zeroclaw/zeroclaw.json
  ↓
create ~/.zeroclaw/zeroclaw.sqlite
  ↓
create default agent markdown files
  ↓
optionally install/start systemd service
```

## 14. Normal Runtime Flow

```text
Telegram private message
  ↓
telegram handler
  ↓
core normalizes message
  ↓
load AGENT.md + USER.md + MEMORY.md
  ↓
load relevant session context from SQLite/JSONL
  ↓
build OpenClaw-inspired prompt
  ↓
call OpenAI-compatible provider
  ↓
run safe tool calls if needed
  ↓
save messages/state
  ↓
reply to Telegram
```


## 15. Installer and First-Run Operational Baseline

Zeroclaw is not truly installable on other devices until the project has a published package or a repository install path. The installer baseline must distinguish between release install, source install, and local development.

### Supported install paths

#### A. Published npm package path

This is the beginner path after the package name is published to npm:

```bash
npm install -g zeroclaw
zeroclaw setup
```

This path is valid only after `zeroclaw` exists on npm and the package `bin` entry points to built output.

#### B. Git source install path

This is the install path before npm publication and for users who want the latest source:

```bash
git clone https://github.com/<owner>/zeroclaw.git
cd zeroclaw
npm install
npm run build
npm link
zeroclaw setup
```

If `npm link` is not desired, users can run the built CLI directly:

```bash
node dist/modules/cli/index.js setup
```

#### C. One-line installer path

The one-line installer must be a real script in the repo before it is documented as stable:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/zeroclaw/main/scripts/install.sh | bash
```

A branded domain such as `https://zeroclaw.dev/install.sh` is allowed only after the domain and hosting are configured.

### Installer responsibilities

- Detect Linux OS and CPU architecture.
- Check for required commands: `bash`, `curl` or `wget`, `tar`, `git` for source installs, `node`, and `npm`.
- Check Node.js version and require Node.js >=20.
- Install or guide installation of Node 22 LTS when Node is missing.
- Install from npm when a published package is requested.
- Install from Git when npm package is unavailable or when `--source` is selected.
- Run `npm install` and `npm run build` for source installs.
- Create or verify the `zeroclaw` CLI command is available on `PATH`.
- Create `~/.zeroclaw` with safe permissions.
- Create `~/.zeroclaw/zeroclaw.env` with permission `0600` when secrets are stored.
- Run `zeroclaw doctor` after installation.
- Run or suggest `zeroclaw setup` only after `doctor` can find the CLI and data directory.
- Avoid Docker as a required install path.

### Installer modes

The installer should support explicit modes:

```bash
scripts/install.sh --npm
scripts/install.sh --source https://github.com/<owner>/zeroclaw.git
scripts/install.sh --local .
scripts/install.sh --check-only
```

Mode behavior:

- `--npm`: install the published npm package globally.
- `--source`: clone repo, install dependencies, build, and link/install the CLI.
- `--local`: install from an already checked-out repo.
- `--check-only`: verify prerequisites without changing the machine.

### Install success criteria

An install is successful only when all of these work on the target device:

```bash
zeroclaw --version
zeroclaw --help
zeroclaw doctor
zeroclaw setup --help
```

If any command fails, the installer must show the failed command and the next suggested fix.

### First-run flow

The first-run flow should be:

```text
install or build Zeroclaw
  ↓
verify zeroclaw command exists
  ↓
create ~/.zeroclaw
  ↓
create zeroclaw.env if needed
  ↓
run zeroclaw doctor
  ↓
start zeroclaw setup
```

### Versioning

Use SemVer for npm and keep the dated spec version separately:

```json
{
  "version": "0.1.0",
  "zeroclawSpecVersion": "2026.06.01"
}
```

## 16. Secret Storage

Zeroclaw stores local runtime secrets in:

```text
~/.zeroclaw/zeroclaw.env
```

Expected examples:

```bash
ZEROCLAW_TELEGRAM_BOT_TOKEN=***
OPENAI_API_KEY=***
OPENGATEWAY_API_KEY=***
ZEROCLAW_RELAY_TOKEN=***
```

Rules:

- `zeroclaw.env` should use permission `0600` when practical.
- `zeroclaw.json` stores only references like `env:OPENAI_API_KEY` or `oauth:openai`.
- `status`, `logs`, `doctor`, and dashboard must never print full secrets.
- There is no `--show-secrets` command in v2026.06.01.
- Secret display must be masked, for example `configured (••••••••abcd)`.

## 17. OAuth Fallback Rules

OpenAI OAuth/provider-login is the preferred beginner path only when it is legally and technically available.

Fallback order:

1. OpenAI OAuth/provider login.
2. OpenAI API key.
3. Gitlawb Opengateway API key.
4. OpenRouter/Groq/Ollama/custom OpenAI-compatible provider.

If OAuth is unavailable, Zeroclaw must not block setup. The CLI/dashboard should explain the fallback in plain language and continue with API-key setup.

## 18. Systemd Service Baseline

`zeroclaw service install` should prefer a user-level systemd service when available. This reduces root requirements for beginner VPS setups.

Conceptual user service template:

```ini
[Unit]
Description=Zeroclaw AI Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/env zeroclaw start
Restart=always
RestartSec=5
EnvironmentFile=%h/.zeroclaw/zeroclaw.env
WorkingDirectory=%h/.zeroclaw

[Install]
WantedBy=default.target
```

Service commands must clearly explain when `sudo`, lingering, or user-systemd availability is required. Raw systemd errors should be translated into actionable guidance.

## 19. SQLite Schema Baseline

Initial SQLite schema should include:

- `schema_migrations`: applied migration versions.
- `sessions`: session identity, channel, agent, created/updated timestamps.
- `messages`: normalized messages, role, content, timestamps, provider metadata.
- `telegram_chats`: Telegram chat/user mapping, bot username, private/group flags.
- `reminders`: reminder schedule, status, payload, timestamps.
- `runtime_state`: key-value runtime state.
- `tool_runs`: tool call audit trail, status, timestamps, redacted metadata.

The schema should be migration-based from the start, but migration logic must stay simple for v2026.06.01.

## 20. First-Run Templates

`zeroclaw setup` and `zeroclaw init` create default files for the default agent.

### `AGENT.md`

Should include:

- Agent name.
- Short behavior/persona.
- Response language preference.
- Safety boundaries.
- Tool-use rules.
- Telegram private-chat behavior.

### `USER.md`

Should include:

- User display name.
- Preferred language.
- Communication style.
- Empty notes section.

### `MEMORY.md`

Should start mostly empty with a short explanation that durable user-approved notes go there.

### `TOOLS.md`

Should explain available built-in tools and local workspace boundaries.

Templates must be friendly and editable, not overly technical.

## 21. Prompt Template Baseline

The core prompt builder should assemble:

1. Zeroclaw identity and role.
2. `AGENT.md` persona/behavior.
3. `USER.md` preferences.
4. Relevant `MEMORY.md` notes.
5. Telegram behavior rules.
6. Tool safety rules.
7. Recent session context from SQLite/JSONL.
8. Current user message.

Prompting should be OpenClaw-inspired, but implemented as Zeroclaw's own lightweight prompt template.

## 22. Doctor Checklist

`zeroclaw doctor` must check at least:

- Node.js version >=20.
- npm/global install visibility.
- `~/.zeroclaw` exists and is writable.
- `zeroclaw.json` exists and passes schema validation.
- `zeroclaw.env` exists when required and has safe permissions.
- SQLite database opens and migrations are current.
- Provider credential exists or OAuth credential is present.
- Provider test request succeeds or returns actionable guidance.
- Telegram token exists and `getMe` succeeds when Telegram is enabled.
- Dashboard port `10212` is available when setup is requested.
- systemd service status can be read when service is installed.
- RAM/storage warning when the machine is below target baseline.

Every failed check should include a human-readable fix.

## 23. Security Baseline

v2026.06.01 security defaults:

- Dashboard is temporary and token-protected.
- Dashboard port defaults to `10212`.
- No full secret logging.
- Telegram private chat only.
- Telegram group mode disabled/silent.
- File tools scoped to the agent workspace.
- Shell tool disabled.
- No bundled project-owner API keys.
- `zeroclaw.env` permission check.
- SQLite and logs stored under `~/.zeroclaw`.


## 24. Development Team Workflow

Sub-agents mentioned during Zeroclaw planning are development helpers for building this project, not a Zeroclaw runtime feature for v2026.06.01.

The implementation workflow may use multiple sub-agents with different model choices and stricter safety profiles. The lead assistant coordinates, reviews, and integrates their work.

### Purpose

- Speed up implementation by splitting independent work.
- Use different models for different engineering roles.
- Route security-sensitive review to stricter models/profiles, for example Claude-style safety review.
- Keep product scope clear: v2026.06.01 does not need internal multi-agent runtime, model-routing, or sub-agent orchestration features.

### Suggested development roles

- `architect`: repo structure, module boundaries, implementation plan consistency.
- `cli-systemd`: CLI commands, service install/status flows, user-level systemd behavior.
- `dashboard-ux`: temporary setup dashboard, beginner copy, token-protected setup flow.
- `telegram`: Telegram private-chat adapter, BotFather guidance, token validation, group-disabled behavior.
- `storage-sqlite`: SQLite schema, migrations, JSONL fallback/export, markdown templates.
- `provider-auth`: OpenAI OAuth/provider-login feasibility, API-key fallback, provider presets.
- `security-reviewer`: secret handling, dashboard exposure, tool permissions, no bundled private keys.
- `docs-installer`: README, install script docs, first-run docs, troubleshooting.

### Coordination rules

- Sub-agents should receive bounded tasks with clear write scopes.
- Security reviewer should not implement broad changes; it should review and report risks.
- The lead assistant must merge outputs, resolve conflicts, and run verification.
- Sub-agent output does not count as complete until checked by local tests, typecheck, build, or direct inspection.

## 25. Verification Requirements

Before claiming v2026.06.01 implementation is complete, verify:

- `npm run typecheck` passes.
- `npm run test` passes.
- `npm run build` produces `dist/`.
- `zeroclaw --help` works from built output.
- `zeroclaw doctor` runs on a clean config and reports actionable guidance.
- `zeroclaw setup` starts the temporary dashboard on port `10212` with token protection.
- SQLite database initializes correctly.
- JSONL fallback/export works.
- Telegram private chat flow works with a test bot.
- Group mode remains disabled/silent by default.
- RAM usage is checked on a small VPS or constrained environment.

## 26. Open Questions for Implementation Planning

These are not blockers for the design, but must be resolved during planning or implementation:

1. Whether `better-sqlite3` install is reliable enough on the target VPS baseline.
2. Exact non-default provider preset models for OpenRouter, OpenAI, Groq, Ollama, and Custom.
3. Exact wording for default `AGENT.md`, `USER.md`, `MEMORY.md`, and `TOOLS.md` templates.
4. Exact OpenAI OAuth/provider-login mechanism, or confirmation that API-key fallback must be the default shipped path until OAuth is stable.
5. Whether `better-sqlite3` needs a non-native fallback for machines without build tooling.
6. Exact systemd user-service behavior on common VPS distros.
7. Exact sub-agent task split for implementation and which review tasks should use stricter models.
