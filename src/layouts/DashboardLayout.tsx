import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'
import type { Role } from '@/types/database'

type NavItem = {
  to: string
  label: string
  roles: Role[]
  icon: (props: { className?: string }) => JSX.Element
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconCart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 6h15l-2 8H7L6 6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M6 6 5 3H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}
function IconBox({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3 3 7.5 12 12l9-4.5L12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M3 7.5V16.5L12 21v-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M21 7.5V16.5L12 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
function IconTag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 13 11 22 2 13V2h11l7 7v4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M7.5 7.5h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" />
      <path
        d="M22 21v-2a3.5 3.5 0 0 0-3-3.45"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 3.2a4 4 0 0 1 0 7.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
function IconClock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function IconReport({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 3h10v18H7V3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 7h6M9 11h6M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function IconWallet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M21 9h-5a2 2 0 0 0 0 4h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16.5 11h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
function IconBell({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function IconMenu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function IconStore({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function IconPackage({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const allNavItems: NavItem[] = [
  { to: '/', label: 'Dasbor', roles: ['super_admin', 'manager', 'karyawan'], icon: IconGrid },
  { to: '/outlets', label: 'Outlet', roles: ['super_admin'], icon: IconStore },
  { to: '/pos', label: 'POS', roles: ['super_admin', 'manager', 'karyawan'], icon: IconCart },
  { to: '/products', label: 'Produk', roles: ['super_admin', 'manager'], icon: IconBox },
  { to: '/stock', label: 'Stok', roles: ['super_admin', 'manager'], icon: IconPackage },
  { to: '/categories', label: 'Kategori', roles: ['super_admin', 'manager'], icon: IconTag },
  { to: '/reports', label: 'Laporan', roles: ['super_admin', 'manager', 'karyawan'], icon: IconReport },
  { to: '/cash-flow', label: 'Arus Kas', roles: ['super_admin', 'manager'], icon: IconWallet },
  { to: '/employees', label: 'Karyawan', roles: ['super_admin', 'manager'], icon: IconUsers },
  { to: '/attendance', label: 'Absensi', roles: ['super_admin', 'manager', 'karyawan'], icon: IconClock },
  { to: '/shifts', label: 'Shift', roles: ['super_admin', 'manager', 'karyawan'], icon: IconClock },
]

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  manager: 'Manager',
  karyawan: 'Karyawan',
}

export function DashboardLayout() {
  const { profile, signOut } = useAuthContext()
  const { outletId, outlet, outlets, setOutletId, isSuperAdmin } = useOutlet()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const pageTitle = useMemo(() => {
    const found = allNavItems.find((i) => i.to === location.pathname)
    if (found) return found.label
    if (location.pathname === '/') return 'Dasbor'
    return 'Dasbor'
  }, [location.pathname])

  const initials = useMemo(() => {
    const raw = (profile?.full_name || profile?.email || 'U').trim()
    const parts = raw.split(/\s+/).filter(Boolean)
    const i = (parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '')
    return i.toUpperCase()
  }, [profile?.email, profile?.full_name])

  function handleLogout() {
    signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Tutup sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={[
            'fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800',
            'transform transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-auto',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white dark:bg-white">
                <img src="/logo.webp" alt="Aledroses" className="h-full w-full object-cover" />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
              aria-label="Tutup sidebar"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-3">
            <div className="px-2 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500">
              MENU UTAMA
            </div>
            {allNavItems
              .filter((item) => profile && item.roles.includes(profile.role))
              .map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      [
                        'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800/60',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={[
                            'w-9 h-9 rounded-lg inline-flex items-center justify-center transition-colors',
                            isActive
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
                              : 'bg-gray-50 text-gray-500 group-hover:bg-white dark:bg-gray-800 dark:text-gray-300 dark:group-hover:bg-gray-800',
                          ].join(' ')}
                        >
                          <Icon className="w-5 h-5" />
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-transparent group-[.active]:bg-primary-600" />
                      </>
                    )}
                  </NavLink>
                )
              })}
          </nav>

          <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {profile?.full_name || 'Pengguna'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{profile?.email}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{profile && roleLabels[profile.role]}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 w-full btn-secondary"
            >
              Keluar
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 lg:pl-0">
          <header className="sticky top-0 z-30 h-16 bg-gray-50/80 dark:bg-gray-950/70 backdrop-blur border-b border-gray-200 dark:border-gray-800">
            <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                  aria-label="Buka sidebar"
                >
                  <IconMenu className="w-5 h-5" />
                </button>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Dasbor</p>
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                    {pageTitle}
                  </h1>
                  {outlet && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">{outlet.name}</p>
                  )}
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="header-outlet" className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      Outlet
                    </label>
                    <select
                      id="header-outlet"
                      value={outletId ?? ''}
                      onChange={(e) => setOutletId(e.target.value || null)}
                      className="input w-44 text-sm"
                      aria-label="Pilih outlet"
                    >
                      <option value="">Pilih outlet</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex-1 max-w-xl hidden md:block">
                <div className="relative">
                  <input
                    className="input pl-10 bg-white dark:bg-gray-900"
                    placeholder="Cari..."
                    aria-label="Search"
                  />
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    aria-hidden="true"
                  >
                    <path
                      d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M16 16l5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                  aria-label="Notifikasi"
                >
                  <IconBell className="w-5 h-5" />
                </button>
                <div className="hidden sm:flex items-center gap-3 pl-2">
                  <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold">
                    {initials}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
