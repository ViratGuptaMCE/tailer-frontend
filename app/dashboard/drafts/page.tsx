'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Copy, FilePen, Plus, Search, Send, Trash2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Banner, Button, Card, EmptyState, Input, PageHeader, Select, SkeletonList, cx } from '@/components/ui'

interface DraftSummary {
  id: string
  company_id: string | null
  contact_id: string | null
  mail_account_id: string | null
  resume_id: string | null
  subject: string
  version: number
}

interface Company {
  id: string
  name: string
}

interface Contact {
  id: string
  name: string
}

interface Template {
  id: string
  name: string
}

interface Finding {
  rule_id: string
  severity: 'block' | 'warn' | 'info'
  message: string
  suggestion: string
}

interface SendResult {
  status: 'ok' | 'queued' | 'error'
  message: string
  findings?: Finding[]
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An error occurred'
}

function getErrorDetails(err: unknown): unknown {
  return err instanceof Error && 'details' in err ? (err as Error & { details?: unknown }).details : null
}

const FINDING_TONE = {
  block: 'text-danger',
  warn: 'text-warning',
  info: 'text-ink-muted',
} as const

const FINDING_DOT = {
  block: 'bg-danger',
  warn: 'bg-warning',
  info: 'bg-info',
} as const

export default function DraftsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [drafts, setDrafts] = useState<DraftSummary[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [companyId, setCompanyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<Record<string, boolean>>({})
  const [sendResults, setSendResults] = useState<Record<string, SendResult>>({})

  const loadDrafts = async (query: string, comp: string) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (comp) params.set('company_id', comp)
    const data = await fetchApi(`/api/v1/drafts?${params.toString()}`)
    setDrafts(data.drafts ?? [])
  }

  useEffect(() => {
    let cancelled = false
    async function initial() {
      try {
        const params = new URLSearchParams()
        const initialQ = searchParams.get('q') ?? ''
        if (initialQ) params.set('q', initialQ)
        const [d, c, ct, t] = await Promise.all([
          fetchApi(`/api/v1/drafts?${params.toString()}`),
          fetchApi('/api/v1/companies'),
          fetchApi('/api/v1/contacts'),
          fetchApi('/api/v1/templates'),
        ])
        if (cancelled) return
        setDrafts(d.drafts ?? [])
        setCompanies(c.companies ?? [])
        setContacts(ct.contacts ?? [])
        setTemplates(t.templates ?? [])
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await loadDrafts(q, companyId)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleSeed = async () => {
    try {
      await fetchApi('/api/v1/templates/seed-presets', { method: 'POST' })
      const t = await fetchApi('/api/v1/templates')
      setTemplates(t.templates ?? [])
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleNew = async (templateId: string) => {
    const created = await fetchApi('/api/v1/drafts', {
      method: 'POST',
      body: JSON.stringify({
        company_id: companyId || null,
        template_id: templateId || null,
        subject: '',
        body_text: '',
      }),
    })
    router.push(`/dashboard/drafts/${created.id}`)
  }

  const handleDuplicate = async (id: string) => {
    const copy = await fetchApi(`/api/v1/drafts/${id}/duplicate`, { method: 'POST' })
    router.push(`/dashboard/drafts/${copy.id}`)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this draft?')) return
    await fetchApi(`/api/v1/drafts/${id}`, { method: 'DELETE' })
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  // Immediate send: passes the deliverability gate, sends through the same
  // dispatcher (caps/gaps apply). On blocks the findings show inline to fix.
  const handleSendNow = async (d: DraftSummary) => {
    if (sending[d.id]) return
    setSending((prev) => ({ ...prev, [d.id]: true }))
    try {
      const data = await fetchApi(`/api/v1/drafts/${d.id}/send-now`, {
        method: 'POST',
        body: JSON.stringify({
          contact_id: d.contact_id,
          mail_account_id: d.mail_account_id,
          resume_id: d.resume_id,
        }),
      })
      const rows = (data.scheduled ?? []) as {
        status: string
        send_at: string | null
        error: string | null
        to_email: string
      }[]
      const sent = rows.filter((r) => r.status === 'sent')
      const queued = rows.filter((r) => r.status === 'pending')
      const failed = rows.filter((r) => r.status !== 'sent' && r.status !== 'pending')
      if (sent.length === rows.length && rows.length > 0) {
        // Sent drafts move out of the working list.
        setDrafts((prev) => prev.filter((x) => x.id !== d.id))
        setSendResults((prev) => ({
          ...prev,
          [d.id]: {
            status: 'ok',
            message:
              `Sent now to ${sent.length} address${sent.length === 1 ? '' : 'es'} · ` +
              `score ${data.deliverability_score ?? '—'}/100 — moved out of drafts.`,
          },
        }))
      } else if (queued.length > 0 && failed.length === 0) {
        const first = queued
          .map((r) => (r.send_at ? new Date(r.send_at).getTime() : Number.NaN))
          .filter((t) => !Number.isNaN(t))
          .sort((a, b) => a - b)[0]
        setSendResults((prev) => ({
          ...prev,
          [d.id]: {
            status: 'queued',
            message:
              `Queued ${queued.length} email${queued.length === 1 ? '' : 's'}` +
              (first !== undefined
                ? ` — first sends at ${new Date(first).toLocaleString()} (recent send gap or account busy).`
                : ' (recent send gap or account busy).'),
          },
        }))
      } else {
        const problems = [...queued, ...failed]
          .map((r) => `${r.to_email}: ${r.error ?? r.status}`)
          .join('; ')
        setSendResults((prev) => ({
          ...prev,
          [d.id]: {
            status: 'error',
            message: `${sent.length} sent${problems ? `; ${problems}` : ''}`.trim(),
          },
        }))
      }
    } catch (err: unknown) {
      const details = getErrorDetails(err) as
        | { detail?: { message?: string; score?: number; findings?: Finding[] } }
        | null
      const detail = details?.detail
      if (detail && Array.isArray(detail.findings)) {
        setSendResults((prev) => ({
          ...prev,
          [d.id]: {
            status: 'error',
            message: `${detail.message ?? 'Blocked by deliverability'} (score ${detail.score ?? '—'}/100). Fix these, then send again:`,
            findings: detail.findings,
          },
        }))
      } else {
        setSendResults((prev) => ({
          ...prev,
          [d.id]: { status: 'error', message: getErrorMessage(err) },
        }))
      }
    } finally {
      setSending((prev) => ({ ...prev, [d.id]: false }))
    }
  }

  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name
  const contactName = (id: string | null) => contacts.find((c) => c.id === id)?.name
  const displayName = (d: DraftSummary) =>
    `${companyName(d.company_id) || 'unknown'}_${contactName(d.contact_id) || 'unknown'}`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drafts"
        subtitle="Every email starts here, filed by company."
        actions={<Button variant="primary" onClick={() => handleNew('')}><Plus size={16} aria-hidden /> New draft</Button>}
      />
      {error && <Banner tone="danger">{error}</Banner>}

      <Card className="p-5">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
          <div className="relative min-w-40 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input className="pl-9" placeholder="Search subject or body" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search drafts" />
          </div>
          <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Filter by company">
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button type="submit">Search</Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-[13px] text-ink-secondary">Start from a template:</span>
          {templates.map((t) => (
            <Button key={t.id} size="sm" variant="soft" onClick={() => handleNew(t.id)}>
              {t.name}
            </Button>
          ))}
          <button onClick={handleSeed} className="ml-auto text-sm font-medium text-brand-600 hover:text-brand-700">
            Seed presets
          </button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <SkeletonList rows={5} />
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={<FilePen size={24} aria-hidden />}
            title="No drafts yet"
            body="Start from a template above, or ask the AI assistant to draft one for a company."
            action={<Button variant="primary" onClick={() => handleNew('')}>New draft</Button>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {drafts.map((d) => {
              const result = sendResults[d.id]
              return (
                <li key={d.id} className="px-5 py-3 transition-colors hover:bg-surface-subtle">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/dashboard/drafts/${d.id}`} className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {displayName(d)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {d.subject || '(no subject)'}
                      </span>
                    </Link>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleSendNow(d)}
                        loading={sending[d.id]}
                        title="Send this draft now — must pass the deliverability checks"
                      >
                        <Send size={16} aria-hidden /> Send
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDuplicate(d.id)} title="Duplicate draft" aria-label={`Duplicate ${displayName(d)}`}>
                        <Copy size={16} aria-hidden />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id)} title="Delete draft" aria-label={`Delete ${displayName(d)}`} className="hover:text-danger">
                        <Trash2 size={16} aria-hidden />
                      </Button>
                    </div>
                  </div>
                  {result && (
                    <div className="mt-2 text-sm" role="status">
                      <p
                        className={cx(
                          result.status === 'ok' && 'text-success',
                          result.status === 'queued' && 'text-warning',
                          result.status === 'error' && 'text-danger',
                        )}
                      >
                        {result.message}
                      </p>
                      {result.findings && result.findings.length > 0 && (
                        <ul className="mt-1.5 space-y-1.5">
                          {result.findings.map((f, i) => (
                            <li key={`${f.rule_id}-${i}`} className="flex gap-2 text-sm">
                              <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', FINDING_DOT[f.severity])} aria-hidden />
                              <span>
                                <span className={cx('font-medium', FINDING_TONE[f.severity])}>{f.message}</span>
                                {f.suggestion && (
                                  <span className="block text-[13px] text-ink-muted">Fix: {f.suggestion}</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
