import type { ReactNode } from 'react'
import type { ApiError, ServedBy } from '../api/client'
import type { Coverage, Origin } from '../api/types'
import { PROBLEM_COPY, formatDate, partialCopy } from '../lib/format'
import { ORIGIN_BADGE } from '../lib/scale'
import { useWarningMessage } from '../state/Metadata'

/** Labels data that does not come from the live backend. */
export function ServedByBadge({ servedBy }: { servedBy: ServedBy }) {
  if (servedBy === 'api') {
    return null
  }
  const text = {
    mock: 'Dữ liệu mẫu',
    'mock-fallback': 'Dữ liệu mẫu · backend chưa có API này',
    'mock-derived': 'Dữ liệu mẫu · suy ra từ bản đồ ngày',
  }[servedBy]
  return <span className="badge badge-mock" title="Chỉ dùng để phát triển giao diện và kiểm thử">{text}</span>
}

export function OriginBadge({ origin, long = false }: { origin: Origin | null; long?: boolean }) {
  if (!origin) {
    return null
  }
  const badge = ORIGIN_BADGE[origin]
  return (
    <span className={`badge badge-origin origin-${origin}`} title={badge.label}>
      <span aria-hidden="true">{badge.short}</span>
      <span className={long ? '' : 'visually-hidden'}>{long ? ` ${badge.label}` : badge.label}</span>
    </span>
  )
}

export function CoverageChip({ coverage }: { coverage: Coverage }) {
  if (!coverage.partial) {
    return <span className="badge">Đủ {coverage.coveredDayCount}/{coverage.expectedDayCount} ngày</span>
  }
  if (coverage.coveredStartDate === null) {
    return <span className="badge badge-outside">— Ngoài phạm vi dữ liệu</span>
  }
  return (
    <span className="badge badge-partial" title={partialCopy(coverage) ?? undefined}>
      ◐ Chưa đầy đủ: {formatDate(coverage.coveredStartDate)}–{formatDate(coverage.coveredEndDate)} ({coverage.coveredDayCount}/{coverage.expectedDayCount} ngày)
    </span>
  )
}

export function UpdatingNote({ show, what }: { show: boolean; what: string }) {
  return show ? <span className="badge badge-updating" role="status" aria-live="polite">Đang cập nhật {what}…</span> : null
}

export function WarningNotes({ codes, title = 'Lưu ý dữ liệu' }: { codes: string[]; title?: string }) {
  const message = useWarningMessage()
  if (codes.length === 0) {
    return null
  }
  return (
    <details className="warnings">
      <summary>{title} ({codes.length})</summary>
      <ul>
        {codes.map((code) => <li key={code}>{message(code)}</li>)}
      </ul>
    </details>
  )
}

export function ErrorNote({ error, onRetry, context }: { error: ApiError; onRetry?: () => void; context: string }) {
  const text = error.kind === 'mock-missing'
    ? 'Chưa có dữ liệu mẫu cho lựa chọn này. Dùng toàn quốc, khung ví dụ Tây Nguyên năm 2024 hoặc chuyển sang API thật.'
    : error.kind === 'network'
      ? 'Không kết nối được backend (cổng 8080). Kiểm tra backend hoặc chuyển sang dữ liệu mẫu.'
      : (error.code && PROBLEM_COPY[error.code]) ?? error.message
  const retryable = error.kind === 'network' || (error.status ?? 0) >= 500
  return (
    <div className="note note-error" role="alert">
      <strong>! Không tải được {context}.</strong> {text}
      {error.code && <span className="muted"> (mã {error.code})</span>}
      {retryable && onRetry && <button type="button" className="button" onClick={onRetry}>Thử lại</button>}
    </div>
  )
}

export function Card({ id, title, aside, children, className = '' }: {
  id: string
  title: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card ${className}`} aria-labelledby={`${id}-title`}>
      <div className="card-head">
        <h2 id={`${id}-title`}>{title}</h2>
        {aside && <div className="toolbar">{aside}</div>}
      </div>
      {children}
    </section>
  )
}
