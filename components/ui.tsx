'use client'

/* Shared UI primitives built on the design.md tokens (light theme only). */

import React from 'react'
import {
  Ban,
  Bell,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  FilePen,
  Hourglass,
  Info,
  KeyRound,
  Loader2,
  Pause,
  Reply,
  Send,
  Sparkles,
} from 'lucide-react'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/* ---------- Buttons (design §6.1) ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'ai' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-e1 hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-subtle',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  ghost: 'text-ink-secondary hover:bg-surface-subtle hover:text-ink',
  ai: 'text-white shadow-e1 hover:opacity-95',
  danger: 'bg-surface text-danger border border-danger-border hover:bg-danger-bg',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const sizes = {
    sm: 'h-8 px-2.5 text-[13px]',
    md: 'h-9 px-3.5 text-sm',
    lg: 'h-11 px-[18px] text-sm',
  } as const
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_STYLES[variant],
        sizes[size],
        className,
      )}
      style={variant === 'ai' ? { background: 'var(--ai-gradient)', ...style } : style}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
}

export function AiButton(props: ButtonProps) {
  const { children, ...rest } = props
  return (
    <Button variant="ai" {...rest}>
      <Sparkles size={16} aria-hidden />
      {children}
    </Button>
  )
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cx('animate-spin', className)} aria-hidden />
}

/* ---------- Cards & page headers (design §6.3, §5.1) ---------- */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cx('rounded-lg border border-line bg-surface', className)}>{children}</div>
  )
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div>
        <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-ink-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-semibold leading-9 tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ---------- Chips & status (design §6.4, §2.5) ---------- */

export type ChipTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' | 'ai'

const CHIP_STYLES: Record<ChipTone, string> = {
  success: 'bg-success-bg text-success border-success-border',
  warning: 'bg-warning-bg text-warning border-warning-border',
  danger: 'bg-danger-bg text-danger border-danger-border',
  info: 'bg-info-bg text-info border-info-border',
  neutral: 'bg-surface-subtle text-ink-secondary border-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  ai: 'bg-ai-50 text-ai-600 border-ai-200',
}

export function Chip({
  tone = 'neutral',
  icon,
  children,
  className,
  title,
}: {
  tone?: ChipTone
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex h-[22px] items-center gap-1 rounded-sm border px-2 text-xs font-medium',
        CHIP_STYLES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <FilePen size={14} aria-hidden />,
  pending: <Clock size={14} aria-hidden />,
  scheduled: <Clock size={14} aria-hidden />,
  sending: <Loader2 size={14} className="animate-spin" aria-hidden />,
  sent: <Check size={14} aria-hidden />,
  awaiting_reply: <Hourglass size={14} aria-hidden />,
  replied: <Reply size={14} aria-hidden />,
  bounced: <CircleAlert size={14} aria-hidden />,
  failed: <CircleAlert size={14} aria-hidden />,
  opted_out: <Ban size={14} aria-hidden />,
  paused: <Pause size={14} aria-hidden />,
  auth_failed: <KeyRound size={14} aria-hidden />,
  cancelled: <Ban size={14} aria-hidden />,
  inbox: <Info size={14} aria-hidden />,
  promotions: <Bell size={14} aria-hidden />,
  spam: <CircleAlert size={14} aria-hidden />,
  updates: <Info size={14} aria-hidden />,
  unknown: <Info size={14} aria-hidden />,
}

const STATUS_TONES: Record<string, ChipTone> = {
  draft: 'neutral',
  pending: 'info',
  scheduled: 'info',
  sending: 'brand',
  sent: 'success',
  awaiting_reply: 'warning',
  replied: 'success',
  bounced: 'danger',
  failed: 'danger',
  opted_out: 'neutral',
  paused: 'warning',
  auth_failed: 'danger',
  cancelled: 'neutral',
  inbox: 'success',
  promotions: 'warning',
  spam: 'danger',
  updates: 'info',
  unknown: 'neutral',
}

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const key = (status || 'unknown').toLowerCase()
  return (
    <Chip tone={STATUS_TONES[key] ?? 'neutral'} icon={STATUS_ICONS[key]}>
      {label ?? status.replace(/_/g, ' ')}
    </Chip>
  )
}

/* ---------- Banners & feedback (design §6.8) ---------- */

const BANNER_STYLES: Record<'success' | 'warning' | 'danger' | 'info', string> = {
  success: 'bg-success-bg border-success-border text-success',
  warning: 'bg-warning-bg border-warning-border text-warning',
  danger: 'bg-danger-bg border-danger-border text-danger',
  info: 'bg-info-bg border-info-border text-info',
}

const BANNER_ICONS = {
  success: <CircleCheck size={16} aria-hidden />,
  warning: <CircleAlert size={16} aria-hidden />,
  danger: <CircleAlert size={16} aria-hidden />,
  info: <Info size={16} aria-hidden />,
}

export function Banner({
  tone = 'info',
  action,
  children,
}: {
  tone?: 'success' | 'warning' | 'danger' | 'info'
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx(
        'flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm',
        BANNER_STYLES[tone],
      )}
    >
      {BANNER_ICONS[tone]}
      <span className="flex-1 text-ink-secondary">{children}</span>
      {action}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        {icon}
      </div>
      <h3 className="mt-3 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-secondary">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-shimmer rounded-md bg-surface-subtle', className)} />
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

/* ---------- Modal (design §6.7) ---------- */

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(15,23,42,0.32)] p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'animate-fade-up w-full rounded-xl bg-surface shadow-e3',
          wide ? 'max-w-[720px]' : 'max-w-[520px]',
        )}
      >
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-secondary">{description}</p>}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}

/* ---------- Forms (design §6.2) ---------- */

const INPUT_BASE =
  'h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-600'

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string
  hint?: string
  error?: string | null
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-[13px] font-medium leading-5 text-ink-secondary"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-danger">
          <CircleAlert size={14} aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(INPUT_BASE, props.className)} />
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(INPUT_BASE, 'h-auto py-2', props.className)} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(INPUT_BASE, 'w-auto', props.className)} />
}

/* ---------- Tabs & stepper (design §6.6, §7.8) ---------- */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: ReadonlyArray<{ key: T; label: string }>
  value: T
  onChange: (key: T) => void
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cx(
            '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
            value === t.key
              ? 'border-brand-600 font-medium text-ink'
              : 'border-transparent text-ink-secondary hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={cx(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                done ? 'bg-brand-600 text-white' : active ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-muted',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check size={14} aria-hidden /> : i + 1}
            </span>
            <span className={cx('text-[13px]', active ? 'font-medium text-ink' : 'text-ink-muted')}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="mx-1 h-px flex-1 bg-line" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

/* ---------- Score ring, capacity, progress (design §7.2, §7.3) ---------- */

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const tone = score >= 85 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)'
  const label = score >= 85 ? 'Looks personal' : score >= 60 ? 'Needs a look' : 'Likely to be filtered'
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Deliverability score ${score} out of 100: ${label}`}
        className="transition-all"
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 320ms var(--ease-out-soft), stroke 320ms' }}
        />
        <text
          x="50%"
          y="50%"
          dy=".35em"
          textAnchor="middle"
          fontSize={size * 0.3}
          fontWeight={650}
          fill="var(--text)"
          className="tabular"
        >
          {score}
        </text>
      </svg>
      <span className="text-sm font-medium text-ink-secondary">{label}</span>
    </div>
  )
}

export function CapacityBar({ used, cap, label }: { used: number; cap: number; label?: string }) {
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0
  const bar = pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--brand-600)'
  return (
    <div title={label ?? `${used} of ${cap} used today`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: bar }} />
      </div>
      <div className="tabular mt-1 text-xs text-ink-muted">
        {used} of {cap} today{pct >= 100 ? ' · resumes tomorrow' : ''}
      </div>
    </div>
  )
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ---------- Avatar, stat cards, diffs (design §10, §8, §7.4) ---------- */

const AVATAR_TINTS = ['bg-brand-100 text-brand-700', 'bg-ai-50 text-ai-600', 'bg-success-bg text-success', 'bg-warning-bg text-warning', 'bg-info-bg text-info']

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997
  const tint = AVATAR_TINTS[hash % AVATAR_TINTS.length]
  return (
    <span
      aria-hidden
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', tint)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || '?'}
    </span>
  )
}

export function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  hint?: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-secondary">{label}</span>
        <span className="text-ink-muted">{icon}</span>
      </div>
      <div className="tabular mt-1 text-[28px] font-semibold leading-9 tracking-tight text-ink">{value}</div>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </Card>
  )
}

export function DiffLines({ lines }: { lines: string[] }) {
  if (!lines || lines.length === 0) return null
  return (
    <div className="overflow-hidden rounded-md border border-line font-mono text-xs">
      {lines.map((line, i) => {
        const added = line.startsWith('+') && !line.startsWith('+++')
        const removed = line.startsWith('-') && !line.startsWith('---')
        return (
          <div
            key={i}
            className={cx(
              'border-l-2 px-2 py-0.5 whitespace-pre-wrap',
              added && 'border-success bg-success-bg text-ink',
              removed && 'border-danger bg-danger-bg text-ink-secondary line-through',
              !added && !removed && 'border-transparent text-ink-secondary',
            )}
          >
            {line || ' '}
          </div>
        )
      })}
    </div>
  )
}

export function AiBanner({ version, onDiff, onRevert, onKeep }: { version: number; onDiff?: () => void; onRevert?: () => void; onKeep?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ai-200 bg-ai-50 px-4 py-2.5 text-sm">
      <Sparkles size={16} className="text-ai-500" aria-hidden />
      <span className="flex-1 font-medium text-ink">Updated by AI (v{version})</span>
      {onDiff && <Button size="sm" variant="soft" onClick={onDiff}>View diff</Button>}
      {onRevert && <Button size="sm" variant="ghost" onClick={onRevert}>Revert</Button>}
      {onKeep && <Button size="sm" variant="ghost" onClick={onKeep}>Keep</Button>}
    </div>
  )
}

/* Re-export a couple of icons pages use repeatedly */
export { Send }
