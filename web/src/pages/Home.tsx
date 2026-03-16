import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Home() {
  const [novels, setNovels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchNovels() {
      const { data, error } = await supabase
        .from('novels')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) console.error('Error fetching novels:', error)
      else setNovels(data || [])
      setLoading(false)
    }

    fetchNovels()
  }, [])

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white">Library</h1>
        <Link to="/admin" className="text-black dark:text-white hover:opacity-70 font-medium">Add Novel</Link>
      </div>
      
      {novels.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-black dark:text-white">Your library is empty.</p>
          <Link to="/admin" className="mt-4 inline-block bg-black text-white dark:bg-white dark:text-black px-6 py-2 rounded-lg hover:opacity-80 transition">Add your first novel</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {novels.map(novel => (
            <Link key={novel.id} to={`/novel/${novel.id}`} className="group group-hover:scale-105 transition-transform duration-200">
              <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 relative">
                  {novel.cover_url ? (
                    <img src={novel.cover_url} alt={novel.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Cover</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <span className="text-white font-medium text-sm">Read</span>
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="font-semibold text-black dark:text-white line-clamp-2" title={novel.title}>{novel.title}</h2>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
