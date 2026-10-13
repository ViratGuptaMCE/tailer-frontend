'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FilePen, Plus, Sparkles } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  AiButton,
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonList,
  StatusChip,
  Tabs,
  Textarea,
} from '@/components/ui'

interface Company {
  id: string
  name: string
  website: string | null
  notes: string | null
}

interface Contact {
  id: string
  company_id: string
  name: string
  position: string | null
  emails: string[]
  timezone: string | null
  status: string
}

interface DraftSummary {
  id: string
  subject: string
  version: number
}

interface ResearchCandidate {
  name: string
  position: string
  source_url: string
  relevance_reason: string
  relevance_score: number
  type: string
}

interface ResearchJob {
  id: string
  status: string
  progress: string | null
  candidates: ResearchCandidate[]
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An error occurred'
}

const TABS = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'research', label: 'Research' },
  { key: 'notes', label: 'Tone & notes' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('contacts')
  const [company, setCompany] = useState<Company | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [drafts, setDrafts] = useState<DraftSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const [cName, setCName] = useState('')
  const [cPosition, setCPosition] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [editingEmail, setEditingEmail] = useState<Record<string, string>>({})

  const [targetTeam, setTargetTeam] = useState('')
  const [sourceUrls, setSourceUrls] = useState('')
  const [job, setJob] = useState<ResearchJob | null>(null)
  const [researching, setResearching] = useState(false)
  const [runningNow, setRunningNow] = useState(false)
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [acceptEmails, setAcceptEmails] = useState<Record<number, string>>({})
  const [toneContact, setToneContact] = useState('')
  const [toneText, setToneText] = useState('')
  const [toneResult, setToneResult] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [c, ct, d] = await Promise.all([
        fetchApi(`/api/v1/companies/${id}`),
        fetchApi(`/api/v1/contacts?company_id=${id}`),
        fetchApi(`/api/v1/drafts?company_id=${id}`),
      ])
      setCompany(c)
      setNotes(c.notes ?? '')
      setContacts(ct.contacts ?? [])
      setDrafts(d.drafts ?? [])
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function initial() {
      try {
        const [c, ct, d] = await Promise.all([
          fetchApi(`/api/v1/companies/${id}`),
          fetchApi(`/api/v1/contacts?company_id=${id}`),
          fetchApi(`/api/v1/drafts?company_id=${id}`),
        ])
        if (cancelled) return
        setCompany(c)
        setNotes(c.notes ?? '')
        setContacts(ct.contacts ?? [])
        setDrafts(d.drafts ?? [])
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
  }, [id])

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetchApi('/api/v1/contacts', {
        method: 'POST',
        body: JSON.stringify({
          company_id: id,
          name: cName,
          position: cPosition || null,
          email: cEmail || null,
        }),
      })
      setCName('')
      setCPosition('')
      setCEmail('')
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleEmailSave = async (contactId: string) => {
    try {
      await fetchApi(`/api/v1/contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({ email: editingEmail[contactId] ?? '' }),
      })
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleNotesSave = async () => {
    try {
      await fetchApi(`/api/v1/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      })
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleNewDraft = async () => {
    const created = await fetchApi('/api/v1/drafts', {
      method: 'POST',
      body: JSON.stringify({ company_id: id, subject: `Outreach – ${company?.name ?? ''}` }),
    })
    router.push(`/dashboard/drafts/${created.id}`)
  }

  const handleResearch = async () => {
    setResearching(true)
    setError(null)
    try {
      const urls = sourceUrls.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
      const created = await fetchApi('/api/v1/research', {
        method: 'POST',
        body: JSON.stringify({ company_id: id, target_team: targetTeam || null, source_urls: urls }),
      })
      setJob(created)
      // Poll until done (5s interval, ~2 min max).
      for (let i = 0; i < 24; i++) {
        if (created.status === 'done') break
        await new Promise((r) => setTimeout(r, 5000))
        try {
          const updated = await fetchApi(`/api/v1/research/${created.id}`)
          setJob(updated)
          if (updated.status === 'done' || updated.status === 'failed') break
        } catch {
          break
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setResearching(false)
    }
  }

  const handleRefreshJob = async () => {
    if (!job) return
    try {
      const updated = await fetchApi(`/api/v1/research/${job.id}`)
      setJob(updated)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleRunNow = async () => {
    if (!job || runningNow) return
    setRunningNow(true)
    setError(null)
    try {
      const updated = await fetchApi(`/api/v1/research/${job.id}/run`, {
        method: 'POST',
      })
      setJob(updated)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setRunningNow(false)
    }
  }

  const handleAccept = async () => {
    if (!job) return
    try {
      const selections = job.candidates
        .map((c, i) => ({ c, i }))
        .filter(({ i }) => selected[i])
        .map(({ c, i }) => ({ ...c, email: acceptEmails[i] || null }))
      if (!selections.length) {
        setError('Select at least one candidate to save.')
        return
      }
      const result = await fetchApi(`/api/v1/research/${job.id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ selections }),
      })
      setError(null)
      setSelected({})
      setAcceptEmails({})
      await refresh()
      setJob({ ...job, progress: `Saved ${result.count ?? selections.length} contacts` })
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleToneAnalyze = async () => {
    if (!toneContact) {
      setError('Pick a contact for tone analysis.')
      return
    }
    try {
      const data = await fetchApi(`/api/v1/contacts/${toneContact}/tone`, {
        method: 'POST',
        body: JSON.stringify({ texts: toneText ? [toneText] : [] }),
      })
      setToneResult(JSON.stringify(data.tone_profile, null, 2))
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <Card><SkeletonList rows={6} /></Card>
    )
  }
  if (!company) return <Banner tone="danger">{error ?? 'Company not found.'}</Banner>

  return (
    <div className="space-y-6">
      <Link href="/dashboard/companies" className="flex items-center gap-1 text-sm text-ink-secondary hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Companies
      </Link>
      <PageHeader
        title={company.name}
        subtitle={company.website ?? undefined}
        actions={<Button variant="primary" onClick={handleNewDraft}><Plus size={16} aria-hidden /> New draft</Button>}
      />
      {error && <Banner tone="danger">{error}</Banner>}

      <div className="flex items-center gap-3">
        <Avatar name={company.name} size={44} />
        <div className="flex gap-2">
          <Chip tone="info">{contacts.length} contacts</Chip>
          <Chip tone="neutral">{drafts.length} drafts</Chip>
        </div>
      </div>

      <Card className="px-5 pt-2">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        {tab === 'contacts' && (
          <div className="py-4">
            <form onSubmit={handleAddContact} className="flex flex-wrap items-end gap-2">
              <div className="min-w-36 flex-1">
                <Field label="Name"><Input placeholder="Jane Recruiter" value={cName} onChange={(e) => setCName(e.target.value)} required /></Field>
              </div>
              <div className="min-w-36 flex-1">
                <Field label="Position"><Input placeholder="Engineering Manager" value={cPosition} onChange={(e) => setCPosition(e.target.value)} /></Field>
              </div>
              <div className="min-w-36 flex-1">
                <Field label="Emails" hint="Separate several with commas"><Input placeholder="jane@acme.com" type="text" value={cEmail} onChange={(e) => setCEmail(e.target.value)} /></Field>
              </div>
              <Button type="submit" variant="primary"><Plus size={16} aria-hidden /> Add</Button>
            </form>
            {contacts.length === 0 ? (
              <EmptyState
                icon={<Avatar name="?" size={48} />}
                title="No contacts yet"
                body="Add people manually, or switch to the Research tab and let AI find them."
              />
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                      <tr className="bg-surface-subtle text-left text-[13px] font-medium text-ink-secondary">
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Position</th>
                        <th className="px-3 py-2 font-medium">Emails</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {contacts.map((c) => (
                      <tr key={c.id} className="h-12 transition-colors hover:bg-surface-subtle">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2 font-medium text-ink">
                            <Avatar name={c.name} size={24} /> {c.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-ink-secondary">{c.position ?? <span className="text-ink-disabled">—</span>}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1">
                            <Input
                              className="h-8 w-56 text-[13px]"
                              placeholder="Add emails, comma-separated"
                              defaultValue={(c.emails ?? []).join(', ')}
                              aria-label={`Emails for ${c.name}`}
                              onChange={(e) => setEditingEmail((prev) => ({ ...prev, [c.id]: e.target.value }))}
                            />
                            <Button size="sm" variant="ghost" onClick={() => handleEmailSave(c.id)}>Save</Button>
                          </span>
                        </td>
                        <td className="px-3 py-2"><StatusChip status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'drafts' && (
          <div className="py-4">
            {drafts.length === 0 ? (
              <EmptyState
                icon={<FilePen size={24} aria-hidden />}
                title={`No drafts for ${company.name} yet`}
                body="Start from a template or ask AI to draft one."
                action={<Button variant="primary" onClick={handleNewDraft}>New draft</Button>}
              />
            ) : (
              <ul className="divide-y divide-line">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <Link href={`/dashboard/drafts/${d.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-2.5 hover:bg-surface-subtle">
                      <span className="truncate text-sm font-medium text-ink">{d.subject || '(untitled)'}</span>
                      <span className="tabular shrink-0 text-xs text-ink-muted">v{d.version}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'research' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-ink-secondary">
              Finds public points of contact — recruiters, hiring managers, team leads. Emails are never guessed; you add them before scheduling.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-40">
                <Field label="Target team (optional)"><Input placeholder="Engineering" value={targetTeam} onChange={(e) => setTargetTeam(e.target.value)} /></Field>
              </div>
              <div className="min-w-52 flex-1">
                <Field label="Extra source URLs (optional)"><Input placeholder="https://…, comma separated" value={sourceUrls} onChange={(e) => setSourceUrls(e.target.value)} /></Field>
              </div>
              <AiButton loading={researching} onClick={handleResearch}>Find contacts</AiButton>
              {job && <Button variant="ghost" onClick={handleRefreshJob}>Refresh status</Button>}
              {job && (job.status === 'pending' || job.status === 'running') && (
                <Button
                  variant="ghost"
                  onClick={() => void handleRunNow()}
                  loading={runningNow}
                  title="Run this job right now in this request instead of waiting for the background runner"
                >
                  Run now
                </Button>
              )}
            </div>
            {job && (
              <div className="text-sm">
                <p className="text-ink-secondary">
                  Status: <StatusChip status={job.status === 'done' ? 'sent' : job.status === 'failed' ? 'failed' : 'pending'} label={job.status} />
                  {job.progress && <span className="ml-2 text-ink-muted">{job.progress}</span>}
                </p>
                {job.candidates.length > 0 ? (
                  <>
                    <div className="mt-2 overflow-x-auto rounded-lg border border-line">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-surface-subtle text-left text-[13px] font-medium text-ink-secondary">
                            <th className="px-3 py-2 font-medium">Save</th>
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium">Position</th>
                            <th className="px-3 py-2 font-medium">Why relevant</th>
                              <th className="px-3 py-2 font-medium">Emails (you add, comma-separated)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {job.candidates.map((c, i) => (
                            <tr key={`${c.name}-${i}`} className="h-12 hover:bg-surface-subtle">
                              <td className="px-3 py-2">
                                <input type="checkbox" checked={selected[i] ?? false} onChange={(e) => setSelected((prev) => ({ ...prev, [i]: e.target.checked }))} aria-label={`Save ${c.name}`} className="h-4 w-4 accent-brand-600" />
                              </td>
                              <td className="px-3 py-2 font-medium text-ink">
                                {c.name}
                                {c.source_url && (
                                  <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-xs font-normal text-brand-600 hover:text-brand-700">
                                    source
                                  </a>
                                )}
                              </td>
                              <td className="px-3 py-2 text-ink-secondary">{c.position || '—'}</td>
                              <td className="max-w-xs truncate px-3 py-2 text-ink-secondary" title={c.relevance_reason}>{c.relevance_reason || '—'}</td>
                              <td className="px-3 py-2">
                                <Input className="h-8 w-40 text-[13px]" placeholder="email" type="email" value={acceptEmails[i] ?? ''} aria-label={`Email for ${c.name}`} onChange={(e) => setAcceptEmails((prev) => ({ ...prev, [i]: e.target.value }))} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button variant="primary" size="sm" onClick={handleAccept} className="mt-2">Save selected as contacts</Button>
                  </>
                ) : (
                  job.status === 'done' && <p className="mt-2 text-sm text-ink-muted">No verified contacts found in the sources.</p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'notes' && (
          <div className="grid grid-cols-1 gap-4 py-4 lg:grid-cols-2">
            <div>
              <Field label="Company notes">
                <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context the AI should know: products, tech, recent news…" />
              </Field>
              <Button size="sm" onClick={handleNotesSave} className="mt-2">Save notes</Button>
            </div>
            <div>
              <p className="mb-1 text-[13px] font-medium text-ink-secondary">
                Tone profiling <span className="font-normal text-ink-muted">— style only, never identity</span>
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-36 flex-1">
                  <Select value={toneContact} onChange={(e) => setToneContact(e.target.value)} className="w-full" aria-label="Contact for tone analysis">
                    <option value="">Pick contact…</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>
                <Button size="sm" onClick={handleToneAnalyze}><Sparkles size={16} aria-hidden /> Analyze tone</Button>
              </div>
              <Input className="mt-2" placeholder="Paste a sample of their writing (optional)" value={toneText} onChange={(e) => setToneText(e.target.value)} aria-label="Writing sample" />
              {toneResult && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-surface-subtle p-3 font-mono text-xs text-ink-secondary">{toneResult}</pre>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
