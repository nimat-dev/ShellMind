import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import type {
  ChatTurn,
  AgentStreamEvent,
  PermRequestPayload,
  PermissionDecision,
  ProjectEntry,
} from "@shellmind/protocol";
import { AgentClient } from "../client.js";
import { getToolRenderer } from "../renderers/registry.js";
import { PermissionCard } from "./PermissionCard.js";
import {
  getSpeechToTextProvider,
  type ISpeechToTextProvider,
  getTextToSpeechProvider,
  type ITextToSpeechProvider,
  extractSpokenSummary,
} from "../voice/index.js";

export interface ChatScreenProps {
  client: AgentClient;
  sttProvider?: ISpeechToTextProvider;
  ttsProvider?: ITextToSpeechProvider;
  initialTtsEnabled?: boolean;
}

interface ParsedToolExecution {
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  client,
  sttProvider,
  ttsProvider,
  initialTtsEnabled = false,
}) => {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentCwd, setCurrentCwd] = useState<string>("");
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<PermRequestPayload | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(initialTtsEnabled);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const activeSTT = sttProvider ?? getSpeechToTextProvider();
  const activeTTS = ttsProvider ?? getTextToSpeechProvider();

  const ttsEnabledRef = useRef(initialTtsEnabled);
  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  const activeTTSRef = useRef(activeTTS);
  useEffect(() => {
    activeTTSRef.current = activeTTS;
  }, [activeTTS]);

  useEffect(() => {
    return () => {
      activeTTSRef.current.stop().catch(() => {});
    };
  }, []);

  const scrollViewRef = useRef<ScrollView>(null);
  const currentStreamingTurnRef = useRef<ChatTurn | null>(null);

  // Initialize and load chat history & projects on mount
  useEffect(() => {
    // 1. Initial requests
    client.requestChatHistory();
    client.requestProjectList();

    // 2. Chat history listener
    const unsubHistory = client.onChatHistory((resp) => {
      setCurrentCwd(resp.currentCwd);
      setTurns((prevTurns) => {
        const turnMap = new Map<string, ChatTurn>();
        // Add existing turns
        for (const t of prevTurns) {
          turnMap.set(t.id, t);
        }
        // Merge or overwrite with canonical turns from agent
        for (const t of resp.turns) {
          turnMap.set(t.id, t);
        }
        return Array.from(turnMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      });
    });

    // 3. Project list listener
    const unsubProjects = client.onProjectList((resp) => {
      setCurrentCwd(resp.currentCwd);
      setProjects(resp.projects);
    });

    // 4. Project set listener
    const unsubProjectSet = client.onProjectSet((resp) => {
      if (resp.success) {
        setCurrentCwd(resp.currentCwd);
        // Reload history for new directory
        client.requestChatHistory(resp.currentCwd);
      }
    });

    // 5. Permission request listener
    const unsubPerm = client.onPermissionRequest((req) => {
      setPendingPermission(req);
    });

    // 6. Agent stream listener
    const unsubStream = client.onAgentStream((event: AgentStreamEvent) => {
      handleStreamEvent(event);
    });

    // 7. State change (reconnect handler)
    const unsubState = client.onStateChange((state) => {
      if (state.status === "online") {
        client.requestChatHistory();
        client.requestProjectList();
      }
    });

    return () => {
      unsubHistory();
      unsubProjects();
      unsubProjectSet();
      unsubPerm();
      unsubStream();
      unsubState();
    };
  }, [client]);

  const handleStreamEvent = (event: AgentStreamEvent) => {
    if (event.type === "assistant_text") {
      setIsStreaming(true);
      setTurns((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant" || last.status !== "streaming") {
          const newAssistantTurn: ChatTurn = {
            id: `stream_${Date.now()}`,
            role: "assistant",
            text: event.text,
            timestamp: Date.now(),
            status: "streaming",
            toolEvents: [event],
          };
          currentStreamingTurnRef.current = newAssistantTurn;
          return [...prev, newAssistantTurn];
        }

        const updated: ChatTurn = {
          ...last,
          text: (last.text ?? "") + event.text,
          toolEvents: [...(last.toolEvents ?? []), event],
        };
        currentStreamingTurnRef.current = updated;
        return [...prev.slice(0, -1), updated];
      });
    } else if (event.type === "tool_use" || event.type === "tool_result") {
      setIsStreaming(true);
      setTurns((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") {
          const newAssistantTurn: ChatTurn = {
            id: `stream_${Date.now()}`,
            role: "assistant",
            text: "",
            timestamp: Date.now(),
            status: "streaming",
            toolEvents: [event],
          };
          currentStreamingTurnRef.current = newAssistantTurn;
          return [...prev, newAssistantTurn];
        }

        const updated: ChatTurn = {
          ...last,
          toolEvents: [...(last.toolEvents ?? []), event],
        };
        currentStreamingTurnRef.current = updated;
        return [...prev.slice(0, -1), updated];
      });
    } else if (event.type === "done") {
      setIsStreaming(false);
      setPendingPermission(null);
      let finalText = event.result || "";
      setTurns((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        finalText = last.text || event.result || "";
        const updated: ChatTurn = {
          ...last,
          status: "done",
          text: finalText,
          toolEvents: [...(last.toolEvents ?? []), event],
        };
        return [...prev.slice(0, -1), updated];
      });

      // TTS Spoken reply if toggle is enabled
      if (ttsEnabledRef.current && finalText) {
        const summary = extractSpokenSummary(finalText);
        if (summary) {
          activeTTSRef.current.stop().catch(() => {});
          setIsSpeaking(true);
          activeTTSRef.current
            .speak(summary, {
              onStart: () => setIsSpeaking(true),
              onDone: () => setIsSpeaking(false),
              onError: () => setIsSpeaking(false),
            })
            .catch(() => {
              setIsSpeaking(false);
            });
        }
      }
    } else if (event.type === "aborted" || event.type === "error") {
      setIsStreaming(false);
      setPendingPermission(null);
      activeTTSRef.current.stop().catch(() => {});
      setIsSpeaking(false);
      setTurns((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        const updated: ChatTurn = {
          ...last,
          status: event.type === "aborted" ? "aborted" : "error",
          toolEvents: [...(last.toolEvents ?? []), event],
        };
        return [...prev.slice(0, -1), updated];
      });
    }
  };

  const handleStopSpeaking = () => {
    activeTTSRef.current.stop().catch(() => {});
    setIsSpeaking(false);
  };

  const handleToggleTTS = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    if (!next) {
      activeTTSRef.current.stop().catch(() => {});
      setIsSpeaking(false);
    }
  };

  const handleSendPrompt = () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    activeTTSRef.current.stop().catch(() => {});
    setIsSpeaking(false);

    const userTurn: ChatTurn = {
      id: `usr_${Date.now()}`,
      role: "user",
      text,
      timestamp: Date.now(),
      status: "done",
    };

    setTurns((prev) => [...prev, userTurn]);
    setInputText("");
    setIsStreaming(true);

    client.sendAgentPrompt(text, currentCwd || undefined);
  };

  const handleAbort = () => {
    activeTTSRef.current.stop().catch(() => {});
    setIsSpeaking(false);
    client.abortAgent("Aborted by user");
    setIsStreaming(false);
    setPendingPermission(null);
  };

  const handleSelectProject = (projectPath: string) => {
    setIsPickerOpen(false);
    client.setProject(projectPath);
  };

  const handlePermissionResponse = (decision: PermissionDecision, remember: boolean) => {
    if (!pendingPermission) return;
    client.respondPermission(pendingPermission.requestId, decision, remember);
    setPendingPermission(null);
  };

  const handleStartVoice = async () => {
    setVoiceError(null);
    activeTTSRef.current.stop().catch(() => {});
    setIsSpeaking(false);
    try {
      const perm = await activeSTT.requestPermission();
      if (perm === "denied") {
        setVoiceError("Microphone permission denied. Tap to type instead.");
        return;
      }
      await activeSTT.startRecording((interim) => {
        setInputText(interim);
      });
      setIsRecording(true);
    } catch (err) {
      setVoiceError((err as Error).message || "Voice input failed");
      setIsRecording(false);
    }
  };

  const handleStopVoice = async () => {
    if (!isRecording) return;
    try {
      const recognized = await activeSTT.stopRecording();
      setIsRecording(false);
      if (recognized.trim()) {
        setInputText(recognized);
      }
    } catch {
      setIsRecording(false);
    }
  };

  const handleCancelVoice = async () => {
    try {
      await activeSTT.cancelRecording();
    } catch {
      // Ignored
    }
    setIsRecording(false);
  };

  // Group tool_use and tool_result events into structured executions
  const extractToolExecutions = (toolEvents?: AgentStreamEvent[]): ParsedToolExecution[] => {
    if (!toolEvents) return [];
    const map = new Map<string, ParsedToolExecution>();

    for (const ev of toolEvents) {
      if (ev.type === "tool_use") {
        map.set(ev.toolUseId, {
          toolName: ev.toolName,
          toolUseId: ev.toolUseId,
          input: ev.input,
        });
      } else if (ev.type === "tool_result") {
        const existing = map.get(ev.toolUseId);
        if (existing) {
          existing.result = ev.content;
          existing.isError = ev.isError;
        } else {
          map.set(ev.toolUseId, {
            toolName: "Tool",
            toolUseId: ev.toolUseId,
            input: {},
            result: ev.content,
            isError: ev.isError,
          });
        }
      }
    }

    return Array.from(map.values());
  };

  return (
    <View style={styles.container} testID="chat-screen">
      {/* Top Project Selector Bar */}
      <View style={styles.projectBar}>
        <TouchableOpacity
          style={styles.projectButton}
          onPress={() => setIsPickerOpen(!isPickerOpen)}
          activeOpacity={0.7}
          testID="project-picker-button"
        >
          <Text style={styles.projectFolderIcon}>📁</Text>
          <Text style={styles.projectNameText} numberOfLines={1}>
            {currentCwd ? currentCwd.split("/").pop() || currentCwd : "Select Project"}
          </Text>
          <Text style={styles.chevronIcon}>{isPickerOpen ? "▲" : "▼"}</Text>
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          {/* TTS Spoken Replies Toggle */}
          <TouchableOpacity
            style={[styles.ttsToggle, ttsEnabled && styles.ttsToggleActive]}
            onPress={handleToggleTTS}
            testID="tts-toggle"
            accessibilityLabel={ttsEnabled ? "Disable spoken replies" : "Enable spoken replies"}
          >
            <Text style={styles.ttsToggleIcon}>{ttsEnabled ? "🔊" : "🔇"}</Text>
            <Text style={[styles.ttsToggleText, ttsEnabled && styles.ttsToggleTextActive]}>
              {ttsEnabled ? "Voice On" : "Voice Off"}
            </Text>
          </TouchableOpacity>

          {isStreaming && (
            <View style={styles.busyIndicator}>
              <ActivityIndicator size="small" color="#58A6FF" />
              <Text style={styles.busyText}>Claude is thinking...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Project Dropdown Modal/List */}
      {isPickerOpen && (
        <View style={styles.projectDropdown} testID="project-picker-list">
          <Text style={styles.dropdownTitle}>Switch Workspace Directory</Text>
          {projects.map((proj) => (
            <TouchableOpacity
              key={proj.path}
              style={[
                styles.projectItem,
                proj.path === currentCwd && styles.projectItemActive,
              ]}
              onPress={() => handleSelectProject(proj.path)}
              testID={`project-item-${proj.name}`}
            >
              <Text
                style={[
                  styles.projectItemName,
                  proj.path === currentCwd && styles.projectItemNameActive,
                ]}
              >
                {proj.name}
              </Text>
              <Text style={styles.projectItemPath} numberOfLines={1}>
                {proj.path}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Message Timeline */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageScroll}
        contentContainerStyle={styles.messageContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {turns.length === 0 && (
          <View style={styles.emptyContainer} testID="empty-chat-state">
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>ShellMind AI Assistant</Text>
            <Text style={styles.emptySubtitle}>
              Ask Claude Code to inspect files, run tests, or execute terminal commands in this project.
            </Text>
          </View>
        )}

        {turns.map((turn) => {
          const isUser = turn.role === "user";
          const toolExecutions = !isUser ? extractToolExecutions(turn.toolEvents) : [];

          return (
            <View
              key={turn.id}
              style={[
                styles.turnRow,
                isUser ? styles.turnRowUser : styles.turnRowAssistant,
              ]}
              testID={`chat-bubble-${turn.role}-${turn.id}`}
            >
              {isUser ? (
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{turn.text}</Text>
                </View>
              ) : (
                <View style={styles.assistantBubble}>
                  {/* Tool Cards */}
                  {toolExecutions.map((exec) => {
                    const Renderer = getToolRenderer(exec.toolName);
                    return (
                      <Renderer
                        key={exec.toolUseId}
                        toolName={exec.toolName}
                        input={exec.input}
                        result={exec.result}
                        isError={exec.isError}
                      />
                    );
                  })}

                  {/* Assistant Text */}
                  {Boolean(turn.text) && (
                    <Text style={styles.assistantText} testID="assistant-text">
                      {turn.text}
                    </Text>
                  )}

                  {/* Turn Status Pill */}
                  {turn.status && turn.status !== "done" && (
                    <View style={styles.statusRow}>
                      <Text
                        style={[
                          styles.turnStatusPill,
                          turn.status === "streaming"
                            ? styles.streamingPill
                            : turn.status === "aborted"
                            ? styles.abortedPill
                            : styles.errorPill,
                        ]}
                      >
                        {turn.status.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Pending Permission Card Embed */}
        {pendingPermission && (
          <View style={styles.permissionWrapper} testID="chat-permission-card">
            <PermissionCard
              request={pendingPermission}
              onRespond={handlePermissionResponse}
            />
          </View>
        )}
      </ScrollView>

      {/* Voice Error Notification Banner */}
      {voiceError && (
        <View style={styles.voiceErrorBanner} testID="voice-error-banner">
          <Text style={styles.voiceErrorText}>{voiceError}</Text>
          <TouchableOpacity onPress={() => setVoiceError(null)}>
            <Text style={styles.voiceErrorDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active Speech Playback Indicator */}
      {isSpeaking && (
        <View style={styles.speakingIndicator} testID="speaking-indicator">
          <View style={styles.speakingPulseDot} />
          <Text style={styles.speakingText}>Speaking response...</Text>
          <TouchableOpacity
            onPress={handleStopSpeaking}
            style={styles.ttsStopButton}
            testID="tts-stop-button"
          >
            <Text style={styles.ttsStopText}>Mute</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active Voice Recording Indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator} testID="recording-indicator">
          <View style={styles.recordingPulseDot} />
          <Text style={styles.recordingText}>Listening... release to send or edit</Text>
          <TouchableOpacity onPress={handleCancelVoice} testID="voice-cancel-button">
            <Text style={styles.voiceCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask Claude Code..."
          placeholderTextColor="#8B949E"
          value={inputText}
          onChangeText={setInputText}
          multiline
          testID="chat-input-field"
        />

        {/* Push to talk Microphone Button */}
        <TouchableOpacity
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          onPressIn={handleStartVoice}
          onPressOut={handleStopVoice}
          activeOpacity={0.7}
          testID="mic-button"
          accessibilityLabel="Push to talk"
        >
          <Text style={styles.micButtonIcon}>{isRecording ? "🔴" : "🎙️"}</Text>
        </TouchableOpacity>

        {isStreaming ? (
          <TouchableOpacity
            style={styles.abortButton}
            onPress={handleAbort}
            testID="chat-abort-button"
            activeOpacity={0.7}
          >
            <Text style={styles.abortButtonText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSendPrompt}
            disabled={!inputText.trim()}
            testID="chat-send-button"
            activeOpacity={0.7}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D1117",
  },
  projectBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#161B22",
    borderBottomWidth: 1,
    borderBottomColor: "#21262D",
  },
  projectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#21262D",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    maxWidth: "70%",
    gap: 6,
  },
  projectFolderIcon: {
    fontSize: 14,
  },
  projectNameText: {
    color: "#C9D1D9",
    fontSize: 13,
    fontWeight: "600",
  },
  chevronIcon: {
    color: "#8B949E",
    fontSize: 10,
  },
  busyIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  busyText: {
    color: "#58A6FF",
    fontSize: 12,
  },
  projectDropdown: {
    backgroundColor: "#161B22",
    borderBottomWidth: 1,
    borderBottomColor: "#30363D",
    padding: 12,
    gap: 8,
    maxHeight: 220,
  },
  dropdownTitle: {
    color: "#8B949E",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  projectItem: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#0D1117",
  },
  projectItemActive: {
    borderColor: "#58A6FF",
    borderWidth: 1,
  },
  projectItemName: {
    color: "#C9D1D9",
    fontWeight: "600",
    fontSize: 13,
  },
  projectItemNameActive: {
    color: "#58A6FF",
  },
  projectItemPath: {
    color: "#8B949E",
    fontSize: 11,
    fontFamily: "Courier",
    marginTop: 2,
  },
  messageScroll: {
    flex: 1,
  },
  messageContent: {
    padding: 12,
    gap: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#E6EDF3",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "#8B949E",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  turnRow: {
    flexDirection: "row",
  },
  turnRowUser: {
    justifyContent: "flex-end",
  },
  turnRowAssistant: {
    justifyContent: "flex-start",
  },
  userBubble: {
    backgroundColor: "#1F6FEB",
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "85%",
  },
  userText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
  },
  assistantBubble: {
    backgroundColor: "#161B22",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: "92%",
    borderWidth: 1,
    borderColor: "#30363D",
  },
  assistantText: {
    color: "#C9D1D9",
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 4,
  },
  statusRow: {
    marginTop: 6,
    flexDirection: "row",
  },
  turnStatusPill: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  streamingPill: {
    backgroundColor: "#2C313A",
    color: "#D19A66",
  },
  abortedPill: {
    backgroundColor: "#422828",
    color: "#E06C75",
  },
  errorPill: {
    backgroundColor: "#4E2121",
    color: "#FF5370",
  },
  permissionWrapper: {
    marginVertical: 8,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    backgroundColor: "#161B22",
    borderTopWidth: 1,
    borderTopColor: "#21262D",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#0D1117",
    color: "#E6EDF3",
    fontSize: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#30363D",
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#238636",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#21262D",
    opacity: 0.6,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  abortButton: {
    backgroundColor: "#DA3633",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  abortButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  micButton: {
    backgroundColor: "#21262D",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#30363D",
  },
  micButtonActive: {
    backgroundColor: "#492324",
    borderColor: "#F85149",
  },
  micButtonIcon: {
    fontSize: 14,
  },
  voiceErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#3A1D1D",
    borderTopWidth: 1,
    borderColor: "#F85149",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  voiceErrorText: {
    color: "#FFA198",
    fontSize: 12,
    flex: 1,
  },
  voiceErrorDismiss: {
    color: "#FFA198",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 8,
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1427",
    borderTopWidth: 1,
    borderColor: "#A371F7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  recordingPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F85149",
  },
  recordingText: {
    color: "#D2A8FF",
    fontSize: 12,
    flex: 1,
    fontWeight: "500",
  },
  voiceCancelText: {
    color: "#8B949E",
    fontSize: 12,
    fontWeight: "600",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ttsToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#21262D",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  ttsToggleActive: {
    backgroundColor: "#1F2937",
    borderColor: "#388BFD",
  },
  ttsToggleIcon: {
    fontSize: 12,
  },
  ttsToggleText: {
    color: "#8B949E",
    fontSize: 11,
    fontWeight: "600",
  },
  ttsToggleTextActive: {
    color: "#58A6FF",
  },
  speakingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161B22",
    borderTopWidth: 1,
    borderTopColor: "#388BFD",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  speakingPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#388BFD",
  },
  speakingText: {
    color: "#58A6FF",
    fontSize: 12,
    flex: 1,
    fontWeight: "500",
  },
  ttsStopButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#21262D",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#F85149",
  },
  ttsStopText: {
    color: "#F85149",
    fontSize: 11,
    fontWeight: "600",
  },
});
