"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

// UI components
import Transcript from "./components/Transcript";
import BottomToolbar from "./components/BottomToolbar";
import PreConnectScreen from "./components/PreConnectScreen";
import Events from "./components/Events";

// Types
import { AgentConfig, SessionStatus } from "@/app/types";

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useHandleServerEvent } from "./hooks/useHandleServerEvent";

// Utilities
import { createRealtimeConnection } from "./lib/realtimeConnection";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";

function App() {
  const searchParams = useSearchParams();

  const { transcriptItems, addTranscriptMessage, addTranscriptBreadcrumb } =
    useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] =
    useState<AgentConfig[] | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  const [userText, setUserText] = useState<string>("");
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    const eventType = `${eventObj.type}${eventNameSuffix ? ` ${eventNameSuffix}` : ""}`;
    console.log(`[CLIENT EVENT SENDING] ${eventType}`, eventObj); // Log sending attempt
    if (dcRef.current && dcRef.current.readyState === "open") {
      logClientEvent(eventObj, eventNameSuffix);
      dcRef.current.send(JSON.stringify(eventObj));
      console.log(`[CLIENT EVENT SENT] ${eventType}`); // Log successful send
    } else {
      console.error(
        `[CLIENT EVENT FAILED] ${eventType} - Data channel not open. State: ${dcRef.current?.readyState}`,
        eventObj
      );
      logClientEvent(
        { attemptedEvent: eventObj.type },
        "error.data_channel_not_open"
      );
    }
  };

  const handleServerEventRef = useHandleServerEvent({
    setSessionStatus,
    selectedAgentName,
    selectedAgentConfigSet,
    sendClientEvent,
    setSelectedAgentName,
  });

  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(
        `Agent: ${selectedAgentName}`,
        currentAgent
      );
      updateSession(false);
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED" && sessionStatus !== "PAUSED") return;
    if (sessionStatus === "DISCONNECTED") {
      setIsInitialLoad(false);
    }
    setSessionStatus("CONNECTING");

    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        return;
      }

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
      }
      audioElementRef.current.autoplay = true;

      const { pc, dc } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioElementRef
      );
      pcRef.current = pc;
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        logClientEvent({}, "data_channel.open");
      });
      dc.addEventListener("close", () => {
        logClientEvent({}, "data_channel.close");
      });
      dc.addEventListener("error", (err: any) => {
        logClientEvent({ error: err }, "data_channel.error");
      });
      dc.addEventListener("message", (e: MessageEvent) => {
        handleServerEventRef.current(JSON.parse(e.data));
      });
    } catch (err) {
      console.error("Error connecting to realtime:", err);
      setSessionStatus("DISCONNECTED");
    }
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          id,
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      },
      "(simulated user text message)"
    );
    sendClientEvent(
      { type: "response.create" },
      "(trigger response after simulated user text message)"
    );
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    sendClientEvent(
      { type: "input_audio_buffer.clear" },
      "clear audio buffer on session update"
    );

    const currentAgent = selectedAgentConfigSet?.find(
      (a) => a.name === selectedAgentName
    );

    const turnDetection = {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 200,
      create_response: true,
    };

    const instructions = currentAgent?.instructions || "";
    const tools = currentAgent?.tools || [];

    const sessionUpdateEvent = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions,
        voice: "coral",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: turnDetection,
        tools,
      },
    };

    sendClientEvent(sessionUpdateEvent);

    if (shouldTriggerResponse) {
      sendSimulatedUserMessage("hi");
    }
  };

  const cancelAssistantSpeech = async () => {
    const mostRecentAssistantMessage = [...transcriptItems]
      .reverse()
      .find((item) => item.role === "assistant");

    if (!mostRecentAssistantMessage) {
      console.warn("can't cancel, no recent assistant message found");
      return;
    }
    if (mostRecentAssistantMessage.status === "DONE") {
      console.log("No truncation needed, message is DONE");
      return;
    }

    sendClientEvent({
      type: "conversation.item.truncate",
      item_id: mostRecentAssistantMessage?.itemId,
      content_index: 0,
      audio_end_ms: Date.now() - mostRecentAssistantMessage.createdAtMs,
    });
    sendClientEvent(
      { type: "response.cancel" },
      "(cancel due to user interruption)"
    );
  };

  const handleSendTextMessage = () => {
    console.log('[DEBUG] handleSendTextMessage called'); // Log function call
    if (!userText.trim() || sessionStatus !== "CONNECTED") {
      console.log(`[DEBUG] handleSendTextMessage aborted. userText: '${userText}', sessionStatus: ${sessionStatus}`);
      return;
    }
    console.log('[DEBUG] Proceeding to send message:', userText);
    cancelAssistantSpeech();

    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: userText.trim() }],
        },
      },
      "(send user text message)"
    );
    setUserText("");

    sendClientEvent({ type: "response.create" }, "trigger response");
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED") {
      if (pcRef.current) {
        pcRef.current.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.enabled = false;
          }
        });
      }
      setSessionStatus("PAUSED");
      logClientEvent({}, "paused");
    } else if (sessionStatus === "PAUSED") {
      if (pcRef.current) {
        pcRef.current.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.enabled = true;
          }
        });
      }
      setSessionStatus("CONNECTING");
      logClientEvent({}, "resuming");
    } else {
      connectToRealtime();
    }
  };

  const handleToggleMicMute = () => {
    if (!pcRef.current || sessionStatus !== "CONNECTED") return;

    const audioSender = pcRef.current.getSenders().find(s => s.track?.kind === 'audio');
    if (audioSender && audioSender.track) {
      const nextMuteState = !isMicMuted;
      audioSender.track.enabled = !nextMuteState;
      setIsMicMuted(nextMuteState);
      logClientEvent({ muted: nextMuteState }, nextMuteState ? "mic_muted" : "mic_unmuted");
    } else {
      console.warn("Audio track sender not found, cannot toggle mute.");
    }
  };

  useEffect(() => {
    const storedLogsExpanded = localStorage.getItem("logsExpanded");
    if (storedLogsExpanded) {
      setIsEventsPaneExpanded(storedLogsExpanded === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
  }, [isEventsPaneExpanded]);

  return (
    <div className="flex h-screen flex-col">
      <div className="p-5 text-lg font-semibold flex justify-between items-center bg-blue-600 text-white">
        <div className="flex items-center">
          <div>
            RIDEJOB模擬面談
          </div>
        </div>
      </div>

      {isInitialLoad ? (
        <PreConnectScreen onConnect={onToggleConnection} isConnecting={sessionStatus === "CONNECTING"} />
      ) : (
        <>
          <div className="flex flex-1 overflow-hidden">
            <div
              className={`overflow-y-auto bg-neutral-100 p-4 transition-all duration-300 ease-in-out ${
                isEventsPaneExpanded ? "w-1/2" : "w-full"
              }`}
            >
              <Transcript
                userText={userText}
                setUserText={setUserText}
                onSendMessage={handleSendTextMessage}
                canSend={
                  sessionStatus === "CONNECTED" &&
                  dcRef.current?.readyState === "open"
                }
              />
            </div>
            {isEventsPaneExpanded && (
              <div className="w-1/2 border-l border-gray-300 bg-white">
                <Events isExpanded={isEventsPaneExpanded} />
              </div>
            )}
          </div>
          <BottomToolbar
            sessionStatus={sessionStatus}
            onToggleConnection={onToggleConnection}
            isMicMuted={isMicMuted}
            onToggleMicMute={handleToggleMicMute}
            isEventsPaneExpanded={isEventsPaneExpanded}
            setIsEventsPaneExpanded={setIsEventsPaneExpanded}
          />
        </>
      )}
    </div>
  );
}

export default App;
