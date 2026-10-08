import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { ToolRendererProps } from "./DefaultRenderer.js";

export const FileRenderer: React.FC<ToolRendererProps> = ({
  toolName,
  input,
  result,
  isError = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const filePath =
    (typeof input["file_path"] === "string" ? input["file_path"] : undefined) ||
    (typeof input["path"] === "string" ? input["path"] : undefined) ||
    "(unknown file)";

  const isRunning = result === undefined;

  const getActionLabel = (tool: string) => {
    const lower = tool.toLowerCase();
    if (lower.includes("read") || lower === "view") return "READ";
    if (lower.includes("write")) return "WRITE";
    if (lower.includes("edit") || lower.includes("replace")) return "EDIT";
    return tool.toUpperCase();
  };

  return (
    <View style={styles.card} testID="tool-renderer-File">
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          <Text style={styles.icon}>📄</Text>
          <Text style={styles.actionBadge}>{getActionLabel(toolName)}</Text>
          <Text style={styles.filePath} numberOfLines={1}>
            {filePath}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text
            style={[
              styles.statusPill,
              isRunning ? styles.runningPill : isError ? styles.errorPill : styles.successPill,
            ]}
          >
            {isRunning ? "Running" : isError ? "Error" : "Done"}
          </Text>
          <Text style={styles.toggleChevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.detailsBlock}>
          {typeof input["old_str"] === "string" && (
            <View style={styles.diffBlock}>
              <Text style={styles.diffLabel}>- Old:</Text>
              <Text style={styles.diffMinus} numberOfLines={5}>
                {input["old_str"]}
              </Text>
            </View>
          )}
          {typeof input["new_str"] === "string" && (
            <View style={styles.diffBlock}>
              <Text style={styles.diffLabel}>+ New:</Text>
              <Text style={styles.diffPlus} numberOfLines={5}>
                {input["new_str"]}
              </Text>
            </View>
          )}
          {result !== undefined && (
            <View style={styles.resultBlock}>
              <Text style={styles.diffLabel}>Result:</Text>
              <Text
                style={[styles.resultText, isError && styles.errorText]}
                numberOfLines={8}
              >
                {result || "(success)"}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1C2026",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2D333B",
    padding: 10,
    marginVertical: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  icon: {
    fontSize: 13,
  },
  actionBadge: {
    backgroundColor: "#2B3A4A",
    color: "#58A6FF",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  filePath: {
    color: "#C9D1D9",
    fontFamily: "Courier",
    fontSize: 12,
    flex: 1,
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
    backgroundColor: "#1B3B2B",
    color: "#7EE787",
  },
  errorPill: {
    backgroundColor: "#492324",
    color: "#FFA198",
  },
  toggleChevron: {
    color: "#8B949E",
    fontSize: 10,
  },
  detailsBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#21262D",
    gap: 6,
  },
  diffBlock: {
    backgroundColor: "#0D1117",
    borderRadius: 4,
    padding: 6,
  },
  diffLabel: {
    color: "#8B949E",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 2,
  },
  diffMinus: {
    color: "#FFA198",
    fontFamily: "Courier",
    fontSize: 11,
  },
  diffPlus: {
    color: "#7EE787",
    fontFamily: "Courier",
    fontSize: 11,
  },
  resultBlock: {
    backgroundColor: "#0D1117",
    borderRadius: 4,
    padding: 6,
  },
  resultText: {
    color: "#C9D1D9",
    fontFamily: "Courier",
    fontSize: 11,
  },
  errorText: {
    color: "#FFA198",
  },
});
