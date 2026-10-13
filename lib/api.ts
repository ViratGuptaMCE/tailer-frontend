import { createClient as createBrowserClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  // Try to get the session token to pass to the backend
  let token = ''
  
  if (typeof window !== 'undefined') {
    const supabase = createBrowserClient()
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      token = data.session.access_token
    }
  } else {
    // If running on the server, we might need to get it from the server client.
    // However, usually we make backend requests from the client components for settings.
    // For server components, we'd pass the token directly.
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
  })

  if (options.headers) {
    new Headers(options.headers).forEach((value, key) => {
      headers.set(key, value)
    })
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    // Normalise errors — backend uses {error:{code,message,details}}, tolerate legacy shapes.
    let errorMessage = 'An error occurred'
    let errorData: unknown = null
    try {
      errorData = await response.json()
      const body = errorData as {
        error?: { message?: string }
        detail?: unknown
        message?: string
      }
      const detail = body.detail
      errorMessage =
        body.error?.message ||
        (typeof detail === 'string' ? detail : undefined) ||
        (detail && typeof detail === 'object' && 'message' in (detail as Record<string, unknown>)
          ? String((detail as Record<string, unknown>).message)
          : undefined) ||
        body.message ||
        errorMessage
    } catch {
      errorMessage = response.statusText
    }
    const err = new Error(errorMessage) as Error & { details?: unknown }
    // Structured payload (e.g. deliverability findings) for callers that want it.
    err.details = errorData
    throw err
  }

  // Allow 204 No Content
  if (response.status === 204) {
    return null
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function authHeaders(): Promise<Headers> {
  const headers = new Headers()
  if (typeof window !== 'undefined') {
    const supabase = createBrowserClient()
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      headers.set('Authorization', `Bearer ${data.session.access_token}`)
    }
  }
  return headers
}

function parseErrorBody(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null) {
    const err = body as {
      error?: { message?: string }
      detail?: string
      message?: string
    }
    return err?.error?.message || err.detail || err.message || fallback
  }
  return fallback
}

export async function fetchFormApi(endpoint: string, form: FormData) {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: form,
  })
  if (!response.ok) {
    let errorMessage = 'An error occurred'
    try {
      errorMessage = parseErrorBody(await response.json(), errorMessage)
    } catch {
      errorMessage = response.statusText
    }
    throw new Error(errorMessage)
  }
  return response.json()
}
