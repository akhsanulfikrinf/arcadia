import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import { Upload as UploadIcon, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function Upload() {
    const [files, setFiles] = useState<File[]>([]);
    const [title, setTitle] = useState("");
    const [coverUrl, setCoverUrl] = useState("");
    const [splitChapters, setSplitChapters] = useState(true);
    
    const [isExistingNovel, setIsExistingNovel] = useState(false);
    const [existingNovels, setExistingNovels] = useState<{id: string, title: string}[]>([]);
    const [selectedNovelId, setSelectedNovelId] = useState("");
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressStr, setProgressStr] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        const fetchNovels = async () => {
            const { data } = await supabase.from('novels').select('id, title').order('title');
            if (data) {
                setExistingNovels(data);
                if (data.length > 0) setSelectedNovelId(data[0].id);
            }
        };
        fetchNovels();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name));
            setFiles(selectedFiles);
            if (!isExistingNovel) {
                setTitle(selectedFiles[0].name.replace(/\.[^/.]+$/, "").replace(/\s*(volume|vol|bab|chapter|bagian)\s*\d+/i, "").trim());
            }
            setError("");
            setSuccess("");
        }
    };

    const extractText = async (file: File): Promise<string> => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        
        if (ext === "txt") {
            return await file.text();
        } else if (ext === "docx") {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        } else if (ext === "pdf") {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                setProgressStr(`Reading PDF page ${i} of ${pdf.numPages}...`);
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                
                const textItems = content.items.filter(item => 'str' in item) as any[];
                textItems.sort((a, b) => {
                    const yDiff = b.transform[5] - a.transform[5];
                    if (Math.abs(yDiff) < 5) {
                        return a.transform[4] - b.transform[4];
                    }
                    return yDiff;
                });
                
                let pageText = "";
                let lastY = -1;
                for (const item of textItems) {
                    const y = Math.round(item.transform[5]);
                    if (lastY !== -1 && Math.abs(y - lastY) > 4) {
                        pageText += "\n";
                    } else if (lastY !== -1 && item.str.trim() !== "") {
                        pageText += " ";
                    }
                    pageText += item.str;
                    lastY = y;
                }

                // Strip header, footer, page number
                const lines = pageText.split('\n').filter(line => {
                    const t = line.trim().toLowerCase();
                    if (/^\d+$/.test(t)) return false; // skip pure page numbers
                    if (t.includes('ruidrive.com')) return false; // skip footer
                    if (title && t.includes(title.toLowerCase()) && t.length < 100) return false; // skip header with novel title
                    return true;
                });

                fullText += lines.join('\n') + "\n\n";
            }
            return fullText;
        } else {
            throw new Error("Unsupported file format. Please use TXT, DOCX, or PDF.");
        }
    };

    const processChapters = (text: string) => {
        if (!splitChapters) {
            return [{ title: "Chapter 1", content: text }];
        }

        const regex = /^(?:Chapter|Bab|Volume|Bagian)\s*[\dIVXLCDM]+|^(?:Prologue|Prolog|Epilogue|Epilog)/im;
        const lines = text.split('\n');
        const chapters: {title: string, content: string}[] = [];
        
        let currentTitle = "Chapter 1";
        let currentContent: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            if (/^\d+$/.test(line)) continue; // Skip page numbers
            
            if (regex.test(line) && line.length < 100) {
                if (currentContent.length < 15) {
                    currentContent.push(line);
                    continue;
                }
                if (currentContent.length > 0) {
                    chapters.push({
                        title: currentTitle,
                        content: currentContent.join('\n')
                    });
                }
                currentTitle = line;
                currentContent = [];
            } else {
                currentContent.push(line);
            }
        }
        
        if (currentContent.length > 0) {
            chapters.push({
                title: currentTitle,
                content: currentContent.join('\n')
            });
        }
        
        if (chapters.length === 0) {
            return [{ title: "Chapter 1", content: text }];
        }
        
        return chapters;
    };

    const handleUpload = async () => {
        if (files.length === 0) {
            setError("Please select at least one file.");
            return;
        }
        
        if (isExistingNovel && !selectedNovelId) {
            setError("Please select an existing novel from the list.");
            return;
        }
        
        if (!isExistingNovel && !title.trim()) {
            setError("Please enter a novel title.");
            return;
        }

        setIsProcessing(true);
        setError("");
        setSuccess("");

        try {
            let novelId = "";
            let startChapterIndex = 1;
            let finalTitle = "";

            // Optional: Extract cover from the latest (last) PDF volume if no cover URL provided
            let coverBlob: Blob | null = null;
            if (!coverUrl.trim()) {
                const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
                if (pdfFiles.length > 0) {
                    setProgressStr("Extracting cover image from the latest PDF volume...");
                    const latestPdf = pdfFiles[pdfFiles.length - 1];
                    try {
                        const arrayBuffer = await latestPdf.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                        const page = await pdf.getPage(1);
                        const viewport = page.getViewport({ scale: 1.5 });
                        
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            await page.render({ canvasContext: ctx, canvas, viewport }).promise;
                            coverBlob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.8));
                        }
                    } catch (e) {
                        console.error("Failed to extract cover from PDF:", e);
                    }
                }
            }

            if (isExistingNovel) {
                novelId = selectedNovelId;
                const selectedNovel = existingNovels.find(n => n.id === novelId);
                finalTitle = selectedNovel ? selectedNovel.title : "Unknown Novel";
                
                setProgressStr("Fetching existing novel data...");
                const { data: lastChapter } = await supabase
                    .from('chapters')
                    .select('chapter_index')
                    .eq('novel_id', novelId)
                    .order('chapter_index', { ascending: false })
                    .limit(1)
                    .single();
                
                if (lastChapter) {
                    startChapterIndex = lastChapter.chapter_index + 1;
                }
            } else {
                finalTitle = title.trim();
                setProgressStr("Checking database for existing novel...");
                // Keep the fail-safe check in case they typed an existing title
                const { data: existingNovel, error: searchErr } = await supabase
                    .from('novels')
                    .select('id')
                    .ilike('title', finalTitle)
                    .maybeSingle();

                if (searchErr) throw searchErr;

                if (existingNovel) {
                    novelId = existingNovel.id;
                    const { data: lastChapter } = await supabase
                        .from('chapters')
                        .select('chapter_index')
                        .eq('novel_id', novelId)
                        .order('chapter_index', { ascending: false })
                        .limit(1)
                        .single();
                    if (lastChapter) startChapterIndex = lastChapter.chapter_index + 1;
                } else {
                    // Create new novel
                    const fakeUrl = `https://manual-upload/${Date.now()}`;
                    const { data: newNovel, error: createErr } = await supabase
                        .from('novels')
                        .insert({
                            title: finalTitle,
                            url: fakeUrl,
                            cover_url: coverUrl.trim() || null
                        })
                        .select('id')
                        .single();
                    
                    if (createErr || !newNovel) throw createErr || new Error("Failed to create novel.");
                    novelId = newNovel.id;
                }
            }

            // Upload the extracted cover image if one was generated
            if (coverBlob) {
                setProgressStr("Uploading extracted cover image...");
                const coverPath = `covers/${novelId}.jpg`;
                const { error: coverUploadErr } = await supabase.storage
                    .from('novel-contents')
                    .upload(coverPath, coverBlob, { contentType: 'image/jpeg', upsert: true });
                
                if (!coverUploadErr) {
                    const { data: publicUrlData } = supabase.storage.from('novel-contents').getPublicUrl(coverPath);
                    if (publicUrlData && publicUrlData.publicUrl) {
                        await supabase.from('novels').update({ cover_url: publicUrlData.publicUrl }).eq('id', novelId);
                    }
                }
            }

            let globalCompletedCount = 0;
            let currentChapterIndex = startChapterIndex;

            // Process each file sequentially
            for (let fIdx = 0; fIdx < files.length; fIdx++) {
                const currentFile = files[fIdx];
                setProgressStr(`[File ${fIdx + 1}/${files.length}] Extracting text from ${currentFile.name}...`);
                
                const text = await extractText(currentFile);
                
                setProgressStr(`[File ${fIdx + 1}/${files.length}] Processing chapters...`);
                const parsedChapters = processChapters(text);
                
                if (parsedChapters.length === 0) continue;

                for (let i = 0; i < parsedChapters.length; i++) {
                    const ch = parsedChapters[i];
                    setProgressStr(`[File ${fIdx + 1}/${files.length}] Uploading chapter ${i + 1} of ${parsedChapters.length}...`);
                    
                    const { data: chData, error: chErr } = await supabase
                        .from('chapters')
                        .insert({
                            novel_id: novelId,
                            title: ch.title.length > 255 ? ch.title.substring(0, 250) + '...' : ch.title,
                            chapter_index: currentChapterIndex
                        })
                        .select('id')
                        .single();
                        
                    if (chErr || !chData) throw chErr || new Error("Failed to create chapter.");
                    const chapterId = chData.id;

                    const paragraphs = ch.content.split('\n').map(p => p.trim()).filter(p => p.length > 0);
                    const contentBlocks = paragraphs.map((p, idx) => ({
                        type: "paragraph",
                        position: idx,
                        content: p
                    }));

                    const storagePath = `novels/${novelId}/${chapterId}.json`;
                    const { error: storageErr } = await supabase.storage
                        .from('novel-contents')
                        .upload(storagePath, JSON.stringify(contentBlocks), {
                            contentType: 'application/json',
                            upsert: true
                        });
                        
                    if (storageErr) throw storageErr;
                    
                    currentChapterIndex++;
                    globalCompletedCount++;
                }
            }

            setSuccess(`Successfully uploaded ${globalCompletedCount} chapters to "${finalTitle}"!`);
            setFiles([]);
            if (!isExistingNovel) setTitle("");
            setCoverUrl("");
            
        } catch (err: any) {
            console.error("Upload Error:", err);
            let errorMsg = "An unknown error occurred during upload.";
            if (err instanceof Error) {
                errorMsg = err.message;
            } else if (err && typeof err === 'object') {
                if (err.message) errorMsg = String(err.message);
                else if (err.error_description) errorMsg = String(err.error_description);
            } else if (typeof err === 'string') {
                errorMsg = err;
            }
            setError(errorMsg);
        } finally {
            setIsProcessing(false);
            setProgressStr("");
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Manual Novel Upload</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
                Upload a light novel file (TXT, DOCX, PDF) to automatically parse and add it to your library.
            </p>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
                
                {/* File Input */}
                <div>
                    <label className="block text-sm font-medium mb-1">Select File(s) (.txt, .docx, .pdf)</label>
                    <div className="flex items-center gap-4">
                        <label className="flex-1 cursor-pointer border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors">
                            <input 
                                type="file" 
                                className="hidden" 
                                accept=".txt,.docx,.pdf"
                                multiple
                                onChange={handleFileChange}
                                disabled={isProcessing}
                            />
                            <UploadIcon className="w-8 h-8 text-zinc-400 mb-2" />
                            {files.length > 0 ? (
                                <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                                    {files.length} file(s) selected
                                </span>
                            ) : (
                                <span className="text-zinc-500">Click to browse or drag & drop</span>
                            )}
                        </label>
                    </div>
                </div>

                {/* Meta Inputs */}
                <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    
                    <label className="flex items-center gap-2 cursor-pointer bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                        <input
                            type="checkbox"
                            checked={isExistingNovel}
                            onChange={(e) => setIsExistingNovel(e.target.checked)}
                            className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-600"
                            disabled={isProcessing}
                        />
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Append to Existing Novel in Library</span>
                    </label>

                    {isExistingNovel ? (
                        <div>
                            <label className="block text-sm font-medium mb-1">Select Novel</label>
                            <select
                                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-zinc-400"
                                value={selectedNovelId}
                                onChange={(e) => setSelectedNovelId(e.target.value)}
                                disabled={isProcessing || existingNovels.length === 0}
                            >
                                {existingNovels.length === 0 && <option value="">No novels found in database...</option>}
                                {existingNovels.map(n => (
                                    <option key={n.id} value={n.id}>{n.title}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Novel Title</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-zinc-400"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Overlord"
                                    disabled={isProcessing}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Cover Image URL (Optional)</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-zinc-400"
                                    value={coverUrl}
                                    onChange={(e) => setCoverUrl(e.target.value)}
                                    placeholder="Leave empty to auto-extract from PDF"
                                    disabled={isProcessing}
                                />
                            </div>
                        </>
                    )}
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={splitChapters}
                            onChange={(e) => setSplitChapters(e.target.checked)}
                            className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                            disabled={isProcessing}
                        />
                        <span className="text-sm">Auto-split into chapters (by "Chapter X", "Bab X" patterns)</span>
                    </label>
                </div>

                {/* Status Messages */}
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}
                
                {success && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span className="text-sm">{success}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="pt-4 flex justify-end">
                    <button
                        onClick={handleUpload}
                        disabled={files.length === 0 || (isExistingNovel ? !selectedNovelId : !title) || isProcessing}
                        className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {progressStr || "Processing..."}
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4" />
                                Upload & Process
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
