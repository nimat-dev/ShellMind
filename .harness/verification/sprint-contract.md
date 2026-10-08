# Sprint Contract — F005: Mobile terminal UI (emulator + accessory keys + scrollback + history)

Feature: F005 — Mobile terminal UI (emulator + accessory keys + scrollback + history)
Phase: Phase 02 — Terminal & telemetry
Date: 2026-10-07

## 1. Scope & Acceptance Criteria
- [x] ADR-0002 recorded: Native React Native ANSI Stream Buffer vs xterm.js in WebView.
- [x] Pure TypeScript terminal buffer (`TerminalBuffer` in `packages/mobile/src/terminal/buffer.ts`):
  - Ingests streaming `term.data` text chunks.
  - Parses ANSI color codes (SGR standard & bright foregrounds/backgrounds, bold, dim, underline, inverse, reset).
  - Handles terminal control characters (`\r`, `\n`, `\b`, `\x1b[2K`, `\x1b[K`).
  - Implements scrollback line buffer with configurable line limit (e.g. 2000 lines).
  - Produces structured line spans for rendering.
- [x] Mobile-native accessory keyboard row:
  - Quick action keys: `Ctrl`, `Esc`, `Tab`, `↑`, `↓`, `←`, `→`, `|`, `/`, `-`, `~`.
  - When `Ctrl` modifier is active, typing a character generates control code (e.g. `Ctrl+C` -> `\x03`, `Ctrl+D` -> `\x04`, `Ctrl+Z` -> `\x1a`).
- [x] Command history buffer:
  - Stores executed input commands.
  - Up / Down arrow navigation cycles through previous commands.
  - History drawer / list for tap-to-rerun.
- [x] Terminal UI (`TerminalScreen.tsx`):
  - Monospace font, dark high-contrast terminal theme.
  - Autoscroll on new output with scrollback inspection.
  - Window resize trigger (`term.resize`) calculated on orientation / viewport change.
  - Disconnect banner preserving terminal output without freezing UI.
- [x] Client integration in `AgentClient`:
  - Terminal session management (`openTerminal`, `sendTerminalInput`, `resizeTerminal`).
  - Terminal event listeners (`onTerminalData`, `onTerminalExit`).
- [x] Comprehensive unit and integration tests in `packages/mobile/src/terminal/buffer.test.ts` and `packages/mobile/src/mobile.test.ts`.
- [x] Clean architecture (`check-architecture.sh` 0 violations). Full verify (`pnpm verify`) green.

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- Rapid / large output chunks (thousands of lines): buffer trims scrollback cleanly without OOM or lag.
- ANSI color sequences split across chunks: buffer maintains parser state.
- Carriage returns (`\r`) overwriting lines (e.g. download progress bars `[==>   ] 20%` -> `[====> ] 40%`).
- Disconnect mid-session: UI displays disconnected banner, disables input, but retains full scrollback history.
- Rapid typing and control character key combinations (`Ctrl+C` sends interrupt `\x03`).
- Window resize: calculates reasonable cols/rows and sends `term.resize`.

## 3. E2E scenario(s)
1. Client connects -> opens terminal session -> receives banner and prompt via `term.data`.
2. User enters command (`pwd`) -> receives streamed output -> command added to history.
3. User presses `↑` accessory key -> recalls previous command (`pwd`).
4. User taps `Ctrl` + `C` -> sends `\x03` interrupt signal.
5. Resize viewport -> sends `term.resize` with updated dimensions.
6. Connection drops -> status banner shows Offline, scrollback remains visible and interactive.

## 4. Plan (thinnest vertical slice)
1. Create `packages/mobile/src/terminal/buffer.ts` (ANSI parser & scrollback buffer state machine).
2. Write unit tests in `packages/mobile/src/terminal/buffer.test.ts`.
3. Add terminal methods to `AgentClient` in `packages/mobile/src/client.ts`.
4. Create React components: `AccessoryBar.tsx`, `HistoryModal.tsx`, `TerminalScreen.tsx`, and wire in `App.tsx`.
5. Add integration tests in `packages/mobile/src/mobile.test.ts`.
6. Run full verification (`pnpm verify`), capture evidence, and open PR.

## 5. Out of scope (parked, not built)
- System telemetry metrics tiles (F006).
- Claude Code AI bridge (F007-F009).
- Alternate screen buffer (vim/htop curses full-screen redraw) — deferred per ADR-0002.

## 6. New dependencies (with justification)
None required. Uses built-in React Native components and pure TypeScript.
