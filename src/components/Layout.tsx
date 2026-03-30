import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'ホーム', icon: '🏠' },
  { to: '/proposal', label: '献立', icon: '🍽️' },
  { to: '/settings', label: '設定', icon: '⚙️' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-orange-50 flex flex-col">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-2">
        <span className="text-2xl">🍱</span>
        <h1 className="text-lg font-bold text-orange-600">らくごはん</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors ${
                isActive ? 'text-orange-500 font-semibold' : 'text-gray-400'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
