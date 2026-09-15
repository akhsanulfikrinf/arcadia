import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Plus,
    Loader2,
    CheckCircle2,
    RefreshCw,
    ListTree,
    Sparkles,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import {
    getSmartRecommendations,
    type NovelRecommendation,
} from "../data/novelRecommendations";

export default function Admin() {
    const navigate = useNavigate();
    const [url, setUrl] = useState("");
    const [status, setStatus] = useState<
        "idle" | "loading" | "success" | "error"
    >("idle");
    const [message, setMessage] = useState("");

    const [recommendations, setRecommendations] = useState<
        NovelRecommendation[]
    >([]);
    const [selectedGenre, setSelectedGenre] = useState<string>("All");

    useEffect(() => {
        document.title = "Admin Dashboard - Arcadia";
    }, []);

    useEffect(() => {
        async function checkAdmin() {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) {
                navigate("/");
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("is_admin")
                .eq("auth_id", session.user.id)
                .single();

            if (!profile?.is_admin) {
                navigate("/");
                return;
            }

            loadNovels();
        }

        async function loadNovels() {
            window.scrollTo(0, 0);
            const { data, error } = await supabase
                .from("novels")
                .select("title, url");
            if (data && !error) {
                const smartRecs = getSmartRecommendations(data);
                setRecommendations(smartRecs);
            }
        }

        checkAdmin();
    }, [navigate]);

    const filteredRecs = useMemo(() => {
        if (selectedGenre === "All") return recommendations;
        return recommendations.filter((r) => r.genre === selectedGenre);
    }, [recommendations, selectedGenre]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!url.trim() || !url.startsWith("http")) {
            setStatus("error");
            setMessage("Please enter a valid URL.");
            return;
        }

        if (
            !confirm(
                "Are you sure you want to add this novel and start the scraping process?",
            )
        ) {
            return;
        }

        setStatus("loading");

        try {
            const { data, error: funcError } = await supabase.functions.invoke(
                "add-novel",
                {
                    body: { novel_url: url },
                },
            );

            if (funcError) {
                let errDetail = funcError.message;
                try {
                    const errJson = await funcError.context?.json?.();
                    if (errJson?.error) errDetail = errJson.error;
                } catch {}
                throw new Error(errDetail);
            }

            setStatus("success");
            setMessage(
                data?.message ||
                    "Scraper triggered successfully! It may take a few minutes for chapters to appear.",
            );
            setUrl("");
        } catch (err: any) {
            console.error(err);
            setStatus("error");
            setMessage(
                err.message || "An error occurred while adding the novel.",
            );
        }
    };

    const handleSyncAll = async () => {
        if (
            !confirm(
                "Sync all novels? This will find and scrape any missing chapters or newly released volumes without re-downloading existing chapters.",
            )
        ) {
            return;
        }

        setStatus("loading");
        try {
            const { data, error: funcError } = await supabase.functions.invoke(
                "add-novel",
                {
                    body: { novel_url: "ALL" },
                },
            );

            if (funcError) {
                let errDetail = funcError.message;
                try {
                    const errJson = await funcError.context?.json?.();
                    if (errJson?.error) errDetail = errJson.error;
                } catch {}
                throw new Error(errDetail);
            }

            setStatus("success");
            setMessage(
                data?.message ||
                    "Sync triggered! All novels will be checked for missing and new chapters.",
            );
        } catch (err: any) {
            console.error(err);
            setStatus("error");
            setMessage(err.message || "An error occurred while syncing.");
        }
    };

    const handleRescrapeAll = async () => {
        if (
            !confirm(
                "Are you sure you want to trigger a full re-scrape of ALL novels in the library? This will overwrite existing chapters.",
            )
        ) {
            return;
        }

        setStatus("loading");
        try {
            const { data, error: funcError } = await supabase.functions.invoke(
                "add-novel",
                {
                    body: { novel_url: "ALL_FORCE" },
                },
            );

            if (funcError) {
                let errDetail = funcError.message;
                try {
                    const errJson = await funcError.context?.json?.();
                    if (errJson?.error) errDetail = errJson.error;
                } catch {}
                throw new Error(errDetail);
            }

            setStatus("success");
            setMessage(
                data?.message ||
                    "Full re-scrape triggered! All novels will have their chapters refreshed.",
            );
        } catch (err: any) {
            console.error(err);
            setStatus("error");
            setMessage(err.message || "An error occurred while re-scraping.");
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-12">
            <Link
                to="/"
                className="inline-flex items-center text-sm font-bold text-black dark:text-white hover:opacity-70 mb-8 transition"
            >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Library
            </Link>

            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                <h1 className="text-2xl font-bold text-black dark:text-white mb-2">
                    Add New Novel
                </h1>
                <p className="text-black/70 dark:text-white/70 mb-8">
                    Enter the URL of the light novel from meionovels.com to add
                    it to your library and trigger the scraper.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label
                            htmlFor="url"
                            className="block text-sm font-medium text-black dark:text-white mb-2"
                        >
                            Novel URL
                        </label>
                        <input
                            type="url"
                            id="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://meionovels.com/novel/example-novel/"
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white transition outline-none"
                            disabled={status === "loading"}
                        />
                    </div>

                    {recommendations.length > 0 && (
                        <div className="mb-8 pt-2">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <span className="text-sm font-bold text-black dark:text-white">
                                        Smart Novel Recommendations (
                                        {recommendations.length} new titles to
                                        scrape):
                                    </span>
                                </div>
                                <span className="text-xs text-black/50 dark:text-white/50 hidden sm:inline">
                                    Click title to auto-fill URL
                                </span>
                            </div>

                            {/* Genre Filter Tabs */}
                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {[
                                    "All",
                                    "Isekai & Fantasy",
                                    "Psychological",
                                    "Mystery & Historical",
                                    "Rom-Com & Slice of Life",
                                    "Action & Dungeon",
                                ].map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => setSelectedGenre(g)}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                                            selectedGenre === g
                                                ? "bg-black text-white dark:bg-white dark:text-black shadow-sm"
                                                : "bg-gray-100 text-black/70 hover:bg-gray-200 dark:bg-gray-800 dark:text-white/70 dark:hover:bg-gray-700"
                                        }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>

                            {/* Recommendations Card Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-95 overflow-y-auto pr-1">
                                {filteredRecs.map((rec, i) => (
                                    <div
                                        key={i}
                                        onClick={() => {
                                            setUrl(rec.url);
                                            window.scrollTo({
                                                top: 120,
                                                behavior: "smooth",
                                            });
                                        }}
                                        className={`group cursor-pointer p-3.5 rounded-2xl border transition flex flex-col justify-between ${
                                            url === rec.url
                                                ? "border-black dark:border-white bg-gray-50 dark:bg-gray-900 ring-2 ring-black/10 dark:ring-white/10"
                                                : "border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/40 hover:border-black/50 dark:hover:border-white/50 hover:shadow-sm"
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                                <span className="text-xs font-bold text-black dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-1">
                                                    {rec.title}
                                                </span>
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-black/70 dark:text-white/70 shrink-0">
                                                    {rec.genre
                                                        .split("&")[0]
                                                        .trim()}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-black/60 dark:text-white/60 line-clamp-2 leading-relaxed mb-2.5">
                                                {rec.description}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60 mt-auto">
                                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium truncate max-w-[70%]">
                                                💡 Based on:{" "}
                                                {rec.basedOn.split(",")[0]}
                                            </span>
                                            <span className="text-[10px] font-bold text-black dark:text-white group-hover:translate-x-0.5 transition-transform">
                                                Auto-fill ➜
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-100 dark:border-red-800">
                            {message}
                        </div>
                    )}

                    {status === "success" && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl text-sm flex border border-green-100 dark:border-green-800">
                            <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
                            <span>{message}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === "loading" || !url}
                        className="w-full flex justify-center items-center py-4 px-4 rounded-xl shadow-lg text-sm font-bold text-white bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {status === "loading" ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Triggering Scraper...
                            </>
                        ) : (
                            <>
                                <Plus className="w-5 h-5 mr-2" />
                                Add to Library
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-black dark:text-white mb-2">
                        Individual Management
                    </h2>
                    <p className="text-sm text-black/70 dark:text-white/70 mb-6">
                        Manage existing novels, check their scraping status, or
                        force a re-scrape for a specific title.
                    </p>

                    <Link
                        to="/admin/manual-rescrape"
                        className="w-full flex justify-center items-center py-4 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-[#222] hover:bg-black dark:bg-[#333] dark:hover:bg-[#444] transition"
                    >
                        <ListTree className="w-5 h-5 mr-2" />
                        Go to Manual Re-scrape List
                    </Link>
                </div>

                <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-black dark:text-white mb-2">
                        Library Sync & Update
                    </h2>
                    <p className="text-sm text-black/70 dark:text-white/70 mb-4">
                        Check all novels in your library to automatically fill
                        missing chapters and scrape new volume releases.
                        Existing chapters are kept as-is.
                    </p>

                    <button
                        type="button"
                        onClick={handleSyncAll}
                        disabled={status === "loading"}
                        className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition"
                    >
                        {status === "loading" ? (
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="w-5 h-5 mr-2" />
                        )}
                        Sync & Fill Missing Chapters (All Novels)
                    </button>
                </div>

                <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
                        Danger Zone
                    </h2>
                    <p className="text-sm text-black/70 dark:text-white/70 mb-4">
                        Force a complete re-scrape of all novels in your
                        library. This will delete all existing chapter contents
                        and re-download them. Use this if illustrations or text
                        are broken across multiple novels.
                    </p>
                    <button
                        type="button"
                        onClick={handleRescrapeAll}
                        disabled={status === "loading"}
                        className="w-full flex justify-center items-center py-3 px-6 rounded-xl shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition"
                    >
                        {status === "loading" ? (
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="w-5 h-5 mr-2" />
                        )}
                        Force Re-scrape All Novels
                    </button>
                </div>
            </div>
        </div>
    );
}
