import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { ClientState, AgentClient } from "../client.js";
import type { PairingConfig } from "../pairing.js";
import { SysInfoTiles } from "./SysInfoTiles.js";

export interface StatusScreenProps {
  state: ClientState;
  pairingConfig: PairingConfig;
  client?: AgentClient;
  onPing: () => void;
  onReconnect: () => void;
  onUnpair: () => void;
  onSwitchToTerminal?: () => void;
}

export const StatusScreen: React.FC<StatusScreenProps> = ({
  state,
  pairingConfig,
  client,
  onPing,
  onReconnect,
  onUnpair,
  onSwitchToTerminal,
}) => {
  const isOnline = state.status === "online";
  const isConnecting = state.status === "connecting" || state.status === "handshaking";
  const isError = state.status === "error";

  const getStatusBadge = () => {
    if (isOnline) {
      return { text: "ONLINE", color: "#22c55e", bg: "#14532d" };
    }
    if (isConnecting) {
      return { text: "CONNECTING", color: "#eab308", bg: "#713f12" };
    }
    if (isError) {
      return { text: "ERROR", color: "#ef4444", bg: "#7f1d1d" };
    }
    return { text: "OFFLINE", color: "#94a3b8", bg: "#334155" };
  };

  const badge = getStatusBadge();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>ShellMind Agent</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        </View>
        {onSwitchToTerminal && (
          <TouchableOpacity
            style={styles.termButton}
            onPress={onSwitchToTerminal}
            activeOpacity={0.7}
          >
            <Text style={styles.termButtonText}>Terminal ➜</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Server:</Text>
          <Text style={styles.value}>{state.serverName ?? "Waiting..."}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Host:</Text>
          <Text style={styles.value}>
            {pairingConfig.host}:{pairingConfig.port}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Session ID:</Text>
          <Text style={styles.valueMono}>{state.sessionId ?? "None"}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Latency (RTT):</Text>
          <Text style={[styles.value, isOnline && styles.latencyValue]}>
            {state.lastRttMs !== null ? `${state.lastRttMs} ms` : "-"}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Agent Version:</Text>
          <Text style={styles.value}>{state.agentVersion ?? "-"}</Text>
        </View>
      </View>

      {client && <SysInfoTiles client={client} />}

      {state.errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{state.errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {isOnline ? (
          <TouchableOpacity style={styles.primaryButton} onPress={onPing}>
            <Text style={styles.buttonText}>Ping Now</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryButton} onPress={onReconnect}>
            <Text style={styles.buttonText}>Reconnect</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.secondaryButton} onPress={onUnpair}>
          <Text style={styles.secondaryButtonText}>Unpair Device</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#0f172a",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#293548",
  },
  label: {
    color: "#94a3b8",
    fontSize: 14,
  },
  value: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "500",
  },
  valueMono: {
    color: "#38bdf8",
    fontSize: 13,
    fontFamily: "Courier",
  },
  latencyValue: {
    color: "#4ade80",
    fontWeight: "bold",
  },
  errorBox: {
    backgroundColor: "#450a0a",
    borderColor: "#991b1b",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#475569",
  },
  secondaryButtonText: {
    color: "#cbd5e1",
    fontSize: 14,
  },
  termButton: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  termButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
});
