import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import AgentMarketplace from "./pages/AgentMarketplace";
import CsvAnalyzerAgent from "./pages/agents/CsvAnalyzerAgent";
import PdfCompressorAgent from "./pages/agents/PdfCompressorAgent";
import TextSummarizerAgent from "./pages/agents/TextSummarizerAgent";
import GitHubScorerAgent from "./pages/agents/GitHubScorerAgent";
import PaymentAgent from "./pages/PaymentAgent";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen bg-black">
        <Routes>
          <Route path="/" element={<AgentMarketplace />} />
          <Route path="/agent/pdf-compressor" element={<PdfCompressorAgent />} />
          <Route path="/agent/text-summarizer" element={<TextSummarizerAgent />} />
          <Route path="/agent/csv-analyzer" element={<CsvAnalyzerAgent />} />
          <Route path="/agent/github-scorer" element={<GitHubScorerAgent />} />
          <Route path="/agent/:agentId" element={<PaymentAgent />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;