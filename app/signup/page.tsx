'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthLink, AuthShell } from '../_auth'
import { Banner, Button, Field, Input } from '@/components/ui'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess('Check your email for the confirmation link.')
    }
    setLoading(false)
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Write emails that change your career."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSignup} className="space-y-4">
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
        <Field label="Password" hint="At least 6 characters.">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <Banner tone="danger">{error}</Banner>}
        {success && <Banner tone="success">{success}</Banner>}
        <Button type="submit" variant="primary" loading={loading} className="w-full">
          Sign up
        </Button>
      </form>
    </AuthShell>
  )
}
