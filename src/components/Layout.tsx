import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  List,
  History,
  BarChart3,
  Settings,
  Globe,
  Menu,
  X,
  WifiOff,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/browse', label: 'Browse', icon: List },
  { to: '/scraper', label: 'Scraper', icon: Globe },
  { to: '/history', label: 'History', icon: History },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
]

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const closeSidebar = () => setSidebarOpen(false)

  const sidebar = (
    <aside className="flex flex-col bg-surface-sidebar border-r border-border-main w-56 h-full">
      <div className="p-4 border-b border-border-main flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-content">SCRP Muzic</h1>
            {!online && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            )}
          </div>
          <p className="text-xs text-content-muted mt-0.5">Release Browser</p>
        </div>
        <button
          onClick={closeSidebar}
          className="lg:hidden p-1 text-content-muted hover:text-content-secondary rounded-md hover:bg-surface-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={closeSidebar}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-surface-tertiary text-content font-medium'
                  : 'text-content-secondary hover:text-content hover:bg-surface-secondary'
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-2 border-t border-border-main">
        <NavLink
          to="/settings"
          onClick={closeSidebar}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-surface-tertiary text-content font-medium'
                : 'text-content-secondary hover:text-content hover:bg-surface-secondary'
            }`
          }
        >
          <Settings className="w-4 h-4" />
          Settings
        </NavLink>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-surface text-content">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex shrink-0">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeSidebar}
          />
          <div className="absolute left-0 top-0 h-full transition-transform">
            {sidebar}
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden bg-surface min-w-0">
        <div className="flex items-center gap-2 p-2 border-b border-border-main lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 text-content-muted hover:text-content-secondary rounded-md hover:bg-surface-secondary transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
