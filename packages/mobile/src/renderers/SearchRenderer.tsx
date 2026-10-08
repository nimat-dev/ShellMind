import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { ToolRendererProps } from "./DefaultRenderer.js";

export const SearchRenderer: React.FC<ToolRendererProps> = ({
  toolName,
  input,
  result,
  isError = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const pattern =
    (typeof input["pattern"] === "string" ? input["pattern"] : undefined) ||
    (typeof input["query"] === "string" ? input["query"] : undefined) ||
    JSON.stringify(input);

  const searchPath =
    (typeof input["path"] === "string" ? input["path"] : undefined) ||
    (typeof input["directory"] === "string" ? input["directory"] : undefined);

  const isRunning = result === undefined;

  return (
    <View style={styles.card} testID="tool-renderer-Search">
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          <Text style={styles.icon}>🔍</Text>
          <Text style={styles.searchType}>{toolName}</Text>
          <Text style={styles.patternText} numberOfLines={1}>
            "{pattern}"
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text
            style={[
              styles.statusPill,
              isRunning ? styles.runningPill : isError ? styles.errorPill : styles.successPill,
            ]}
          >
            {isRunning ? "Searching" : isError ? "Error" : "Done"}
          </Text>
          <Text style={styles.toggleChevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </TouchableOpacity>

      {searchPath && (
        <Text style={styles.pathSubtext} numberOfLines={1}>
          in {searchPath}
        </Text>
      )}

      {expanded && result !== undefined && (
        <View style={styles.resultContainer}>
          <Text
            style={[styles.resultText, isError && styles.errorText]}
            numberOfLines={12}
          >
            {result || "(no matches found)"}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1B2228",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2B3642",
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
  searchType: {
    backgroundColor: "#362F4B",
    color: "#D2A8FF",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  patternText: {
    color: "#E6EDF3",
    fontFamily: "Courier",
    fontSize: 12,
    flex: 1,
  },
  pathSubtext: {
    color: "#8B949E",
    fontSize: 11,
    marginTop: 4,
    fontFamily: "Courier",
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
    backgroundColor: "#163B2B",
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
  resultContainer: {
    backgroundColor: "#0D1117",
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  resultText: {
    color: "#C9D1D9",
    fontFamily: "Courier",
    fontSize: 11,
    lineHeight: 16,
  },
  errorText: {
    color: "#FFA198",
  },
});
