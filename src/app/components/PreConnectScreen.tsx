import React from "react";

interface PreConnectScreenProps {
  onConnect: () => void;
  isConnecting: boolean;
}

function PreConnectScreen({ onConnect, isConnecting }: PreConnectScreenProps) {
  const buttonLabel = isConnecting ? "Connecting..." : "会話開始";
  const buttonClasses = `text-white text-base p-2 w-36 rounded-full h-10 ${
    isConnecting
      ? "bg-gray-500 cursor-not-allowed"
      : "bg-green-600 hover:bg-green-700 cursor-pointer"
  }`;

  return (
    <div className="flex flex-col items-center justify-center flex-1 bg-gray-100">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800">模擬面接の準備はできましたか？</h2>
      <button
        onClick={onConnect}
        className={buttonClasses}
        disabled={isConnecting}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

export default PreConnectScreen; 