# ADR-0002: Mobile Terminal Emulator Architecture

- **Status**: Accepted
- **Date**: 2026-10-07
- **Feature**: F005 — Mobile terminal UI

## Context
F005 introduces interactive terminal capabilities to the ShellMind mobile companion app. The mobile client must:
1. Ingest streamed stdout chunks from the agent (`term.data`).
2. Parse ANSI color codes and control sequences (carriage return `\r`, newline `\n`, backspace `\b`, line clears, SGR colors).
3. Render styled monospace output with a smooth scrollback buffer.
4. Support rapid keystrokes, virtual keyboard input, and mobile-native accessory keys (`Ctrl`, `Esc`, `Tab`, `↑`, `↓`, `←`, `→`, `|`, `/`, `-`, `~`).
5. Transmit viewport dimensions on resize (`term.resize`).
6. Maintain command history with tap-to-rerun and arrow navigation.
7. Gracefully indicate disconnects without freezing or losing scrollback context.

We evaluated two architectural strategies:
- **Option A**: `xterm.js` embedded in a React Native WebView (`react-native-webview`).
- **Option B**: Native React Native ANSI Stream Buffer (`TerminalBuffer`) with styled React Native components.

## Evaluation & Decision

| Criterion | Option A: xterm.js in WebView | Option B: Native RN ANSI Buffer (Chosen) |
|---|---|---|
| **Latency & Performance** | Overhead of WebView bridge serialization (`postMessage`) on every keystroke and stdout chunk. | Direct native thread rendering; 0ms bridge overhead. |
| **Keyboard & Accessory Bar** | Quirky focus management between native accessory bar and WebView DOM input; IME issues. | Flawless native TextInput and accessory bar key injection (Ctrl combos, Esc, Tab, Arrows). |
| **Dependencies & Footprint** | Requires native `react-native-webview` binary package and bundled local HTML/JS/CSS assets. | Zero additional native binary dependencies; pure TypeScript. |
| **Testability** | Requires browser/DOM mocks or full end-to-end device testing; impossible to unit test in Vitest. | 100% unit-testable state machine in Vitest running under Node. |
| **TUI Complexity** | Full alternate screen buffer support (vim, htop). | Line-oriented scrollback with ANSI color & control sequence parsing. |

**Decision**:
We choose **Option B: Native React Native ANSI Stream Buffer (`TerminalBuffer`)**:
1. Implement a pure TypeScript state machine `TerminalBuffer` in `packages/mobile/src/terminal/buffer.ts` that parses incoming chunks (`term.data`), processes ANSI SGR color/style sequences (30-37, 90-97, 40-47, bold, underline, inverse, reset), handles terminal control characters (`\r`, `\n`, `\b`), and manages a configurable scrollback line limit (e.g., 2000 lines).
2. Implement `TerminalScreen.tsx` with:
   - High-contrast, dark-mode monospace terminal display.
   - Smooth scrollback with automatic follow-tail on new output.
   - Mobile-native accessory keyboard row (`Ctrl`, `Esc`, `Tab`, `↑`, `↓`, `←`, `→`, `|`, `/`, `-`, `~`).
   - Command history tracker allowing up/down recall and quick rerun.
   - Disconnect state banner showing offline status while preserving terminal output.
3. Keep the terminal view modular: The protocol layer (`term.open`, `term.data`, `term.input`, `term.resize`, `term.exit`) remains completely decoupled from the rendering engine. If future phases require a specialized TUI renderer for curses applications, an xterm.js backend can be swapped in without modifying the protocol or agent daemon.

## Consequences
- **Positive**:
  - Blazing fast, lightweight, and battery-friendly.
  - Native feel with instant keyboard response and intuitive accessory controls.
  - Full test coverage of ANSI parsing, line splitting, backspacing, and command history in Vitest.
  - Zero native binary dependency headaches in Expo.
- **Negative / Constraints**:
  - Full-screen alternate screen buffer TUIs (e.g. interactive `htop` or full `vim` screen redraws) are simplified into streaming line output in V1. Interactive command-line execution (`bash`, `zsh`, `git`, `docker`, `pnpm`, `cat`, `curl`, build tools, scripts) is fully supported.
