import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { History as HistoryIcon, Loader2, ArrowLeft, Clock } from 'lucide-react'
import { supabase } from '../supabaseClient'

interface HistoryItem {
  id: string
  title: string
  cover_url: string
  lastChapter: {
    id: string
    title: string
    chapter_index: number
  }
  totalRead: number
}

export default function History() {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = "Reading History - Arcadia"
  }, [])

  useEffect(() => {
    async function loadHistory() {
      window.scrollTo(0, 0)
      const profileId = localStorage.getItem('arcadia_profile_id')
      const historyMap: Record<string, string[]> = JSON.parse(localStorage.getItem('arcadia_history') || '{}')
      
      // Load from DB if possible
      if (profileId) {
        const { data: dbHistory } = await supabase
          .from('reading_history')
          .select('novel_id, chapter_id')
          .eq('profile_id', profileId)
          .order('updated_at', { ascending: true })

        if (dbHistory) {
          dbHistory.forEach(item => {
            if (!historyMap[item.novel_id]) historyMap[item.novel_id] = []
            if (!historyMap[item.novel_id].includes(item.chapter_id)) {
              historyMap[item.novel_id].push(item.chapter_id)
            }
          })
        }
      }

      const novelIds = Object.keys(historyMap)
      if (novelIds.length === 0) {
        setLoading(false)
        return
      }

      // Fetch novels that are in history
      const { data: novels, error: nError } = await supabase
        .from('novels')
        .select('id, title, cover_url')
        .in('id', novelIds)

      if (nError || !novels) {
        setLoading(false)
        return
      }

      // For each novel, get the last chapter read
      const formattedHistory = await Promise.all(novels.map(async (novel) => {
        const chapterIds = historyMap[novel.id]
        const lastChapterId = chapterIds[chapterIds.length - 1]
        
        const { data: chapter } = await supabase
          .from('chapters')
          .select('id, title, chapter_index')
          .eq('id', lastChapterId)
          .single()

        return {
          ...novel,
          lastChapter: chapter,
          totalRead: chapterIds.length
        }
      }))

      setHistoryItems(formattedHistory.filter((h): h is HistoryItem => Boolean(h.lastChapter)))
      setLoading(false)
    }

    loadHistory()
  }, [])

  if (loading) return (
    <div className="flex justify-center flex-col items-center h-screen bg-white dark:bg-[#121212]">
      <Loader2 className="w-8 h-8 animate-spin text-black dark:text-white mb-4" />
      <p className="text-black dark:text-white font-medium">Loading history...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link to="/" className="inline-flex items-center text-sm font-bold text-black dark:text-white hover:opacity-70 mb-8 transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Library
      </Link>

      <div className="mb-10">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-4 flex items-center">
          <HistoryIcon className="w-8 h-8 mr-3" /> Reading History
        </h1>
        <p className="text-black/70 dark:text-white/70">Continue where you left off.</p>
      </div>

      {historyItems.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-black/50 dark:text-white/50">Your reading history is empty.</p>
          <Link to="/" className="mt-4 inline-block px-6 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold hover:opacity-80 transition">Start Reading</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {historyItems.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 hover:shadow-md transition flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <Link to={`/novel/${item.id}`} className="shrink-0">
                <img src={item.cover_url} alt="" className="w-24 h-36 object-cover rounded-xl shadow-sm hover:opacity-80 transition" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/novel/${item.id}`} className="block group">
                  <h3 className="font-bold text-xl text-black dark:text-white mb-1 group-hover:text-black/70 dark:group-hover:text-white/70 transition truncate">{item.title}</h3>
                </Link>
                <p className="text-sm text-black/50 dark:text-white/50 mb-4">You have read {item.totalRead} chapters</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link 
                    to={`/read/${item.lastChapter.id}`} 
                    className="px-5 py-2.5 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm flex items-center hover:opacity-80 transition"
                  >
                    Continue: {item.lastChapter.title}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
