import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "../supabaseClient";

interface BookmarkedChapter {
    id: string;
    title: string;
    chapter_index: number;
    novel_id: string;
    novels: {
        title: string;
        cover_url: string;
    } | null;
}

export default function Bookmarks() {
    const [bookmarkedChapters, setBookmarkedChapters] = useState<
        BookmarkedChapter[]
    >([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = "Bookmarks - Arcadia";
    }, []);

    useEffect(() => {
        async function loadBookmarks() {
            window.scrollTo(0, 0);
            const profileId = localStorage.getItem("arcadia_profile_id");
            let bookmarkIds = JSON.parse(
                localStorage.getItem("arcadia_bookmarks") || "[]",
            );

            // Load from DB if possible
            if (profileId) {
                const { data: dbBmk } = await supabase
                    .from("bookmarks")
                    .select("chapter_id")
                    .eq("profile_id", profileId);

                if (dbBmk) {
                    const dbIds = dbBmk.map((b) => b.chapter_id);
                    // Merge unique IDs
                    bookmarkIds = [...new Set([...bookmarkIds, ...dbIds])];
                }
            }

            if (bookmarkIds.length === 0) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from("chapters")
                .select(
                    `
          id,
          title,
          chapter_index,
          novel_id,
          novels (
            title,
            cover_url
          )
        `,
                )
                .in("id", bookmarkIds);

            if (!error && data) {
                setBookmarkedChapters(data as unknown as BookmarkedChapter[]);
            }
            setLoading(false);
        }

        loadBookmarks();
    }, []);

    const removeBookmark = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const profileId = localStorage.getItem("arcadia_profile_id");

        // 1. Remove locally
        const bookmarks = JSON.parse(
            localStorage.getItem("arcadia_bookmarks") || "[]",
        );
        const newBookmarks = bookmarks.filter((bId: string) => bId !== id);
        localStorage.setItem("arcadia_bookmarks", JSON.stringify(newBookmarks));
        setBookmarkedChapters((prev) => prev.filter((b) => b.id !== id));

        // 2. Remove from DB
        if (profileId) {
            await supabase
                .from("bookmarks")
                .delete()
                .match({ profile_id: profileId, chapter_id: id });
        }
    };

    if (loading)
        return (
            <div className="flex justify-center flex-col items-center h-screen bg-white dark:bg-[#121212]">
                <Loader2 className="w-8 h-8 animate-spin text-black dark:text-white mb-4" />
                <p className="text-black dark:text-white font-medium">
                    Loading bookmarks...
                </p>
            </div>
        );

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <Link
                to="/"
                className="inline-flex items-center text-sm font-bold text-black dark:text-white hover:opacity-70 mb-8 transition"
            >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Library
            </Link>

            <div className="mb-10">
                <h1 className="text-3xl font-bold text-black dark:text-white mb-4 flex items-center">
                    <Bookmark className="w-8 h-8 mr-3 fill-current" /> Bookmarks
                </h1>
                <p className="text-black/70 dark:text-white/70">
                    Your saved chapters for quick access.
                </p>
            </div>

            {bookmarkedChapters.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                    <Bookmark className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p className="text-black/50 dark:text-white/50">
                        You haven't bookmarked any chapters yet.
                    </p>
                    <Link
                        to="/"
                        className="mt-4 inline-block px-6 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold hover:opacity-80 transition"
                    >
                        Explore Library
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {bookmarkedChapters.map((ch) => (
                        <Link
                            key={ch.id}
                            to={`/read/${ch.id}`}
                            className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md transition group flex items-center gap-4"
                        >
                            <img
                                src={ch.novels?.cover_url}
                                alt=""
                                className="w-12 h-16 object-cover rounded-lg bg-gray-100 dark:bg-gray-900 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-black/50 dark:text-white/50 uppercase tracking-wider mb-1 truncate">
                                    {ch.novels?.title}
                                </p>
                                <h3 className="font-bold text-black dark:text-white truncate">
                                    {ch.title}
                                </h3>
                            </div>
                            <button
                                onClick={(e) => removeBookmark(ch.id, e)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                title="Remove bookmark"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
