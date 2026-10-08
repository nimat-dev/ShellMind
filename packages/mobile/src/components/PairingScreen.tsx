import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { parsePairingPayload, type PairingConfig } from "../pairing.js";

export interface PairingScreenProps {
  onPair: (config: PairingConfig) => void;
  isLoading?: boolean;
  initialError?: string | null;
}

export const PairingScreen: React.FC<PairingScreenProps> = ({
  onPair,
  isLoading = false,
  initialError = null,
}) => {
  const [payloadText, setPayloadText] = useState("");
  const [error, setError] = useState<string | null>(initialError);

  const handleSubmit = () => {
    setError(null);
    const result = parsePairingPayload(payloadText);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onPair(result.data);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ShellMind</Text>
      <Text style={styles.subtitle}>Pair with Desktop Agent</Text>

      <Text style={styles.instructions}>
        Run <Text style={styles.code}>shellmind pair</Text> on your computer and paste the connection payload JSON below (or scan the QR code):
      </Text>

      <TextInput
        style={styles.input}
        placeholder='{"deviceId": "dev_...", "token": "tok_...", "host": "100.x.y.z", "port": 4242}'
        placeholderTextColor="#666"
        multiline
        numberOfLines={6}
        value={payloadText}
        onChangeText={setPayloadText}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Connect & Pair</Text>
        )}
      </TouchableOpacity>
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
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#f8fafc",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 32,
    marginTop: 4,
  },
  instructions: {
    color: "#cbd5e1",
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  code: {
    fontFamily: "Courier",
    color: "#38bdf8",
    fontWeight: "bold",
  },
  input: {
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    fontFamily: "Courier",
    borderWidth: 1,
    borderColor: "#334155",
    textAlignVertical: "top",
    minHeight: 120,
    marginBottom: 12,
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: "#1e3a8a",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
});
