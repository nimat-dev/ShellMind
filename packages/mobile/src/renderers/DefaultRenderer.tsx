import React from "react";
import { View, Text, StyleSheet } from "react-native";

export interface ToolRendererProps {
  toolName: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export const DefaultRenderer: React.FC<ToolRendererProps> = ({
  toolName,
  input,
  result,
  isError = false,
}) => {
  const formattedInput = JSON.stringify(input, null, 2);

  return (
    <View style={styles.card} testID={`tool-renderer-${toolName}`}>
      <View style={styles.header}>
        <Text style={styles.toolBadge}>⚙️ {toolName}</Text>
        <Text style={[styles.statusBadge, isError ? styles.errorStatus : styles.idleStatus]}>
          {isError ? "Error" : result ? "Completed" : "Executing..."}
        </Text>
      </View>
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Input:</Text>
        <Text style={styles.monoText} numberOfLines={6}>
          {formattedInput}
        </Text>
      </View>
      {result !== undefined && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>Result:</Text>
          <Text style={[styles.monoText, isError && styles.errorText]} numberOfLines={8}>
            {result}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E1E24",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#33333E",
    padding: 10,
    marginVertical: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  toolBadge: {
    color: "#82AAFF",
    fontWeight: "600",
    fontSize: 13,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  idleStatus: {
    backgroundColor: "#2C313A",
    color: "#ABB2BF",
  },
  errorStatus: {
    backgroundColor: "#4E2121",
    color: "#FF5370",
  },
  inputContainer: {
    backgroundColor: "#16161A",
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  inputLabel: {
    color: "#7F848E",
    fontSize: 11,
    marginBottom: 2,
    fontWeight: "600",
  },
  resultContainer: {
    backgroundColor: "#16161A",
    borderRadius: 6,
    padding: 8,
  },
  resultLabel: {
    color: "#7F848E",
    fontSize: 11,
    marginBottom: 2,
    fontWeight: "600",
  },
  monoText: {
    fontFamily: "Courier",
    fontSize: 12,
    color: "#D8DEE9",
  },
  errorText: {
    color: "#FF5370",
  },
});
