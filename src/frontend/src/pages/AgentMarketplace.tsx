import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileText, FileSpreadsheet, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type AgentCategory = "All" | "File Tools" | "Text Tools" | "Data Tools";

const agents = [
  {
    id: "pdf-compressor",
    name: "PDF Compressor",
    description: "Reduce PDF size for faster uploads and sharing.",
    icon: FileText,
    category: "File Tools",
    price: "From 0.05 ICP",
  },
  {
    id: "text-summarizer",
    name: "Text Summarizer",
    description: "Summarize long articles and documents instantly.",
    icon: Sparkles,
    category: "Text Tools",
    price: "From 0.03 ICP",
  },
  {
    id: "csv-analyzer",
    name: "CSV Analyzer",
    description: "Analyze and visualize CSV data efficiently.",
    icon: FileSpreadsheet,
    category: "Data Tools",
    price: "From 0.07 ICP",
    isNew: true,
  },
];

const categories: AgentCategory[] = ["All", "File Tools", "Text Tools", "Data Tools"];

export default function AgentMarketplace() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory>("All");
  const navigate = useNavigate();

  const filteredAgents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return agents.filter((agent) => {
      const matchesCategory =
        selectedCategory === "All" || agent.category === selectedCategory;
      const matchesTerm =
        term.length === 0 ||
        agent.name.toLowerCase().includes(term) ||
        agent.description.toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [searchTerm, selectedCategory]);

  const handleLaunch = (agentId: string) => {
    navigate(`/agent/${agentId}`);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-500/20 via-pink-500/10 to-blue-500/20 blur-3xl"
          animate={{ opacity: [0.6, 0.9, 0.6], scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-16 sm:px-8">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="mb-4 inline-flex items-center gap-3 rounded-full bg-gray-900/60 px-6 py-2 border border-gray-700/60 backdrop-blur">
            <Sparkles className="h-5 w-5 text-purple-300 animate-pulse" />
            <span className="text-sm tracking-wide text-gray-300">Discover pay-per-use autonomy</span>
          </div>
          <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Autonomous Agent Marketplace
            </span>
          </h1>
          <p className="mt-4 text-lg text-gray-400">
            Pay-per-use AI Agents powered by{" "}
            <a
              href="https://icpay.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-300 hover:text-purple-200"
            >
              ICPay
            </a>
          </p>
          <a
            href="https://icpay.org"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center text-sm font-medium text-gray-400 hover:text-purple-300"
          >
            Learn more →
          </a>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid gap-4 rounded-2xl bg-gradient-to-br from-gray-900/90 via-gray-900/60 to-gray-950/90 p-6 border border-gray-800/60 backdrop-blur-lg md:grid-cols-[2fr,1fr]"
        >
          <div className="relative">
            <label htmlFor="agent-search" className="mb-2 block text-sm font-medium text-gray-300">
              Search agents
            </label>
            <div className="group relative">
              <motion.div
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-gray-500 transition-colors group-focus-within:text-purple-300"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Zap className="h-5 w-5" />
              </motion.div>
              <input
                id="agent-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Find the agent you need…"
                className="w-full rounded-xl border border-gray-800 bg-gray-900/60 py-3 pl-12 pr-4 text-sm text-gray-200 placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="agent-category" className="mb-2 block text-sm font-medium text-gray-300">
              Category
            </label>
            <div className="relative">
              <select
                id="agent-category"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value as AgentCategory)}
                className="w-full appearance-none rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3 text-sm text-gray-200 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500">
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0, y: 40 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                staggerChildren: 0.12,
              },
            },
          }}
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredAgents.map((agent, index) => {
            const Icon = agent.icon;
            return (
              <motion.div
                key={agent.id}
                variants={{
                  hidden: { opacity: 0, y: 30, scale: 0.98 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { duration: 0.4, delay: index * 0.05 },
                  },
                }}
                whileHover={{ y: -8, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative h-full rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/10 to-blue-500/20 p-[1px]"
              >
                <div className="relative flex h-full flex-col gap-6 rounded-[1.5rem] border border-gray-800/70 bg-gray-950/80 p-6 backdrop-blur-xl transition-shadow duration-300 group-hover:shadow-[0_20px_60px_-20px_rgba(168,85,247,0.45)]">
                  <div className="flex items-start justify-between">
                    <motion.div
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-purple-200"
                      animate={{ rotate: [0, 2, -2, 0], scale: [1, 1.05, 1] }}
                      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Icon className="h-6 w-6" />
                    </motion.div>
                    {agent.isNew && (
                      <span className="rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-lg">
                        New
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold tracking-tight text-white">
                      {agent.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {agent.description}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-sm text-gray-400">
                    <span className="font-medium text-purple-300">{agent.price}</span>
                    <span className="rounded-full bg-gray-900/80 px-3 py-1 text-xs text-gray-500">
                      {agent.category}
                    </span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleLaunch(agent.id)}
                    className="mt-4 w-full bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:from-purple-500 hover:via-pink-500 hover:to-blue-500 hover:shadow-[0_18px_45px_-18px_rgba(56,189,248,0.6)]"
                  >
                    Launch Agent
                  </Button>
                </div>
              </motion.div>
            );
          })}
          {filteredAgents.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-full flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-gray-800 bg-gray-950/60 p-16 text-center text-gray-500"
            >
              <Sparkles className="h-8 w-8 text-purple-400" />
              <div>
                <p className="text-lg font-semibold text-gray-300">No agents found</p>
                <p className="mt-2 text-sm text-gray-500">
                  Try adjusting your filters or check back soon for new releases.
                </p>
              </div>
            </motion.div>
          )}
        </motion.section>

        <motion.footer
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col items-center gap-2 border-t border-gray-800/60 pt-8 text-center text-sm text-gray-500"
        >
          <p>
            Built with <span className="text-pink-400">❤️</span> by the Autonomous Agents Network
          </p>
          <div className="flex items-center gap-4 text-xs uppercase tracking-wide text-gray-600">
            <a
              href="https://icpay.org"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-purple-300"
            >
              ICPay
            </a>
            <span className="text-gray-700">•</span>
            <a
              href="https://dfinity.org"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-purple-300"
            >
              DFINITY
            </a>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}

