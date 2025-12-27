# portlist

A lightweight desktop application to view and manage listening server ports on your machine.

## Features

- View all listening TCP ports in real-time
- See process name, PID, command, and working directory for each port
- Filter ports by name, port number, or directory
- Kill processes directly from the UI
- Auto-refresh with configurable polling interval
- Always-on-top mode for quick access
- Cross-platform support (macOS, Windows, Linux)

## Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/mosle/portlist/releases) page:

- **macOS**: `portlist-x.x.x.dmg` (Intel) or `portlist-x.x.x-arm64.dmg` (Apple Silicon)
- **Windows**: `portlist-x.x.x.exe`
- **Linux**: `portlist-x.x.x.AppImage` or `portlist-x.x.x.deb`

### Build from Source

Requirements:
- Node.js 20+
- pnpm 10+

```bash
# Clone the repository
git clone https://github.com/mosle/portlist.git
cd portlist

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Package for your platform
pnpm package
```

## Usage

1. Launch the application
2. All listening TCP ports will be displayed automatically
3. Use the filter input to search by port number, process name, or directory
4. Click the kill button (X) to terminate a process
5. Click the refresh button to manually update the list
6. Click the pin button to toggle always-on-top mode
7. Click the gear button to open settings

## Development

```bash
# Run development server
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build the application
pnpm build

# Package for all platforms
pnpm package
```

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── services/   # Port scanning, process management
│   ├── utils/      # lsof parser, helpers
│   └── ipc/        # IPC handlers
├── renderer/       # Electron renderer process
│   ├── components/ # UI components
│   └── state/      # Application state
├── preload/        # Preload scripts
└── shared/         # Shared types and constants
```

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **TypeScript** - Type-safe JavaScript
- **esbuild** - Fast bundler
- **Vitest** - Unit testing framework
- **electron-builder** - Application packaging

## How It Works

### macOS
Uses `lsof` to list listening TCP ports and `ps` to get process information.

### Windows
Uses `netstat` to list ports and `wmic`/`tasklist` to get process details.

### Linux
Uses `ss` (socket statistics) to list ports and `/proc` filesystem for process info.

## License

ISC
