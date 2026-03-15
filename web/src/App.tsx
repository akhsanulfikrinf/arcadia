import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import Home from './pages/Home'
import NovelDetails from './pages/NovelDetails'
import Reader from './pages/Reader'
import Admin from './pages/Admin'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('arcadia_auth') === 'true'
  )
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    // Check local storage for dark mode theme
    const isDark = localStorage.getItem('arcadia_theme') === 'dark'
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (username === 'Sucry' && password === 'Sucry_01#') {
      setIsAuthenticated(true)
      localStorage.setItem('arcadia_auth', 'true')
      setAuthError('')
    } else {
      setAuthError('Invalid username or password')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 max-w-md w-full">
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-2 text-indigo-600 font-bold text-2xl">
              <BookOpen className="w-8 h-8" />
              <span>Arcadia</span>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-6 text-center">Reader Authentication</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white rounded-xl py-3 font-medium hover:bg-indigo-700 transition mt-4">Access Library</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex flex-col font-sans transition-colors duration-200">
        <header className="bg-white dark:bg-[#1e1e1e] border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-xl hover:opacity-80 transition">
              <BookOpen className="w-6 h-6" />
              <span>Arcadia</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/novel/:id" element={<NovelDetails />} />
            <Route path="/read/:id" element={<Reader />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
        
        <footer className="bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-gray-800 py-6 mt-auto">
          <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Arcadia &copy; {new Date().getFullYear()}</p>
          </div>
        </footer>
      </div>
    </Router>
  )
}

export default App
