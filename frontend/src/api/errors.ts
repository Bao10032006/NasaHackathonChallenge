import type { Problem } from './types'

export type ApiErrorKind = 'problem' | 'network' | 'mock-missing'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly problem: Problem | null

  constructor(kind: ApiErrorKind, message: string, status: number | null = null, problem: Problem | null = null) {
    super(message)
    this.kind = kind
    this.status = status
    this.problem = problem
  }

  /** Stable problem code when the backend (or a fixture) returned problem+json. */
  get code(): string | null {
    return this.problem?.code ?? null
  }
}
