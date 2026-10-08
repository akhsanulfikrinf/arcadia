with open("src/pages/Upload.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: Sort PDF items by Y descending, then X ascending
pdf_old = """                    for (const item of content.items) {
                        if (!('str' in item)) continue;
                        
                        // Y coordinate is at index 5 of transform matrix
                        const y = Math.round(item.transform[5]);
                        if (lastY !== -1 && Math.abs(y - lastY) > 4) {
                            pageText += "\\n";
                        } else if (lastY !== -1 && item.str.trim() !== "") {
                            pageText += " ";
                        }
                        
                        pageText += item.str;
                        lastY = y;
                    }"""

pdf_new = """                    const textItems = content.items.filter(item => 'str' in item) as any[];
                    textItems.sort((a, b) => {
                        const yDiff = b.transform[5] - a.transform[5];
                        if (Math.abs(yDiff) < 5) {
                            return a.transform[4] - b.transform[4];
                        }
                        return yDiff;
                    });
                    
                    for (const item of textItems) {
                        const y = Math.round(item.transform[5]);
                        if (lastY !== -1 && Math.abs(y - lastY) > 4) {
                            pageText += "\\n";
                        } else if (lastY !== -1 && item.str.trim() !== "") {
                            pageText += " ";
                        }
                        pageText += item.str;
                        lastY = y;
                    }"""
content = content.replace(pdf_old, pdf_new)


# Fix 2: Chapter processing logic
regex_old = """        const regex = /^(?:Chapter|Bab|Volume|Bagian)\s*[\dIVXLCDM]+|^(?:Prologue|Epilogue)/im;
        const lines = text.split('\\n');
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
                        content: currentContent.join('\\n')
                    });
                }
                currentTitle = line;
                currentContent = [];
            } else {
                currentContent.push(line);
            }
        }"""

regex_new = """        const regex = /^(?:Chapter|Bab|Volume|Bagian)\\s*[\\dIVXLCDM]+|^(?:Prologue|Prolog|Epilogue|Epilog)/im;
        const lines = text.split('\\n');
        const chapters: {title: string, content: string}[] = [];
        
        let currentTitle = "Chapter 1";
        let currentContent: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            if (/^\\d+$/.test(line)) continue; // Skip page numbers
            
            if (regex.test(line) && line.length < 100) {
                if (currentContent.length < 15 && chapters.length > 0) {
                    currentContent.push(line);
                    continue;
                }
                if (currentContent.length > 0) {
                    chapters.push({
                        title: currentTitle,
                        content: currentContent.join('\\n')
                    });
                }
                currentTitle = line;
                currentContent = [];
            } else {
                currentContent.push(line);
            }
        }"""
content = content.replace(regex_old, regex_new)

with open("src/pages/Upload.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated Upload.tsx with PDF sorting and TOC skipping.")
