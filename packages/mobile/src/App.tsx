import React, { useEffect, useState, useMemo } from "react";
import { SafeAreaView, StatusBar, StyleSheet, ActivityIndicator, View } from "react-native";
import { AgentClient, type ClientState } from "./client.js";
import { type PairingConfig } from "./pairing.js";
import { type ISecureStorage, ExpoSecureStoreAdapter } from "./storage.js";
import { PairingScreen } from "./components/PairingScreen.js";
import { StatusScreen } from "./components/StatusScreen.js";
import { TerminalScreen } from "./components/TerminalScreen.js";

const STORAGE_PAIRING_KEY = "shellmind.pairing_config";

export interface AppProps {
  storage?: ISecureStorage;
  client?: AgentClient;
}

export const App: React.FC<AppProps> = ({ storage, client }) => {
  const secureStorage = useMemo(() => storage ?? new ExpoSecureStoreAdapter(), [storage]);
  const agentClient = useMemo(() => client ?? new AgentClient(), [client]);

  const [isLoading, setIsLoading] = useState(true);
  const [pairingConfig, setPairingConfig] = useState<PairingConfig | null>(null);
  const [clientState, setClientState] = useState<ClientState>(agentClient.getState());
  const [activeTab, setActiveTab] = useState<"terminal" | "status">("terminal");

  useEffect(() => {
    const unsubscribe = agentClient.onStateChange((state) => {
      setClientState(state);
    });
    return unsubscribe;
  }, [agentClient]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const raw = await secureStorage.getItem(STORAGE_PAIRING_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as PairingConfig;
          setPairingConfig(parsed);
          agentClient.connect(parsed);
        }
      } catch {
        // Ignored, proceed to pairing screen
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, [secureStorage, agentClient]);

  const handlePair = async (config: PairingConfig) => {
    setPairingConfig(config);
    setActiveTab("terminal");
    await secureStorage.setItem(STORAGE_PAIRING_KEY, JSON.stringify(config));
    agentClient.connect(config);
  };

  const handleUnpair = async () => {
    agentClient.disconnect();
    setPairingConfig(null);
    setActiveTab("terminal");
    await secureStorage.deleteItem(STORAGE_PAIRING_KEY);
  };

  const handleReconnect = () => {
    if (pairingConfig) {
      agentClient.connect(pairingConfig);
    }
  };

  const handlePing = () => {
    agentClient.sendPing();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1117" />
      {pairingConfig ? (
        activeTab === "terminal" ? (
          <TerminalScreen
            client={agentClient}
            onSwitchToStatus={() => setActiveTab("status")}
          />
        ) : (
          <StatusScreen
            state={clientState}
            pairingConfig={pairingConfig}
            client={agentClient}
            onPing={handlePing}
            onReconnect={handleReconnect}
            onUnpair={handleUnpair}
            onSwitchToTerminal={() => setActiveTab("terminal")}
          />
        )
      ) : (
        <PairingScreen
          onPair={handlePair}
          isLoading={clientState.status === "connecting" || clientState.status === "handshaking"}
          initialError={clientState.errorMessage}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default App;
