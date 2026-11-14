import fixtureIndex from '../mocks/index.json'
import type { Query, Served } from './client'
import { ApiError } from './errors'
import type {
  AreaListResponse,
  CellPeriodDetailsResponse,
  MapCellsResponse,
  Problem,
  SourceComposition,
} from './types'

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

async function loadFixture(fixture: MockFixture): Promise<unknown> {
  const load = loaders[`../mocks/fixtures/${fixture.file}.json`]
  if (!load) {
    throw new ApiError('mock-missing', `Thiếu file dữ liệu mẫu ${fixture.file}.json`)
  }
  return load()
}

export async function mockRequest<T>(path: string, query: Query): Promise<Served<T>> {
  const fixture = findMockFixture(path, query)
  if (!fixture) {
    const derived = await deriveExactDateCellDetails(path, query)
    if (derived) {
      return { data: derived as T, servedBy: 'mock-derived' }
    }
    throw new ApiError('mock-missing', `Chưa có dữ liệu mẫu cho ${path}?${new URLSearchParams(query).toString()}`)
  }
  const body = await loadFixture(fixture)
  if (fixture.status >= 400) {
    const problem = body as Problem
    throw new ApiError('problem', problem.detail, fixture.status, problem)
  }
  return { data: body as T, servedBy: 'mock' }
}

/**
 * For one cell and one exact date there is exactly one source code, so the cell period-details
 * response is fully determined by the exact-date map (value, origin, source code, input count and
 * validity). This reproduces the backend rules for that case without inventing anything.
 */
async function deriveExactDateCellDetails(path: string, query: Query): Promise<CellPeriodDetailsResponse | null> {
  const match = /^\/cells\/([^/]+)\/period-details$/.exec(path)
  if (!match || Object.keys(query).length !== 1 || !query.date) {
    return null
  }
  const cellId = decodeURIComponent(match[1])
  const areasFixture = findMockFixture('/areas', {})
  const cell = areasFixture
    ? ((await loadFixture(areasFixture)) as AreaListResponse).items.find((item) => item.type === 'cell' && item.id === cellId)
    : undefined
  if (!cell) {
    return null
  }
  const maps = index.fixtures.filter((fixture) => fixture.path === '/map/cells' && fixture.status === 200
    && fixture.query.date === query.date)
  for (const fixture of maps) {
    const map = (await loadFixture(fixture)) as MapCellsResponse
    const value = map.cells.find((candidate) => candidate.cellId === cellId)
    if (!value || value.sourceCode === undefined || value.source === undefined || value.origin === null
      || value.origin === 'MIXED' || value.value === null) {
      continue
    }
    const source: SourceComposition = {
      sourceCode: value.sourceCode,
      source: value.source,
      origin: value.origin,
      cellCount: 1,
      contributingCellDayCount: 1,
      harmonizedValue: value.value,
      inputObservationCount: value.inputObservationCount ?? 0,
      sourceInputValidCellCount: value.sourceInputValid ? 1 : 0,
    }
    const warnings = map.meta.warnings.filter((code) => code !== 'DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY'
      && code !== 'AQUA_FALLBACK_AFTER_ORBIT_DRIFT' && code !== 'TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY'
      && code !== 'MODEL_REDISTRIBUTED_DAILY_VALUE')
    if (value.sourceCode === 1) {
      warnings.push('TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY')
    }
    if (value.sourceCode === 1 || value.sourceCode === 2) {
      warnings.push('MODEL_REDISTRIBUTED_DAILY_VALUE')
    }
    return {
      cell,
      temporalSelector: map.temporalSelector,
      value: value.value,
      valueStatus: value.valueStatus,
      origin: value.origin,
      sourceComposition: [source],
      meta: { ...map.meta, warnings },
    }
  }
  return null
}
