#!/usr/bin/env node
import * as os from "node:os";
import * as path from "node:path";
import { parseArgs } from "node:util";
import {
  AgentDaemon,
  TailnetTransportServer,
  FileDeviceRegistry,
  NodePtyManager,
  NodeSysInfoProvider,
  LocalClaudeDriver,
  NodeProjectManager,
  findTailnetInterface,
} from "./index.js";

function getDefaultRegistryPath(): string {
  const baseDir =
    process.env.SHELLMIND_DATA_DIR || path.join(os.homedir(), ".shellmind");
  return path.join(baseDir, "devices.json");
}

function printUsage(): void {
  console.log(`
ShellMind Agent CLI

Usage:
  shellmind pair [name]               Pair a new mobile client device
  shellmind devices                   List all paired devices
  shellmind revoke <deviceId>         Revoke a paired device
  shellmind dev [options]             Run the agent daemon in the foreground
  shellmind status                    Check tailnet interface and registry status

Options for 'dev':
  --port, -p <number>        Port to listen on (default: 4242)
  --allow-localhost          Allow binding to 127.0.0.1 (development only)
`);
}

async function handlePair(args: string[]): Promise<void> {
  const name = args[0] || `Mobile Client (${new Date().toLocaleDateString()})`;
  const registry = new FileDeviceRegistry(getDefaultRegistryPath());
  const pairing = registry.createPairing(name);

  const iface = findTailnetInterface({ allowLocalhost: true });
  const host = iface?.address || "100.x.y.z";

  console.log("=== ShellMind Device Paired Successfully ===");
  console.log(`Device ID:    ${pairing.device.id}`);
  console.log(`Device Name:  ${pairing.device.name}`);
  console.log(`Tailnet Host: ${host}`);
  console.log(`Auth Token:   ${pairing.rawToken}`);
  console.log("\n[WARNING] Keep this token secret. It will never be displayed again.");
  console.log("\nConnection Payload (JSON):");
  console.log(
    JSON.stringify(
      {
        deviceId: pairing.device.id,
        token: pairing.rawToken,
        host,
        port: 4242,
      },
      null,
      2
    )
  );
}

async function handleDevices(): Promise<void> {
  const registry = new FileDeviceRegistry(getDefaultRegistryPath());
  const devices = await registry.listDevices();

  if (devices.length === 0) {
    console.log("No paired devices found. Run 'shellmind pair' to pair a device.");
    return;
  }

  console.log("=== Paired Devices ===");
  console.table(
    devices.map((d) => ({
      ID: d.id,
      Name: d.name,
      Platform: d.platform,
      Status: d.revokedAt ? "REVOKED" : "ACTIVE",
      "Paired At": new Date(d.pairedAt).toISOString(),
      "Revoked At": d.revokedAt ? new Date(d.revokedAt).toISOString() : "-",
    }))
  );
}

async function handleRevoke(args: string[]): Promise<void> {
  const deviceId = args[0];
  if (!deviceId) {
    console.error("Error: Missing deviceId. Usage: shellmind revoke <deviceId>");
    process.exit(1);
  }

  const registry = new FileDeviceRegistry(getDefaultRegistryPath());
  const revoked = await registry.revokeDevice(deviceId);

  if (revoked) {
    console.log(`Successfully revoked device: ${deviceId}`);
  } else {
    console.error(`Device not found: ${deviceId}`);
    process.exit(1);
  }
}

async function handleDev(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string", short: "p", default: "4242" },
      "allow-localhost": { type: "boolean", default: false },
    },
    strict: false,
  });

  const port = parseInt(values.port as string, 10) || 4242;
  const allowLocalhost = Boolean(values["allow-localhost"]);

  const iface = findTailnetInterface({ allowLocalhost });
  if (!iface) {
    console.error(
      "Error: No Tailscale network interface found.\n" +
        "ShellMind must bind to your Tailscale network. Please start Tailscale, or pass --allow-localhost for local development."
    );
    process.exit(1);
  }

  const registry = new FileDeviceRegistry(getDefaultRegistryPath());
  const transport = new TailnetTransportServer({ allowLocalhost });
  const daemon = new AgentDaemon(transport, registry, {
    agentVersion: "0.1.0",
    serverName: os.hostname(),
    terminalManager: new NodePtyManager(),
    sysInfoProvider: new NodeSysInfoProvider(),
    claudeDriver: new LocalClaudeDriver(),
    projectManager: new NodeProjectManager(),
  });

  console.log("=== ShellMind Agent Daemon ===");
  console.log(`Interface: ${iface.name} (${iface.address})`);
  console.log(`Port:      ${port}`);
  console.log(`Registry:  ${getDefaultRegistryPath()}`);

  const listener = await daemon.start({ host: iface.address, port });
  console.log(`\nDaemon listening on ws://${listener.address().host}:${listener.address().port}`);
  console.log("Press Ctrl+C to stop.\n");

  const shutdown = async () => {
    console.log("\nShutting down daemon...");
    await daemon.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function handleStatus(): Promise<void> {
  const iface = findTailnetInterface({ allowLocalhost: false });
  const registry = new FileDeviceRegistry(getDefaultRegistryPath());
  const devices = await registry.listDevices();
  const activeCount = devices.filter((d) => !d.revokedAt).length;

  console.log("=== ShellMind Agent Status ===");
  console.log(
    `Tailnet Status:   ${
      iface
        ? `CONNECTED (${iface.name}: ${iface.address})`
        : "DISCONNECTED (No Tailscale interface found)"
    }`
  );
  console.log(`Registry Path:    ${getDefaultRegistryPath()}`);
  console.log(`Total Devices:    ${devices.length} (${activeCount} active, ${devices.length - activeCount} revoked)`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const rest = argv.slice(1);

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printUsage();
    return;
  }

  switch (command) {
    case "pair":
      await handlePair(rest);
      break;
    case "devices":
      await handleDevices();
      break;
    case "revoke":
      await handleRevoke(rest);
      break;
    case "dev":
      await handleDev(rest);
      break;
    case "status":
      await handleStatus();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
