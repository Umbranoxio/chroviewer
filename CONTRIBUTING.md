# Contributing

For local setup, start with [SETUP.md](SETUP.md)

## Package Management

Use Bun for package work:

```sh
bun i
bun add <package>
bun remove <package>
```

Do not use npm, pnpm or yarn in this repo

## Code Style

- Use kebab-case for TypeScript filenames and directories
- Use named exports
- Omit explicit TypeScript return types when inference is clear
- Put user facing text in `messages` and read it through the i18n helpers

## Generated Files

Do not edit generated API contracts or `public/environments/*.json` directly

```sh
bun run api:generate
bun run api:regen
```

`api:regen` fetches fresh OpenAPI snapshots and requires network access. Commit refreshed snapshots and generated contracts together

## Checks

Run the full check before committing:

```sh
bun run check
```

## Commits

Our commit style is `{feature}: {change_summary} (#{issue_number})` <sub>(sometimes maintainers are naughty and bypass the need for an issue number, do not be like the maintainers)</sub>

Example:

```text
rank-request: fix comment wrapping (#55)
denyah: destroy the page some more (#1)
```
