import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { AgentClient } from "../client.js";
import type { SysMetricsPayload } from "@shellmind/protocol";

export interface SysInfoTilesProps {
  client: AgentClient;
  refreshIntervalMs?: number;
}

export const SysInfoTiles: React.FC<SysInfoTilesProps> = ({
  client,
  refreshIntervalMs = 4000,
}) => {
  const [metrics, setMetrics] = useState<SysMetricsPayload | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(client.getState().status === "online");

  useEffect(() => {
    const unsubState = client.onStateChange((state) => {
      const online = state.status === "online";
      setIsOnline(online);
      if (online && !metrics) {
        client.requestSystemMetrics();
      }
    });

    const unsubMetrics = client.onSystemMetrics((m) => {
      setMetrics(m);
    });

    if (client.getState().status === "online") {
      client.requestSystemMetrics();
    }

    const timer = setInterval(() => {
      if (client.getState().status === "online") {
        client.requestSystemMetrics();
      }
    }, refreshIntervalMs);

    return () => {
      unsubState();
      unsubMetrics();
      clearInterval(timer);
    };
  }, [client, refreshIntervalMs]);

  const formatBytesToGb = (bytes: number): string => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1);
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getHealthColor = (percent: number): string => {
    if (percent > 85) return "#f85149"; // Red
    if (percent > 65) return "#d29922"; // Yellow
    return "#3fb950"; // Green
  };

  if (!metrics) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          {isOnline ? "Gathering system telemetry..." : "Telemetry unavailable (offline)"}
        </Text>
      </View>
    );
  }

  const cpuColor = getHealthColor(metrics.cpu.percent);
  const memColor = getHealthColor(metrics.memory.percent);
  const diskColor = metrics.disk ? getHealthColor(metrics.disk.percent) : "#8b949e";

  return (
    <View style={styles.container}>
      {/* Telemetry Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Live Telemetry</Text>
        {!isOnline && (
          <View style={styles.staleBadge}>
            <Text style={styles.staleText}>STALE (OFFLINE)</Text>
          </View>
        )}
      </View>

      {/* Tiles Grid */}
      <View style={styles.grid}>
        {/* CPU Tile */}
        <View style={styles.tile}>
          <Text style={styles.tileTitle}>CPU</Text>
          <Text style={[styles.tilePercent, { color: cpuColor }]}>
            {metrics.cpu.percent}%
          </Text>
          <View style={styles.barBackground}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.min(100, metrics.cpu.percent)}%`, backgroundColor: cpuColor },
              ]}
            />
          </View>
          <Text style={styles.tileDetail}>{metrics.cpu.cores} Cores</Text>
        </View>

        {/* Memory Tile */}
        <View style={styles.tile}>
          <Text style={styles.tileTitle}>RAM</Text>
          <Text style={[styles.tilePercent, { color: memColor }]}>
            {metrics.memory.percent}%
          </Text>
          <View style={styles.barBackground}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.min(100, metrics.memory.percent)}%`, backgroundColor: memColor },
              ]}
            />
          </View>
          <Text style={styles.tileDetail}>
            {formatBytesToGb(metrics.memory.usedBytes)} / {formatBytesToGb(metrics.memory.totalBytes)} GB
          </Text>
        </View>

        {/* Disk Tile */}
        <View style={styles.tile}>
          <Text style={styles.tileTitle}>DISK</Text>
          {metrics.disk ? (
            <>
              <Text style={[styles.tilePercent, { color: diskColor }]}>
                {metrics.disk.percent}%
              </Text>
              <View style={styles.barBackground}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.min(100, metrics.disk.percent)}%`,
                      backgroundColor: diskColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.tileDetail}>
                {formatBytesToGb(metrics.disk.usedBytes)} / {formatBytesToGb(metrics.disk.totalBytes)} GB
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.tilePercent, { color: "#8b949e" }]}>N/A</Text>
              <Text style={styles.tileDetail}>Storage restricted</Text>
            </>
          )}
        </View>
      </View>

      {/* Host & Uptime Footer Pill */}
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          Host: <Text style={styles.footerHighlight}>{metrics.hostname}</Text>
        </Text>
        <Text style={styles.footerText}>
          Uptime: <Text style={styles.footerHighlight}>{formatUptime(metrics.uptimeSeconds)}</Text>
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#f0f6fc",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  staleBadge: {
    backgroundColor: "#7a271a",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  staleText: {
    color: "#ffa198",
    fontSize: 10,
    fontWeight: "700",
  },
  loadingContainer: {
    backgroundColor: "#161b22",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#30363d",
  },
  loadingText: {
    color: "#8b949e",
    fontSize: 13,
  },
  grid: {
    flexDirection: "row",
    gap: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: "#161b22",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#30363d",
    alignItems: "center",
  },
  tileTitle: {
    color: "#8b949e",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  tilePercent: {
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "monospace",
    marginVertical: 2,
  },
  barBackground: {
    width: "100%",
    height: 4,
    backgroundColor: "#21262d",
    borderRadius: 2,
    marginVertical: 6,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
  tileDetail: {
    color: "#c9d1d9",
    fontSize: 10,
    fontFamily: "monospace",
    textAlign: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#161b22",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#30363d",
  },
  footerText: {
    color: "#8b949e",
    fontSize: 12,
  },
  footerHighlight: {
    color: "#58a6ff",
    fontFamily: "monospace",
  },
});
