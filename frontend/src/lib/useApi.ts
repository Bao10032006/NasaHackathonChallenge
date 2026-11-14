import { useEffect, useRef, useState } from 'react'
import { ApiError, type Endpoint, type Served, type ServedBy } from '../api/client'

/**
 * - `loading` keeps the previous successful data (if any) so panels can show it dimmed with an
 *   "updating" label instead of jumping to an empty state; it is never presented as current.
 * - `success` carries `servedBy` so panels can label mock / fallback data.
 */
export type ApiState<T> =
  | { status: 'idle' }
  | { status: 'loading'; previous?: T }
  | { status: 'success'; data: T; servedBy: ServedBy }
  | { status: 'error'; error: ApiError }

export type ApiResult<T> = ApiState<T> & { retry: () => void }

/** Snapshot data is immutable, so a successful response can be reused for the session. */
const cache = new Map<string, Promise<Served<unknown>>>()

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('network', String(error))
}

/**
 * Loads an endpoint; pass `null` to skip (e.g. no cell selected). Responses are cached by request key
 * (endpoint + every parameter + data source). Only the latest request of a component can update its
 * state, so fast filter changes never show an older selection. Failed requests are evicted so Retry
 * can try again.
 */
export function useApi<T>(endpoint: Endpoint<T> | null): ApiResult<T> {
  const key = endpoint?.key ?? null
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ApiState<T>>({ status: 'idle' })
  const lastData = useRef<T | undefined>(undefined)

  useEffect(() => {
    if (!endpoint) {
      setState({ status: 'idle' })
      return
    }
    let active = true
    let pending = cache.get(endpoint.key) as Promise<Served<T>> | undefined
    if (!pending) {
      pending = endpoint.load()
      cache.set(endpoint.key, pending as Promise<Served<unknown>>)
      pending.catch(() => cache.delete(endpoint.key))
    }
    setState({ status: 'loading', previous: lastData.current })
    pending.then(
      (served) => {
        if (active) {
          lastData.current = served.data
          setState({ status: 'success', data: served.data, servedBy: served.servedBy })
        }
      },
      (error: unknown) => {
        if (active) {
          setState({ status: 'error', error: toApiError(error) })
        }
      },
    )
    return () => {
      active = false
    }
    // `key` captures every request parameter; `endpoint` itself is recreated on each render.
  }, [key, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, retry: () => setAttempt((value) => value + 1) }
}

/** Data to draw: the current response, or the previous one while a new request is loading. */
export function currentOrPrevious<T>(state: ApiState<T>): { data: T | undefined; stale: boolean } {
  if (state.status === 'success') {
    return { data: state.data, stale: false }
  }
  if (state.status === 'loading') {
    return { data: state.previous, stale: state.previous !== undefined }
  }
  return { data: undefined, stale: false }
}
