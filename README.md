# 🌌 Arcadia: Personal Light Novel Reader

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-orange?style=for-the-badge&logo=pwa)](https://web.dev/progressive-web-apps/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

Arcadia is a premium, mobile-first Web Application designed for avid Light Novel readers. It combines a sleek, modern interface with a powerful automated scraping engine to provide a seamless reading experience without the clutter of traditional novel sites.

---

## ✨ Key Features

### 📖 Immersive Reading
- **PWA Experience**: Install Arcadia on your phone for a full-screen, app-like experience.
- **Dynamic Themes**: Beautifully crafted Light and Dark modes.
- **Auto-Sync History**: Picking up where you left off is effortless across all your devices.
- **Bookmark Management**: Keep track of your favorite stories with a single tap.

### 🏛️ Advanced Library Management
- **Continue Reading**: Quick-access cards for your current progress.
- **Powerful Search & Sort**: Organize your collection by title or date added.
- **Responsive Design**: Optimized layouts for mobile webviews and desktop browsers.

### 🛡️ Secure Multi-User System
- **Supabase Auth**: Secure login via Email or Username.
- **Private Data**: Your bookmarks, history, and preferences are linked to your personal account.
- **Admin Roles**: Sophisticated admin dashboard to manage the scraping engine and library content.

### 🤖 Automated Scraper Engine
- **Background Scraping**: Triggered via Supabase Edge Functions and GitHub Actions.
- **Resilient Logic**: Built-in protection against Cloudflare challenges and data loss.
- **Live Progress Tracking**: Watch real-time progress bars as volumes and chapters are scraped.
- **Manual Overrides**: Edit novel titles without interfering with the scraping process.

---

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Tailwind CSS, Lucide Icons.
- **Backend / Database**: Supabase (PostgreSQL, RLS, Auth, Edge Functions).
- **Scraper**: Python, Playwright, GitHub Actions.
- **Deployment**: GitHub Pages (UI), GitHub Actions (Scraper).

---

## 🚀 Getting Started

### Prerequisites
- Node.js & npm
- Python 3.10+ (for local scraping tests)
- A Supabase Project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/akhsanulfikrinf/arcadia.git
   cd arcadia
   ```

2. **Frontend Setup**
   ```bash
   cd web
   npm install
   # Create a .env file with your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   npm run dev
   ```

3. **Database Setup**
   - Apply migrations found in the `supabase/migrations` folder to your Supabase project.
   - Configure your GitHub Secrets for the Edge Function.

---

## 🛡️ License

Arcadia is a personal project built for convenience and educational purposes. Ensure you respect the terms of service of any source sites when using the scraping engine.

---

*Built with ❤️ by [Akhsan](https://github.com/akhsanulfikrinf)*
