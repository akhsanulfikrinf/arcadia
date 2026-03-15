import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Minus, Bookmark, Moon } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function Reader() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chapter, setChapter] = useState<any>(null)
  const [contents, setContents] = useState<any[]>([])
  const [novel, setNovel] = useState<any>(null)
  const [allChapters, setAllChapters] = useState<any[]>([])
  
  // Navigation
  const [prevChapter, setPrevChapter] = useState<any>(null)
  const [nextChapter, setNextChapter] = useState<any>(null)
  
  const [loading, setLoading] = useState(true)
  const [fontSize, setFontSize] = useState(18)

  // Initialize dark mode from system or html attribute
  useEffect(() => {
    // If we want to read it from classList later we can, nothing to setup here without state
  }, [])

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark')
  }

  useEffect(() => {
    async function loadContent() {
      if (!id) return
      setLoading(true)
      window.scrollTo(0, 0)
      
      const { data: chData } = await supabase.from('chapters').select('*').eq('id', id).single()
      if (chData) {
        setChapter(chData)
        
        // Save to read history
        try {
          const history = JSON.parse(localStorage.getItem('arcadia_history') || '{}')
          if (!history[chData.novel_id]) {
            history[chData.novel_id] = []
          }
          if (!history[chData.novel_id].includes(chData.id)) {
            history[chData.novel_id].push(chData.id)
          }
          localStorage.setItem('arcadia_history', JSON.stringify(history))
        } catch (e) {
          console.error("Could not save history", e)
        }
        
        // Load novel info
        const { data: nData } = await supabase.from('novels').select('*').eq('id', chData.novel_id).single()
        setNovel(nData)
        
        // Load contents
        const { data: cData } = await supabase.from('contents').select('*').eq('chapter_id', id).order('position', { ascending: true })
        setContents(cData || [])
        
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

  if (loading) return <div className="flex justify-center flex-col items-center h-screen bg-white dark:bg-[#121212]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div><p className="text-gray-500">Loading chapter...</p></div>
  if (!chapter) return <div className="text-center py-20 text-red-500 bg-white dark:bg-[#121212] min-h-screen">Chapter not found.</div>

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen font-sans pb-32 text-gray-800 dark:text-gray-200 transition-colors">
      <div className="max-w-4xl mx-auto px-6 pt-12">
        
        {/* Header Title */}
        <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-800 dark:text-white leading-tight">
          {novel?.title} - {chapter.title}
        </h1>
        
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center text-gray-400 dark:text-gray-500 text-sm mb-10 gap-2">
          <Link to="/" className="hover:text-indigo-600 transition">Home</Link>
          <span>/</span>
          <Link to="/" className="hover:text-indigo-600 transition">All Mangas</Link>
          <span>/</span>
          <Link to={`/novel/${chapter.novel_id}`} className="hover:text-indigo-600 transition">{novel?.title}</Link>
          <span>/</span>
          <span className="text-gray-500 dark:text-gray-400">{chapter.title}</span>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-16 border-b border-gray-100 dark:border-gray-800 pb-8">
          
          {/* Chapter Selector */}
          <div className="flex-1">
            <select 
              className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg px-4 py-3 outline-none min-w-[240px] appearance-none font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              value={chapter.id}
              onChange={(e) => navigate(`/read/${e.target.value}`)}
            >
              {allChapters.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.title}</option>
              ))}
            </select>
          </div>

          {/* Buttons Group */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setFontSize(f => Math.min(32, f + 2))} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex justify-center items-center text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <Plus className="w-5 h-5" />
              </button>
              <button onClick={() => setFontSize(f => Math.max(14, f - 2))} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex justify-center items-center text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <Minus className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex justify-center items-center text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <Bookmark className="w-5 h-5 fill-current" />
              </button>
              <button onClick={toggleDarkMode} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex justify-center items-center text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <Moon className="w-5 h-5 fill-current" />
              </button>
            </div>
            
            {nextChapter ? (
              <button 
                onClick={() => navigate(`/read/${nextChapter.id}`)}
                className="bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg px-6 py-2.5 flex items-center transition shadow-sm"
              >
                Next <ChevronRight className="w-5 h-5 ml-1" />
              </button>
            ) : (
              <button disabled className="bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium rounded-lg px-6 py-2.5 flex items-center shadow-sm cursor-not-allowed">
                Next <ChevronRight className="w-5 h-5 ml-1" />
              </button>
            )}
          </div>
        </div>

        {/* Main Reading Content */}
        <div style={{ fontSize: `${fontSize}px`, lineHeight: '2' }} className="max-w-3xl mx-auto font-sans tracking-wide">
        <div className="space-y-6">
          {contents.map((block) => {
            if (block.type === 'title') {
              return <h3 key={block.id} className="font-bold mt-12 mb-6 text-gray-900 dark:text-gray-100" style={{ fontSize: `${fontSize * 1.3}px` }}>{block.content}</h3>
            }
            if (block.type === 'dialog') {
              return <p key={block.id} className="text-left mb-6 text-gray-700 dark:text-gray-300">{block.content}</p>
            }
            if (block.type === 'image') {
              return (
                <div key={block.id} className="my-10 flex justify-center w-full">
                  <img src={block.image_url} alt="Illustration" className="rounded-xl shadow-md max-w-full h-auto" loading="lazy" />
                </div>
              )
            }
            
            // Format Bab/Chapter prefixes
            const match = block.content.match(/^((?:Bab|Chapter)\s+\d+[^A-Z]*[a-zA-Z\s]+?)(?=\s+[A-Z])/i)
            if (match && match[1]) {
              return (
                <p key={block.id} className="text-left mb-6 text-gray-700 dark:text-gray-300">
                  <span className="block font-bold text-gray-900 dark:text-white mb-2" style={{ fontSize: `${fontSize * 1.2}px` }}>
                    {match[1].trim()}
                  </span>
                  {block.content.substring(match[1].length).trim()}
                </p>
              )
            }
            // Fallback for smaller chapters simply prefixed with Bab/Chapter: but without Title
            const simpleMatch = block.content.match(/^((?:Bab|Chapter)\s+\d+:?)\s+/i)
            if (simpleMatch && simpleMatch[1]) {
              return (
                <p key={block.id} className="text-left mb-6 text-gray-700 dark:text-gray-300">
                  <span className="block font-bold text-gray-900 dark:text-white mb-2" style={{ fontSize: `${fontSize * 1.2}px` }}>
                    {simpleMatch[1].trim()}
                  </span>
                  {block.content.substring(simpleMatch[1].length).trim()}
                </p>
              )
            }

            return <p key={block.id} className="text-left mb-6 text-gray-700 dark:text-gray-300">{block.content}</p>
          })}
        </div>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-20 flex justify-between items-center pt-8 border-t border-gray-100 dark:border-gray-800">
          {prevChapter ? (
            <button 
              onClick={() => navigate(`/read/${prevChapter.id}`)}
              className="flex items-center px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition font-medium"
            >
              <ChevronLeft className="w-5 h-5 mr-1" /> Previous
            </button>
          ) : <div />}
          
          {nextChapter ? (
            <button 
              onClick={() => navigate(`/read/${nextChapter.id}`)}
              className="flex items-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium"
            >
               Next <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          ) : (
            <span className="text-gray-400 italic font-medium">End of available chapters</span>
          )}
        </div>
      </div>
    </div>
  )
}
