import React, { ReactNode } from 'react'
import ChatDrawer from './_chat'
import { MobileNav, NavFallback, SideNav, TopBar } from './_nav'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-canvas">
      <React.Suspense fallback={<NavFallback />}>
        <SideNav />
      </React.Suspense>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-6 md:px-6 md:pb-10">
          <div className="mx-auto w-full max-w-[1200px]">
            <React.Suspense fallback={<div className="p-4 text-sm text-ink-muted">Loading…</div>}>
              {children}
            </React.Suspense>
          </div>
        </main>
      </div>

      <React.Suspense fallback={null}>
        <MobileNav />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <ChatDrawer />
      </React.Suspense>
    </div>
  )
}
