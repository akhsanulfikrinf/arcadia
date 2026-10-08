
const text = `
Daftar Isi
Prolog
Bab 1: Bangkit
Bab 2: Cinta
Bab 3: Selesai

Prolog
Ini adalah prolog.
Prolog bisa sangat panjang, mungkin ada 2 paragraf.
Ya, 3 paragraf.

Bab 1: Bangkit
Ini adalah bab 1.
Satu
Dua

Bab 2: Cinta
Ini adalah bab 2.
Satu
Dua
Tiga
Empat
Lima
`;
const regex = /^(?:Chapter|Bab|Volume|Bagian)\s+(?:\d+|[IVXLCDM]+)(?:[\s:\-\.]|$)|^(?:Prologue|Prolog|Epilogue|Epilog|Kata Penutup)(?:[\s:\-\.]|$)/i;
const lines = text.split("\n");
const candidates = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\d+$/.test(line) || /\.{2,}/.test(line)) continue;
    if (regex.test(line) && line.length < 100 && !line.endsWith(".") && line.split(" ").length < 10) {
        candidates.push({ lineIndex: i, title: line });
    }
}

const chapters = [];
let currentTitle = "Bagian Awal";
let currentContent = [];
let lastMarkerIndex = 0;

if (candidates.length > 0) {
    chapters.push({
        title: currentTitle,
        content: lines.slice(0, candidates[0].lineIndex).join("\n").trim()
    });
}

for (let i = 0; i < candidates.length; i++) {
    const marker = candidates[i];
    const nextMarker = candidates[i + 1];
    const startIdx = marker.lineIndex + 1;
    const endIdx = nextMarker ? nextMarker.lineIndex : lines.length;
    
    const content = lines.slice(startIdx, endIdx).join("\n").trim();
    chapters.push({
        title: marker.title,
        content: content
    });
}

// Filter out chapters with extremely little content (like TOC entries)
// But keep Bagian Awal if it has content.
const validChapters = chapters.filter((ch, idx) => {
    // If it is the very last chapter, it is real.
    if (idx === chapters.length - 1) return true;
    
    // If a chapter has less than 25 characters of content, it is likely a TOC entry.
    // Wait, what if the real chapter has no text but just an image placeholder? 
    // Image placeholder is "QWER - image010.jpg" which is ~20 chars.
    // But usually there is SOME text.
    // Actually, TOC entries usually have 0 lines between them! 
    // content.length === 0 or < 10.
    if (ch.content.length < 15 && idx !== 0) return false;
    
    return true;
});

console.log(validChapters);

