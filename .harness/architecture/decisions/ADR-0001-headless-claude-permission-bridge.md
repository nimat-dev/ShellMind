# ADR-0001: Headless Claude Code Execution and Permission Interception

- **Status**: Accepted
- **Date**: 2026-10-07
- **Feature**: F000 — Claude Code headless spike

## Context
ShellMind operates as a bridge between a mobile companion client and a local desktop AI brain. To keep the product private, zero-cost, and independent of external server bills, ShellMind relies on the user's existing local Claude Code CLI subscription rather than a paid Anthropic API key (`ANTHROPIC_API_KEY`).

The viability of ShellMind hinges on two core capabilities:
1. Spawning headless Claude Code sessions without requiring an `ANTHROPIC_API_KEY`, streaming tokens and events over JSONL.
2. Intercepting Claude Code's tool execution permission prompts programmatically so that approval/denial decisions can be routed to the mobile client rather than an interactive local TTY.

## Decision
1. **Headless Execution Command & Flags**:
   The desktop agent spawns Claude Code using:
   ```bash
   claude -p "<prompt>" --output-format stream-json --verbose --mcp-config <path-to-mcp-config> --permission-prompt-tool mcp__<server_name>__<tool_name>
   ```
   - **No API key requirement**: Confirmed that when `ANTHROPIC_API_KEY` is empty/unset, Claude Code successfully authenticates against the user's logged-in subscription keychain/token.
   - **`--verbose` requirement**: Discovered during testing that Claude Code version 2.1.293 strictly requires `--verbose` whenever `--output-format=stream-json` is used with `-p` (`--print`). Without `--verbose`, Claude exits immediately with code 1.
   - **Rate limit event monitoring**: Claude Code emits periodic `rate_limit_event` objects containing `resetsAt`, `utilization` (5-hour and 7-day windows), and `rateLimitType`. ShellMind protocol and agents will observe these events to detect window depletion and trigger backoff/resume.

2. **Programmatic Permission Interception Mechanism**:
   We evaluated two potential programmatic interception routes:
   - *Option A: Stdio SDK Control Stream (`--permission-prompt-tool stdio`)*: Requires full bidirectional SDK initialize handshakes on stdin.
   - *Option B: Standalone MCP Permission Prompt Tool (`--permission-prompt-tool mcp__<server>__<tool>`)*: Claude Code natively supports delegating permission prompts to an MCP tool.
   
   **Chosen Mechanism for F007 / F008**: We adopt **Option B (MCP Permission Server)**.
   - The desktop agent starts an internal lightweight MCP server (or in-process stdio subprocess) exposing a single tool (e.g. `permission_prompt`).
   - The tool receives standard arguments from Claude:
     ```json
     {
       "tool_name": "Bash",
       "input": { "command": "..." },
       "tool_use_id": "toolu_..."
     }
     ```
   - The MCP tool holds execution, notifies ShellMind daemon (which prompts the paired mobile device), and awaits user decision.
   - To approve: The MCP tool returns JSON string: `{"behavior": "allow"}`. Claude proceeds to run the tool.
   - To deny: The MCP tool returns JSON string: `{"behavior": "deny", "message": "<reason>"}`. Claude halts tool execution with error status and explains denial.
   - **Tool Naming Invariant**: Discovered that Claude prefixes tools loaded via `--mcp-config` with `mcp__<server_name>__<tool_name>`. The flag must pass this full namespaced identifier (e.g. `--permission-prompt-tool mcp__perm_server__permission_prompt`).

## Consequences
- **Easier**:
  - Zero API key management or recurring billing logic.
  - Complete control over every tool execution before it runs on the host machine.
  - Standard JSON-RPC MCP interface cleanly separates daemon core from Claude Code internals.
- **Harder / Constraints**:
  - The agent must always supply `--verbose` when driving stream-json.
  - An MCP server subprocess or socket must be running alongside the agent session.
  - Namespacing rules (`mcp__<server>__<tool>`) must be strictly maintained in config generators.

## Alternatives Considered
- **Direct Anthropic API calls (`@anthropic-ai/sdk`)**: Rejected because it bypasses local Claude Code subscription, incurs pay-per-token API charges, and forfeits Claude Code's built-in tool system and local context.
- **Interactive TTY pseudo-terminal automation (expect / regex parsing)**: Brittle, vulnerable to terminal escape codes and UI changes in Claude Code's interactive REPL. Headless JSONL + MCP tool is deterministic and typed.
