import React from "react";
import { SessionStatus } from "@/app/types";

interface BottomToolbarProps {
  sessionStatus: SessionStatus;
  onToggleConnection: () => void;
  isMicMuted: boolean;
  onToggleMicMute: () => void;
  isEventsPaneExpanded: boolean;
  setIsEventsPaneExpanded: (val: boolean) => void;
}

function BottomToolbar({
  sessionStatus,
  onToggleConnection,
  isMicMuted,
  onToggleMicMute,
  isEventsPaneExpanded,
  setIsEventsPaneExpanded,
}: BottomToolbarProps) {
  const isConnected = sessionStatus === "CONNECTED";
  const isPaused = sessionStatus === "PAUSED";
  const showMicButton = isConnected || isPaused;

  return (
    <div className="p-4 flex flex-row items-center justify-center gap-x-8 bg-blue-600 text-white">
      {/* Pause/Resume Button */}
      {isConnected && (
        <button
          onClick={onToggleConnection}
          className="bg-red-600 hover:bg-red-700 text-white text-base p-2 w-36 rounded-full h-10 cursor-pointer"
        >
          一時中断
        </button>
      )}
      {isPaused && (
        <button
          onClick={onToggleConnection}
          className="bg-green-600 hover:bg-green-700 text-white text-base p-2 w-36 rounded-full h-10 cursor-pointer"
        >
          再開
        </button>
      )}

      {/* Mic Mute Button */}
      {showMicButton && (
        <button
          onClick={onToggleMicMute}
          className={`text-white text-base p-2 w-36 rounded-full h-10 cursor-pointer ${
            isMicMuted
              ? "bg-yellow-600 hover:bg-yellow-700"
              : "bg-gray-600 hover:bg-gray-700"
          }`}
        >
          {isMicMuted ? "マイクON" : "マイクOFF"}
        </button>
      )}

      {/* Logs Toggle Switch */}
      <div className="flex flex-row items-center gap-2">
        <input
          id="logs"
          type="checkbox"
          checked={isEventsPaneExpanded}
          onChange={e => setIsEventsPaneExpanded(e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="logs" className="flex items-center cursor-pointer">
          Logs
        </label>
      </div>
    </div>
  );
}

export default BottomToolbar;
