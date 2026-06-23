import React from "react";
import { AgentProvider, useAgent } from "./AgentContext";
import { IntroScreen } from "./components/IntroScreen";
import { Dashboard } from "./components/Dashboard";

function Main() {
  const { hasSeenIntro } = useAgent();
  
  return (
    <div className="min-h-screen bg-canvas-base text-[#13343B] relative font-sans">
      <div className="ambient-glow" />
      <div className="ambient-glow-2" />
      {hasSeenIntro ? <Dashboard /> : <IntroScreen />}
    </div>
  );
}

export default function App() {
  return (
    <AgentProvider>
      <Main />
    </AgentProvider>
  );
}
