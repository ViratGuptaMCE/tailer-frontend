'use client'

import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Send, Sparkles } from 'lucide-react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { AiBanner } from '@/components/ui'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
}

interface DraftUpdate {
  draft_id: string
  version: number
}

function contextFromPath(path: string): { chip: string; page: Record<string, string> } {
  const draft = path.match(/\/drafts\/([^/]+)/)
  if (draft) return { chip: `Draft: ${draft[1].slice(0, 8)}…`, page: { draft_id: draft[1] } }
  const company = path.match(/\/companies\/([^/]+)/)
  if (company)
    return { chip: `Company: ${company[1].slice(0, 8)}…`, page: { company_id: company[1] } }
  return { chip: 'General', page: {} }
}

function renderMarkdown(text: string): React.ReactNode[] {
  const blocks = text.split(/\n\s*\n/)
  return blocks.map((block, i) => {
    const lines = block.split('\n')
    if (/^#{1,3}\s/.test(lines[0])) {
      return (
        <div key={i} className="font-semibold">
          {inline(lines[0].replace(/^#{1,3}\s*/, ''), `h${i}`)}
        </div>
      )
    }
    if (lines.every((l) => /^[-*]\s/.test(l))) {
      return (
        <ul key={i} className="list-disc pl-5">
          {lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^[-*]\s*/, ''), `li${i}-${j}`)}</li>
          ))}
        </ul>
      )
    }
    if (/^```/.test(lines[0])) {
      return (
        <pre key={i} className="overflow-x-auto rounded bg-gray-100 p-2 text-xs">
          {lines.slice(1, lines[lines.length - 1].startsWith('```') ? -1 : undefined).join('\n')}
        </pre>
      )
    }
    return (
      <p key={i} className="whitespace-pre-wrap">
        {lines.map((l, j) => (
          <React.Fragment key={j}>
            {inline(l, `p${i}-${j}`)}
            {j < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    )
  })
}

function inline(text: string, key: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return (
        <code key={`${key}-${i}`} className="rounded bg-gray-100 px-1 text-xs">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 1) {
      return <em key={`${key}-${i}`}>{part.slice(1, -1)}</em>
    }
    return <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>
  })
}

const SUGGESTIONS = [
  'Draft an outreach email for a company and role',
  'Make this shorter',
  'Rewrite for a recruiter',
  'Create a follow-up',
]

export default function ChatDrawer() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [activity, setActivity] = useState<string[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [updates, setUpdates] = useState<DraftUpdate[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const { chip, page } = contextFromPath(pathname)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activity])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || busy) return
    setBusy(true)
    setMessages((prev) => [...prev, { role: 'user', text: content }])
    setInput('')
    setActivity([])
    let assistant = ''
    const pushActivity = (line: string) => setActivity((prev) => [...prev.slice(-8), line])
    try {
      const supabase = createBrowserClient()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token ?? ''
      const res = await fetch(`${API_URL}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: content, thread_id: threadId, page }),
      })
      if (!res.ok || !res.body) throw new Error(`Chat failed (${res.status})`)
      setMessages((prev) => [...prev, { role: 'assistant', text: '' }])
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const applyText = (delta: string) => {
        assistant += delta
        const snapshot = assistant
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', text: snapshot }
          return next
        })
      }
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data:'))
          if (!line) continue
          const event = JSON.parse(line.slice(5).trim())
          if (event.type === 'text_delta') applyText(event.text ?? '')
          else if (event.type === 'tool_start') pushActivity(`${event.name}…`)
          else if (event.type === 'tool_result') pushActivity(`✓ ${event.summary ?? event.name}`)
          else if (event.type === 'thread') setThreadId(event.thread_id)
          else if (event.type === 'draft_updated')
            setUpdates((prev) => [
              ...prev,
              { draft_id: event.draft_id, version: event.version },
            ])
          else if (event.type === 'error') pushActivity(`Error: ${event.message}`)
        }
      }
    } catch (err: unknown) {
      pushActivity(err instanceof Error ? err.message : 'Chat failed')
    } finally {
      setBusy(false)
    }
  }

  // Drafting lives in the Draft Studio right rail, not this widget.
  if (/^\/dashboard\/drafts\/[^/]+$/.test(pathname)) return null

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-50 flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white shadow-e3 transition-opacity hover:opacity-95"
        style={{ background: 'var(--ai-gradient)' }}
      >
        <Sparkles size={16} aria-hidden />
        {open ? 'Close chat' : 'Ask AI'}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="AI assistant"
          className="animate-fade-up fixed bottom-[72px] right-4 z-50 flex h-[70vh] w-[calc(100vw-2rem)] max-w-96 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-e3"
        >
          <div className="flex items-center gap-2 border-b border-line bg-ai-50 px-4 py-3">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-white"
              style={{ background: 'var(--ai-gradient)' }}
              aria-hidden
            >
              <Sparkles size={14} />
            </span>
            <span className="text-sm font-semibold text-ink">Assistant</span>
            <span className="ml-auto rounded-sm border border-line bg-surface px-2 py-0.5 text-xs text-ink-secondary">{chip}</span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3" aria-live="polite">
            {updates.map((u) => (
              <AiBanner key={`${u.draft_id}-${u.version}`} version={u.version} />
            ))}
            {messages.length === 0 && (
              <p className="text-sm text-ink-muted">
                Ask me to draft, shorten, or personalize an email — I&apos;ll show my work and you approve everything.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i}>
                {m.role === 'user' ? (
                  <div className="ml-8 rounded-lg rounded-br-sm bg-brand-50 px-3 py-2 text-sm text-ink">
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: 'var(--ai-gradient)' }}
                      aria-hidden
                    >
                      <Sparkles size={12} />
                    </span>
                    <div className="min-w-0 flex-1 text-sm leading-6 text-ink">
                      {renderMarkdown(m.text || '…')}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {activity.length > 0 && (
              <ul className="space-y-1">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-ink-muted">
                    {a.startsWith('✓') || a.startsWith('Error') ? (
                      <Check size={12} aria-hidden className="text-success" />
                    ) : (
                      <Loader2 size={12} aria-hidden className="animate-spin" />
                    )}
                    {a}
                  </li>
                ))}
              </ul>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-line p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  disabled={busy}
                  className="rounded-full border border-ai-200 bg-ai-50 px-2.5 py-1 text-xs font-medium text-ai-600 hover:bg-ai-50 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void send(input)
              }}
              className="flex gap-1.5"
            >
              <input
                className="h-9 flex-1 rounded-md border border-line-strong bg-surface px-3 text-sm placeholder:text-ink-muted focus:border-brand-600"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about drafts, resumes, scheduling…"
                aria-label="Message the assistant"
              />
              <button
                type="submit"
                disabled={busy}
                aria-label="Send message"
                className="flex h-9 w-9 items-center justify-center rounded-md text-white shadow-e1 disabled:opacity-50"
                style={{ background: 'var(--ai-gradient)' }}
              >
                <Send size={16} aria-hidden />
              </button>
            </form>
          </div>
          {updates.length > 0 && (
            <div className="border-t border-line px-4 py-2">
              {updates.map((u) => (
                <div key={`link-${u.draft_id}-${u.version}`}>
                  <a
                    className="text-xs font-medium text-ai-600 hover:text-ai-500"
                    href={`/dashboard/drafts/${u.draft_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View diff in editor →
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
