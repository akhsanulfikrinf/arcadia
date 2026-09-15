import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { BookOpen, Moon, Sun, UserCircle, LogOut, Settings, Bookmark, History } from 'lucide-react'
import { supabase } from './supabaseClient'
import Home from './pages/Home'
import NovelDetails from './pages/NovelDetails'
import Reader from './pages/Reader'
import Admin from './pages/Admin'
import ManualRescrape from './pages/ManualRescrape'
import Bookmarks from './pages/Bookmarks'
import HistoryPage from './pages/History'

function App() {
  const [session, setSession] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)

  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('arcadia_theme') !== 'light'
  )

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  useEffect(() => {
    // 1. Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else {
        setUserProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(uid: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_id', uid)
      .single()
    
    if (data) {
      setUserProfile(data)
      localStorage.setItem('arcadia_profile_id', data.id)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('arcadia_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('arcadia_theme', 'light')
    }
  }, [isDarkMode])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setIsAuthLoading(true)

    try {
      if (authMode === 'login') {
        let loginEmail = email; // This could be username or email
        
        // If it's a username (no @), look up the email in profiles
        if (!loginEmail.includes('@')) {
          const { data, error: rpcErr } = await supabase
            .rpc('get_email_by_username', { p_username: loginEmail })
          
          if (rpcErr || !data) {
            throw new Error('Username not found. Please use email or register.')
          }
          loginEmail = data
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              username: username,
              display_name: username
            }
          }
        })
        if (error) throw error
        setAuthError('Registration successful! Please sign in.')
        setAuthMode('login')
      }
    } catch (err: any) {
      setAuthError(err.message)
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('arcadia_profile_id')
    setIsProfileMenuOpen(false)
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-[#121212]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex items-center justify-center p-4 transition-colors duration-200">
        {/* Floating Theme Toggle */}
        <div className="absolute top-6 right-6">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="p-3 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-black dark:text-white hover:opacity-80 transition"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="bg-white dark:bg-black rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 max-w-md w-full transition-colors">
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-2xl">
              <BookOpen className="w-8 h-8" />
              <span>Arcadia</span>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-black dark:text-white mb-6 text-center">
            {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h1>
          
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl mb-6">
            <button 
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${authMode === 'login' ? 'bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Log In
            </button>
            <button 
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${authMode === 'register' ? 'bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">Username or Email</label>
              <input 
                type="text" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                placeholder="username or email"
              />
            </div>
            {authMode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">Username</label>
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                  placeholder="Your nickname"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                placeholder="••••••••"
              />
            </div>
            {authError && (
              <p className={`text-sm text-center ${authError.includes('successful') ? 'text-green-600' : 'text-red-500'}`}>
                {authError}
              </p>
            )}
            <button 
              type="submit" 
              disabled={isAuthLoading}
              className="w-full bg-black dark:bg-white text-white dark:text-black rounded-xl py-3 font-bold hover:opacity-80 transition mt-4 disabled:opacity-50"
            >
              {isAuthLoading ? 'Please wait...' : authMode === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex flex-col font-sans transition-colors duration-200">
        <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2 text-black dark:text-white font-bold text-xl hover:opacity-80 transition">
              <BookOpen className="w-6 h-6" />
              <span>Arcadia</span>
            </Link>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)} 
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-black dark:text-white"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-black dark:text-white"
                >
                  <UserCircle className="w-6 h-6" />
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-2 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                    <Link 
                      to="/bookmarks" 
                      className="flex items-center px-4 py-3 text-sm text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <Bookmark className="w-4 h-4 mr-3" /> Bookmarks
                    </Link>
                    <Link 
                      to="/history" 
                      className="flex items-center px-4 py-3 text-sm text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <History className="w-4 h-4 mr-3" /> History
                    </Link>
                    {userProfile?.is_admin && (
                      <>
                        <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                        <Link 
                          to="/admin" 
                          className="flex items-center px-4 py-3 text-sm text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          <Settings className="w-4 h-4 mr-3" /> Admin Dashboard
                        </Link>
                      </>
                    )}
                    <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                    <button 
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                      <LogOut className="w-4 h-4 mr-3" /> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/novel/:id" element={<NovelDetails />} />
            <Route path="/read/:id" element={<Reader />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/history" element={<HistoryPage />} />
            {userProfile?.is_admin && (
              <>
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/manual-rescrape" element={<ManualRescrape />} />
              </>
            )}
          </Routes>
        </main>
        
        <footer className="bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800 py-6 mt-auto">
          <div className="max-w-5xl mx-auto px-4 text-center text-sm text-black dark:text-white">
            <p>Arcadia &copy; {new Date().getFullYear()}</p>
          </div>
        </footer>
      </div>
    </Router>
  )
}

export default App
