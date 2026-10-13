'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CalendarClock, CopyPlus, Eye, Save, Send } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Banner,
  Button,
  CapacityBar,
  Card,
  Field,
  Input,
  Modal,
  ScoreRing,
  Select,
  Skeleton,
  cx,
} from '@/components/ui'

interface Draft {
  id: string
  company_id: string | null
  contact_id: string | null
  subject: string
  body_text: string
  body_html: string | null
  role_applying: string | null
  application_type: string | null
  resume_id: string | null
  mail_account_id: string | null
  version: number
  archived_at: string | null
  variables: string[]
}

interface Company {
  id: string
  name: string
}

interface Contact {
  id: string
  name: string
  position: string | null
  emails: string[]
  source_url: string | null
}

interface MailAccount {
  id: string
  label: string
  effective_cap: number
}

interface ResumeOption {
  id: string
  label: string
}

interface Finding {
  rule_id: string
  severity: 'block' | 'warn' | 'info'
  message: string
  suggestion: string
}

interface CheckResult {
  score: number
  blocked: boolean
  findings: Finding[]
}

interface Preview {
  subject: string
  body_text: string
  body_html: string | null
  unresolved_subject: string[]
  unresolved_body: string[]
  variables: string[]
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An error occurred'
}

const HOUSE_RULES =
  'House rules (always apply): keep the mail short and crisp. ' +
  'Do not include any LinkedIn, portfolio, or GitHub links. ' +
  "If providing an HTML response, make it colorful and customized to the theme of the company's website."

interface SuggestedPrompt {
  key: string
  label: string
  text: string
  mode?: 'text' | 'html'
  setRole?: string
  setApplied?: boolean
}

interface AssistOverride {
  text?: string
  mode?: 'text' | 'html'
  role?: string
  applied?: boolean
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    key: 'intern-fte',
    label: 'Intern / FTE cold mail',
    text: 'Write a cold mail for any Intern or FTE role matching my resume.',
  },
  {
    key: 'sde-intern',
    label: 'SDE Intern cold mail',
    text: 'Write a cold mail for an SDE Intern position.',
    setRole: 'SDE Intern',
  },
  {
    key: 'sde-1',
    label: 'SDE-1 cold mail',
    text: 'Write a cold mail for an SDE-1 position.',
    setRole: 'SDE-1',
  },
  {
    key: 'creative-style',
    label: 'Creative · company style',
    text: "Write a creative mail that adapts this company's working manner and culture in its words and styling.",
    mode: 'html',
  },
  {
    key: 'applied-role',
    label: 'Applied role follow-up',
    text: 'Write a mail asking for consideration for the applied role.',
    setApplied: true,
  },
]

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

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-line bg-surface">
      <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between">
          {title}
          <span className="text-ink-muted transition-transform group-open:rotate-180" aria-hidden>▾</span>
        </span>
      </summary>
      <div className="border-t border-line px-5 py-4">{children}</div>
    </details>
  )
}

export default function DraftEditorPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id
  const [draft, setDraft] = useState<Draft | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [caps, setCaps] = useState<Record<string, { remaining: number | null; effective_cap: number }>>({})
  const [resumes, setResumes] = useState<ResumeOption[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [check, setCheck] = useState<CheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [sendMode, setSendMode] = useState<'now' | 'slot' | 'custom'>('slot')
  const [sendFormat, setSendFormat] = useState<'text' | 'html'>('html')
  const [customTime, setCustomTime] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState('Saved')
  const [mode, setMode] = useState<'text' | 'html'>('text')

  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [role, setRole] = useState('')
  const [previewContact, setPreviewContact] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [applied, setApplied] = useState(false)
  const [jobId, setJobId] = useState('')
  const [assistMode, setAssistMode] = useState<'text' | 'html'>('text')
  const [assistInput, setAssistInput] = useState('')
  const [assistBusy, setAssistBusy] = useState(false)
  const [assistMsgs, setAssistMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [contactEmail, setContactEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [contactEmailMsg, setContactEmailMsg] = useState<string | null>(null)

  const draftRef = useRef<Draft | null>(null)
  const fieldsRef = useRef({ subject: '', bodyText: '', bodyHtml: '', role: '', mode: 'text' as 'text' | 'html' })

  useEffect(() => {
    fieldsRef.current = { subject, bodyText, bodyHtml, role, mode }
  })

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const adoptHead = useCallback(async () => {
    try {
      const d = await fetchApi(`/api/v1/drafts/${id}`)
      setDraft(d)
      setSubject(d.subject ?? '')
      setBodyText(d.body_text ?? '')
      setBodyHtml(d.body_html ?? '')
      setRole(d.role_applying ?? '')
      setMode(d.body_html ? 'html' : 'text')
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function initial() {
      try {
        const [d, c, a, r] = await Promise.all([
          fetchApi(`/api/v1/drafts/${id}`),
          fetchApi('/api/v1/companies'),
          fetchApi('/api/v1/mail-accounts'),
          fetchApi('/api/v1/resumes'),
        ])
        const ct = d.company_id
          ? await fetchApi(`/api/v1/contacts?company_id=${d.company_id}`)
          : await fetchApi('/api/v1/contacts')
        if (cancelled) return
        setDraft(d)
        setSubject(d.subject ?? '')
        setBodyText(d.body_text ?? '')
        setBodyHtml(d.body_html ?? '')
        setRole(d.role_applying ?? '')
        setMode(d.body_html ? 'html' : 'text')
        setCompanies(c.companies ?? [])
        setContacts(ct.contacts ?? [])
        setAccounts(a.accounts ?? [])
        setResumes((r.resumes ?? []).map((x: { id: string; label: string }) => ({ id: x.id, label: x.label })))
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

  useEffect(() => {
    let cancelled = false
    async function loadCaps() {
      try {
        const data = await fetchApi('/api/v1/dashboard/summary')
        if (cancelled) return
        const map: Record<string, { remaining: number | null; effective_cap: number }> = {}
        for (const a of data.accounts ?? []) {
          if (a.label) map[a.label] = { remaining: a.remaining ?? null, effective_cap: a.effective_cap ?? 0 }
        }
        setCaps(map)
      } catch {
        // Non-fatal: caps just won't show remaining counts.
      }
    }
    void loadCaps()
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(
    async () => {
      const current = draftRef.current
      if (!current) return
      setSaveState('Saving…')
      try {
        const updated = await fetchApi(`/api/v1/drafts/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            version: current.version,
            subject,
            body_text: bodyText,
            body_html: mode === 'html' ? bodyHtml || null : null,
            role_applying: role || null,
            contact_id: current.contact_id,
            company_id: current.company_id,
            mail_account_id: current.mail_account_id,
          }),
        })
        setDraft(updated)
        setSaveState('Saved')
      } catch (err: unknown) {
        const msg = getErrorMessage(err)
        setSaveState('Error')
        setError(msg.includes('Version conflict') ? `${msg} Reload to get v-latest.` : msg)
      }
    },
    [id, subject, bodyText, bodyHtml, mode, role],
  )

  // No autosave — the user saves explicitly. Unsaved changes are flagged
  // in the header, warned on tab close, and persisted before scheduling
  // (the scheduler freezes the DB head, not the editor boxes).
  const dirty =
    draft != null &&
    (subject !== (draft.subject ?? '') ||
      bodyText !== (draft.body_text ?? '') ||
      (mode === 'html' ? bodyHtml || null : null) !== (draft.body_html ?? null) ||
      role !== (draft.role_applying ?? ''))

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const persistIfDirty = useCallback(async () => {
    if (dirty) await persist()
  }, [dirty, persist])

  const handlePreview = async () => {
    try {
      const data = await fetchApi(`/api/v1/drafts/${id}/preview`, {
        method: 'POST',
        body: JSON.stringify({ contact_id: previewContact || null }),
      })
      setPreview(data)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleCompanyChange = async (companyId: string) => {
    const current = draftRef.current
    if (!current) return
    try {
      const updated = await fetchApi(`/api/v1/drafts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          version: current.version,
          company_id: companyId || null,
        }),
      })
      setDraft(updated)
      const ct = companyId
        ? await fetchApi(`/api/v1/contacts?company_id=${companyId}`)
        : await fetchApi('/api/v1/contacts')
      setContacts(ct.contacts ?? [])
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleLinkChange = async (field: 'mail_account_id' | 'resume_id', value: string) => {
    const current = draftRef.current
    if (!current) return
    try {
      const updated = await fetchApi(`/api/v1/drafts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          version: current.version,
          [field]: value || null,
        }),
      })
      setDraft(updated)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleCheck = async () => {
    setChecking(true)
    setError(null)
    try {
      const data = await fetchApi(`/api/v1/drafts/${id}/deliverability-check`, {
        method: 'POST',
        body: JSON.stringify({
          contact_id: previewContact || null,
          mail_account_id: draftRef.current?.mail_account_id ?? null,
          resume_id: draftRef.current?.resume_id ?? null,
        }),
      })
      setCheck(data)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setChecking(false)
    }
  }

  // Draft Studio assistant: one call -> research (person + company), then a
  // versioned AI write on the open draft. Current editor state of both
  // bodies travels with every request. House rules are appended to every
  // send from this panel (chips and typed text alike).
  const sendAssist = async (override?: AssistOverride) => {
    const base = (override?.text ?? assistInput).trim()
    if (!base) return
    const instruction = `${base}\n\n${HOUSE_RULES}`
    const mode = override?.mode ?? assistMode
    const effRole = (override?.role ?? role).trim() || null
    const effApplied = override?.applied ?? applied
    const current = draftRef.current
    if (!instruction || assistBusy || !current) return
    setAssistBusy(true)
    setAssistMsgs((prev) => [...prev, { role: 'user', text: base }])
    setAssistInput('')
    const f = fieldsRef.current
    try {
      const data = await fetchApi(`/api/v1/drafts/${id}/assist`, {
        method: 'POST',
        body: JSON.stringify({
          mode,
          instruction,
          company_id: current.company_id,
          contact_id: previewContact || current.contact_id,
          linkedin_url: linkedinUrl.trim() || null,
          role: effRole,
          applied: effApplied,
          job_id: effApplied ? jobId.trim() || null : null,
          resume_id: current.resume_id,
          current_text: f.bodyText,
          current_html: f.mode === 'html' ? f.bodyHtml || null : current.body_html ?? null,
        }),
      })
      const used = data.coverage?.used?.join(', ') || 'nothing'
      const missing = data.coverage?.missing?.join(', ')
      setAssistMsgs((prev) => [
        ...prev,
        {
          role: 'ai',
          text:
            `Drafted as v${data.version} (score ${data.deliverability?.score ?? '—'}/100). ` +
            `Researched: ${used}${missing ? ` · Missing: ${missing}` : ''}`,
        },
      ])
      await adoptHead()
    } catch (err: unknown) {
      setAssistMsgs((prev) => [...prev, { role: 'ai', text: getErrorMessage(err) }])
    } finally {
      setAssistBusy(false)
    }
  }

  const handleChipClick = (chip: SuggestedPrompt) => {
    if (assistBusy) return
    if (chip.setRole !== undefined) setRole(chip.setRole)
    if (chip.setApplied !== undefined) setApplied(chip.setApplied)
    if (chip.mode) setAssistMode(chip.mode)
    let text = chip.text
    if (chip.key === 'applied-role') {
      const jid = jobId.trim()
      text += jid
        ? ` (Job ID: ${jid}).`
        : ' (the Job ID is missing from the brief — ask me for it instead of inventing one).'
    }
    void sendAssist({
      text,
      mode: chip.mode,
      role: chip.setRole,
      applied: chip.setApplied,
    })
  }

  const handlePersonChange = (contactId: string) => {
    setPreviewContact(contactId)
    const c = contacts.find((x) => x.id === contactId)
    if (c?.source_url && !linkedinUrl.trim()) setLinkedinUrl(c.source_url)
    setContactEmail((c?.emails ?? []).join(', '))
    setContactEmailMsg(null)
  }

  // Save the picked contact's emails inline (comma-separated), then re-check.
  const saveContactEmail = async () => {
    const cid = previewContact
    if (!cid || savingEmail) return
    setSavingEmail(true)
    setContactEmailMsg(null)
    try {
      const updated = await fetchApi(`/api/v1/contacts/${cid}`, {
        method: 'PATCH',
        body: JSON.stringify({ email: contactEmail.trim() }),
      })
      setContacts((prev) =>
        prev.map((c) => (c.id === cid ? { ...c, emails: updated.emails ?? [] } : c)),
      )
      setContactEmailMsg(null)
      await handleCheck()
    } catch (err: unknown) {
      setContactEmailMsg(getErrorMessage(err))
    } finally {
      setSavingEmail(false)
    }
  }

  // Save as a New Draft: duplicate the current content, then open the copy.
  const saveAsNew = async () => {
    if (!draftRef.current) return
    await persist()
    try {
      const copy = await fetchApi(`/api/v1/drafts/${id}/duplicate`, { method: 'POST' })
      router.push(`/dashboard/drafts/${copy.id}`)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Skeleton className="h-[480px] rounded-xl" />
        <Skeleton className="h-[480px] rounded-lg" />
      </div>
    )
  }
  if (!draft) return <Banner tone="danger">{error ?? 'Draft not found.'}</Banner>

  const openSchedule = async (mode: 'now' | 'slot' | 'custom' = 'slot') => {
    // Persist first: the scheduler freezes the DB head, not the editor boxes.
    await persistIfDirty()
    setSendMode(mode)
    setShowSchedule(true)
    setScheduleMsg(null)
    setSendFormat(draftRef.current?.body_html ? 'html' : 'text')
    await handleCheck()
  }

  const confirmSchedule = async () => {
    setScheduling(true)
    setScheduleMsg(null)
    try {
      await persistIfDirty()
      const base = {
        contact_id: previewContact || draft.contact_id,
        mail_account_id: draft.mail_account_id,
        resume_id: draft.resume_id,
        format: sendFormat,
      }
      const data =
        sendMode === 'now'
          ? await fetchApi(`/api/v1/drafts/${id}/send-now`, {
              method: 'POST',
              body: JSON.stringify(base),
            })
          : await fetchApi(`/api/v1/drafts/${id}/schedule`, {
              method: 'POST',
              body: JSON.stringify({
                ...base,
                send_at:
                  sendMode === 'slot'
                    ? 'next_safe_slot'
                    : new Date(customTime).toISOString(),
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
      if (sendMode === 'now') {
        if (sent.length === rows.length && rows.length > 0) {
          setScheduleMsg(
            `Sent now to ${sent.length} address${sent.length === 1 ? '' : 'es'} — score ${data.deliverability_score}/100.`,
          )
        } else if (queued.length > 0 && failed.length === 0) {
          const first = queued
            .map((r) => (r.send_at ? new Date(r.send_at).getTime() : Number.NaN))
            .filter((t) => !Number.isNaN(t))
            .sort((a, b) => a - b)[0]
          setScheduleMsg(
            `Queued ${queued.length} email${queued.length === 1 ? '' : 's'}` +
              (first !== undefined
                ? ` — first sends at ${new Date(first).toLocaleString()} (recent send gap or account busy).`
                : ' (recent send gap or account busy).'),
          )
        } else {
          const problems = [...queued, ...failed]
            .map((r) => `${r.to_email}: ${r.error ?? r.status}`)
            .join('; ')
          setScheduleMsg(
            `${sent.length} sent${problems ? `; ${problems}` : ''}`.trim(),
          )
        }
      } else if (rows.length > 0) {
        const first = rows
          .map((r) => (r.send_at ? new Date(r.send_at).getTime() : Number.NaN))
          .filter((t) => !Number.isNaN(t))
          .sort((a, b) => a - b)[0]
        setScheduleMsg(
          `Scheduled ${rows.length} email${rows.length === 1 ? '' : 's'}` +
            (first !== undefined ? ` for ${new Date(first).toLocaleString()}` : '') +
            `. Score ${data.deliverability_score}/100.`,
        )
      } else {
        setScheduleMsg('Nothing scheduled.')
      }
    } catch (err: unknown) {
      setScheduleMsg(getErrorMessage(err))
      await handleCheck()
    } finally {
      setScheduling(false)
    }
  }

  const companyName = companies.find((c) => c.id === draft.company_id)?.name
  const contactName = contacts.find((c) => c.id === draft.contact_id)?.name
  const senderLabel = accounts.find((a) => a.id === draft.mail_account_id)?.label
  const resumeLabel = resumes.find((r) => r.id === draft.resume_id)?.label
  const capInfo = senderLabel ? caps[senderLabel] : undefined
  const customDate = customTime ? new Date(customTime) : null
  const displayName = `${companyName || 'unknown'}_${contactName || 'unknown'}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Link href="/dashboard/drafts" className="flex items-center gap-1 text-ink-secondary hover:text-ink">
            <ArrowLeft size={16} aria-hidden /> Drafts
          </Link>
          <span className="truncate font-medium text-ink">/ {displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cx(
              'tabular text-xs',
              saveState === 'Error' ? 'text-danger' : dirty ? 'text-warning' : 'text-ink-muted',
            )}
            aria-live="polite"
          >
            {saveState === 'Saving…' || saveState === 'Error'
              ? saveState
              : dirty
                ? 'Unsaved changes'
                : 'Saved'}{' '}
            · v{draft.version}
          </span>
          <Button variant="secondary" onClick={() => void persist()}>
            <Save size={16} aria-hidden /> Save Current Draft
          </Button>
          <Button variant="secondary" onClick={() => void saveAsNew()}>
            <CopyPlus size={16} aria-hidden /> Save as a New Draft
          </Button>
          <Button variant="secondary" onClick={() => void openSchedule('now')}>
            <Send size={16} aria-hidden /> Send now
          </Button>
          <Button variant="primary" onClick={() => void openSchedule('slot')}>
            <CalendarClock size={16} aria-hidden /> Schedule email
          </Button>
        </div>
      </div>
      {error && <Banner tone="danger">{error}</Banner>}
      {draft.archived_at && (
        <Banner tone="success">
          This draft was sent on {new Date(draft.archived_at).toLocaleString()} and has moved
          out of your drafts list. It stays editable here.
        </Banner>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Paper */}
        <div className="mx-auto w-full max-w-[760px] space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-line bg-surface-sunken p-0.5" role="group" aria-label="Email format">
              {(['text', 'html'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cx(
                    'rounded-[6px] px-3 py-1 text-[13px] transition-all',
                    mode === m ? 'bg-surface font-medium text-ink shadow-e1' : 'text-ink-secondary hover:text-ink',
                  )}
                >
                  {m === 'text' ? 'Plain text' : 'HTML'}
                </button>
              ))}
            </div>
            {draft.variables.length > 0 && (
              <span className="font-mono text-xs text-ink-muted">
                {draft.variables.map((v) => `{{${v}}}`).join(' ')}
              </span>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-6 shadow-e1 md:p-12">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject — short, specific, honest"
              aria-label="Subject"
              className="w-full border-0 bg-transparent text-xl font-semibold tracking-tight text-ink placeholder:text-ink-disabled focus:outline-none"
            />
            <hr className="my-4 border-line" />
            {mode === 'text' ? (
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Hi {{recipient_first_name}}, …"
                aria-label="Email body"
                rows={16}
                className="w-full resize-y border-0 bg-transparent text-base leading-[26px] text-ink placeholder:text-ink-disabled focus:outline-none"
              />
            ) : (
              <div className="space-y-3">
                <textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  placeholder="<div style=&quot;…&quot;>…</div> — creative HTML welcome (no scripts)"
                  aria-label="HTML body"
                  rows={18}
                  className="w-full resize-y rounded-lg border border-line bg-surface-subtle p-3 font-mono text-[13px] leading-5 text-ink focus:border-brand-600"
                />
              </div>
            )}
          </div>

          {preview && (
            <Card className="animate-fade-up p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Eye size={16} aria-hidden /> Preview
              </div>
              <div className="mt-2 text-[15px] font-semibold text-ink">{preview.subject}</div>
              {(preview.unresolved_subject.length > 0 || preview.unresolved_body.length > 0) && (
                <p className="mt-1 text-[13px] text-warning">
                  Unresolved: {[...preview.unresolved_subject, ...preview.unresolved_body].join(', ')}
                </p>
              )}
              <iframe
                title="draft-preview"
                sandbox=""
                className="mt-2 h-64 w-full rounded-lg border border-line bg-surface"
                srcDoc={preview.body_html ?? preview.body_text.replace(/\n/g, '<br>')}
              />
            </Card>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-3">
          <Section title="Deliverability">
            <div className="flex items-center justify-between gap-2">
              {check ? (
                <ScoreRing score={check.score} />
              ) : (
                <p className="text-sm text-ink-muted">Check how personal this looks before scheduling.</p>
              )}
              <Button size="sm" variant="soft" onClick={handleCheck} loading={checking}>
                {check ? 'Re-check' : 'Check'}
              </Button>
            </div>
            {check && (
              <ul className="mt-3 space-y-2">
                {check.findings.length === 0 && (
                  <li className="text-sm text-success">Clean — safe to schedule.</li>
                )}
                {check.findings.map((f, i) => (
                  <li key={`${f.rule_id}-${i}`} className="flex gap-2 text-sm">
                    <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', FINDING_DOT[f.severity])} aria-hidden />
                    <span>
                      <span className={cx('font-medium', FINDING_TONE[f.severity])}>{f.message}</span>
                      {f.suggestion && <span className="block text-[13px] text-ink-muted">Fix: {f.suggestion}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Brief">
            <div className="space-y-4">
              <Field label="Company">
                <Select value={draft.company_id ?? ''} onChange={(e) => handleCompanyChange(e.target.value)} className="w-full">
                  <option value="">No company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Person">
                <Select value={previewContact} onChange={(e) => handlePersonChange(e.target.value)} className="w-full">
                  <option value="">Pick a contact…</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {(c.emails ?? []).length > 0
                        ? ` · ${(c.emails ?? []).join(', ')}`
                        : c.position
                          ? ` · ${c.position} — no email yet`
                          : ' — no email yet'}
                    </option>
                  ))}
                </Select>
              </Field>
              {(contacts.find((c) => c.id === previewContact)?.emails ?? []).length === 0 && previewContact && (
                <div className="rounded-md border border-warning-border bg-warning-bg p-3">
                  <p className="text-xs font-medium text-warning">
                    {contacts.find((c) => c.id === previewContact)?.name} has no email on
                    file — checks and sending need at least one (separate several with commas).
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <input
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="name@company.com, other@company.com"
                      aria-label="Add this contact's emails"
                      type="text"
                      className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2.5 text-sm placeholder:text-ink-muted focus:border-brand-600"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void saveContactEmail()}
                      loading={savingEmail}
                      disabled={!contactEmail.trim()}
                    >
                      Save
                    </Button>
                  </div>
                  {contactEmailMsg && <p className="mt-1 text-xs text-danger">{contactEmailMsg}</p>}
                </div>
              )}
              <Field label="Role applying">
                <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Backend Engineer" />
              </Field>
              <Field label="LinkedIn URL (optional)">
                <Input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/…"
                  inputMode="url"
                />
              </Field>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
                <input
                  type="checkbox"
                  checked={applied}
                  onChange={(e) => setApplied(e.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                I already filled the application form
              </label>
              {applied && (
                <Field label="Job ID">
                  <Input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="REQ-123" />
                </Field>
              )}
              <Field label="Resume">
                <Select value={draft.resume_id ?? ''} onChange={(e) => handleLinkChange('resume_id', e.target.value)} className="w-full">
                  <option value="">No resume</option>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </Select>
              </Field>
              <Button size="sm" variant="ghost" onClick={handlePreview}>
                <Eye size={16} aria-hidden /> Preview with values
              </Button>
            </div>
          </Section>

          <Section title="Sender">
            <div className="space-y-4">
              <Field label="Sender account">
                <Select value={draft.mail_account_id ?? ''} onChange={(e) => handleLinkChange('mail_account_id', e.target.value)} className="w-full">
                  <option value="">No account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.label} ({a.effective_cap}/day)</option>
                  ))}
                </Select>
              </Field>
              {senderLabel && (
                <CapacityBar
                  used={capInfo && capInfo.remaining != null ? capInfo.effective_cap - capInfo.remaining : 0}
                  cap={capInfo?.effective_cap ?? accounts.find((a) => a.id === draft.mail_account_id)?.effective_cap ?? 0}
                  label={`${senderLabel} capacity`}
                />
              )}
            </div>
          </Section>

          {/* Pinned studio assistant: researches the brief, writes the mode's block. */}
          <div className="sticky bottom-1 flex flex-col overflow-hidden rounded-lg border border-ai-200 bg-surface shadow-e2">
            <div className="flex items-center gap-2 border-b border-line bg-ai-50 px-4 py-2.5">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                style={{ background: 'var(--ai-gradient)' }}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M12 2l1.9 5.7L19.6 9.6l-5.7 1.9L12 17.2l-1.9-5.7L4.4 9.6l5.7-1.9L12 2z" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-ink">Assistant</span>
              <div className="ml-auto flex rounded-md border border-line bg-surface-sunken p-0.5" role="group" aria-label="Assistant mode">
                {(['text', 'html'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setAssistMode(m)}
                    aria-pressed={assistMode === m}
                    title={m === 'html' ? 'Write the whole email as creative HTML' : 'Write the plain-text body'}
                    className={cx(
                      'rounded-[6px] px-2.5 py-1 text-xs transition-all',
                      assistMode === m ? 'bg-surface font-medium text-ink shadow-e1' : 'text-ink-secondary hover:text-ink',
                    )}
                  >
                    {m === 'text' ? 'Plaintext' : 'HTML'}
                  </button>
                ))}
              </div>
            </div>
            {assistMsgs.length > 0 && (
              <ul className="max-h-44 space-y-2 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
                {assistMsgs.map((m, i) => (
                  <li key={i}>
                    {m.role === 'user' ? (
                      <p className="ml-6 rounded-lg rounded-br-sm bg-brand-50 px-3 py-2 text-ink">{m.text}</p>
                    ) : (
                      <p className="rounded-lg rounded-bl-sm bg-ai-50 px-3 py-2 text-ink">{m.text}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-1.5 border-t border-line px-3 pt-3" aria-label="Suggested prompts">
              {SUGGESTED_PROMPTS.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  disabled={assistBusy}
                  title={chip.text}
                  className="rounded-full border border-ai-200 bg-ai-50 px-2.5 py-1 text-xs font-medium text-ai-600 transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void sendAssist()
              }}
              className="p-3"
            >
              <div className="flex gap-1.5">
                <input
                  value={assistInput}
                  onChange={(e) => setAssistInput(e.target.value)}
                  placeholder={
                    assistMode === 'html'
                      ? 'Draft it as colorful HTML…'
                      : 'Draft it, or tell me what to change…'
                  }
                  aria-label="Message the drafting assistant"
                  className="h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 text-sm placeholder:text-ink-muted focus:border-brand-600"
                />
                <button
                  type="submit"
                  disabled={assistBusy || !assistInput.trim()}
                  aria-label="Send to assistant"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white shadow-e1 transition-opacity hover:opacity-95 disabled:opacity-50"
                  style={{ background: 'var(--ai-gradient)' }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M22 2L11 13" />
                    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Defaults applied: short &amp; crisp · no links · themed HTML.
              </p>
            </form>
          </div>
        </div>
      </div>

      {showSchedule && (
        <Modal
          title={sendMode === 'now' ? 'Send email now' : 'Schedule email'}
          description="Content is frozen at schedule time — later edits won't change it."
          onClose={() => setShowSchedule(false)}
          wide
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowSchedule(false)}>Close</Button>
              <Button variant="primary" onClick={() => void confirmSchedule()} loading={scheduling} disabled={check?.blocked === true}>
                {sendMode === 'now' ? 'Send now' : 'Confirm schedule'}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-ink-muted">Recipient</dt><dd className="font-medium text-ink">{(() => {
                const c = contacts.find((x) => x.id === (previewContact || draft.contact_id))
                if (!c) return '—'
                const n = (c.emails ?? []).length
                return n > 1 ? `${c.name} · ${n} addresses (one email each)` : c.name
              })()}</dd></div>
              <div><dt className="text-xs text-ink-muted">Sender</dt><dd className="font-medium text-ink">{senderLabel ?? '—'}</dd></div>
              <div><dt className="text-xs text-ink-muted">Resume</dt><dd className="font-medium text-ink">{resumeLabel ?? 'None'}</dd></div>
              <div>
                <dt className="text-xs text-ink-muted">Format</dt>
                <dd className="mt-1">
                  <div className="flex rounded-md border border-line bg-surface-sunken p-0.5" role="group" aria-label="Send format">
                    {(['text', 'html'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setSendFormat(f)}
                        aria-pressed={sendFormat === f}
                        disabled={f === 'html' && !draft.body_html}
                        title={f === 'text' ? 'Plain text only' : 'HTML with a plain-text alternative'}
                        className={cx(
                          'rounded-[6px] px-2.5 py-1 text-xs transition-all disabled:opacity-40',
                          sendFormat === f ? 'bg-surface font-medium text-ink shadow-e1' : 'text-ink-secondary hover:text-ink',
                        )}
                      >
                        {f === 'text' ? 'Plaintext' : 'HTML'}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {sendFormat === 'text' || !draft.body_html
                      ? 'Goes out as plain text only.'
                      : 'Goes out as HTML with a plain-text alternative.'}
                  </p>
                </dd>
              </div>
            </dl>
            <div className="space-y-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 has-checked:border-brand-600">
                <input type="radio" checked={sendMode === 'now'} onChange={() => setSendMode('now')} className="accent-brand-600" />
                <span>
                  <span className="font-medium text-ink">Send now</span>
                  <span className="block text-xs text-ink-muted">Immediately — caps and safety gaps still apply</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 has-checked:border-brand-600">
                <input type="radio" checked={sendMode === 'slot'} onChange={() => setSendMode('slot')} className="accent-brand-600" />
                <span>
                  <span className="font-medium text-ink">Next safe slot</span>
                  <span className="block text-xs text-ink-muted">Weekday morning, their time</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 has-checked:border-brand-600">
                <input type="radio" checked={sendMode === 'custom'} onChange={() => setSendMode('custom')} className="accent-brand-600" />
                <span className="font-medium text-ink">Custom</span>
              </label>
              {sendMode === 'custom' && (
                <div>
                  <Input type="datetime-local" value={customTime} onChange={(e) => setCustomTime(e.target.value)} aria-label="Custom send time" />
                  {customDate && (
                    <p className="tabular mt-1 text-xs text-ink-muted">
                      {customDate.toLocaleString()} your time · {customDate.toUTCString().slice(0, 22)} UTC
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          {check?.blocked && (
            <Banner tone="danger">Blocked — fix the findings in the Deliverability panel first.</Banner>
          )}
          {scheduleMsg && <p className="mt-2 text-sm text-ink-secondary" role="status">{scheduleMsg}</p>}
        </Modal>
      )}
    </div>
  )
}
