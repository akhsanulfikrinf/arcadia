import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Loader2, CheckCircle2, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'

interface NovelWithStats {
  id: string
  title: string
  url: string
  cover_url?: string | null
  created_at: string
  chapterCount: number
  completedCount: number
  lastScraped: string
}

interface StatusState {
  type: string
  message: string
}

export default function ManualRescrape() {
  const navigate = useNavigate()
  const [novels, setNovels] = useState<NovelWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusState>({ type: '', message: '' })

  useEffect(() => {
    async function checkAdmin() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('auth_id', session.user.id)
        .single()
      
      if (!profile?.is_admin) {
        navigate('/')
        return
      }
      
      loadNovels()
    }

    async function loadNovels() {
      window.scrollTo(0, 0)
      const { data: novelData, error: novelError } = await supabase.from('novels').select('*').order('title', { ascending: true })
      
      if (!novelError && novelData) {
        const novelsWithStats = await Promise.all(novelData.map(async (n) => {
          // Total chapters registered in the system
          const { count: totalCount } = await supabase.from('chapters').select('id', { count: 'exact', head: true }).eq('novel_id', n.id)
          
          // Chapters that actually have at least one block of content
          const { data: completedData } = await supabase.rpc('get_completed_chapters_count', { n_id: n.id });
          const completedCount = completedData || 0;

          const { data: latestCh } = await supabase.from('chapters').select('created_at').eq('novel_id', n.id).order('chapter_index', { ascending: false }).limit(1).single()
          
          return {
            ...n,
            chapterCount: totalCount || 0,
            completedCount: completedCount,
            lastScraped: latestCh?.created_at || n.created_at
          }
        }))
        setNovels(novelsWithStats)
      }
      setLoading(false)
    }
    
    document.title = "Manual Re-scrape - Arcadia"
    checkAdmin()
    
    // Auto refresh every 30 seconds to see progress
    const interval = setInterval(loadNovels, 30000)
    return () => clearInterval(interval)
  }, [navigate])

  const getScrapeStatus = (completed: number, total: number) => {
    if (total > 0 && completed === total) {
      return { 
        label: 'Finished Scraping', 
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' 
      };
    }
    if (completed > 0) {
      return { 
        label: 'Scraping Process', 
        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' 
      };
    }
    return { 
      label: 'Not Scraped', 
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' 
    };
  }

  const handleRescrape = async (novelUrl: string, novelId: string) => {
    if (!confirm(`Are you sure you want to re-scrape this novel? This will update all chapters and illustrations.`)) {
      return;
    }

    setProcessingId(novelId)
    setStatus({ type: 'loading', message: 'Triggering scraper...' })

    try {
      const { data, error: funcError } = await supabase.functions.invoke('add-novel', {
        body: { novel_url: novelUrl }
      })
      
      if (funcError) throw funcError
      
      setStatus({ type: 'success', message: data?.message || 'Scraper triggered! Chapters will be refreshed soon.' })
      setTimeout(() => setStatus({ type: '', message: '' }), 5000)
    } catch (err: unknown) {
      console.error(err)
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'An error occurred.',
      })
    } finally {
      setProcessingId(null)
    }
  }

  const filteredNovels = novels.filter(n => 
    n.title.toLowerCase().includes(search.toLowerCase())
  )

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('id-ID', { 
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
    })
  }

  if (loading) return (
    <div className="flex justify-center flex-col items-center h-screen bg-white dark:bg-[#121212]">
      <Loader2 className="w-8 h-8 animate-spin text-black dark:text-white mb-4" />
      <p className="text-black dark:text-white font-medium">Loading novels...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link to="/admin" className="inline-flex items-center text-sm font-bold text-black dark:text-white hover:opacity-70 mb-8 transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Admin
      </Link>

      <div className="mb-10">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-4">Manual Re-scrape</h1>
        <p className="text-black/70 dark:text-white/70">Select a specific novel to force a full re-scrape of its chapters and illustrations.</p>
        <p className="text-xs text-black/40 dark:text-white/40 mt-2 italic flex items-center">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin-slow" /> Stats refresh automatically every 30 seconds.
        </p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text"
          placeholder="Search novels by title..."
          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-black dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {status.message && (
        <div className={`mb-8 p-4 rounded-xl flex items-center border ${
          status.type === 'error' ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' : 
          status.type === 'success' ? 'bg-green-50 border-green-100 text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' :
          'bg-gray-50 border-gray-100 text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white'
        }`}>
          {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-3 shrink-0" /> : <RefreshCw className={`w-5 h-5 mr-3 shrink-0 ${status.type === 'loading' ? 'animate-spin' : ''}`} />}
          <span className="font-medium">{status.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filteredNovels.map(novel => (
          <div key={novel.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 hover:shadow-md transition">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
              <div className="flex items-center gap-5 min-w-0">
                <img src={novel.cover_url || ''} alt="" className="w-16 h-24 object-cover rounded-xl bg-gray-100 dark:bg-gray-900 shadow-sm shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-bold text-lg text-black dark:text-white truncate">{novel.title}</h3>
                  <p className="text-sm text-black/50 dark:text-white/50 mb-3 flex items-center">
                    Last scraped: <span className="ml-1 text-black dark:text-white font-medium">{formatTime(novel.lastScraped)}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold rounded uppercase tracking-wider">
                      {novel.completedCount} / {novel.chapterCount} Scraped
                    </span>
                    {(() => {
                      const statusInfo = getScrapeStatus(novel.completedCount, novel.chapterCount);
                      return (
                        <span className={`px-2 py-0.5 border text-[10px] font-bold rounded uppercase tracking-wider ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleRescrape(novel.url, novel.id)}
                disabled={processingId !== null}
                className="px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm hover:opacity-80 transition disabled:opacity-50 flex items-center justify-center sm:w-auto w-full"
              >
                {processingId === novel.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Re-scrape Novel
              </button>
            </div>
            
            {/* Real Progress Bar */}
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
               <div 
                  className={`h-full transition-all duration-1000 ${
                    novel.chapterCount > 0 && novel.completedCount === novel.chapterCount ? 'bg-green-500' : 
                    novel.completedCount > 0 ? 'bg-blue-500' : 'bg-red-500'
                  }`} 
                  style={{ 
                    width: novel.chapterCount > 0 ? `${(novel.completedCount / novel.chapterCount) * 100}%` : '0%' 
                  }} 
               />
            </div>
          </div>
        ))}

        {filteredNovels.length === 0 && (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
            <p className="text-black/50 dark:text-white/50">No novels found matching "{search}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
