'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, Paperclip, PlayCircle } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Banner, Button, Card, EmptyState, Input, PageHeader, SkeletonList, StatusChip, Tabs } from '@/components/ui'

interface ScheduledItem {
  id: string
  draft_id: string
  to_email: string
  send_at: string
  status: string
  attempts: number
  rendered_subject: string
  rendered_text: string
  attachment_name: string | null
  error: string | null
  sent_at: string | null
}

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'sent', label: 'Sent' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const

type TabKey = (typeof TABS)[number]['key']

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An error occurred'
}

const EMPTY_COPY: Record<TabKey, { title: string; body: string }> = {
  pending: { title: 'Nothing waiting to send', body: 'Scheduled emails appear here, frozen at schedule time.' },
  sent: { title: 'No sent mail yet', body: 'Delivered outreach lands here with its timestamp.' },
  failed: { title: 'No failures', body: 'Sends that could not be delivered would show up here.' },
  cancelled: { title: 'Nothing cancelled', body: 'Cancelled sends are kept here for reference.' },
}

export default function ScheduledPage() {
  const [tab, setTab] = useState<TabKey>('pending')
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [newTime, setNewTime] = useState('')
  const [processing, setProcessing] = useState(false)
  const [processMsg, setProcessMsg] = useState<string | null>(null)
  const [processorStale, setProcessorStale] = useState<boolean | null>(null)

  const load = async (status: string) => {
    setLoading(true)
    try {
      const data = await fetchApi(`/api/v1/scheduled?status=${status}`)
      setItems(data.scheduled ?? [])
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function initial() {
      try {
        const data = await fetchApi('/api/v1/scheduled?status=pending')
        if (!cancelled) setItems(data.scheduled ?? [])
        // Processor heartbeat: stale (>15 min) means the QStash cron isn't
        // reaching the API — pending rows would never wake otherwise.
        try {
          const beats = await fetchApi('/api/v1/ops/heartbeats')
          if (!cancelled) setProcessorStale(Boolean(beats?.send?.stale))
        } catch {
          // Non-fatal.
        }
      } catch (err: unknown) {
        if (!cancelled) setError(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initial()
    return () => {
      cancelled = true
    }
  }, [])

  const switchTab = (t: TabKey) => {
    setTab(t)
    setPreviewId(null)
    void load(t)
  }

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this send?')) return
    try {
      await fetchApi(`/api/v1/scheduled/${id}/cancel`, { method: 'POST' })
      await load(tab)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleReschedule = async (id: string) => {
    if (!newTime) return
    try {
      await fetchApi(`/api/v1/scheduled/${id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ send_at: new Date(newTime).toISOString() }),
      })
      setNewTime('')
      await load(tab)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  // Wake the dispatcher manually — same tick QStash runs every 5 minutes.
  // Works in local dev (ENV=dev bypass); in prod the endpoint is
  // signature-protected and the cron handles it automatically.
  const handleProcessNow = async () => {
    if (processing) return
    setProcessing(true)
    setProcessMsg(null)
    try {
      const result = await fetchApi('/internal/tick/send', { method: 'POST' })
      setProcessMsg(
        `Processed — ${result.sent ?? 0} sent, ${result.cancelled ?? 0} cancelled, ` +
          `${result.failed ?? 0} failed, ${result.requeued ?? 0} requeued.`,
      )
      setProcessorStale(false)
    } catch (err: unknown) {
      setProcessMsg(
        `${getErrorMessage(err)} — the queue processes automatically every ~5 min in production.`,
      )
    } finally {
      setProcessing(false)
      await load(tab)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled & sent"
        subtitle="Every send, frozen at schedule time."
        actions={
          <Button variant="secondary" onClick={() => void handleProcessNow()} loading={processing}>
            <PlayCircle size={16} aria-hidden /> Process queue now
          </Button>
        }
      />
      {error && <Banner tone="danger">{error}</Banner>}
      {processMsg && <Banner tone="info">{processMsg}</Banner>}
      {processorStale && items.length > 0 && tab === 'pending' && (
        <Banner tone="warning">
          The send processor hasn&apos;t run in over 15 minutes — pending emails stay queued
          until it wakes. Use “Process queue now”, or set up the QStash cron for automatic runs.
        </Banner>
      )}

      <Card className="px-5 pt-2">
        <Tabs tabs={TABS} value={tab} onChange={switchTab} />
        {loading ? (
          <SkeletonList rows={4} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={24} aria-hidden />}
            title={EMPTY_COPY[tab].title}
            body={EMPTY_COPY[tab].body}
          />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{item.rendered_subject}</div>
                    <div className="tabular mt-0.5 text-xs text-ink-muted">
                      To {item.to_email} · {new Date(item.send_at).toLocaleString()}
                      {item.status === 'pending' && ' · frozen at schedule time'}
                    </div>
                  </div>
                  <StatusChip status={item.status} />
                </div>
                {item.error && (
                  <p className="mt-1 text-xs text-danger">{item.error}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setPreviewId(previewId === item.id ? null : item.id)}>
                    {previewId === item.id ? 'Hide preview' : 'Preview frozen content'}
                  </Button>
                  {tab === 'pending' && (
                    <>
                      <Button size="sm" variant="danger" onClick={() => handleCancel(item.id)}>
                        Cancel send
                      </Button>
                      <Input
                        type="datetime-local"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="w-auto text-xs"
                        aria-label="New send time"
                      />
                      <Button size="sm" onClick={() => handleReschedule(item.id)}>
                        Reschedule
                      </Button>
                    </>
                  )}
                </div>
                {previewId === item.id && (
                  <div className="animate-fade-up mt-2 rounded-lg border border-line bg-surface-subtle p-4 text-sm whitespace-pre-wrap text-ink">
                    {item.rendered_text}
                    {item.attachment_name && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-ink-muted">
                        <Paperclip size={14} aria-hidden /> {item.attachment_name}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
