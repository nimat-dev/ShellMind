import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  LayoutChangeEvent,
} from "react-native";
import type { AgentClient, ClientState } from "../client.js";
import { TerminalBuffer, type TerminalLine } from "../terminal/buffer.js";
import { AccessoryBar } from "./AccessoryBar.js";
import { HistoryModal } from "./HistoryModal.js";

export interface TerminalScreenProps {
  client: AgentClient;
  onSwitchToStatus?: () => void;
}

export const TerminalScreen: React.FC<TerminalScreenProps> = ({
  client,
  onSwitchToStatus,
}) => {
  const [clientState, setClientState] = useState<ClientState>(client.getState());
  const [lines, setLines] = useState<readonly TerminalLine[]>([]);
  const [inputText, setInputText] = useState("");
  const [ctrlActive, setCtrlActive] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  const bufferRef = useRef<TerminalBuffer>(new TerminalBuffer({ maxLines: 2000 }));
  const scrollViewRef = useRef<ScrollView>(null);
  const dimensionsRef = useRef<{ cols: number; rows: number }>({ cols: 80, rows: 24 });

  useEffect(() => {
    const unsubState = client.onStateChange((state) => {
      setClientState(state);
      if (state.status === "online") {
        client.openTerminal({
          cols: dimensionsRef.current.cols,
          rows: dimensionsRef.current.rows,
        });
      }
    });

    const unsubData = client.onTerminalData((data) => {
      bufferRef.current.write(data);
      setLines([...bufferRef.current.getLines()]);
    });

    const unsubExit = client.onTerminalExit((exitCode) => {
      bufferRef.current.write(`\r\n[Process exited with code ${exitCode}]\r\n`);
      setLines([...bufferRef.current.getLines()]);
    });

    // Initial terminal open if already online
    if (client.getState().status === "online") {
      client.openTerminal({
        cols: dimensionsRef.current.cols,
        rows: dimensionsRef.current.rows,
      });
    }

    return () => {
      unsubState();
      unsubData();
      unsubExit();
    };
  }, [client]);

  useEffect(() => {
    // Follow output
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [lines]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    // Approximate monospace font character cell size: ~8px width, ~18px height
    const cols = Math.max(20, Math.floor(width / 8.5));
    const rows = Math.max(5, Math.floor(height / 18));
    if (cols !== dimensionsRef.current.cols || rows !== dimensionsRef.current.rows) {
      dimensionsRef.current = { cols, rows };
      if (clientState.status === "online") {
        client.resizeTerminal(cols, rows);
      }
    }
  };

  const handleSendInput = (text: string) => {
    if (ctrlActive && text.length === 1) {
      // Convert character to control code (e.g. 'c' or 'C' -> '\x03')
      const code = text.toUpperCase().charCodeAt(0);
      if (code >= 64 && code <= 95) {
        const ctrlCode = String.fromCharCode(code - 64);
        client.sendTerminalInput(ctrlCode);
        setCtrlActive(false);
        setInputText("");
        return;
      }
    }

    client.sendTerminalInput(text);
  };

  const handleSubmitCommand = () => {
    const cmd = inputText;
    setInputText("");
    setHistoryIndex(null);

    if (cmd.trim().length > 0) {
      setHistory((prev) => [...prev, cmd]);
    }

    handleSendInput(cmd + "\n");
  };

  const handleAccessoryKey = (key: string) => {
    if (key === "\x1b[A") {
      // Up arrow: navigate history backwards if input is active
      if (history.length > 0) {
        const nextIndex =
          historyIndex === null
            ? history.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setInputText(history[nextIndex] ?? "");
        return;
      }
    } else if (key === "\x1b[B") {
      // Down arrow: navigate history forward
      if (historyIndex !== null) {
        const nextIndex = historyIndex + 1;
        if (nextIndex < history.length) {
          setHistoryIndex(nextIndex);
          setInputText(history[nextIndex] ?? "");
        } else {
          setHistoryIndex(null);
          setInputText("");
        }
        return;
      }
    }

    // Direct key transmission
    handleSendInput(key);
  };

  const handleRunCommandFromHistory = (command: string) => {
    setInputText("");
    setHistoryIndex(null);
    setHistory((prev) => [...prev, command]);
    handleSendInput(command + "\n");
  };

  const isOnline = clientState.status === "online";

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>ShellMind Terminal</Text>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.statusIndicator,
                isOnline ? styles.indicatorOnline : styles.indicatorOffline,
              ]}
            />
            <Text style={styles.statusLabel}>
              {isOnline ? "Connected" : "Disconnected"}
            </Text>
            {clientState.lastRttMs !== null && isOnline && (
              <Text style={styles.rttLabel}>{clientState.lastRttMs}ms</Text>
            )}
          </View>
        </View>

        {onSwitchToStatus && (
          <TouchableOpacity
            style={styles.switchButton}
            onPress={onSwitchToStatus}
            activeOpacity={0.7}
          >
            <Text style={styles.switchText}>Status</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Disconnect Warning Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Agent offline — terminal output is read-only
          </Text>
        </View>
      )}

      {/* Terminal Monospace Output */}
      <View style={styles.terminalBody} onLayout={handleLayout}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.terminalScroll}
          contentContainerStyle={styles.terminalScrollContent}
        >
          {lines.map((line) => (
            <View key={line.id} style={styles.line}>
              {line.spans.length === 0 ? (
                <Text style={styles.spanText}> </Text>
              ) : (
                line.spans.map((span, sIdx) => (
                  <Text
                    key={`${line.id}-${sIdx}`}
                    style={[
                      styles.spanText,
                      span.style.fg ? { color: span.style.fg } : undefined,
                      span.style.bg ? { backgroundColor: span.style.bg } : undefined,
                      span.style.bold ? { fontWeight: "bold" } : undefined,
                      span.style.underline
                        ? { textDecorationLine: "underline" }
                        : undefined,
                    ]}
                  >
                    {span.text}
                  </Text>
                ))
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Keyboard & Input Controls */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AccessoryBar
          ctrlActive={ctrlActive}
          onToggleCtrl={() => setCtrlActive((prev) => !prev)}
          onKeyPress={handleAccessoryKey}
          onOpenHistory={() => setHistoryModalVisible(true)}
        />

        <View style={styles.inputBar}>
          <Text style={styles.promptSymbol}>➜</Text>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSubmitCommand}
            placeholder={
              ctrlActive ? "Type key for Ctrl combo (e.g. C)" : "Enter shell command..."
            }
            placeholderTextColor="#6e7681"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            editable={isOnline}
            returnKeyType="go"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!isOnline || inputText.length === 0) && styles.sendButtonDisabled,
            ]}
            onPress={handleSubmitCommand}
            disabled={!isOnline || inputText.length === 0}
            activeOpacity={0.7}
          >
            <Text style={styles.sendButtonText}>↵</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* History Drawer Modal */}
      <HistoryModal
        visible={historyModalVisible}
        history={history}
        onSelectCommand={handleRunCommandFromHistory}
        onClose={() => setHistoryModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d1117",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#30363d",
    backgroundColor: "#161b22",
  },
  headerLeft: {
    flexDirection: "column",
  },
  title: {
    color: "#f0f6fc",
    fontSize: 16,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indicatorOnline: {
    backgroundColor: "#3fb950",
  },
  indicatorOffline: {
    backgroundColor: "#f85149",
  },
  statusLabel: {
    color: "#8b949e",
    fontSize: 12,
  },
  rttLabel: {
    color: "#58a6ff",
    fontSize: 12,
    fontWeight: "600",
  },
  switchButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#21262d",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#30363d",
  },
  switchText: {
    color: "#58a6ff",
    fontSize: 13,
    fontWeight: "600",
  },
  offlineBanner: {
    backgroundColor: "#f8514922",
    borderBottomWidth: 1,
    borderBottomColor: "#f8514944",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  offlineBannerText: {
    color: "#f85149",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
  },
  terminalBody: {
    flex: 1,
    backgroundColor: "#0d1117",
  },
  terminalScroll: {
    flex: 1,
  },
  terminalScrollContent: {
    padding: 12,
  },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    lineHeight: 18,
  },
  spanText: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#c9d1d9",
    lineHeight: 18,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#161b22",
    borderTopWidth: 1,
    borderTopColor: "#30363d",
  },
  promptSymbol: {
    color: "#3fb950",
    fontSize: 15,
    fontWeight: "bold",
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: "#f0f6fc",
    fontFamily: "monospace",
    fontSize: 14,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#0d1117",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#30363d",
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#238636",
    borderRadius: 6,
  },
  sendButtonDisabled: {
    backgroundColor: "#21262d",
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
