import React from "react";
import { SessionStatus } from "@/app/types";

interface BottomToolbarProps {
  sessionStatus: SessionStatus;
  onToggleConnection: () => void;
}

function BottomToolbar({
  sessionStatus,
  onToggleConnection,
}: BottomToolbarProps) {
  const isConnected = sessionStatus === "CONNECTED";
  const isPaused = sessionStatus === "PAUSED";

  return (
    <div className="p-4 flex flex-row items-center justify-center gap-x-8 bg-blue-600 text-white">
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
    </div>
  );
}

export default BottomToolbar;
