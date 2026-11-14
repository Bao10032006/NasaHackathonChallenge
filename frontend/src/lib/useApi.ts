import { useEffect, useState } from 'react'
import { ApiError, type Endpoint } from '../api/client'

export type ApiState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError }

/** Snapshot data is immutable, so a successful response can be reused for the session. */
const cache = new Map<string, Promise<unknown>>()

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('network', String(error))
}

/**
 * Loads an endpoint; pass `null` to skip (e.g. no cell selected). Responses are cached by request key
 * (endpoint + every parameter + data source); failed requests are evicted so Retry can try again.
 */
export function useApi<T>(endpoint: Endpoint<T> | null): ApiState<T> & { retry: () => void } {
  const key = endpoint?.key ?? null
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ApiState<T>>({ status: 'idle' })

  useEffect(() => {
    if (!endpoint) {
      setState({ status: 'idle' })
      return
    }
    let active = true
    setState({ status: 'loading' })
    let pending = cache.get(endpoint.key) as Promise<T> | undefined
    if (!pending) {
      pending = endpoint.load()
      cache.set(endpoint.key, pending)
      pending.catch(() => cache.delete(endpoint.key))
    }
    pending.then(
      (data) => active && setState({ status: 'success', data }),
      (error: unknown) => active && setState({ status: 'error', error: toApiError(error) }),
    )
    return () => {
      active = false
    }
    // The key captures every request parameter; `endpoint` itself is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  return { ...state, retry: () => setAttempt((value) => value + 1) }
}
