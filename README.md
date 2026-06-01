# zeroclaw

Zeroclaw is a lightweight, open-source AI agent runtime for Linux/VPS machines.

Target: beginner-friendly setup, low-resource operation, CLI + temporary web dashboard + Telegram private chat.

Current status: early scaffold. The CLI builds and exposes the planned command surface, but most runtime features are still placeholders.

## Install from source

```bash
git clone https://github.com/zeroclaws/zeroclaw.git
cd zeroclaw
npm install
npm run build
npm link
zeroclaw init
zeroclaw doctor
zeroclaw setup
```

## Useful commands

```bash
zeroclaw --help
zeroclaw init
zeroclaw doctor
zeroclaw status
zeroclaw setup
```

## Design spec

- [`docs/zeroclaw-v2026-06-01-design.md`](docs/zeroclaw-v2026-06-01-design.md)
