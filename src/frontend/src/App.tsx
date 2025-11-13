import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import AgentMarketplace from "./pages/AgentMarketplace";
import PaymentAgent from "./pages/PaymentAgent";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen bg-black">
        <Routes>
          <Route path="/" element={<AgentMarketplace />} />
          <Route path="/agent/:agentId" element={<PaymentAgent />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;