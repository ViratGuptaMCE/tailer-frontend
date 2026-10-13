import { createClient } from '@/lib/supabase/server'
import DashboardWidgets from './_widgets'

export const instant = false

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold leading-9 tracking-tight text-ink">
          Good to see you{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {today} — here&apos;s your outreach at a glance.
        </p>
      </div>
      <DashboardWidgets />
    </div>
  )
}
