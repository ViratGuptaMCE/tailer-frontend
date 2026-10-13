import Link from 'next/link'
import React from 'react'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] h-[480px] w-[480px] rounded-full opacity-60"
        style={{ background: 'radial-gradient(closest-side, var(--brand-100), transparent)' }}
      />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-1.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white" aria-hidden>
            ✉
          </span>
          <span className="text-2xl font-semibold tracking-tight text-ink">tailer</span>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-e1">
          <h1 className="text-center text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-center text-sm text-ink-secondary">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-ink-secondary">{footer}</div>}
      </div>
    </div>
  )
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-brand-600 hover:text-brand-700">
      {children}
    </Link>
  )
}
