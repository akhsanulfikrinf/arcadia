import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import Home from './pages/Home'
import NovelDetails from './pages/NovelDetails'
import Reader from './pages/Reader'
import Admin from './pages/Admin'

function App() {
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
