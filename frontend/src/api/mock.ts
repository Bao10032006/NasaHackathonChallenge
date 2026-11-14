import fixtureIndex from '../mocks/index.json'
import type { Query } from './client'
import { ApiError } from './errors'
import type { Problem } from './types'

/**
 * Mock adapter over the fixtures written by tools/frontend/build_mock_fixtures.py.
 * Fixtures marked `backend@<commit>` are verbatim backend responses; `generated:` ones cover
 * endpoints the backend does not implement yet (TASK 03B3). A request without a fixture fails
 * with kind `mock-missing` instead of inventing data.
 */

export interface MockFixture {
  file: string
  path: string
  query: Query
  status: number
  provenance: string
}

const index = fixtureIndex as { generatedFromCommit: string; fixtures: MockFixture[] }

const loaders = import.meta.glob<unknown>('../mocks/fixtures/*.json', { import: 'default' })

export const mockFixtures: readonly MockFixture[] = index.fixtures
export const mockGeneratedFromCommit = index.generatedFromCommit

function normalizeValue(value: string): string {
  const trimmed = value.trim()
  return trimmed !== '' && /^-?\d+(\.\d+)?$/.test(trimmed) ? String(Number(trimmed)) : trimmed
}

function normalize(query: Query): string {
  return Object.keys(query)
    .sort()
    .map((key) => `${key}=${normalizeValue(query[key])}`)
    .join('&')
}

export function findMockFixture(path: string, query: Query): MockFixture | undefined {
  const wanted = normalize(query)
  return index.fixtures.find((fixture) => fixture.path === path && normalize(fixture.query) === wanted)
}

export async function mockRequest<T>(path: string, query: Query): Promise<T> {
  const fixture = findMockFixture(path, query)
  if (!fixture) {
    throw new ApiError(
      'mock-missing',
      `Chưa có dữ liệu mẫu cho ${path}?${new URLSearchParams(query).toString()}`,
    )
  }
  const load = loaders[`../mocks/fixtures/${fixture.file}.json`]
  if (!load) {
    throw new ApiError('mock-missing', `Thiếu file dữ liệu mẫu ${fixture.file}.json`)
  }
  const body = await load()
  if (fixture.status >= 400) {
    const problem = body as Problem
    throw new ApiError('problem', problem.detail, fixture.status, problem)
  }
  return body as T
}
