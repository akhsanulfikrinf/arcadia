import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Save, Loader2, ImagePlus } from "lucide-react";
import { supabase } from "../supabaseClient";

interface Chapter {
    id: string;
    novel_id: string;
    title: string;
    chapter_index: number;
}

interface ContentBlock {
    type: string;
    content?: string;
    image_url?: string;
    src?: string;
    position: number;
}

export default function ManageIllustrations() {
    const { id } = useParams();
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loading, setLoading] = useState(true);
    
    // State for the currently selected chapter
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
    const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
    const [loadingContent, setLoadingContent] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Store image URLs keyed by block index
    const [imageUrls, setImageUrls] = useState<Record<number, string>>({});

    useEffect(() => {
        if (!id) return;
        loadChapters();
    }, [id]);

    const loadChapters = async () => {
        const { data } = await supabase
            .from('chapters')
            .select('*')
            .eq('novel_id', id)
            .order('chapter_index', { ascending: true });
        
        if (data) setChapters(data);
        setLoading(false);
    };

    const loadChapterContent = async (chapter: Chapter) => {
        setSelectedChapter(chapter);
        setLoadingContent(true);
        setImageUrls({});
        
        const path = `novels/${id}/${chapter.id}.json`;
        const { data, error } = await supabase.storage.from('novel-contents').download(path);
        
        if (data && !error) {
            try {
                const text = await data.text();
                const blocks: ContentBlock[] = JSON.parse(text);
                setContentBlocks(blocks);
                
                // Pre-fill existing image URLs if they were already converted to images
                const urls: Record<number, string> = {};
                blocks.forEach((b, idx) => {
                    if (b.type === 'image' && (b.image_url || b.src)) {
                        urls[idx] = b.image_url || b.src || "";
                    }
                });
                setImageUrls(urls);
            } catch (e) {
                console.error("Failed to parse JSON", e);
            }
        }
        setLoadingContent(false);
    };

    const handleSave = async () => {
        if (!selectedChapter) return;
        setSaving(true);
        
        const newBlocks = contentBlocks.map((block, idx) => {
            const url = imageUrls[idx];
            if (url && url.trim().length > 0) {
                return {
                    ...block,
                    type: 'image',
                    image_url: url.trim(),
                    src: url.trim(), // keep both for compatibility
                    content: undefined // remove placeholder text
                };
            }
            return block;
        });

        const path = `novels/${id}/${selectedChapter.id}.json`;
        const { error } = await supabase.storage
            .from('novel-contents')
            .upload(path, JSON.stringify(newBlocks), {
                contentType: 'application/json',
                upsert: true
            });
            
        if (!error) {
            alert("Saved successfully!");
            setContentBlocks(newBlocks);
        } else {
            alert("Failed to save: " + error.message);
        }
        
        setSaving(false);
    };

    if (loading) return <div className="p-8">Loading chapters...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center gap-4 mb-8">
                <Link to={`/novel/${id}`} className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ImagePlus className="w-6 h-6" /> Manage Illustrations
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Chapter List */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden h-[calc(100vh-200px)] flex flex-col">
                    <div className="p-4 bg-gray-50 dark:bg-zinc-800 font-bold border-b border-gray-200 dark:border-zinc-700">
                        Chapters
                    </div>
                    <div className="overflow-y-auto flex-1 p-2">
                        {chapters.map(ch => (
                            <button
                                key={ch.id}
                                onClick={() => loadChapterContent(ch)}
                                className={`w-full text-left p-3 rounded-lg text-sm mb-1 transition ${
                                    selectedChapter?.id === ch.id 
                                        ? 'bg-black text-white dark:bg-white dark:text-black' 
                                        : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                                }`}
                            >
                                {ch.title}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Editor */}
                <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 h-[calc(100vh-200px)] overflow-y-auto">
                    {!selectedChapter ? (
                        <div className="text-center text-gray-500 h-full flex items-center justify-center">
                            Select a chapter to manage its illustrations.
                        </div>
                    ) : loadingContent ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin" />
                        </div>
                    ) : (
                        <div>
                            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-zinc-800 pb-4">
                                <h2 className="text-xl font-bold">{selectedChapter.title}</h2>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg font-bold flex items-center gap-2 hover:opacity-80 transition disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save
                                </button>
                            </div>

                            <div className="space-y-6">
                                {contentBlocks.map((block, idx) => {
                                    // Identify blocks that look like placeholders or are already images
                                    const isPlaceholder = block.type === 'paragraph' && block.content && /QWER\s*-|image|ilustrasi/i.test(block.content);
                                    const isImage = block.type === 'image' || block.type === 'image_placeholder';
                                    
                                    if (!isPlaceholder && !isImage) return null;

                                    return (
                                        <div key={idx} className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-200 dark:border-zinc-700">
                                            <p className="text-sm font-bold text-gray-500 mb-2">
                                                Found Placeholder: <span className="text-black dark:text-white font-mono">{block.content || "Existing Image"}</span>
                                            </p>
                                            <input
                                                type="text"
                                                placeholder="Paste image URL here (e.g. https://www.ruidrive.com/...jpg)"
                                                value={imageUrls[idx] || ""}
                                                onChange={(e) => setImageUrls({...imageUrls, [idx]: e.target.value})}
                                                className="w-full px-4 py-3 bg-white dark:bg-black border border-gray-300 dark:border-zinc-600 rounded-lg outline-none focus:ring-2 focus:ring-black dark:focus:ring-white font-mono text-sm"
                                            />
                                            {imageUrls[idx] && (
                                                <div className="mt-4 flex justify-center">
                                                    <img src={imageUrls[idx]} alt="Preview" className="max-h-48 rounded-lg shadow-sm" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                
                                {contentBlocks.filter(b => (b.type === 'paragraph' && b.content && /QWER\s*-|image|ilustrasi/i.test(b.content)) || b.type === 'image' || b.type === 'image_placeholder').length === 0 && (
                                    <div className="text-center text-gray-500 py-12">
                                        No image placeholders found in this chapter.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
