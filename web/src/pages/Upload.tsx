import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import { Upload as UploadIcon, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function Upload() {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [coverUrl, setCoverUrl] = useState("");
    const [splitChapters, setSplitChapters] = useState(true);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressStr, setProgressStr] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selected = e.target.files[0];
            setFile(selected);
            // Default title from filename without extension
            setTitle(selected.name.replace(/\.[^/.]+$/, ""));
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

        // Split based on common chapter markers (Chapter X, Bab X, Volume X)
        // This is a heuristic approach
        const regex = /^(?:Chapter|Bab|Volume|Bagian)\s+[\dIVXLCDM]+/im;
        
        const lines = text.split('\n');
        const chapters: {title: string, content: string}[] = [];
        
        let currentTitle = "Chapter 1";
        let currentContent: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // If line matches chapter format and is relatively short
            if (regex.test(line) && line.length < 100) {
                // Save previous chapter if it has content
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
        
        // Push the last chapter
        if (currentContent.length > 0) {
            chapters.push({
                title: currentTitle,
                content: currentContent.join('\n')
            });
        }
        
        // If no chapters found via regex, fallback to single chapter
        if (chapters.length === 0) {
            return [{ title: "Chapter 1", content: text }];
        }
        
        return chapters;
    };

    const handleUpload = async () => {
        if (!file) {
            setError("Please select a file.");
            return;
        }
        if (!title.trim()) {
            setError("Please enter a novel title.");
            return;
        }

        setIsProcessing(true);
        setError("");
        setSuccess("");
        setProgressStr("Extracting text from file...");

        try {
            // 1. Extract text
            const text = await extractText(file);
            
            setProgressStr("Processing chapters...");
            // 2. Process chapters
            const parsedChapters = processChapters(text);
            
            if (parsedChapters.length === 0) {
                throw new Error("No readable content found in file.");
            }

            setProgressStr(`Found ${parsedChapters.length} chapters. Creating novel...`);

            // 3. Insert Novel
            // Generate a fake url since this is a manual upload
            const fakeUrl = `https://manual-upload/${Date.now()}`;
            const { data: novelData, error: novelErr } = await supabase
                .from('novels')
                .insert({
                    title: title.trim(),
                    url: fakeUrl,
                    cover_url: coverUrl.trim() || null
                })
                .select()
                .single();
                
            if (novelErr || !novelData) throw novelErr || new Error("Failed to create novel.");
            const novelId = novelData.id;

            // 4. Insert Chapters and Upload Content
            let completedCount = 0;
            for (let i = 0; i < parsedChapters.length; i++) {
                const ch = parsedChapters[i];
                setProgressStr(`Uploading chapter ${i + 1} of ${parsedChapters.length}...`);
                
                // Insert chapter row
                const { data: chData, error: chErr } = await supabase
                    .from('chapters')
                    .insert({
                        novel_id: novelId,
                        title: ch.title.length > 255 ? ch.title.substring(0, 250) + '...' : ch.title,
                        chapter_index: i
                    })
                    .select()
                    .single();
                    
                if (chErr || !chData) throw chErr || new Error("Failed to create chapter.");
                const chapterId = chData.id;

                // Build content array
                const paragraphs = ch.content.split('\n').map(p => p.trim()).filter(p => p.length > 0);
                const contentBlocks = paragraphs.map((p, idx) => ({
                    type: "paragraph",
                    position: idx,
                    content: p
                }));

                // Upload to Storage
                const storagePath = `novels/${novelId}/${chapterId}.json`;
                const { error: storageErr } = await supabase.storage
                    .from('novel-contents')
                    .upload(storagePath, JSON.stringify(contentBlocks), {
                        contentType: 'application/json',
                        upsert: true
                    });
                    
                if (storageErr) throw storageErr;
                completedCount++;
            }

            setSuccess(`Successfully uploaded "${title}" with ${completedCount} chapters!`);
            setFile(null);
            setTitle("");
            setCoverUrl("");
            
        } catch (err) {
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
                    <label className="block text-sm font-medium mb-1">Select File (.txt, .docx, .pdf)</label>
                    <div className="flex items-center gap-4">
                        <label className="flex-1 cursor-pointer border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors">
                            <input 
                                type="file" 
                                className="hidden" 
                                accept=".txt,.docx,.pdf"
                                onChange={handleFileChange}
                                disabled={isProcessing}
                            />
                            <UploadIcon className="w-8 h-8 text-zinc-400 mb-2" />
                            {file ? (
                                <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
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
                            placeholder="e.g. Overlord Volume 1"
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
                        disabled={!file || !title || isProcessing}
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
