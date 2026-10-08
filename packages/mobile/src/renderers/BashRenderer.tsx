import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { ToolRendererProps } from "./DefaultRenderer.js";

export const BashRenderer: React.FC<ToolRendererProps> = ({
  input,
  result,
  isError = false,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const command =
    (typeof input["command"] === "string" ? input["command"] : undefined) ||
    (typeof input["cmd"] === "string" ? input["cmd"] : undefined) ||
    JSON.stringify(input);

  const isRunning = result === undefined;

  return (
    <View style={styles.card} testID="tool-renderer-Bash">
      <TouchableOpacity
        style={styles.header}
        onPress={() => setCollapsed(!collapsed)}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          <Text style={styles.icon}>💻</Text>
          <Text style={styles.title}>Bash</Text>
        </View>
        <View style={styles.statusRow}>
          <Text
            style={[
              styles.statusPill,
              isRunning ? styles.runningPill : isError ? styles.errorPill : styles.successPill,
            ]}
          >
            {isRunning ? "Running" : isError ? "Failed" : "Success"}
          </Text>
          <Text style={styles.toggleChevron}>{collapsed ? "▼" : "▲"}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.commandBar}>
        <Text style={styles.promptSymbol}>$</Text>
        <Text style={styles.commandText} numberOfLines={collapsed ? 1 : 4}>
          {command}
        </Text>
      </View>

      {!collapsed && result !== undefined && (
        <View style={styles.outputBlock}>
          <Text
            style={[styles.outputText, isError && styles.errorOutputText]}
            numberOfLines={15}
          >
            {result || "(empty output)"}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#181A1F",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#282C34",
    padding: 10,
    marginVertical: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    color: "#61AFEF",
    fontWeight: "700",
    fontSize: 13,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusPill: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  runningPill: {
    backgroundColor: "#3A3F4B",
    color: "#E5C07B",
  },
  successPill: {
    backgroundColor: "#1E3A2B",
    color: "#98C379",
  },
  errorPill: {
    backgroundColor: "#4E2121",
    color: "#E06C75",
  },
  toggleChevron: {
    color: "#5C6370",
    fontSize: 10,
  },
  commandBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#0D1117",
    borderRadius: 6,
    padding: 8,
    gap: 6,
  },
  promptSymbol: {
    color: "#98C379",
    fontFamily: "Courier",
    fontSize: 12,
    fontWeight: "700",
  },
  commandText: {
    color: "#E6EDF3",
    fontFamily: "Courier",
    fontSize: 12,
    flex: 1,
  },
  outputBlock: {
    backgroundColor: "#0D1117",
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#21262D",
  },
  outputText: {
    color: "#ABB2BF",
    fontFamily: "Courier",
    fontSize: 11,
    lineHeight: 16,
  },
  errorOutputText: {
    color: "#E06C75",
  },
});
