'use client'

import { useEffect, useState } from 'react'
import { fetchApi } from '@/lib/api'
import {
  Banner,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  StatusChip,
  Textarea,
} from '@/components/ui'

function sectionError(err: unknown): string {
  return err instanceof Error ? err.message : 'An error occurred'
}

const SUBNAV = [
  { id: 'profile', label: 'Profile' },
  { id: 'suppression', label: 'Suppression' },
  { id: 'spam-terms', label: 'Spam words' },
  { id: 'domain', label: 'Domain health' },
  { id: 'data', label: 'Export & delete' },
]

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [timezone, setTimezone] = useState('')
  const [signatureText, setSignatureText] = useState('')

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await fetchApi('/api/v1/me')
        setDisplayName(data.display_name || '')
        setTimezone(data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)
        setSignatureText(data.signature_text || '')
      } catch (err: unknown) {
        setError(sectionError(err))
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await fetchApi('/api/v1/me', {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: displayName,
          timezone,
          signature_text: signatureText,
        }),
      })
      setSuccess('Settings saved.')
    } catch (err: unknown) {
      setError(sectionError(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-ink-muted">Loading settings…</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Profile, safety lists, deliverability labs and your data." />
      {error && <Banner tone="danger">{error}</Banner>}
      {success && <Banner tone="success">{success}</Banner>}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5">
            {SUBNAV.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-md px-3 py-2 text-sm text-ink-secondary hover:bg-surface-subtle hover:text-ink">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-2xl space-y-6">
          <Card id="profile" className="scroll-mt-20 p-5">
            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Display name" hint="Shown as the sender on every email.">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Timezone" hint="Used to display send times in your time.">
                <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </Field>
              <Field label="Email signature">
                <Textarea rows={4} value={signatureText} onChange={(e) => setSignatureText(e.target.value)} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" loading={saving}>Save changes</Button>
              </div>
            </form>
          </Card>

          <SuppressionSection />
          <SpamTermsSection />
          <DomainHealthSection />
          <ExportSection />
          <DeleteAccountSection />
        </div>
      </div>
    </div>
  )
}

interface SuppressionEntry {
  id: string
  email: string
  reason: string
}

function SuppressionSection() {
  const [entries, setEntries] = useState<SuppressionEntry[]>([])
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function initial() {
      try {
        const data = await fetchApi('/api/v1/suppression')
        if (!cancelled) setEntries(data.entries ?? [])
      } catch {
        // Non-fatal on settings page.
      }
    }
    void initial()
    return () => {
      cancelled = true
    }
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetchApi('/api/v1/suppression', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setEmail('')
      const data = await fetchApi('/api/v1/suppression')
      setEntries(data.entries ?? [])
    } catch (err: unknown) {
      setMsg(sectionError(err))
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await fetchApi(`/api/v1/suppression/${id}`, { method: 'DELETE' })
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err: unknown) {
      setMsg(sectionError(err))
    }
  }

  return (
    <Card id="suppression" className="scroll-mt-20">
      <CardHeader title="Suppression list" description="Blocked addresses can never be scheduled — opt-outs and bounces land here." />
      <div className="p-5 pt-3">
        {msg && <p className="mb-2 text-sm text-danger">{msg}</p>}
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input type="email" required placeholder="address@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Address to block" />
          <Button type="submit">Block</Button>
        </form>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Empty — nobody is blocked.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="bg-surface-subtle text-left text-[13px] font-medium text-ink-secondary">
                <th className="px-3 py-2 font-medium">Address</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((e) => (
                <tr key={e.id} className="h-12">
                  <td className="px-3 py-2 text-ink">{e.email}</td>
                  <td className="px-3 py-2"><StatusChip status="opted_out" label={e.reason} /></td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(e.id)}>Remove</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  )
}

function SpamTermsSection() {
  const [terms, setTerms] = useState<string[]>([])
  const [customized, setCustomized] = useState(false)
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function initial() {
      try {
        const data = await fetchApi('/api/v1/spam-terms')
        if (cancelled) return
        setTerms(data.terms ?? [])
        setCustomized(data.customized ?? false)
      } catch {
        // Non-fatal.
      }
    }
    void initial()
    return () => {
      cancelled = true
    }
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetchApi('/api/v1/spam-terms', {
        method: 'POST',
        body: JSON.stringify({ term: input }),
      })
      setInput('')
      const data = await fetchApi('/api/v1/spam-terms')
      setTerms(data.terms ?? [])
      setCustomized(true)
    } catch (err: unknown) {
      setMsg(sectionError(err))
    }
  }

  const handleRemove = async (term: string) => {
    try {
      await fetchApi(`/api/v1/spam-terms/${encodeURIComponent(term)}`, { method: 'DELETE' })
      setTerms((prev) => prev.filter((t) => t !== term))
    } catch (err: unknown) {
      setMsg(sectionError(err))
    }
  }

  return (
    <Card id="spam-terms" className="scroll-mt-20">
      <CardHeader
        title="Spam-trigger words"
        description={customized ? 'Your customized list.' : 'Default list — adding a word customizes it.'}
      />
      <div className="p-5 pt-3">
        {msg && <p className="mb-2 text-sm text-danger">{msg}</p>}
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input placeholder="e.g. crypto" value={input} onChange={(e) => setInput(e.target.value)} required aria-label="Word to flag" />
          <Button type="submit">Add</Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {terms.map((t) => (
            <button
              key={t}
              title={`Remove ${t}`}
              onClick={() => handleRemove(t)}
              className="h-[22px] rounded-sm border border-line bg-surface-subtle px-2 text-xs font-medium text-ink-secondary hover:border-danger-border hover:bg-danger-bg hover:text-danger"
            >
              {t} ×
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}

interface DomainCheck {
  key: string
  ok: boolean
  fix: string
}

function DomainHealthSection() {
  const [domain, setDomain] = useState('')
  const [checks, setChecks] = useState<DomainCheck[]>([])
  const [allOk, setAllOk] = useState<boolean | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    try {
      const data = await fetchApi(`/api/v1/metrics/domain-health?domain=${encodeURIComponent(domain)}`)
      setChecks(data.checks ?? [])
      setAllOk(data.all_ok ?? null)
    } catch (err: unknown) {
      setMsg(sectionError(err))
    }
  }

  return (
    <Card id="domain" className="scroll-mt-20">
      <CardHeader title="Domain health" description="For custom Google Workspace domains: SPF, DKIM and DMARC checks." />
      <div className="p-5 pt-3">
        {msg && <p className="mb-2 text-sm text-danger">{msg}</p>}
        <form onSubmit={handleCheck} className="flex gap-2">
          <Input placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} required aria-label="Domain to check" />
          <Button type="submit">Check</Button>
        </form>
        {allOk !== null && (
          <div className="mt-3 space-y-1.5 text-sm">
            <p className={allOk ? 'font-medium text-success' : 'font-medium text-warning'}>
              {allOk ? 'All checks pass.' : 'Some checks need attention.'}
            </p>
            {checks.map((c) => (
              <p key={c.key}>
                <span className={c.ok ? 'font-medium text-success' : 'font-medium text-danger'}>
                  {c.ok ? '✓' : '✗'} {c.key.toUpperCase()}
                </span>
                {!c.ok && <span className="ml-1 text-ink-secondary">{c.fix}</span>}
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function ExportSection() {
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    setMsg(null)
    setBusy(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token ?? ''
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${base}/api/v1/me/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Export failed.')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'tailer-export.zip'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setMsg(sectionError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card id="data" className="scroll-mt-20">
      <CardHeader title="Your data" description="Download everything, or delete it permanently." />
      <div className="p-5 pt-3">
        {msg && <p className="mb-2 text-sm text-ink-secondary">{msg}</p>}
        <Button onClick={handleExport} loading={busy}>Download export (.zip)</Button>
      </div>
    </Card>
  )
}

function DeleteAccountSection() {
  const [confirming, setConfirming] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const handleDelete = async () => {
    try {
      const data = await fetchApi('/api/v1/me?confirm=true', { method: 'DELETE' })
      setMsg(`Deleted. Tables cleared: ${Object.keys(data.deleted ?? {}).length}.`)
      setConfirming(false)
    } catch (err: unknown) {
      setMsg(sectionError(err))
    }
  }

  return (
    <Card className="border-danger-border">
      <CardHeader
        title="Delete account data"
        description="Permanently removes mail accounts, drafts, sent history, resumes and files, research, chat history and your profile. This can't be undone."
      />
      <div className="p-5 pt-3">
        {msg && <p className="mb-2 text-sm text-ink-secondary" role="status">{msg}</p>}
        {!confirming ? (
          <Button variant="danger" onClick={() => setConfirming(true)}>Delete everything…</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete forever</Button>
          </div>
        )}
      </div>
    </Card>
  )
}
