'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Building2, Plus, Upload } from 'lucide-react'
import { fetchApi, fetchFormApi } from '@/lib/api'
import { Avatar, Banner, Button, Card, EmptyState, Field, Input, Modal, PageHeader, SkeletonList, Textarea, cx } from '@/components/ui'

interface Company {
  id: string
  name: string
  website: string | null
  notes: string | null
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An error occurred'
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [creating, setCreating] = useState(false)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function initial() {
      try {
        const data = await fetchApi('/api/v1/companies')
        if (!cancelled) setCompanies(data.companies ?? [])
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const created = await fetchApi('/api/v1/companies', {
        method: 'POST',
        body: JSON.stringify({ name, website: website || null }),
      })
      setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setWebsite('')
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const reloadCompanies = async () => {
    const data = await fetchApi('/api/v1/companies')
    setCompanies(data.companies ?? [])
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        subtitle="Target employers, each with contacts, drafts and threads."
        actions={
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            <Upload size={16} aria-hidden /> Import CSV/XLS
          </Button>
        }
      />
      {error && <Banner tone="danger">{error}</Banner>}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => void reloadCompanies()}
        />
      )}

      <Card className="p-5">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <Field label="Company name">
              <Input placeholder="Acme Inc." value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          </div>
          <div className="min-w-40 flex-1">
            <Field label="Website (optional)">
              <Input placeholder="acme.com" value={website} onChange={(e) => setWebsite(e.target.value)} inputMode="url" />
            </Field>
          </div>
          <Button type="submit" variant="primary" loading={creating}>
            <Plus size={16} aria-hidden /> Add company
          </Button>
        </form>
      </Card>

      {loading ? (
        <Card><SkeletonList rows={4} /></Card>
      ) : companies.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 size={24} aria-hidden />}
            title="No companies yet"
            body="Add your first target employer above, then find the right people to write to."
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((c, i) => (
            <li key={c.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 20}ms` }}>
              <Link
                href={`/dashboard/companies/${c.id}`}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface p-5 transition-all duration-150 hover:border-brand-200 hover:shadow-e2"
              >
                <Avatar name={c.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{c.name}</span>
                  {c.website && <span className="block truncate text-[13px] text-ink-muted">{c.website}</span>}
                </span>
                <ArrowRight size={18} className="shrink-0 text-ink-disabled" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface ImportRow {
  name: string
  company: string
  position: string
  email?: string
  emails?: string[]
  phone: string
  status: string
  note: string
}

function importRowEmails(r: ImportRow): string {
  const list = r.emails ?? (r.email ? [r.email] : [])
  return list.join(', ')
}

interface ImportResult {
  dry_run: boolean
  rows_seen: number
  companies_created: number
  contacts_created: number
  rows: ImportRow[]
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [tab, setTab] = useState<'paste' | 'file'>('paste')
  const [csvText, setCsvText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [working, setWorking] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const canPreview = tab === 'paste' ? csvText.trim().length > 0 : file !== null
  const okCount = preview?.rows.filter((r) => r.status === 'ok').length ?? 0

  const runImport = async (dryRun: boolean) => {
    setWorking(true)
    setMsg(null)
    try {
      let data: ImportResult
      if (tab === 'file') {
        if (!file) return
        const form = new FormData()
        form.append('file', file)
        form.append('dry_run', dryRun ? 'true' : 'false')
        data = await fetchFormApi('/api/v1/contacts/import-file', form)
      } else {
        data = await fetchApi('/api/v1/contacts/import', {
          method: 'POST',
          body: JSON.stringify({ csv_text: csvText, dry_run: dryRun }),
        })
      }
      if (dryRun) {
        setPreview(data)
        setDone(null)
      } else {
        setDone(
          `Imported ${data.contacts_created} contact${data.contacts_created === 1 ? '' : 's'}` +
            ` across ${data.companies_created} new compan${data.companies_created === 1 ? 'y' : 'ies'}.`,
        )
        setPreview(null)
        onImported()
      }
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <Modal
      title="Import contacts"
      description="Paste CSV or upload .csv / .xls / .xlsx. Headers like Name, Company, Position, Email, Phone are detected automatically — preview first, nothing is saved until you confirm."
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {preview && !done && (
            <Button
              variant="primary"
              onClick={() => void runImport(false)}
              loading={working}
              disabled={okCount === 0}
            >
              Import {okCount} contact{okCount === 1 ? '' : 's'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex rounded-md border border-line bg-surface-sunken p-0.5" role="group" aria-label="Import source">
          {(['paste', 'file'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t)
                setPreview(null)
                setMsg(null)
                setDone(null)
              }}
              aria-pressed={tab === t}
              className={cx(
                'flex-1 rounded-[6px] px-3 py-1.5 text-[13px] transition-all',
                tab === t ? 'bg-surface font-medium text-ink shadow-e1' : 'text-ink-secondary hover:text-ink',
              )}
            >
              {t === 'paste' ? 'Paste CSV' : 'Upload file'}
            </button>
          ))}
        </div>

        {tab === 'paste' ? (
          <Field
            label="CSV text"
            hint="First row must be a header, e.g. Name, Company, Position, Email, Phone."
          >
            <Textarea
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'Name,Company,Position,Email,Phone\nJane Doe,Acme,Recruiter,jane@acme.com,+15551234567'}
              className="font-mono text-[13px]"
            />
          </Field>
        ) : (
          <Field label="Spreadsheet file" hint=".csv, .xls or .xlsx, up to 1 MB and 500 rows.">
            <Input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-label="Upload spreadsheet"
            />
          </Field>
        )}

        {msg && <p className="text-sm text-danger" role="alert">{msg}</p>}
        {done && <p className="text-sm text-success" role="status">{done}</p>}

        <div>
          <Button
            variant="secondary"
            onClick={() => void runImport(true)}
            loading={working}
            disabled={!canPreview}
          >
            Preview
          </Button>
        </div>

        {preview && (
          <div className="space-y-2">
            <p className="text-sm text-ink-secondary" role="status">
              {preview.rows_seen} row{preview.rows_seen === 1 ? '' : 's'} read ·{' '}
              {preview.contacts_created} new contact{preview.contacts_created === 1 ? '' : 's'} ·{' '}
              {preview.companies_created} new compan{preview.companies_created === 1 ? 'y' : 'ies'}.
              Nothing saved yet.
            </p>
            <div className="max-h-64 overflow-auto rounded-lg border border-line">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-surface-subtle text-left text-xs font-medium text-ink-secondary">
                  <tr>
                    <th className="px-2 py-1.5">Name</th>
                    <th className="px-2 py-1.5">Company</th>
                    <th className="px-2 py-1.5">Position</th>
                    <th className="px-2 py-1.5">Email</th>
                    <th className="px-2 py-1.5">Phone</th>
                    <th className="px-2 py-1.5">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5 font-medium text-ink">{r.name || '—'}</td>
                      <td className="px-2 py-1.5 text-ink-secondary">{r.company || '—'}</td>
                      <td className="px-2 py-1.5 text-ink-secondary">{r.position || '—'}</td>
                      <td className="px-2 py-1.5 font-mono text-xs text-ink-secondary">{importRowEmails(r) || '—'}</td>
                      <td className="px-2 py-1.5 font-mono text-xs text-ink-secondary">{r.phone || '—'}</td>
                      <td className="px-2 py-1.5">
                        {r.status === 'ok' ? (
                          <span className="text-success">new</span>
                        ) : (
                          <span className="text-warning" title={r.note}>
                            {r.status}{r.note ? ` — ${r.note}` : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
