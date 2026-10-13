'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthLink, AuthShell } from '../_auth'
import { Banner, Button, Field, Input } from '@/components/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/update-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess('Check your email for the password reset link.')
    }
    setLoading(false)
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <>
          Remember your password? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={handleReset} className="space-y-4">
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
        {error && <Banner tone="danger">{error}</Banner>}
        {success && <Banner tone="success">{success}</Banner>}
        <Button type="submit" variant="primary" loading={loading} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthShell>
  )
}
