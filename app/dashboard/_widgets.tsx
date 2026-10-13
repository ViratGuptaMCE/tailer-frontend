'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Mail, Send } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Banner,
  Button,
  Card,
  CardHeader,
  Chip,
  Skeleton,
  StatCard,
} from '@/components/ui'

interface Upcoming {
  id: string
  to_email: string
  send_at: string
}

interface AccountCap {
  label: string
  effective_cap: number
  remaining: number | null
}

interface Totals {
  sent_30d: number
  pending: number
  failed: number
  bounced: number
}

interface ByDay {
  day: string
  sent: number
}

interface ChecklistStep {
  key: string
  label: string
  done: boolean
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function DashboardWidgets() {
  const [upcoming, setUpcoming] = useState<Upcoming[]>([])
  const [accounts, setAccounts] = useState<AccountCap[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [byDay, setByDay] = useState<ByDay[]>([])
  const [insights, setInsights] = useState<string[]>([])
  const [steps, setSteps] = useState<ChecklistStep[]>([])
  const [staleJobs, setStaleJobs] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function initial() {
      try {
        const [summary, metrics, checklist, beats] = await Promise.all([
          fetchApi('/api/v1/dashboard/summary'),
          fetchApi('/api/v1/metrics/overview'),
          fetchApi('/api/v1/metrics/checklist'),
          fetchApi('/api/v1/ops/heartbeats'),
        ])
        if (cancelled) return
        setUpcoming(summary.upcoming ?? [])
        setAccounts(summary.accounts ?? [])
        setTotals(metrics.totals ?? null)
        setByDay(metrics.by_day ?? [])
        setInsights(metrics.insights ?? [])
        setSteps(checklist.steps ?? [])
        setStaleJobs(Object.values(beats ?? {}).some((h) => (h as { stale: boolean }).stale))
      } catch {
        // Non-fatal: dashboard still renders without live data.
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void initial()
    return () => {
      cancelled = true
    }
  }, [])

  const sentToday = byDay.find((d) => d.day === todayISO())?.sent ?? 0
  const capacityLeft = accounts.reduce((n, a) => n + (a.remaining ?? 0), 0)
  const capacityTotal = accounts.reduce((n, a) => n + (a.effective_cap ?? 0), 0)
  const showChecklist = steps.length > 0 && steps.some((s) => !s.done)

  if (!loaded) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {showChecklist && (
        <Card className="p-5">
          <CardHeader title="Getting started" description="Five small steps to your first send." />
          <ol className="mt-3 space-y-1.5 px-5 pb-5">
            {steps.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2 text-sm">
                <span
                  className={
                    s.done
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-success-bg text-xs text-success'
                      : 'tabular flex h-5 w-5 items-center justify-center rounded-full bg-surface-sunken text-xs text-ink-muted'
                  }
                  aria-label={s.done ? 'done' : `step ${i + 1}`}
                >
                  {s.done ? '✓' : i + 1}
                </span>
                <span className={s.done ? 'text-ink-muted line-through' : 'text-ink'}>{s.label}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sent today" value={sentToday} icon={<Send size={20} aria-hidden />} hint="Across all accounts" />
        <StatCard
          label="Capacity left"
          value={accounts.length ? `${capacityLeft}/${capacityTotal}` : '—'}
          icon={<Mail size={20} aria-hidden />}
          hint={accounts.length ? 'Sends left today' : 'Connect Gmail to start'}
        />
      </div>

      {staleJobs && (
        <Banner
          tone="warning"
          action={
            <Link href="/dashboard/accounts" className="font-medium underline">
              Check accounts
            </Link>
          }
        >
          Sending hasn&apos;t run in over 15 minutes. Background jobs may be delayed.
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Upcoming sends"
            description="Frozen at schedule time."
            actions={
              <Link href="/dashboard/scheduled">
                <Button size="sm" variant="ghost">View all</Button>
              </Link>
            }
          />
          <ul className="space-y-1 px-3 pb-3 pt-2">
            {upcoming.length === 0 && (
              <li className="px-2 py-3 text-sm text-ink-muted">Nothing scheduled.</li>
            )}
            {upcoming.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-surface-subtle">
                <span className="truncate text-sm text-ink">{u.to_email}</span>
                <span className="tabular shrink-0 text-xs text-ink-muted">
                  {new Date(u.send_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Deliverability health" description="Calm signals, not alarms." />
        <div className="flex flex-wrap gap-2 px-5 pb-5 pt-3">
          <Chip tone={(totals?.bounced ?? 0) > 0 ? 'warning' : 'success'}>
            {totals?.bounced ?? 0} bounced
          </Chip>
          <Chip tone={(totals?.failed ?? 0) > 0 ? 'danger' : 'success'}>
            {totals?.failed ?? 0} failed sends
          </Chip>
          <Chip tone="info">{totals?.pending ?? 0} pending</Chip>
          {insights.length === 0 ? (
            <Chip tone="success">Templates look healthy</Chip>
          ) : (
            insights.map((line, i) => (
              <span key={i} className="w-full text-sm text-warning">
                {line}
              </span>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
