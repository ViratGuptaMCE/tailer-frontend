'use client'

import { useCallback, useEffect, useState } from 'react'
import { CircleCheck, KeyRound, MailPlus, Star, Trash2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Avatar,
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SkeletonList,
  StatusChip,
  Stepper,
} from '@/components/ui'

interface MailAccount {
  id: string
  label: string
  from_email: string
  display_name: string | null
  status: 'active' | 'paused' | 'auth_failed'
  paused_reason: string | null
  daily_cap: number
  effective_cap: number
  warmup_started_at: string | null
  is_default: boolean
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An error occurred'
}

const WIZARD_STEPS = ['2-Step Verification', 'App password', 'Details', 'Verify & save']

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [lastTest, setLastTest] = useState<{ id: string; text: string } | null>(null)

  // Wizard state
  const [step, setStep] = useState(0)
  const [label, setLabel] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [cap, setCap] = useState(20)
  const [saving, setSaving] = useState(false)

  // Per-card edits: cap + replacement password
  const [capEdits, setCapEdits] = useState<Record<string, number>>({})
  const [pwEdits, setPwEdits] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchApi('/api/v1/mail-accounts')
      setAccounts(data.accounts ?? [])
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function initialLoad() {
      try {
        const data = await fetchApi('/api/v1/mail-accounts')
        if (!cancelled) setAccounts(data.accounts ?? [])
      } catch (err: unknown) {
        if (!cancelled) setError(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initialLoad()
    return () => {
      cancelled = true
    }
  }, [])

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await fetchApi('/api/v1/mail-accounts', {
        method: 'POST',
        body: JSON.stringify({
          label,
          from_email: email,
          display_name: displayName || null,
          app_password: password,
          daily_cap: cap,
        }),
      })
      setNotice('Gmail account connected. Send a test email to verify sending.')
      setLabel('')
      setEmail('')
      setDisplayName('')
      setPassword('')
      setCap(20)
      setStep(0)
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    setError(null)
    setNotice(null)
    try {
      const data = await fetchApi(`/api/v1/mail-accounts/${id}/test`, { method: 'POST' })
      setLastTest({ id, text: `SMTP ✓ ${data.smtp.host}:${data.smtp.port} · login ok` })
      setNotice('Test email sent. Check Gmail to confirm it arrived.')
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
      await load()
    } finally {
      setTestingId(null)
    }
  }

  const handleMakeDefault = async (id: string) => {
    try {
      await fetchApi(`/api/v1/mail-accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_default: true }),
      })
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this Gmail account? This cannot be undone.')) return
    try {
      await fetchApi(`/api/v1/mail-accounts/${id}`, { method: 'DELETE' })
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleCapSave = async (id: string) => {
    const value = capEdits[id]
    if (value == null) return
    try {
      await fetchApi(`/api/v1/mail-accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ daily_cap: value }),
      })
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handlePasswordReplace = async (id: string) => {
    const value = (pwEdits[id] || '').trim()
    if (!value) return
    try {
      await fetchApi(`/api/v1/mail-accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ app_password: value }),
      })
      setPwEdits((prev) => ({ ...prev, [id]: '' }))
      setNotice('App password replaced and verified.')
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gmail accounts"
        subtitle="Sending goes through your own Gmail, so it looks like you — not a mail blast."
      />
      {error && <Banner tone="danger">{error}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}

      {/* Connect wizard */}
      <Card>
        <CardHeader
          title="Connect Gmail"
          description="Four short steps. Passwords are encrypted, never shown again, and revocable anytime in your Google Account."
        />
        <div className="px-5 pt-3">
          <Stepper steps={WIZARD_STEPS} current={step} />
        </div>
        <form onSubmit={handleConnect} className="space-y-4 p-5">
          {step === 0 && (
            <div className="rounded-lg border border-line bg-surface-subtle p-4 text-sm text-ink-secondary">
              <p className="font-medium text-ink">Turn on 2-Step Verification</p>
              <p className="mt-1">
                Open your Google Account → Security → 2-Step Verification, and follow the prompts.
                App passwords only exist once this is on.
              </p>
              <div className="mt-3 flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setStep(1)}>It&apos;s on — continue</Button>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="rounded-lg border border-line bg-surface-subtle p-4 text-sm text-ink-secondary">
              <p className="font-medium text-ink">Create an app password</p>
              <p className="mt-1">
                Google Account → Security → App passwords → create one (16 characters) and copy it.{' '}
                <a
                  className="font-medium text-brand-600 hover:text-brand-700"
                  href="https://support.google.com/accounts/answer/185833"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google&apos;s guide
                </a>
              </p>
              <details className="mt-2 text-[13px]">
                <summary className="cursor-pointer font-medium text-brand-600">Why an app password?</summary>
                <p className="mt-1">
                  Your real Google password never touches this app, and you can revoke the app
                  password anytime without changing anything else.
                </p>
              </details>
              <div className="mt-3 flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => setStep(0)}>Back</Button>
                <Button variant="primary" size="sm" onClick={() => setStep(2)}>I have one — continue</Button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Label"><Input placeholder="Personal" value={label} onChange={(e) => setLabel(e.target.value)} required /></Field>
                <Field label="Gmail address"><Input placeholder="you@gmail.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
                <Field label="Display name" hint="Shown as the sender, e.g. Firstname Lastname">
                  <Input placeholder="Firstname Lastname" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </Field>
                <Field label="Daily cap (1–100)" hint="New accounts warm up gradually from 5/day.">
                  <Input type="number" min={1} max={100} value={cap} onChange={(e) => setCap(Number(e.target.value))} />
                </Field>
              </div>
              <div className="mt-3 flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
                <Button variant="primary" size="sm" onClick={() => setStep(3)} disabled={!label.trim() || !email.trim()}>
                  Continue
                </Button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <Field label="16-character app password" hint="Spaces are fine — we verify the SMTP login before saving anything.">
                <Input
                  placeholder="xxxx xxxx xxxx xxxx"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="font-mono"
                />
              </Field>
              <div className="mt-3 flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => setStep(2)}>Back</Button>
                <Button type="submit" variant="primary" size="sm" loading={saving} disabled={!password.trim()}>
                  <KeyRound size={16} aria-hidden /> Verify & save
                </Button>
              </div>
            </div>
          )}
        </form>
      </Card>

      {/* Account cards */}
      {loading ? (
        <Card><SkeletonList rows={2} /></Card>
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MailPlus size={24} aria-hidden />}
            title="No Gmail accounts yet"
            body="Connect your first account above — it takes about a minute."
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {accounts.map((a) => (
            <li key={a.id}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={a.label} size={40} />
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-ink">
                        {a.label}
                        {a.is_default && <Star size={14} className="text-brand-600" fill="currentColor" aria-label="Default account" />}
                      </div>
                      <div className="text-[13px] text-ink-muted">
                        {a.display_name ? `${a.display_name} <${a.from_email}>` : a.from_email}
                      </div>
                    </div>
                  </div>
                  <StatusChip status={a.status} />
                </div>
                {a.paused_reason && (
                  <p className="mt-2 rounded-md bg-danger-bg px-2 py-1 text-[13px] text-danger">{a.paused_reason}</p>
                )}
                <div className="mt-3">
                  <p className="tabular text-[13px] text-ink-secondary" title={a.warmup_started_at ? `Warming up since ${new Date(a.warmup_started_at).toLocaleDateString()}` : undefined}>
                    Cap {a.effective_cap}/{a.daily_cap} per day
                    {a.warmup_started_at && ` · warming up since ${new Date(a.warmup_started_at).toLocaleDateString()}`}
                  </p>
                </div>
                {lastTest?.id === a.id && (
                  <p className="mt-2 flex items-center gap-1 rounded-md bg-success-bg px-2 py-1 text-xs text-success" role="status">
                    <CircleCheck size={14} aria-hidden /> {lastTest.text}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleTest(a.id)} loading={testingId === a.id}>
                    Send test email
                  </Button>
                  {!a.is_default && (
                    <Button size="sm" variant="ghost" onClick={() => handleMakeDefault(a.id)}>
                      Make default
                    </Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => handleDelete(a.id)} className="ml-auto">
                    <Trash2 size={16} aria-hidden /> Remove
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 border-t border-line pt-3">
                  <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
                    Daily cap
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={capEdits[a.id] ?? a.daily_cap}
                      onChange={(e) => setCapEdits((prev) => ({ ...prev, [a.id]: Number(e.target.value) }))}
                      className="flex-1 accent-brand-600"
                      aria-label={`Daily cap for ${a.label}`}
                    />
                    <span className="tabular w-8 text-right text-ink">{capEdits[a.id] ?? a.daily_cap}</span>
                    <Button size="sm" variant="ghost" onClick={() => handleCapSave(a.id)}>Save</Button>
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
                    New app password
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={pwEdits[a.id] ?? ''}
                      onChange={(e) => setPwEdits((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      className="h-8 flex-1 font-mono text-[13px]"
                    />
                    <Button size="sm" variant="ghost" onClick={() => handlePasswordReplace(a.id)}>Replace</Button>
                  </label>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
