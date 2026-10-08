import React, { useEffect, useState, useMemo } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  View,
  TouchableOpacity,
  Text,
} from "react-native";
import { AgentClient, type ClientState } from "./client.js";
import { type PairingConfig } from "./pairing.js";
import { type ISecureStorage, ExpoSecureStoreAdapter } from "./storage.js";
import { PairingScreen } from "./components/PairingScreen.js";
import { StatusScreen } from "./components/StatusScreen.js";
import { TerminalScreen } from "./components/TerminalScreen.js";
import { ChatScreen } from "./components/ChatScreen.js";

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
  const [activeTab, setActiveTab] = useState<"chat" | "terminal" | "status">("chat");

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
    setActiveTab("chat");
    await secureStorage.setItem(STORAGE_PAIRING_KEY, JSON.stringify(config));
    agentClient.connect(config);
  };

  const handleUnpair = async () => {
    agentClient.disconnect();
    setPairingConfig(null);
    setActiveTab("chat");
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
        <View style={styles.content}>
          <View style={styles.screenContainer}>
            {activeTab === "chat" ? (
              <ChatScreen client={agentClient} />
            ) : activeTab === "terminal" ? (
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
            )}
          </View>

          {/* Bottom Tab Bar Navigation */}
          <View style={styles.tabBar} testID="app-tab-bar">
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "chat" && styles.tabButtonActive]}
              onPress={() => setActiveTab("chat")}
              testID="tab-chat"
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, activeTab === "chat" && styles.tabIconActive]}>💬</Text>
              <Text style={[styles.tabLabel, activeTab === "chat" && styles.tabLabelActive]}>
                AI Chat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "terminal" && styles.tabButtonActive]}
              onPress={() => setActiveTab("terminal")}
              testID="tab-terminal"
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, activeTab === "terminal" && styles.tabIconActive]}>💻</Text>
              <Text style={[styles.tabLabel, activeTab === "terminal" && styles.tabLabelActive]}>
                Terminal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "status" && styles.tabButtonActive]}
              onPress={() => setActiveTab("status")}
              testID="tab-status"
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, activeTab === "status" && styles.tabIconActive]}>📊</Text>
              <Text style={[styles.tabLabel, activeTab === "status" && styles.tabLabelActive]}>
                Status
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: "#0D1117",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#161B22",
    borderTopWidth: 1,
    borderTopColor: "#30363D",
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: "space-around",
  },
  tabButton: {
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: "#21262D",
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
    opacity: 0.7,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    color: "#8B949E",
    fontSize: 11,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: "#58A6FF",
  },
});

export default App;
