'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Building2,
  Calendar,
  FileEdit,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { Avatar, cx } from '@/components/ui'

const NAVIGATION = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Companies', href: '/dashboard/companies', icon: Building2 },
  { name: 'Drafts', href: '/dashboard/drafts', icon: FileEdit },
  { name: 'Resumes', href: '/dashboard/resumes', icon: FileText },
  { name: 'Scheduled', href: '/dashboard/scheduled', icon: Calendar },
  { name: 'Accounts', href: '/dashboard/accounts', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

const MOBILE_NAV = [
  { name: 'Drafts', href: '/dashboard/drafts', icon: FileEdit },
  { name: 'Resumes', href: '/dashboard/resumes', icon: FileText },
  { name: 'Scheduled', href: '/dashboard/scheduled', icon: Calendar },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

interface SenderAccount {
  id: string
  label: string
  is_default: boolean
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

export function TopBar() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [accounts, setAccounts] = useState<SenderAccount[]>([])
  const [email, setEmail] = useState('')

  useEffect(() => {
    let cancelled = false
    async function initial() {
      try {
        const supabase = createBrowserClient()
        const { data } = await supabase.auth.getUser()
        if (!cancelled) setEmail(data.user?.email ?? '')
      } catch {
        // Non-fatal.
      }
      try {
        const data = await fetchApi('/api/v1/mail-accounts')
        if (!cancelled) setAccounts(data.accounts ?? [])
      } catch {
        // Non-fatal: switcher just stays empty.
      }
    }
    void initial()
    return () => {
      cancelled = true
    }
  }, [])

  const defaultId = accounts.find((a) => a.is_default)?.id ?? ''

  const handleSwitch = async (id: string) => {
    if (!id) return
    try {
      await fetchApi(`/api/v1/mail-accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_default: true }),
      })
      setAccounts((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })))
    } catch {
      // Non-fatal: select snaps back on next load.
    }
  }

  const handleSignOut = async () => {
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
    } finally {
      router.push('/login')
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-[rgba(255,255,255,0.85)] px-4 backdrop-blur md:px-6">
      <span className="text-lg font-semibold tracking-tight text-ink md:hidden">tailer</span>
      <form
        className="relative hidden max-w-md flex-1 sm:block"
        onSubmit={(e) => {
          e.preventDefault()
          router.push(`/dashboard/drafts${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
        }}
      >
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search drafts"
          aria-label="Search drafts"
          className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-12 text-sm placeholder:text-ink-muted focus:border-brand-600"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-sm border border-line bg-surface-subtle px-1.5 font-mono text-[11px] text-ink-muted">
          ⌘K
        </kbd>
      </form>
      <div className="ml-auto flex items-center gap-2">
        {accounts.length > 0 && (
          <select
            value={defaultId}
            onChange={(e) => void handleSwitch(e.target.value)}
            aria-label="Sending account"
            title="Default sending account"
            className="hidden h-9 max-w-44 rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink-secondary sm:block"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        )}
        <Avatar name={email || 'U'} size={32} />
        <button
          onClick={() => void handleSignOut()}
          title="Sign out"
          aria-label="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-subtle hover:text-ink"
        >
          <LogOut size={18} aria-hidden />
        </button>
      </div>
    </header>
  )
}

function CapacityMiniCard() {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    async function initial() {
      try {
        const data = await fetchApi('/api/v1/dashboard/summary')
        if (cancelled) return
        const list = (data.accounts ?? []) as Array<{ remaining: number | null; effective_cap: number }>
        if (list.length === 0) return
        const remaining = list.reduce((n, a) => n + (a.remaining ?? 0), 0)
        const cap = list.reduce((n, a) => n + (a.effective_cap ?? 0), 0)
        setText(`${remaining} of ${cap} sends left today`)
      } catch {
        // Non-fatal.
      }
    }
    void initial()
    return () => {
      cancelled = true
    }
  }, [])
  if (!text) return null
  return (
    <div className="tabular rounded-lg border border-line bg-surface-subtle px-3 py-2 text-xs text-ink-secondary">
      {text}
    </div>
  )
}

const NAV_COLLAPSE_KEY = 'tailer:nav-collapsed'

export function SideNav() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(NAV_COLLAPSE_KEY) === '1')
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem(NAV_COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <nav
      aria-label="Primary"
      className={cx(
        'hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-150 md:flex',
        collapsed ? 'w-16' : 'w-[248px]',
      )}
    >
      <div className={cx('flex h-14 shrink-0 items-center', collapsed ? 'justify-center px-2' : 'px-5')}>
        {collapsed ? (
          <Link href="/dashboard" title="tailer — Dashboard" aria-label="tailer — Dashboard" className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white">
            ✉
          </Link>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-1.5 text-xl font-semibold tracking-tight text-ink">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-[13px] font-bold text-white" aria-hidden>
              ✉
            </span>
            tailer
          </Link>
        )}
      </div>
      <ul className={cx('flex flex-1 flex-col gap-0.5 overflow-y-auto py-2', collapsed ? 'px-2' : 'px-3')}>
        {NAVIGATION.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.name : undefined}
                className={cx(
                  'relative flex h-9 items-center rounded-md text-sm transition-colors duration-[80ms]',
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                  active ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 h-6 w-[3px] rounded-full bg-brand-600" aria-hidden />
                )}
                <item.icon size={20} aria-hidden className={active ? 'text-brand-600' : 'text-ink-muted'} />
                {!collapsed && item.name}
              </Link>
            </li>
          )
        })}
      </ul>
      {!collapsed && (
        <div className="p-3">
          <CapacityMiniCard />
        </div>
      )}
      <div className={cx('shrink-0 border-t border-line', collapsed ? 'py-2' : 'py-2 pr-3 pl-3')}>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cx(
            'flex h-9 items-center gap-2 rounded-md text-sm text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink',
            collapsed ? 'w-full justify-center' : 'w-full px-3',
          )}
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </nav>
  )
}

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex">
        {MOBILE_NAV.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.name} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px]',
                  active ? 'font-medium text-brand-700' : 'text-ink-muted',
                )}
              >
                <item.icon size={20} aria-hidden />
                {item.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function NavFallback() {
  return (
    <nav aria-hidden className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="flex h-14 shrink-0 items-center px-5">
        <span className="text-xl font-semibold tracking-tight text-ink">tailer</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 py-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="animate-shimmer h-9 rounded-md bg-surface-subtle" />
        ))}
      </div>
    </nav>
  )
}
