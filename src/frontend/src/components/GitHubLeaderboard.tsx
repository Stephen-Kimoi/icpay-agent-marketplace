import { useEffect, useState } from "react";
import { Trophy, Users, TrendingUp, Search, Medal, Crown, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getGitHubLeaderboard,
  getGitHubRankingStats,
  searchGitHubRankings,
  type LeaderboardEntry,
  type GitHubRankingStats,
} from "@/services/githubRankingService";

interface GitHubLeaderboardProps {
  limit?: number;
  showSearch?: boolean;
  showStats?: boolean;
}

export default function GitHubLeaderboard({
  limit = 50,
  showSearch = true,
  showStats = true,
}: GitHubLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<GitHubRankingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGitHubLeaderboard(limit);
      setLeaderboard(data);
      
      if (showStats) {
        const statsData = await getGitHubRankingStats();
        setStats(statsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadLeaderboard();
      return;
    }

    try {
      setSearching(true);
      setError(null);
      const results = await searchGitHubRankings(searchQuery.trim(), limit);
      setLeaderboard(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    loadLeaderboard();
  };

  useEffect(() => {
    loadLeaderboard();
  }, [limit]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-400" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-300" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-semibold text-gray-400">#{rank}</span>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-400";
    if (score >= 80) return "text-blue-400";
    if (score >= 70) return "text-purple-400";
    if (score >= 60) return "text-yellow-400";
    return "text-gray-400";
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-500 to-yellow-600";
    if (rank === 2) return "bg-gradient-to-r from-gray-400 to-gray-500";
    if (rank === 3) return "bg-gradient-to-r from-amber-600 to-amber-700";
    if (rank <= 10) return "bg-gradient-to-r from-purple-500 to-purple-600";
    if (rank <= 50) return "bg-gradient-to-r from-blue-500 to-blue-600";
    return "bg-gradient-to-r from-gray-600 to-gray-700";
  };

  return (
    <div className="rounded-3xl border border-gray-800/70 bg-gray-950/60 p-8 backdrop-blur-xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-purple-300" />
          <h2 className="text-2xl font-bold text-white">GitHub Leaderboard</h2>
        </div>
        <Button
          onClick={loadLeaderboard}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700"
        >
          Refresh
        </Button>
      </div>

      {showStats && stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-800/60 bg-gray-900/60 p-4 text-center">
            <Users className="mx-auto mb-2 h-5 w-5 text-blue-300" />
            <p className="text-2xl font-bold text-white">{stats.total_users}</p>
            <p className="text-xs text-gray-400">Total Users</p>
          </div>
          <div className="rounded-xl border border-gray-800/60 bg-gray-900/60 p-4 text-center">
            <TrendingUp className="mx-auto mb-2 h-5 w-5 text-green-300" />
            <p className="text-2xl font-bold text-white">{stats.average_score.toFixed(1)}</p>
            <p className="text-xs text-gray-400">Average Score</p>
          </div>
          <div className="rounded-xl border border-gray-800/60 bg-gray-900/60 p-4 text-center">
            <Crown className="mx-auto mb-2 h-5 w-5 text-yellow-300" />
            <p className="text-2xl font-bold text-white">{stats.highest_score.toFixed(1)}</p>
            <p className="text-xs text-gray-400">Highest Score</p>
          </div>
          <div className="rounded-xl border border-gray-800/60 bg-gray-900/60 p-4 text-center">
            <Award className="mx-auto mb-2 h-5 w-5 text-gray-300" />
            <p className="text-2xl font-bold text-white">{stats.lowest_score.toFixed(1)}</p>
            <p className="text-xs text-gray-400">Lowest Score</p>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="mb-6 flex gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by GitHub handle..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800/50 py-2 pl-10 pr-4 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>
          </div>
          <Button
            onClick={handleSearch}
            disabled={searching}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {searching ? "Searching..." : "Search"}
          </Button>
          {searchQuery && (
            <Button
              onClick={clearSearch}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"></div>
            <p className="text-gray-400">Loading leaderboard...</p>
          </div>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="py-12 text-center">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-gray-600" />
          <p className="text-gray-400">
            {searchQuery ? "No users found matching your search." : "No users ranked yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.github_handle}
              className="flex items-center gap-4 rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 transition hover:bg-gray-900/60"
            >
              <div className="flex items-center justify-center w-12">
                {entry.rank <= 3 ? (
                  getRankIcon(entry.rank)
                ) : (
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${getRankBadgeColor(
                      entry.rank
                    )}`}
                  >
                    {entry.rank}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <a
                    href={`https://github.com/${entry.github_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-white hover:text-purple-300 transition"
                  >
                    @{entry.github_handle}
                  </a>
                  {entry.rank <= 10 && (
                    <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-300">
                      Top 10
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className={`text-2xl font-bold ${getScoreColor(entry.score)}`}>
                  {entry.score.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400">Score</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Showing {leaderboard.length} {searchQuery ? "search results" : "top users"}
            {stats && ` of ${stats.total_users} total ranked users`}
          </p>
        </div>
      )}
    </div>
  );
}