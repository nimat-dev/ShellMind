import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { PermRequestPayload, PermissionDecision, RiskHint } from "@shellmind/protocol";

export interface PermissionCardProps {
  request: PermRequestPayload;
  onRespond: (decision: PermissionDecision, rememberForSession: boolean) => void;
  disabled?: boolean;
}

export const PermissionCard: React.FC<PermissionCardProps> = ({
  request,
  onRespond,
  disabled = false,
}) => {
  const [rememberForSession, setRememberForSession] = useState(false);

  const getRiskBadgeStyles = (risk: RiskHint) => {
    switch (risk) {
      case "low":
        return {
          bg: "#E8F5E9",
          border: "#81C784",
          text: "#2E7D32",
          label: "LOW RISK",
        };
      case "high":
        return {
          bg: "#FFEBEE",
          border: "#E57373",
          text: "#C62828",
          label: "HIGH RISK",
        };
      case "medium":
      default:
        return {
          bg: "#FFF3E0",
          border: "#FFB74D",
          text: "#EF6C00",
          label: "MEDIUM RISK",
        };
    }
  };

  const riskBadge = getRiskBadgeStyles(request.riskHint);
  const displayCommand =
    request.command ||
    (typeof request.input["command"] === "string" ? request.input["command"] : undefined) ||
    JSON.stringify(request.input, null, 2);

  return (
    <View style={styles.card} testID="permission-card" accessibilityRole="alert">
      {/* Header with Tool Name and Risk Pill */}
      <View style={styles.header}>
        <View style={styles.toolContainer}>
          <Text style={styles.toolIcon}>⚡</Text>
          <Text style={styles.toolName} testID="perm-tool-name">
            {request.toolName}
          </Text>
        </View>
        <View
          style={[
            styles.riskBadge,
            { backgroundColor: riskBadge.bg, borderColor: riskBadge.border },
          ]}
          testID="perm-risk-badge"
        >
          <Text style={[styles.riskText, { color: riskBadge.text }]}>{riskBadge.label}</Text>
        </View>
      </View>

      {/* Description / Intent if available */}
      {request.description ? (
        <Text style={styles.description} testID="perm-description">
          {request.description}
        </Text>
      ) : null}

      {/* Command / Input Code Box */}
      <View style={styles.codeBox}>
        <Text style={styles.codeText} testID="perm-command" numberOfLines={6}>
          {displayCommand}
        </Text>
      </View>

      {/* CWD footer */}
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Working Directory:</Text>
        <Text style={styles.metaValue} testID="perm-cwd" numberOfLines={1}>
          {request.cwd}
        </Text>
      </View>

      {/* Remember for Session Checkbox */}
      <TouchableOpacity
        style={styles.rememberRow}
        activeOpacity={0.7}
        onPress={() => setRememberForSession(!rememberForSession)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: rememberForSession }}
        testID="perm-remember-toggle"
        disabled={disabled}
      >
        <View style={[styles.checkbox, rememberForSession && styles.checkboxActive]}>
          {rememberForSession ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.rememberText}>Remember decision for this session</Text>
      </TouchableOpacity>

      {/* Action Buttons: Allow / Deny */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.denyButton, disabled && styles.buttonDisabled]}
          activeOpacity={0.8}
          onPress={() => onRespond("deny", rememberForSession)}
          accessibilityRole="button"
          accessibilityLabel="Deny command execution"
          testID="perm-deny-btn"
          disabled={disabled}
        >
          <Text style={styles.denyButtonText}>Deny</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.allowButton, disabled && styles.buttonDisabled]}
          activeOpacity={0.8}
          onPress={() => onRespond("allow", rememberForSession)}
          accessibilityRole="button"
          accessibilityLabel="Allow command execution"
          testID="perm-allow-btn"
          disabled={disabled}
        >
          <Text style={styles.allowButtonText}>Allow</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    padding: 16,
    marginVertical: 10,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  toolContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  toolIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  toolName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  riskText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
  },
  codeBox: {
    backgroundColor: "#0D0D0E",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#262628",
  },
  codeText: {
    fontFamily: "Courier",
    fontSize: 13,
    color: "#4AF626",
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginRight: 6,
  },
  metaValue: {
    fontSize: 12,
    color: "#D1D1D6",
    flex: 1,
    fontWeight: "500",
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#636366",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "#2C2C2E",
  },
  checkboxActive: {
    backgroundColor: "#0A84FF",
    borderColor: "#0A84FF",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  rememberText: {
    fontSize: 13,
    color: "#D1D1D6",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  denyButton: {
    backgroundColor: "#2C2C2E",
    borderWidth: 1,
    borderColor: "#3A3A3C",
  },
  denyButtonText: {
    color: "#FF453A",
    fontSize: 15,
    fontWeight: "600",
  },
  allowButton: {
    backgroundColor: "#30D158",
  },
  allowButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
  },
});
