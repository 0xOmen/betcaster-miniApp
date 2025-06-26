import React from "react";
import type { Tab } from "~/components/Demo";

interface FooterProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  showWallet?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  activeTab,
  setActiveTab,
  showWallet = false,
}) => (
  <div className="fixed bottom-0 left-0 right-0 mx-4 mb-4 bg-gray-100 dark:bg-gray-800 border-[3px] border-double border-purple-500 px-2 py-2 rounded-lg z-50">
    <div className="flex justify-around items-center h-14">
      <button
        onClick={() => setActiveTab("home")}
        className={`flex flex-col items-center justify-center w-full h-full ${
          activeTab === "home"
            ? "text-purple-500 dark:text-purple-400"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        <img src="/create.png" alt="Create" className="w-6 h-6" />
        <span className="text-xs mt-1">Create</span>
      </button>
      <button
        onClick={() => setActiveTab("actions")}
        className={`flex flex-col items-center justify-center w-full h-full ${
          activeTab === "actions"
            ? "text-purple-500 dark:text-purple-400"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        <img src="/Bets2.png" alt="Pending Bets" className="w-6 h-6" />
        <span className="text-xs mt-1">Pending Bets</span>
      </button>
      <button
        onClick={() => setActiveTab("context")}
        className={`flex flex-col items-center justify-center w-full h-full ${
          activeTab === "context"
            ? "text-purple-500 dark:text-purple-400"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        <img src="/arbitrate.png" alt="Arbitrate" className="w-6 h-6" />
        <span className="text-xs mt-1">Arbitrate</span>
      </button>
      <button
        onClick={() => setActiveTab("leaderboard")}
        className={`flex flex-col items-center justify-center w-full h-full ${
          activeTab === "leaderboard"
            ? "text-purple-500 dark:text-purple-400"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        <img src="/crown.png" alt="Leaderboard" className="w-6 h-6" />
        <span className="text-xs mt-1">Leaderboard</span>
      </button>
    </div>
  </div>
);
