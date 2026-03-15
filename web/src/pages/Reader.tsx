import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function Reader() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chapter, setChapter] = useState<any>(null)
  const [contents, setContents] = useState<any[]>([])
  const [novel, setNovel] = useState<any>(null)
  
  // Navigation
  const [prevChapter, setPrevChapter] = useState<any>(null)
  const [nextChapter, setNextChapter] = useState<any>(null)
  
  const [loading, setLoading] = useState(true)
  const [fontSize, setFontSize] = useState(18)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    async function loadContent() {
      if (!id) return
      setLoading(true)
      window.scrollTo(0, 0)
      
      const { data: chData } = await supabase.from('chapters').select('*').eq('id', id).single()
      if (chData) {
        setChapter(chData)
        
        // Load novel info
        const { data: nData } = await supabase.from('novels').select('*').eq('id', chData.novel_id).single()
        setNovel(nData)
        
        // Load contents
        const { data: cData } = await supabase.from('contents').select('*').eq('chapter_id', id).order('position', { ascending: true })
        setContents(cData || [])
        
        // Load navigation
        const { data: allChData } = await supabase.from('chapters').select('id, chapter_index').eq('novel_id', chData.novel_id).order('chapter_index', { ascending: true })
        
        if (allChData) {
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

  if (loading) return <div className="flex justify-center flex-col items-center h-screen bg-gray-50 dark:bg-[#121212]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div><p className="text-gray-500">Loading chapter...</p></div>
  if (!chapter) return <div className="text-center py-20 text-red-500 bg-[#f9f9f9] dark:bg-[#121212] min-h-screen">Chapter not found.</div>

  return (
    <div className="bg-[#fcfcfc] dark:bg-[#121212] min-h-screen font-serif pb-20">
      {/* Top Navigation */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#181818]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-all">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={`/novel/${chapter.novel_id}`} className="flex items-center text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-sans text-sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline line-clamp-1 max-w-[200px]">{novel?.title}</span>
            <span className="sm:hidden">Back</span>
          </Link>
          
          <div className="text-center flex-1 px-4">
            <h1 className="text-gray-900 dark:text-gray-100 font-bold font-sans text-sm sm:text-base line-clamp-1">{chapter.title}</h1>
          </div>
          
          <button onClick={() => setShowSettings(!showSettings)} className="text-gray-600 dark:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
            <Settings className="w-5 h-5" />
          </button>
        </div>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 font-sans right-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Appearance</h3>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300 text-sm">Font Size</span>
              <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="px-3 py-1 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 shadow-sm text-sm">- A</button>
                <div className="w-px bg-gray-300 dark:bg-gray-600"></div>
                <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="px-3 py-1 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 shadow-sm text-sm">A +</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-20 transition-all duration-300" style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}>
        <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center text-gray-900 dark:text-gray-100">{chapter.title}</h2>
        
        <div className="space-y-6 text-gray-800 dark:text-gray-300">
          {contents.map((block) => {
            if (block.type === 'title') {
              return <h3 key={block.id} className="text-xl font-bold mt-12 mb-6 text-gray-900 dark:text-gray-100">{block.content}</h3>
            }
            if (block.type === 'dialog') {
              return <p key={block.id} className="pl-4 border-l-2 border-indigo-400 dark:border-indigo-600 italic">{block.content}</p>
            }
            if (block.type === 'image') {
              return (
                <div key={block.id} className="my-10 flex justify-center">
                  <img src={block.image_url} alt="Illustration" className="rounded-xl shadow-md max-w-full h-auto" loading="lazy" />
                </div>
              )
            }
            return <p key={block.id} className="indent-8 text-justify">{block.content}</p>
          })}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="max-w-2xl mx-auto px-6 mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center font-sans">
        {prevChapter ? (
          <button 
            onClick={() => navigate(`/read/${prevChapter.id}`)}
            className="flex items-center px-4 py-2 sm:px-6 sm:py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition shadow-sm"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            <span>Previous<span className="hidden sm:inline"> Chapter</span></span>
          </button>
        ) : <div />}
        
        {nextChapter ? (
          <button 
            onClick={() => navigate(`/read/${nextChapter.id}`)}
            className="flex items-center px-4 py-2 sm:px-6 sm:py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-md hover:shadow-lg"
          >
            <span>Next<span className="hidden sm:inline"> Chapter</span></span>
            <ChevronRight className="w-5 h-5 ml-1" />
          </button>
        ) : (
          <span className="text-gray-500 dark:text-gray-400 italic font-serif">End of available chapters</span>
        )}
      </div>
    </div>
  )
}
