import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function Admin() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (username === 'Sucry' && password === 'Sucry_01#') {
      setIsAuthenticated(true)
      setAuthError('')
    } else {
      setAuthError('Invalid username or password')
    }
  }

  const recommendations = [
    { title: "Kusuriya no Hitorigoto", url: "https://meionovels.com/novel/kusuriya-no-hitorigoto-ln/" },
    { title: "Classroom of the Elite", url: "https://meionovels.com/novel/youkoso-jitsuryoku-shijou-shugi-no-kyoushitsu-e/" },
    { title: "Mushoku Tensei", url: "https://meionovels.com/novel/mushoku-tensei-light-novel/" },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url.trim() || !url.startsWith('http')) {
      setStatus('error')
      setMessage('Please enter a valid URL.')
      return
    }

    setStatus('loading')
    
    try {
      // In a real app we would call the Supabase Edge Function directly here
      // const { data, error } = await supabase.functions.invoke('add-novel', {
      //   body: { novel_url: url },
      // })
      
      // For now, we simulate API call since the function logic can be called directly or via fetch
      // Let's assume the user deployed the Edge function to their project URL
      const { data: { session } } = await supabase.auth.getSession()
      
      const functionUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/add-novel'
      
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ novel_url: url })
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Failed to add novel')
      
      setStatus('success')
      setMessage(data.message || 'Scraper triggered successfully! It may take a few minutes for chapters to appear.')
      setUrl('')
      
    } catch (err: any) {
      console.error(err)
      setStatus('error')
      setMessage(err.message || 'An error occurred while adding the novel.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600 mb-8 transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Library
      </Link>

      {!isAuthenticated ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">Admin Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white rounded-xl py-3 font-medium hover:bg-indigo-700 transition mt-4">Login</button>
          </form>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Add New Novel</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Enter the URL of the light novel from meionovels.com to add it to your library and trigger the scraper.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Novel URL</label>
            <input 
              type="url" 
              id="url" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://meionovels.com/novel/example-novel/"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none"
              disabled={status === 'loading'}
            />
          </div>
          
          <div className="mb-6">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Quick Recommendations:</span>
            <div className="flex flex-wrap gap-2">
              {recommendations.map((rec, i) => (
                <button 
                  key={i} 
                  type="button" 
                  onClick={() => setUrl(rec.url)}
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm hover:bg-indigo-100 dark:hover:bg-gray-600 transition"
                >
                  {rec.title}
                </button>
              ))}
            </div>
          </div>
          
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
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
      </div>
      )}
    </div>
  )
}
