/*
 * Raw-data building blocks. They render every field the API returns as plain, unstyled HTML so the
 * UI can be redesigned later without losing information. Class names and data-* attributes are the
 * hooks for future styling; keep the semantics (status, origin, coverage, warnings) when restyling.
 */
import type { ReactNode } from 'react'
import type { ApiError } from '../api/client'
import type {
  Bounds,
  Coverage,
  Origin,
  ResponseMeta,
  SourceComposition,
  SpatialSelection,
  TemporalSelector,
  ValueStatus,
} from '../api/types'
import {
  AREA_TYPE_LABEL,
  DIAGNOSTIC_REGION_NOTE,
  ORIGIN_COPY,
  PROBLEM_COPY,
  SOURCE_LABEL,
  SOURCE_ORIGIN_SHORT,
  STATUS_COPY,
  formatDate,
  formatInteger,
  formatValue,
  partialCopy,
} from '../lib/format'
import type { ApiState } from '../lib/useApi'
import { useWarningMessage } from '../state/Metadata'

export function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="panel" aria-labelledby={`${id}-title`} data-panel={id}>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  )
}

export function Fields({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="fields">
      {rows.map(([label, value]) => (
        <div key={label} className="field">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Value with its status: AVAILABLE shows the number (including 0); other statuses show their copy. */
export function StatusValue({ value, status }: { value: number | null; status: ValueStatus }) {
  if (status === 'AVAILABLE' && value !== null) {
    return <span data-status={status}>{formatValue(value)}</span>
  }
  return <span data-status={status}>{STATUS_COPY[status]}</span>
}

export function StatusText({ status }: { status: ValueStatus }) {
  return <span data-status={status}>{status} · {STATUS_COPY[status]}</span>
}

export function OriginText({ origin }: { origin: Origin | null }) {
  if (origin === null) {
    return <span data-origin="none">—</span>
  }
  return <span data-origin={origin}>{origin} · {ORIGIN_COPY[origin]}</span>
}

export function BoundsText({ bounds }: { bounds: Bounds | undefined }) {
  if (!bounds) {
    return <>—</>
  }
  return <>tây {bounds.west} · nam {bounds.south} · đông {bounds.east} · bắc {bounds.north}</>
}

export function CoverageView({ coverage }: { coverage: Coverage }) {
  const note = partialCopy(coverage)
  return (
    <div className="coverage" data-partial={coverage.partial}>
      <Fields
        rows={[
          ['Kỳ được hỏi', `${formatDate(coverage.requestedStartDate)} – ${formatDate(coverage.requestedEndDate)}`],
          ['Khoảng có dữ liệu', coverage.coveredStartDate === null
            ? 'Không có'
            : `${formatDate(coverage.coveredStartDate)} – ${formatDate(coverage.coveredEndDate)}`],
          ['Số ngày (có / thiếu / tổng)',
            `${coverage.coveredDayCount} / ${coverage.uncoveredDayCount} / ${coverage.expectedDayCount}`],
          ['Một phần (partial)', coverage.partial ? 'Có' : 'Không'],
        ]}
      />
      {note && <p className="coverage-note" role="note">{note}</p>}
    </div>
  )
}

/** One-line coverage badge for table rows. */
export function CoverageBadge({ coverage }: { coverage: Coverage }) {
  if (!coverage.partial) {
    return <span data-partial="false">Đủ {coverage.coveredDayCount}/{coverage.expectedDayCount} ngày</span>
  }
  return <span data-partial="true">{partialCopy(coverage)}</span>
}

export function TemporalSelectorView({ selector }: { selector: TemporalSelector }) {
  return (
    <>
      <Fields
        rows={[
          ['Kiểu kỳ', selector.type],
          ['Năm', selector.year ?? '—'],
          ['Tháng', selector.month ?? '—'],
          ['Pentad', selector.pentad ?? '—'],
          ['Ngày', formatDate(selector.date)],
          ['Từ – đến', `${formatDate(selector.startDate)} – ${formatDate(selector.endDate)}`],
        ]}
      />
      <CoverageView coverage={selector.coverage} />
    </>
  )
}

export function SelectionView({ selection }: { selection: SpatialSelection }) {
  return (
    <>
      <Fields
        rows={[
          ['Kiểu chọn', selection.type === 'NAMED_AREA' ? 'NAMED_AREA · vùng có sẵn' : 'BOUNDING_BOX · khung tự khoanh'],
          ['Quy tắc', selection.selectionRule === 'CENTER_INCLUSIVE'
            ? 'CENTER_INCLUSIVE · ô được chọn khi tâm nằm trong hoặc trên biên khung'
            : 'NAMED_AREA_MEMBERSHIP · ô thuộc vùng'],
          ['Vùng', selection.area ? `${AREA_TYPE_LABEL[selection.area.type]} · ${selection.area.id}` : '—'],
          ['Khung yêu cầu', <BoundsText key="requested" bounds={selection.requestedBounds} />],
          ['Khung thực tế (bao các ô)', <BoundsText key="selected" bounds={selection.selectedBounds} />],
          ['Số ô', selection.cellCount],
        ]}
      />
      {selection.area?.type === 'diagnostic_region' && <p role="note">{DIAGNOSTIC_REGION_NOTE}</p>}
      <details>
        <summary>Danh sách {selection.cellCount} ô (thứ tự chuẩn của dataset)</summary>
        <p className="cell-ids">{selection.cellIds.join(', ')}</p>
      </details>
    </>
  )
}

export function WarningList({ codes }: { codes: string[] | undefined }) {
  const message = useWarningMessage()
  if (!codes || codes.length === 0) {
    return <p className="warnings-empty">Không có cảnh báo.</p>
  }
  return (
    <ul className="warnings">
      {codes.map((code) => (
        <li key={code} data-warning={code}>
          <code>{code}</code> — {message(code)}
        </li>
      ))}
    </ul>
  )
}

export function MetaView({ meta }: { meta: ResponseMeta }) {
  return (
    <details className="meta">
      <summary>Phiên bản và cảnh báo của phản hồi</summary>
      <Fields
        rows={[
          ['dataVersion', meta.dataVersion],
          ['modelVersion', meta.modelVersion],
          ['Dữ liệu đến hết', formatDate(meta.dataThrough)],
          ['Metric', `${meta.metric} (${meta.unit})`],
          ['Múi giờ', meta.timeZone],
        ]}
      />
      <WarningList codes={meta.warnings} />
    </details>
  )
}

export function SourceCompositionTable({ sources }: { sources: SourceComposition[] }) {
  if (sources.length === 0) {
    return <p>Không có nguồn đóng góp.</p>
  }
  return (
    <table className="source-composition">
      <caption>Thành phần nguồn (số phát hiện đầu vào là của vệ tinh, không phải snpp_eq)</caption>
      <thead>
        <tr>
          <th>Mã</th>
          <th>Nguồn</th>
          <th>Origin</th>
          <th>Số ô</th>
          <th>Số ô-ngày</th>
          <th>Giá trị hài hòa (snpp_eq)</th>
          <th>Số phát hiện đầu vào</th>
          <th>Ô-ngày có đầu vào hợp lệ</th>
        </tr>
      </thead>
      <tbody>
        {sources.map((source) => (
          <tr key={source.sourceCode} data-origin={source.origin}>
            <td>{source.sourceCode}</td>
            <td>{source.source} · {SOURCE_LABEL[source.source]}</td>
            <td>{source.origin} · {SOURCE_ORIGIN_SHORT[source.origin]}</td>
            <td>{formatInteger(source.cellCount)}</td>
            <td>{formatInteger(source.contributingCellDayCount)}</td>
            <td>{formatValue(source.harmonizedValue)}</td>
            <td>{formatInteger(source.inputObservationCount)}</td>
            <td>{formatInteger(source.sourceInputValidCellCount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ErrorView({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const code = error.code
  const copy = error.kind === 'mock-missing'
    ? 'Chưa có dữ liệu mẫu cho bộ lọc này. Dùng kịch bản demo (khung Tây Nguyên 107–108°E, 12–13°N) hoặc chuyển sang "API thật".'
    : error.kind === 'network'
      ? 'Không kết nối được backend. Kiểm tra backend ở cổng 8080 hoặc chuyển sang "Dữ liệu mẫu".'
      : (code && PROBLEM_COPY[code]) ?? 'Yêu cầu thất bại.'
  return (
    <div role="alert" className="error" data-error-kind={error.kind} data-problem-code={code ?? undefined}>
      <p>{copy}</p>
      <Fields
        rows={[
          ['Loại lỗi', error.kind],
          ['HTTP', error.status ?? '—'],
          ['Mã lỗi', code ?? '—'],
          ['Chi tiết', error.problem?.detail ?? error.message],
        ]}
      />
      {onRetry && (error.kind === 'network' || (error.status ?? 0) >= 500) && (
        <button type="button" onClick={onRetry}>Thử lại</button>
      )}
    </div>
  )
}

/** Renders loading / error / empty / success for one request. */
export function Async<T>({
  state,
  idle,
  children,
}: {
  state: ApiState<T> & { retry: () => void }
  idle?: ReactNode
  children: (data: T) => ReactNode
}) {
  switch (state.status) {
    case 'idle':
      return <>{idle ?? null}</>
    case 'loading':
      return <p role="status" aria-busy="true">Đang tải…</p>
    case 'error':
      return <ErrorView error={state.error} onRetry={state.retry} />
    case 'success':
      return <>{children(state.data)}</>
  }
}
