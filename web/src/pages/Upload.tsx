import React, { useState } from "react";
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
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressStr, setProgressStr] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name));
            setFiles(selectedFiles);
            // Default title from first filename, stripping volume/chapter identifiers
            setTitle(selectedFiles[0].name.replace(/\.[^/.]+$/, "").replace(/\s*(volume|vol|bab|chapter|bagian)\s*\d+/i, "").trim());
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
                const pageText = content.items.map((item) => ('str' in item ? item.str : "")).join(" ");
                fullText += pageText + "\n\n";
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

        const regex = /^(?:Chapter|Bab|Volume|Bagian)\s+[\dIVXLCDM]+/im;
        const lines = text.split('\n');
        const chapters: {title: string, content: string}[] = [];
        
        let currentTitle = "Chapter 1";
        let currentContent: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            if (regex.test(line) && line.length < 100) {
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
        if (!title.trim()) {
            setError("Please enter a novel title.");
            return;
        }

        setIsProcessing(true);
        setError("");
        setSuccess("");

        try {
            setProgressStr("Checking database for existing novel...");
            let novelId = "";
            let startChapterIndex = 0;

            // Check if novel already exists
            const { data: existingNovel, error: searchErr } = await supabase
                .from('novels')
                .select('id')
                .ilike('title', title.trim())
                .maybeSingle();

            if (searchErr) throw searchErr;

            if (existingNovel) {
                novelId = existingNovel.id;
                // Get max chapter index
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
                // Create new novel
                const fakeUrl = `https://manual-upload/${Date.now()}`;
                const { data: newNovel, error: createErr } = await supabase
                    .from('novels')
                    .insert({
                        title: title.trim(),
                        url: fakeUrl,
                        cover_url: coverUrl.trim() || null
                    })
                    .select('id')
                    .single();
                
                if (createErr || !newNovel) throw createErr || new Error("Failed to create novel.");
                novelId = newNovel.id;
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

            setSuccess(existingNovel 
                ? `Successfully appended ${globalCompletedCount} chapters to existing novel "${title}"!`
                : `Successfully uploaded new novel "${title}" with ${globalCompletedCount} chapters!`);
            setFiles([]);
            setTitle("");
            setCoverUrl("");
            
        } catch (err: unknown) {
            console.error("Upload Error:", err);
            setError((err instanceof Error ? err.message : null) || "An unknown error occurred during upload.");
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
                            placeholder="https://example.com/cover.jpg"
                            disabled={isProcessing}
                        />
                    </div>
                    
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
                        disabled={files.length === 0 || !title || isProcessing}
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
