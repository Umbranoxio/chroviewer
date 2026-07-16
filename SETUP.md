# Setup

## Before Getting Started

While we do our best & pin dependencies to mitigate these problems, modern js development means installing packages from [npm](https://www.npmjs.com/); and frankly Microsofts security standards as of late have been appalling. Supply chain attacks are becoming common enough that you should protect your machine before installing dependencies in any project, including ours

If you haven't already, we strongly urge y'all to harden your shell environment before going forward; it's not difficult, just follow [this](https://gist.github.com/Umbranoxio/84bb7f284ce8250108274f54dafef98b)

## Requirements

### Package Manager

Install Bun:

Linux and macOS:

```sh
curl -fsSL https://bun.sh/install | bash
```

Windows:

```sh
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Runtime

Use Node `24.x`

We recommend [nvm](https://github.com/nvm-sh/nvm#installing-and-updating). From the project root:

```sh
nvm install
nvm use
```

## Run ChroViewer

Install dependencies:

```sh
bun i
```

Start the development server:

```sh
bun run dev
```

Vite prints the local URL when the server starts

## Environment

The default ScoreSaber and BeatSaver endpoints work without an `.env` file. Copy `.env.example` to `.env` if you need to override them

## Checks

Run the full local check with:

```sh
bun run check
```

This checks formatting, generated API contracts, TypeScript, linting, tests, environment assets and the production build

## Production Build

Build and run the production server locally:

```sh
bun run build
bun run start
```

`bun run start` serves on port `4000`

You can also build the production container:

```sh
docker build -t chroviewer .
docker run --rm -p 4000:4000 chroviewer
```
