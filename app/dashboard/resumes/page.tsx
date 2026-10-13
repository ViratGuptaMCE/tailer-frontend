'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Flag, Copy, Star, Trash2, UploadCloud } from 'lucide-react'
import { fetchApi, fetchFormApi } from '@/lib/api'
import {
  AiButton,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  SkeletonList,
  cx,
} from '@/components/ui'

const MAX_BYTES = 256000
const MAX_SOURCE_BYTES = 100000

interface CompileError {
  line: number | null
  message: string
}

interface CompileResult {
  ok: boolean
  code?: string
  size_bytes: number
  pdf_base64?: string
  errors: CompileError[]
  hint?: string
  recompressed?: boolean
}

interface LatexTemplate {
  key: string
  name: string
  source: string
}

interface ResumeVersion {
  id: string
  version_no: number
  size_bytes: number
  sha256: string
  original_filename: string | null
  note: string | null
  warnings?: string[]
}

interface Resume {
  id: string
  label: string
  kind: string
  tags: string[] | null
  is_default: boolean
  version_count: number
  current_version: {
    id: string
    version_no: number
    size_bytes: number
    sha256: string
    original_filename: string | null
    warnings?: string[]
  } | null
  duplicate_warning?: boolean
}

const WARNING_LABELS: Record<string, string> = {
  'javascript-action': 'contains a JavaScript action',
  'launch-action': 'contains a launch action',
  'additional-actions': 'contains automatic actions',
  'embedded-files': 'contains embedded files',
}

function warningText(codes: string[] | undefined): string {
  if (!codes || codes.length === 0) return ''
  return codes.map((c) => WARNING_LABELS[c] ?? c).join('; ')
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An error occurred'
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [tags, setTags] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [expanded, setExpanded] = useState<Record<string, ResumeVersion[]>>({})
  const [renames, setRenames] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<Resume | null>(null)
  const [usage, setUsage] = useState<{ drafts: { id: string; subject: string }[] } | null>(null)

  const [showLatex, setShowLatex] = useState(false)
  const [templates, setTemplates] = useState<LatexTemplate[]>([])
  const [latexLabel, setLatexLabel] = useState('')
  const [latexSource, setLatexSource] = useState('')
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const latexRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    const data = await fetchApi('/api/v1/resumes')
    setResumes(data.resumes ?? [])
  }

  useEffect(() => {
    let cancelled = false
    async function initial() {
      try {
        const data = await fetchApi('/api/v1/resumes')
        if (!cancelled) setResumes(data.resumes ?? [])
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

  const pickFile = (f: File | null) => {
    setError(null)
    setNotice(null)
    setWarn(null)
    if (f && f.size > MAX_BYTES) {
      setError(
        `This file is ${(f.size / 1024).toFixed(0)} KB; the limit is 250 KB. ` +
          'Try exporting at lower image quality.',
      )
      return
    }
    if (f && f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted.')
      return
    }
    setFile(f)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('label', label || file.name.replace(/\.pdf$/i, ''))
      if (tags) form.append('tags', tags)
      form.append('file', file)
      const created = await fetchFormApi('/api/v1/resumes', form)
      if (created.duplicate_warning) {
        setNotice('Uploaded, but an identical file already exists in your library.')
      } else {
        setNotice('Resume uploaded.')
      }
      if (created.safety_warnings?.length) {
        setWarn(`Uploaded with a flag: this PDF ${warningText(created.safety_warnings)}. Sending it is at your discretion.`)
      }
      setLabel('')
      setTags('')
      setFile(null)
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const toggleVersions = async (id: string) => {
    if (expanded[id]) {
      setExpanded((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }
    try {
      const data = await fetchApi(`/api/v1/resumes/${id}/versions`)
      setExpanded((prev) => ({ ...prev, [id]: data.versions ?? [] }))
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleDownload = async (resumeId: string, versionId: string) => {
    try {
      const data = await fetchApi(`/api/v1/resumes/${resumeId}/versions/${versionId}/download`)
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleDefault = async (id: string) => {
    try {
      await fetchApi(`/api/v1/resumes/${id}/set-default`, { method: 'POST' })
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await fetchApi(`/api/v1/resumes/${id}/duplicate`, { method: 'POST' })
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleRename = async (id: string) => {
    const value = (renames[id] || '').trim()
    if (!value) return
    try {
      await fetchApi(`/api/v1/resumes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ label: value }),
      })
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const openDelete = async (resume: Resume) => {
    try {
      const data = await fetchApi(`/api/v1/resumes/${resume.id}/usage`)
      setUsage(data)
      setDeleting(resume)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await fetchApi(`/api/v1/resumes/${deleting.id}?confirm=true`, { method: 'DELETE' })
      setNotice('Resume permanently deleted.')
      setDeleting(null)
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const openLatex = async () => {
    setShowLatex(true)
    if (templates.length === 0) {
      try {
        const data = await fetchApi('/api/v1/latex/templates')
        setTemplates(data.templates ?? [])
      } catch (err: unknown) {
        setError(getErrorMessage(err))
      }
    }
  }

  const base64ToUrl = (b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    return URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }))
  }

  const handleCompile = async () => {
    setCompiling(true)
    setError(null)
    try {
      const data: CompileResult = await fetchApi('/api/v1/latex/compile', {
        method: 'POST',
        body: JSON.stringify({ source: latexSource }),
      })
      setCompileResult(data)
      if (data.ok && data.pdf_base64) {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl)
        setPdfUrl(base64ToUrl(data.pdf_base64))
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setCompiling(false)
    }
  }

  const handleSaveLatexNew = async () => {
    if (!latexLabel.trim()) {
      setError('Give the LaTeX resume a label first.')
      return
    }
    setSaving(true)
    try {
      const created = await fetchApi('/api/v1/resumes/latex', {
        method: 'POST',
        body: JSON.stringify({ label: latexLabel.trim(), source: latexSource }),
      })
      setNotice('LaTeX resume saved.')
      if (created.safety_warnings?.length) {
        setWarn(`Saved with a flag: this PDF ${warningText(created.safety_warnings)}.`)
      }
      setLatexLabel('')
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveLatexVersion = async () => {
    if (!editingResumeId) return
    setSaving(true)
    try {
      const updated = await fetchApi(`/api/v1/resumes/${editingResumeId}/versions/latex`, {
        method: 'POST',
        body: JSON.stringify({ source: latexSource }),
      })
      setNotice('New LaTeX version saved.')
      if (updated.safety_warnings?.length) {
        setWarn(`Saved with a flag: this PDF ${warningText(updated.safety_warnings)}.`)
      }
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleEditLatex = async (resumeId: string, resumeLabel: string) => {
    try {
      const fork = await fetchApi(`/api/v1/resumes/${resumeId}/fork`, { method: 'POST' })
      await openLatex()
      setLatexLabel(resumeLabel ? `${resumeLabel} (tailored)` : 'Tailored resume')
      setLatexSource(fork.source ?? '')
      setEditingResumeId(fork.id)
      setCompileResult(null)
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
        setPdfUrl(null)
      }
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const jumpToLine = (line: number | null) => {
    const el = latexRef.current
    if (!el || !line) return
    const lines = latexSource.split('\n')
    let offset = 0
    for (let i = 0; i < Math.min(line - 1, lines.length); i++) offset += lines[i].length + 1
    el.focus()
    el.setSelectionRange(offset, offset + (lines[line - 1]?.length ?? 0))
  }

  const sourceKB = new Blob([latexSource]).size / 1024

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resume library"
        subtitle="Unlimited resumes, 250 KB max each. Deletions are permanent."
        actions={
          <>
            <Button variant="secondary" onClick={() => (showLatex ? setShowLatex(false) : void openLatex())}>
              {showLatex ? 'Hide LaTeX editor' : 'Write with LaTeX'}
            </Button>
          </>
        }
      />
      {error && <Banner tone="danger">{error}</Banner>}
      {warn && <Banner tone="warning">{warn}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}

      {showLatex && (
        <Card className="animate-fade-up">
          <div className="border-b border-line px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {templates.map((t) => (
                  <Button
                    key={t.key}
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setLatexSource(t.source)
                      setEditingResumeId(null)
                      setCompileResult(null)
                    }}
                  >
                    {t.name}
                  </Button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="tabular text-xs text-ink-muted" title="LaTeX source size">
                  {sourceKB.toFixed(1)} / {(MAX_SOURCE_BYTES / 1024).toFixed(0)} KB
                </span>
                <ProgressBar value={sourceKB} max={MAX_SOURCE_BYTES / 1024} />
                <Button size="sm" variant="primary" onClick={handleCompile} loading={compiling} disabled={!latexSource}>
                  Compile
                </Button>
                <Button size="sm" onClick={handleSaveLatexNew} disabled={saving || !compileResult?.ok}>
                  Save new
                </Button>
                {editingResumeId && (
                  <Button size="sm" onClick={handleSaveLatexVersion} disabled={saving || !compileResult?.ok}>
                    Save version
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Tip: open the chat and ask it to tailor a resume — it compiles and saves a fork automatically.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
            <div className="border-b border-line lg:border-b-0 lg:border-r">
              <div className="p-3">
                <Input
                  placeholder="Label for this resume"
                  value={latexLabel}
                  onChange={(e) => setLatexLabel(e.target.value)}
                  aria-label="Resume label"
                  className="mb-2"
                />
                <textarea
                  ref={latexRef}
                  value={latexSource}
                  onChange={(e) => setLatexSource(e.target.value)}
                  spellCheck={false}
                  placeholder="Paste or write LaTeX here…"
                  aria-label="LaTeX source"
                  rows={22}
                  className="w-full resize-y rounded-lg border border-line bg-surface p-3 font-mono text-[13px] leading-5 text-ink placeholder:text-ink-disabled focus:border-brand-600"
                />
              </div>
              {compileResult && !compileResult.ok && (
                <div className="border-t border-line bg-danger-bg px-4 py-3 text-sm">
                  <p className="font-semibold text-danger">
                    Compile failed{compileResult.code && ` (${compileResult.code})`}
                  </p>
                  {compileResult.hint && <p className="mt-0.5 text-danger">{compileResult.hint}</p>}
                  <ul className="mt-1 space-y-1 font-mono text-xs">
                    {compileResult.errors.map((e, i) => (
                      <li key={i} className="text-danger">
                        {e.line != null && (
                          <button onClick={() => jumpToLine(e.line)} className="mr-1 rounded border border-danger-border px-1 hover:bg-surface">
                            line {e.line}
                          </button>
                        )}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="min-h-[300px] bg-surface-subtle">
              {compileResult?.ok && pdfUrl ? (
                <div className="p-3">
                  <p className="tabular mb-2 text-xs text-ink-muted">
                    {(compileResult.size_bytes / 1024).toFixed(1)} KB / 250 KB PDF
                    {compileResult.recompressed && ' · recompressed'}
                  </p>
                  <iframe title="LaTeX preview" src={pdfUrl} className="h-[560px] w-full rounded-lg border border-line bg-surface" />
                </div>
              ) : (
                <div className="flex h-full min-h-[300px] items-center justify-center p-6 text-center text-sm text-ink-muted">
                  Press Compile to see the PDF preview here.
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="animate-shimmer h-56 rounded-lg bg-surface-subtle" />)}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {/* Upload dropzone card */}
          <li>
            <form
              onSubmit={handleUpload}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                pickFile(e.dataTransfer.files?.[0] ?? null)
              }}
              className={cx(
                'flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition-colors',
                dragOver ? 'border-brand-600 bg-brand-50' : 'border-line-strong bg-surface hover:border-brand-200',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                aria-label="Choose PDF file"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              <UploadCloud size={28} className="text-ink-muted" aria-hidden />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                {file ? file.name : 'Drop a PDF here or browse'}
              </button>
              {file && <span className="tabular text-xs text-ink-muted">{kb(file.size)} / 250 KB</span>}
              <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Resume label" className="mt-1" />
              <Input placeholder="Tags, comma separated" value={tags} onChange={(e) => setTags(e.target.value)} aria-label="Resume tags" />
              <Button type="submit" variant="primary" size="sm" loading={uploading} disabled={!file}>
                Upload PDF
              </Button>
              <AiButton size="sm" onClick={() => void openLatex()}>Write with LaTeX instead</AiButton>
            </form>
          </li>
          {resumes.length === 0 && (
            <li className="sm:col-span-1 xl:col-span-2">
              <Card className="h-full">
                <EmptyState
                  icon={<FileText size={24} aria-hidden />}
                  title="No resumes yet"
                  body="Upload your first PDF here, or write one in LaTeX."
                  action={
                    <div className="flex justify-center gap-2">
                      <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()}>
                        Upload a PDF
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void openLatex()}>
                        Write with LaTeX
                      </Button>
                    </div>
                  }
                />
              </Card>
            </li>
          )}
          {resumes.map((r, i) => {
            const warnings = r.current_version?.warnings ?? []
            const sizePct = r.current_version ? Math.min(100, (r.current_version.size_bytes / MAX_BYTES) * 100) : 0
            const sizeBar = r.current_version && r.current_version.size_bytes > 225280 ? 'var(--warning)' : 'var(--brand-600)'
            return (
              <li key={r.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 20}ms` }}>
                <Card className="group flex h-full flex-col p-5 transition-all duration-150 hover:border-brand-200 hover:shadow-e2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-subtle text-ink-muted" aria-hidden>
                      <FileText size={22} />
                    </span>
                    {r.is_default ? (
                      <span title="Default resume" className="text-brand-600"><Star size={18} fill="currentColor" aria-label="Default resume" /></span>
                    ) : (
                      <button onClick={() => handleDefault(r.id)} title="Set as default" aria-label={`Set ${r.label} as default`} className="text-ink-disabled opacity-0 hover:text-brand-600 group-hover:opacity-100">
                        <Star size={18} aria-hidden />
                      </button>
                    )}
                  </div>
                  <h3 className="mt-3 truncate text-[15px] font-semibold text-ink" title={r.label}>{r.label}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Chip tone="neutral">{r.kind}</Chip>
                    <Chip tone="neutral">v{r.version_count}</Chip>
                    {r.tags?.map((t) => <Chip key={t} tone="neutral">{t}</Chip>)}
                    {warnings.length > 0 && (
                      <Chip tone="warning" icon={<Flag size={14} aria-hidden />} title={`This PDF ${warningText(warnings)}. Sending it is at your discretion.`}>
                        flagged
                      </Chip>
                    )}
                  </div>
                  {r.current_version && (
                    <div className="tabular mt-2 text-xs text-ink-muted">
                      {kb(r.current_version.size_bytes)} / 250 KB
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-sunken">
                        <span className="block h-full rounded-full" style={{ width: `${sizePct}%`, background: sizeBar }} />
                      </span>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
                    <Button size="sm" variant="ghost" onClick={() => toggleVersions(r.id)}>
                      {expanded[r.id] ? 'Hide versions' : 'Versions'}
                    </Button>
                    {r.current_version && (
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(r.id, r.current_version!.id)} title="Download current version" aria-label={`Download ${r.label}`}>
                        <Download size={16} aria-hidden />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleDuplicate(r.id)} title="Fork as a copy" aria-label={`Fork ${r.label}`}>
                      <Copy size={16} aria-hidden />
                    </Button>
                    {r.kind === 'latex' && (
                      <Button size="sm" variant="ghost" onClick={() => handleEditLatex(r.id, r.label)}>
                        Edit LaTeX
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openDelete(r)} className="ml-auto hover:text-danger" title="Delete permanently" aria-label={`Delete ${r.label}`}>
                      <Trash2 size={16} aria-hidden />
                    </Button>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Input
                      placeholder="Rename…"
                      value={renames[r.id] ?? ''}
                      onChange={(e) => setRenames((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      aria-label={`Rename ${r.label}`}
                      className="h-8 text-[13px]"
                    />
                    <Button size="sm" variant="ghost" onClick={() => handleRename(r.id)}>Save</Button>
                  </div>
                  {expanded[r.id] && (
                    <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-ink-secondary">
                      {expanded[r.id].map((v) => (
                        <li key={v.id} className="flex flex-wrap items-center gap-1">
                          <span className="tabular">v{v.version_no} · {kb(v.size_bytes)}</span>
                          {v.warnings && v.warnings.length > 0 && (
                            <Chip tone="warning" icon={<Flag size={14} aria-hidden />}>{warningText(v.warnings)}</Chip>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {deleting && (
        <Modal
          title={`Permanently delete “${deleting.label}”?`}
          description="This permanently deletes the file and all versions. This can't be undone."
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}>Delete forever</Button>
            </>
          }
        >
          {usage && usage.drafts.length > 0 && (
            <p className="text-sm text-ink-secondary">
              {usage.drafts.length} draft(s) reference it; they will be unlinked, sent history keeps only filename + hash.
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
