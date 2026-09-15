import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SortAsc, Clock, ChevronDown } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function Home() {
  const [novels, setNovels] = useState<any[]>([])
  const [recentReads, setRecentReads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('a-z')

  useEffect(() => {
    document.title = "Arcadia - Library"
  }, [])

  useEffect(() => {
    async function loadData() {
      window.scrollTo(0, 0)
      // 1. Fetch All Novels
      const { data: novelsData, error: nErr } = await supabase
        .from('novels')
        .select('*')
      
      if (!nErr) setNovels(novelsData || [])

      // 2. Fetch Recent Reads
      let profileId = localStorage.getItem('arcadia_profile_id')
      
      // Auto-fetch profile ID if missing but authed
      if (!profileId && localStorage.getItem('arcadia_auth') === 'true') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', 'Sucry')
          .single()
        if (profile) {
          profileId = profile.id
          localStorage.setItem('arcadia_profile_id', profileId as string)
        }
      }

      if (profileId) {
        const { data: historyData } = await supabase
          .from('reading_history')
          .select(`
            novel_id,
            chapter_id,
            updated_at,
            novels (title, cover_url),
            chapters (title, chapter_index)
          `)
          .eq('profile_id', profileId)
          .order('updated_at', { ascending: false })
          .limit(5)
        
        if (historyData) setRecentReads(historyData)
      }

      setLoading(false)
    }

    loadData()
  }, [])

  const filteredNovels = novels
    .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'a-z') return a.title.localeCompare(b.title)
      if (sortBy === 'z-a') return b.title.localeCompare(a.title)
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return 0
    })

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Continue Reading Section */}
      {recentReads.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-bold text-black dark:text-white mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2" /> Continue Reading
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {recentReads.map((read, idx) => (
              <Link 
                key={idx} 
                to={`/read/${read.chapter_id}`} 
                className="flex-shrink-0 w-64 bg-white dark:bg-gray-800 rounded-2xl p-3 flex gap-3 border border-gray-100 dark:border-gray-700 hover:shadow-md transition group"
              >
                <img 
                  src={read.novels?.cover_url} 
                  alt="" 
                  className="w-14 h-20 object-cover rounded-lg bg-gray-100 dark:bg-gray-900 shadow-sm"
                />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className="font-bold text-sm text-black dark:text-white truncate mb-1">{read.novels?.title}</h3>
                  <p className="text-xs text-black/50 dark:text-white/50 truncate">
                    {read.chapters?.title.includes('Chapter') ? read.chapters?.title : `Ch. ${read.chapters?.chapter_index}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar: Search & Sort */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white">Library</h1>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search Bar - Takes up as much space as possible */}
          <div className="relative flex-grow md:w-64 order-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition"
            />
          </div>

          {/* Sort Dropdown - Small and compact on mobile */}
          <div className="relative w-32 md:w-40 order-2">
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full appearance-none pl-9 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition truncate"
            >
              <option value="a-z">A-Z</option>
              <option value="z-a">Z-A</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <SortAsc className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <Link to="/admin" className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl text-sm font-bold hover:opacity-80 transition order-3 shrink-0">
            Add
          </Link>
        </div>
      </div>
      
      {filteredNovels.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
          <Search className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-black/50 dark:text-white/50">
            {searchQuery ? `No novels match "${searchQuery}"` : "Your library is empty."}
          </p>
          {!searchQuery && (
            <Link to="/admin" className="mt-4 inline-block bg-black text-white dark:bg-white dark:text-black px-6 py-2 rounded-lg hover:opacity-80 transition">Add your first novel</Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredNovels.map(novel => (
            <Link key={novel.id} to={`/novel/${novel.id}`} className="group transition-transform duration-200">
              <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg transition">
                <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-900 relative">
                  {novel.cover_url ? (
                    <img src={novel.cover_url} alt={novel.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Cover</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end p-4">
                    <span className="text-white font-bold text-sm bg-indigo-600 px-3 py-1 rounded-lg">View Novel</span>
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="font-bold text-black dark:text-white line-clamp-2 leading-tight" title={novel.title}>{novel.title}</h2>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
