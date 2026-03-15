import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function NovelDetails() {
  const { id } = useParams()
  const [novel, setNovel] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!id) return
      
      const { data: nData, error: nErr } = await supabase
        .from('novels')
        .select('*')
        .eq('id', id)
        .single()
        
      if (!nErr) setNovel(nData)
      
      const { data: cData, error: cErr } = await supabase
        .from('chapters')
        .select('*')
        .eq('novel_id', id)
        .order('chapter_index', { ascending: true })
        
      if (!cErr) setChapters(cData || [])
      
      setLoading(false)
    }

    loadData()
  }, [id])

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
  if (!novel) return <div className="text-center py-20 text-red-500">Novel not found.</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600 mb-6 transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Library
      </Link>
      
      <div className="flex flex-col md:flex-row gap-8 mb-12 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm">
        <div className="w-full md:w-1/3 max-w-[240px] shrink-0 mx-auto md:mx-0">
          <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden shadow-md">
            {novel.cover_url ? (
              <img src={novel.cover_url} alt={novel.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">No Cover</div>
            )}
          </div>
        </div>
        <div className="flex items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">{novel.title}</h1>
            <div className="flex items-center text-gray-500 dark:text-gray-400 mb-6">
              <BookOpen className="w-5 h-5 mr-2" />
              <span>{chapters.length} Chapters available</span>
            </div>
            {chapters.length > 0 && (
              <Link to={`/read/${chapters[0].id}`} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 transition shadow-sm hover:shadow-md inline-block">
                Start Reading
              </Link>
            )}
          </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          Chapters List
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
          {chapters.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No chapters have been scraped yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {chapters.map((chapter) => (
                <Link 
                  key={chapter.id} 
                  to={`/read/${chapter.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition group"
                >
                  <div className="flex items-center">
                    <span className="text-gray-400 w-12 text-sm font-mono">{chapter.chapter_index}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{chapter.title}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
