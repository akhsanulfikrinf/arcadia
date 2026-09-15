import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Edit2, Check, X } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function NovelDetails() {
  const { id } = useParams()
  const [novel, setNovel] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [readHistory, setReadHistory] = useState<string[]>([])
  const [expandedVolumes, setExpandedVolumes] = useState<Record<string, boolean>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function loadData() {
      if (!id) return
      window.scrollTo(0, 0)
      
      const { data: nData, error: nErr } = await supabase
        .from('novels')
        .select('*')
        .eq('id', id)
        .single()
        
      if (!nErr && nData) {
        setNovel(nData)
        setEditedTitle(nData.title)
        document.title = `${nData.title} - Arcadia`
      }
      
      const { data: cData, error: cErr } = await supabase
        .from('chapters')
        .select('*')
        .eq('novel_id', id)
        .order('chapter_index', { ascending: true })
        
      if (!cErr) setChapters(cData || [])
      
      try {
        const history = JSON.parse(localStorage.getItem('arcadia_history') || '{}')
        if (history[id]) {
          setReadHistory(history[id])
        }
      } catch (e) {}

      setLoading(false)
    }

    loadData()
  }, [id])

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
  if (!novel) return <div className="text-center py-20 text-red-500">Novel not found.</div>

  // Group chapters by volume
  const volumes: Record<string, any[]> = {}
  chapters.forEach(chapter => {
    // Extract volume number from title (e.g. "Volume 1 Chapter 1" -> "Volume 1")
    let volName = "Other Chapters"
    const match = chapter.title.match(/Volume\s+\d+/i)
    if (match) {
      volName = match[0]
    }
    if (!volumes[volName]) volumes[volName] = []
    volumes[volName].push(chapter)
  })

  const toggleVolume = (volName: string) => {
    setExpandedVolumes(prev => ({...prev, [volName]: !prev[volName]}))
  }

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || !id) return
    setIsSaving(true)
    const { error } = await supabase
      .from('novels')
      .update({ title: editedTitle.trim() })
      .eq('id', id)
    
    if (!error) {
      setNovel({ ...novel, title: editedTitle.trim() })
      document.title = `${editedTitle.trim()} - Arcadia`
      setIsEditing(false)
    }
    setIsSaving(false)
  }

  // Auto-expand the first volume if none are expanded
  if (Object.keys(volumes).length > 0 && Object.keys(expandedVolumes).length === 0) {
    const firstVol = Object.keys(volumes)[0];
    setExpandedVolumes({[firstVol]: true});
  }

  // Calculate total read
  const totalReadCount = chapters.filter(c => readHistory.includes(c.id)).length
  const percentRead = chapters.length > 0 ? Math.round((totalReadCount / chapters.length) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-sans">
      <Link to="/" className="inline-flex items-center text-sm font-bold text-black dark:text-white hover:opacity-70 mb-6 transition">
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
        <div className="flex-1">
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-4">
              {isEditing ? (
                <div className="flex-1 flex gap-2">
                  <input 
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2 text-2xl font-bold text-black dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveTitle}
                      disabled={isSaving}
                      className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => { setIsEditing(false); setEditedTitle(novel.title); }}
                      className="p-3 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold text-black dark:text-white leading-tight">{novel.title}</h1>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition shrink-0"
                    title="Edit Title"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-col mb-6">
              <div className="flex items-center text-black/70 dark:text-white/70 mb-2">
                <BookOpen className="w-5 h-5 mr-2" />
                <span>{chapters.length} Chapters available</span>
              </div>
              {chapters.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 max-w-[200px]">
                    <div className="bg-black dark:bg-white h-2.5 rounded-full" style={{ width: `${percentRead}%` }}></div>
                  </div>
                  <span className="text-sm font-medium text-black/70 dark:text-white/70">{percentRead}% Read ({totalReadCount}/{chapters.length})</span>
                </div>
              )}
            </div>
            {chapters.length > 0 && (
              <div className="flex gap-3 mt-2">
                {readHistory.length > 0 ? (
                  <Link to={`/read/${readHistory[readHistory.length - 1]}`} className="bg-black text-white dark:bg-white dark:text-black px-8 py-3 rounded-xl font-medium hover:opacity-80 transition shadow-sm hover:shadow-md inline-block">
                    Continue Reading
                  </Link>
                ) : (
                  <Link to={`/read/${chapters[0].id}`} className="bg-black text-white dark:bg-white dark:text-black px-8 py-3 rounded-xl font-medium hover:opacity-80 transition shadow-sm hover:shadow-md inline-block">
                    Start Reading
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-xl font-bold text-black dark:text-white mb-6 flex items-center">
          Chapters List
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
          {chapters.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No chapters have been scraped yet. Please check again in a few minutes.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {Object.entries(volumes).map(([volName, volChapters]) => (
                <div key={volName} className="volume-group">
                  <button 
                    onClick={() => toggleVolume(volName)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    <span className="font-bold text-black dark:text-white">{volName} <span className="text-black/50 dark:text-white/50 font-normal text-sm ml-2">({volChapters.length} chapters)</span></span>
                    <span className="text-black dark:text-white text-xl">{expandedVolumes[volName] ? '−' : '+'}</span>
                  </button>
                  
                  {expandedVolumes[volName] && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700 pl-4 bg-white dark:bg-gray-800">
                      {volChapters.map((chapter) => {
                        const isRead = readHistory.includes(chapter.id)
                        return (
                          <Link 
                            key={chapter.id} 
                            to={`/read/${chapter.id}`}
                            className={`flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition group ${isRead ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-center">
                              <span className={`w-12 text-sm font-mono text-black dark:text-white`}>
                                {isRead ? '✓ Read' : `Ch ${chapter.chapter_index}`}
                              </span>
                              <span className={`font-medium transition pl-2 ${isRead ? 'text-black dark:text-white line-through' : 'text-black dark:text-white'}`}>
                                {chapter.title}
                              </span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
