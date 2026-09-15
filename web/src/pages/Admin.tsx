import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, CheckCircle2, RefreshCw, ListTree } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function Admin() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const [recommendations, setRecommendations] = useState<any[]>([])

  useEffect(() => {
    document.title = "Admin Dashboard - Arcadia"
  }, [])

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
      const { data, error } = await supabase.from('novels').select('title, url').order('created_at', { ascending: false }).limit(4)
      if (data && !error) {
        setRecommendations(data)
      }
    }
    
    checkAdmin()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url.trim() || !url.startsWith('http')) {
      setStatus('error')
      setMessage('Please enter a valid URL.')
      return
    }

    if (!confirm('Are you sure you want to add this novel and start the scraping process?')) {
      return
    }

    setStatus('loading')
    
    try {
      const { data, error: funcError } = await supabase.functions.invoke('add-novel', {
        body: { novel_url: url }
      })
      
      if (funcError) throw funcError
      
      setStatus('success')
      setMessage(data?.message || 'Scraper triggered successfully! It may take a few minutes for chapters to appear.')
      setUrl('')
      
    } catch (err: any) {
      console.error(err)
      setStatus('error')
      setMessage(err.message || 'An error occurred while adding the novel.')
    }
  }

  const handleRescrapeAll = async () => {
    if (!confirm('Are you sure you want to trigger a full re-scrape of ALL novels in the library? This will take a long time.')) {
      return
    }
    
    setStatus('loading');
    try {
      const { data, error: funcError } = await supabase.functions.invoke('add-novel', {
        body: { novel_url: 'ALL_FORCE' }
      })
      
      if (funcError) throw funcError
      
      setStatus('success')
      setMessage(data?.message || 'Full re-scrape triggered! All novels will have their chapters refreshed.')
    } catch (err: any) {
      console.error(err)
      setStatus('error')
      setMessage(err.message || 'An error occurred while re-scraping.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link to="/" className="inline-flex items-center text-sm font-bold text-black dark:text-white hover:opacity-70 mb-8 transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Library
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-black dark:text-white mb-2">Add New Novel</h1>
        <p className="text-black/70 dark:text-white/70 mb-8">Enter the URL of the light novel from meionovels.com to add it to your library and trigger the scraper.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-black dark:text-white mb-2">Novel URL</label>
            <input 
              type="url" 
              id="url" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://meionovels.com/novel/example-novel/"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white transition outline-none"
              disabled={status === 'loading'}
            />
          </div>
          
          {recommendations.length > 0 && (
            <div className="mb-6">
              <span className="text-sm font-medium text-black/70 dark:text-white/70 mb-2 block">Quick Recommendations (Re-scrape added novels):</span>
              <div className="flex flex-wrap gap-2">
                {recommendations.map((rec, i) => (
                  <button 
                    key={i} 
                    type="button" 
                    onClick={() => setUrl(rec.url)}
                    className="px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black rounded-lg text-sm hover:opacity-80 transition truncate max-w-[200px]"
                  >
                    {rec.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {status === 'error' && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-100 dark:border-red-800">
              {message}
            </div>
          )}
          
          {status === 'success' && (
            <div className="p-4 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl text-sm flex border border-green-100 dark:border-green-800">
              <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
              <span>{message}</span>
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={status === 'loading' || !url}
            className="w-full flex justify-center items-center py-4 px-4 rounded-xl shadow-lg text-sm font-bold text-white bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Triggering Scraper...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" />
                Add to Library
              </>
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-black dark:text-white mb-2">Individual Management</h2>
          <p className="text-sm text-black/70 dark:text-white/70 mb-6">Manage existing novels, check their scraping status, or force a re-scrape for a specific title.</p>
          
          <Link
            to="/admin/manual-rescrape"
            className="w-full flex justify-center items-center py-4 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-[#222] hover:bg-black dark:bg-[#333] dark:hover:bg-[#444] transition"
          >
            <ListTree className="w-5 h-5 mr-2" />
            Go to Manual Re-scrape List
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Danger Zone</h2>
          <p className="text-sm text-black/70 dark:text-white/70 mb-4">Force a complete re-scrape of all novels in your library. This will delete all existing chapter contents and re-download them. Use this if illustrations or text are broken across multiple novels.</p>
          <button
              type="button"
              onClick={handleRescrapeAll}
              disabled={status === 'loading'}
              className="w-full flex justify-center items-center py-3 px-6 rounded-xl shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition"
          >
              {status === 'loading' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <RefreshCw className="w-5 h-5 mr-2" />}
              Force Re-scrape All Novels
          </button>
        </div>
      </div>
    </div>
  )
}
