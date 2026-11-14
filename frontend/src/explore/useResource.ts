import { useEffect, useReducer, useState } from 'react'
import { ApiError, request } from './api'

export function useResource<T>(url: string | null) {
  const [attempt, retry] = useReducer((value: number) => value + 1, 0)
  const [previousUrl, setPreviousUrl] = useState(url)
  const [result, setResult] = useState<{ url: string; attempt: number; data?: T; error?: string }>()

  if (previousUrl !== url) {
    setPreviousUrl(url)
    setResult(undefined)
  }

  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    void request<T>(url, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ url, attempt, data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ url, attempt, error: error instanceof ApiError ? error.code : 'REQUEST_FAILED' })
        }
      },
    )
    return () => controller.abort()
  }, [url, attempt])

  const current = url && result?.url === url && result.attempt === attempt ? result : undefined
  return { data: current?.data, error: current?.error, loading: Boolean(url && !current), retry }
}

export type Resource<T> = ReturnType<typeof useResource<T>>
