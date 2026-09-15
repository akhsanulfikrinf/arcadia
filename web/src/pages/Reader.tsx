import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Minus, Bookmark } from 'lucide-react'
import { supabase } from '../supabaseClient'

interface Chapter {
  id: string
  novel_id?: string
  title: string
  chapter_index: number
}

interface Novel {
  id: string
  title: string
  cover_url?: string | null
}

interface ContentBlock {
  id: string
  type: string
  content?: string | null
  image_url?: string | null
  position?: number
}

export default function Reader() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [contents, setContents] = useState<ContentBlock[]>([])
  const [novel, setNovel] = useState<Novel | null>(null)
  const [allChapters, setAllChapters] = useState<Chapter[]>([])
  
  // Navigation
  const [prevChapter, setPrevChapter] = useState<Chapter | null>(null)
  const [nextChapter, setNextChapter] = useState<Chapter | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [fontSize, setFontSize] = useState(18)
  const [isBookmarked, setIsBookmarked] = useState(false)

  const toggleBookmark = async () => {
    const profileId = localStorage.getItem('arcadia_profile_id')
    try {
      const bookmarks = JSON.parse(localStorage.getItem('arcadia_bookmarks') || '[]')
      if (bookmarks.includes(id)) {
        // Remove locally
        const newBookmarks = bookmarks.filter((bId: string) => bId !== id)
        localStorage.setItem('arcadia_bookmarks', JSON.stringify(newBookmarks))
        setIsBookmarked(false)

        // Remove from DB
        if (profileId) {
          await supabase.from('bookmarks').delete().match({ profile_id: profileId, chapter_id: id })
        }
      } else {
        // Add locally
        bookmarks.push(id)
        localStorage.setItem('arcadia_bookmarks', JSON.stringify(bookmarks))
        setIsBookmarked(true)

        // Add to DB
        if (profileId) {
          await supabase.from('bookmarks').insert({ profile_id: profileId, chapter_id: id })
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    async function loadContent() {
      if (!id) return
      setLoading(true)
      window.scrollTo(0, 0)
      
      const { data: chData } = await supabase.from('chapters').select('*').eq('id', id).single()
      if (chData) {
        setChapter(chData)
        document.title = `${chData.title} - Arcadia`
        
        // Save to read history
        try {
          const profileId = localStorage.getItem('arcadia_profile_id')
          
          // 1. Sync locally
          const history = JSON.parse(localStorage.getItem('arcadia_history') || '{}')
          if (!history[chData.novel_id]) history[chData.novel_id] = []
          if (!history[chData.novel_id].includes(chData.id)) history[chData.novel_id].push(chData.id)
          localStorage.setItem('arcadia_history', JSON.stringify(history))
          
          const bookmarks = JSON.parse(localStorage.getItem('arcadia_bookmarks') || '[]')
          setIsBookmarked(bookmarks.includes(chData.id))

          // 2. Sync to DB
          if (profileId) {
            // Check for DB bookmark if not in local
            if (!bookmarks.includes(chData.id)) {
              const { data: dbBmk } = await supabase.from('bookmarks').select('id').match({ profile_id: profileId, chapter_id: id }).single()
              if (dbBmk) setIsBookmarked(true)
            }

            // Save history record
            await supabase.from('reading_history').upsert({
              profile_id: profileId,
              novel_id: chData.novel_id,
              chapter_id: chData.id,
              updated_at: new Date().toISOString()
            }, { onConflict: 'profile_id,novel_id' })
          }
        } catch (e) {
          console.error("Could not sync history", e)
        }
        
        // Load novel info
        const { data: nData, error: nErr } = await supabase.from('novels').select('*').eq('id', chData.novel_id).single()
      if (!nErr && nData) {
        setNovel(nData)
        document.title = `${nData.title} - Arcadia`
      }
        if (chData && nData) {
          document.title = `${chData.title} | ${nData.title} - Arcadia`
        }
        
        // Load contents: try storage first, fallback to DB
        let loadedContents: ContentBlock[] = []
        try {
          const storagePath = `novels/${chData.novel_id}/${id}.json`
          const { data: blob, error: storageErr } = await supabase.storage
            .from('novel-contents')
            .download(storagePath)
          
          if (blob && !storageErr) {
            const json: Array<{ type: string; content?: string; image_url?: string; position?: number }> = JSON.parse(await blob.text())
            loadedContents = json.map((item, i) => ({
              id: `storage-${i}`,
              type: item.type,
              content: item.content || null,
              image_url: item.image_url || null,
              position: item.position ?? i,
            }))
          }
        } catch {
          // Storage fetch failed, will fallback to DB
        }

        if (loadedContents.length === 0) {
          // Fallback: load from database
          const { data: cData } = await supabase.from('contents').select('*').eq('chapter_id', id).order('position', { ascending: true })
          loadedContents = (cData as ContentBlock[]) || []
        }

        setContents(loadedContents)
        
        // Load navigation
        const { data: allChData } = await supabase.from('chapters').select('id, title, chapter_index').eq('novel_id', chData.novel_id).order('chapter_index', { ascending: true })
        
        if (allChData) {
          setAllChapters(allChData)
          const currentIndex = allChData.findIndex(c => c.id === id)
          if (currentIndex > 0) setPrevChapter(allChData[currentIndex - 1])
          else setPrevChapter(null)
          
          if (currentIndex < allChData.length - 1) setNextChapter(allChData[currentIndex + 1])
          else setNextChapter(null)
        }
      }
      setLoading(false)
    }

    loadContent()
  }, [id])

  if (loading) return <div className="flex justify-center flex-col items-center h-screen bg-white dark:bg-[#121212]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white mb-4"></div><p className="text-black dark:text-white">Loading chapter...</p></div>
  if (!chapter) return <div className="text-center py-20 text-red-500 bg-white dark:bg-[#121212] min-h-screen">Chapter not found.</div>

  return (
    <div className="bg-white dark:bg-black min-h-screen font-sans pb-32 text-black dark:text-white transition-colors">
      <div className="max-w-4xl mx-auto px-6 pt-12">
        
        {/* Header Title */}
        <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-black dark:text-white leading-tight">
          {novel?.title} - {chapter.title}
        </h1>
        
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center text-black/60 dark:text-white/60 text-sm mb-10 gap-2 font-medium">
          <Link to="/" className="hover:opacity-70 transition text-black dark:text-white">Home</Link>
          <span>/</span>
          <Link to="/" className="hover:opacity-70 transition text-black dark:text-white">All Mangas</Link>
          <span>/</span>
          <Link to={`/novel/${chapter.novel_id}`} className="hover:opacity-70 transition text-black dark:text-white">{novel?.title}</Link>
          <span>/</span>
          <span>{chapter.title}</span>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-16 border-b border-gray-200 dark:border-gray-800 pb-8">
          
          {/* Chapter Selector */}
          <div className="flex-1 max-w-[240px]">
            <select 
              className="bg-black text-white dark:bg-white dark:text-black rounded-lg px-4 py-3 outline-none w-full appearance-none font-bold cursor-pointer transition hover:opacity-80"
              value={chapter.id}
              onChange={(e) => navigate(`/read/${e.target.value}`)}
            >
              {allChapters.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.title}</option>
              ))}
            </select>
          </div>

          {/* Buttons Group */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={() => setFontSize(f => Math.min(32, f + 2))} className="w-10 h-10 rounded-full border-2 border-black dark:border-white bg-transparent flex justify-center items-center text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition">
                <Plus className="w-5 h-5" />
              </button>
              <button onClick={() => setFontSize(f => Math.max(14, f - 2))} className="w-10 h-10 rounded-full border-2 border-black dark:border-white bg-transparent flex justify-center items-center text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition">
                <Minus className="w-5 h-5" />
              </button>
              <button onClick={toggleBookmark} className={`w-10 h-10 rounded-full border-2 border-black dark:border-white flex justify-center items-center transition ${isBookmarked ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-transparent text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black'}`}>
                <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {prevChapter ? (
                <button 
                  onClick={() => navigate(`/read/${prevChapter.id}`)}
                  className="border-2 border-black dark:border-white bg-transparent text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-bold rounded-lg px-4 py-2.5 flex items-center transition"
                >
                  <ChevronLeft className="w-5 h-5" /> Prev
                </button>
              ) : (
                <button disabled className="border-2 border-gray-300 dark:border-gray-700 text-gray-400 font-bold rounded-lg px-4 py-2.5 flex items-center cursor-not-allowed">
                  <ChevronLeft className="w-5 h-5" /> Prev
                </button>
              )}

              {nextChapter ? (
                <button 
                  onClick={() => navigate(`/read/${nextChapter.id}`)}
                  className="bg-black text-white dark:bg-white dark:text-black font-bold rounded-lg px-4 py-2.5 flex items-center transition hover:opacity-80 border-2 border-black dark:border-white"
                >
                  Next <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button disabled className="bg-gray-300 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-700 text-gray-500 font-bold rounded-lg px-4 py-2.5 flex items-center cursor-not-allowed">
                  Next <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
            
          </div>
        </div>

        {/* Main Reading Content */}
        <div 
          style={{ fontSize: `${fontSize}px`, lineHeight: '2' }} 
          className="max-w-3xl mx-auto font-sans tracking-wide select-none"
          onContextMenu={(e) => {
            e.preventDefault();
            alert("Content is protected");
          }}
          onCopy={(e) => {
            e.preventDefault();
            alert("Content is protected");
          }}
        >
        <div className="space-y-6">
          {(() => {
            const spamPhrases = ["tolong donasinya", "klik-klik", "klik iklan", "trakteer", "donasi", "sociabuzz"];
            const normalizeString = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            const firstTextBlockIndex = contents.findIndex(b => {
              if (b.type === 'image' || !b.content) return false;
              if (spamPhrases.some(p => b.content!.toLowerCase().includes(p))) return false;
              if (normalizeString(b.content) === normalizeString(chapter.title)) return false;
              if (normalizeString(b.content) === normalizeString(novel?.title || '') + normalizeString(chapter.title)) return false;
              return true;
            });
            
            return contents.map((block, index) => {
              if (block.type === 'image') {
                return (
                  <div key={block.id} className="my-10 flex justify-center w-full">
                    <img src={block.image_url || ''} alt="Illustration" className="rounded-xl shadow-md max-w-full h-auto pointer-events-none" loading="lazy" />
                  </div>
                )
              }

              if (!block.content) return null;
              
              // 0. Filter spam (redundant check for safety)
              if (spamPhrases.some(p => block.content!.toLowerCase().includes(p))) return null;

              // 1. Prevent duplication of the chapter title
              if (normalizeString(block.content) === normalizeString(chapter.title)) {
                return null;
              }
              if (normalizeString(block.content) === normalizeString(novel?.title || '') + normalizeString(chapter.title)) {
                return null;
              }
              
              if (block.type === 'title') {
                return <h3 key={block.id} className="font-bold mt-12 mb-6 text-black dark:text-white" style={{ fontSize: `${fontSize * 1.3}px` }}>{block.content}</h3>
              }
              
              const textStr = block.content.trim();

              // 2. Format sub-chapters: Special handling for the very first text block
              if (index === firstTextBlockIndex) {
                  // Look for first sentence ending with punctuation if it's short
                  // Pattern: short text followed by [.!?:] and then a space + Capital/Dialog
                  const splitMatch = textStr.match(/^(.{3,80}?[.!?:])(?:\s+([A-Z"“].*))/s);
                  
                  if (splitMatch) {
                    const prefix = splitMatch[1].trim();
                    const remainder = splitMatch[2].trim();
                    return (
                        <p key={block.id} className="text-left mb-6 text-black dark:text-white">
                          <span className="block font-bold text-black dark:text-white mb-2" style={{ fontSize: `${fontSize * 1.3}px` }}>
                            {prefix}
                          </span>
                          {remainder}
                        </p>
                    );
                  }
              }

              // 3. Regular Bab / Chapter regex for other blocks
              const babRegex = /^((?:Bab|Chapter)\s+\d+(?:[\s:-]+[A-Z][a-zA-Z0-9\s]*?)?)(?:(?=[.!?]|[\r\n]|\s+[A-Z“"'])|$)/i;
              const match = textStr.match(babRegex);
              
              if (match && match[1]) {
                const prefix = match[1].trim();
                const remainder = textStr.substring(prefix.length).trim();
                
                if (remainder.length === 0) {
                  return (
                    <p key={block.id} className="text-left mb-6 mt-12 text-black dark:text-white">
                      <span className="block font-bold text-black dark:text-white" style={{ fontSize: `${fontSize * 1.3}px` }}>
                        {prefix}
                      </span>
                    </p>
                  )
                } else {
                  return (
                    <p key={block.id} className="text-left mb-6 text-black dark:text-white">
                      <span className="block font-bold text-black dark:text-white mb-2" style={{ fontSize: `${fontSize * 1.3}px` }}>
                        {prefix}
                      </span>
                      {remainder}
                    </p>
                  )
                }
              }

              if (block.type === 'dialog') {
                return <p key={block.id} className="text-left mb-6 text-black dark:text-white">{textStr}</p>
              }

              return <p key={block.id} className="text-left mb-6 text-black dark:text-white">{textStr}</p>
            });
          })()}
        </div>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-20 flex justify-between items-center pt-8 border-t border-gray-100 dark:border-gray-800">
          {prevChapter ? (
            <button 
              onClick={() => navigate(`/read/${prevChapter.id}`)}
              className="flex items-center px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-black dark:text-white transition font-bold"
            >
              <ChevronLeft className="w-5 h-5 mr-1" /> Previous
            </button>
          ) : <div />}
          
          {nextChapter ? (
            <button 
              onClick={() => navigate(`/read/${nextChapter.id}`)}
              className="flex items-center px-6 py-3 bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black rounded-lg transition font-bold"
            >
               Next <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          ) : (
            <span className="text-black/60 dark:text-white/60 italic font-medium">End of available chapters</span>
          )}
        </div>
      </div>
    </div>
  )
}
