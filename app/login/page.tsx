'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { AuthLink, AuthShell } from '../_auth'
import { Banner, Button, Field, Input } from '@/components/ui'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up your outreach."
      footer={
        <>
          Don&apos;t have an account? <AuthLink href="/signup">Sign up</AuthLink>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <Field label="Email address">
          <Input
            id="email-address"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <div className="text-right text-sm">
          <AuthLink href="/forgot-password">Forgot your password?</AuthLink>
        </div>
        {error && <Banner tone="danger">{error}</Banner>}
        <Button type="submit" variant="primary" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
