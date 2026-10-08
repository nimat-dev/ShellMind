import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";

export interface AccessoryBarProps {
  ctrlActive: boolean;
  onToggleCtrl: () => void;
  onKeyPress: (key: string) => void;
  onOpenHistory: () => void;
}

export const AccessoryBar: React.FC<AccessoryBarProps> = ({
  ctrlActive,
  onToggleCtrl,
  onKeyPress,
  onOpenHistory,
}) => {
  const keys: Array<{ label: string; action: () => void; highlight?: boolean }> = [
    {
      label: "Ctrl",
      action: onToggleCtrl,
      highlight: ctrlActive,
    },
    { label: "Esc", action: () => onKeyPress("\x1b") },
    { label: "Tab", action: () => onKeyPress("\t") },
    { label: "↑", action: () => onKeyPress("\x1b[A") },
    { label: "↓", action: () => onKeyPress("\x1b[B") },
    { label: "←", action: () => onKeyPress("\x1b[D") },
    { label: "→", action: () => onKeyPress("\x1b[C") },
    { label: "|", action: () => onKeyPress("|") },
    { label: "/", action: () => onKeyPress("/") },
    { label: "-", action: () => onKeyPress("-") },
    { label: "~", action: () => onKeyPress("~") },
    { label: "Hist", action: onOpenHistory },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {keys.map((k) => (
          <TouchableOpacity
            key={k.label}
            style={[styles.keyButton, k.highlight && styles.keyHighlight]}
            onPress={k.action}
            activeOpacity={0.7}
          >
            <Text style={[styles.keyText, k.highlight && styles.keyTextHighlight]}>
              {k.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 44,
    backgroundColor: "#161b22",
    borderTopWidth: 1,
    borderTopColor: "#30363d",
    borderBottomWidth: 1,
    borderBottomColor: "#30363d",
  },
  scrollContent: {
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
  },
  keyButton: {
    backgroundColor: "#21262d",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  keyHighlight: {
    backgroundColor: "#238636",
  },
  keyText: {
    color: "#c9d1d9",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  keyTextHighlight: {
    color: "#ffffff",
  },
});
