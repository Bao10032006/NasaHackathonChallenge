import type { BaselineValue, CalendarValue } from '../api/types'
import { Async, CoverageBadge, CoverageView, Fields, MetaView, OriginText, Panel, StatusValue, WarningList } from '../components/raw'
import { STATUS_COPY, formatDate, formatDelta, formatValue } from '../lib/format'
import { useApi } from '../lib/useApi'
import { dayCalendarMonth, useAppState, useDispatch } from '../state/AppState'
import { calendarRequest, dayCalendarRequest } from './requests'

/** Value minus baseline median, only for complete AVAILABLE periods with an AVAILABLE baseline. */
function deltaFromBaseline(value: CalendarValue, baseline: BaselineValue | undefined): number | null {
  if (value.valueStatus !== 'AVAILABLE' || value.partial || value.value === null) {
    return null
  }
  if (!baseline || baseline.valueStatus !== 'AVAILABLE' || baseline.value === null) {
    return null
  }
  return value.value - baseline.value
}

/** 12 months (or 73 pentads in pentad mode) of the selected year, with the historical baseline. */
export function PeriodCalendar() {
  const state = useAppState()
  const dispatch = useDispatch()
  const calendar = useApi(calendarRequest(state))
  const pentadMode = state.filters.timeMode === 'pentad'

  return (
    <Panel id="period-calendar" title={pentadMode ? '73 pentad trong năm + mức lịch sử' : 'Hoạt động 12 tháng + mức lịch sử'}>
      <Async state={calendar}>
        {(data) => {
          const baselineByPeriod = new Map(data.baseline?.values.map((value) => [value.period, value]) ?? [])
          return (
            <>
              <h3>Tổng năm {data.year}</h3>
              <Fields
                rows={[
                  ['Tổng năm', <StatusValue key="total" value={data.summary.totalValue} status={data.summary.valueStatus} />],
                  [pentadMode ? 'Pentad cao nhất' : 'Tháng cao nhất', data.summary.peakPeriod
                    ? `${pentadMode ? 'Pentad' : 'Tháng'} ${data.summary.peakPeriod.period}: ${formatValue(data.summary.peakPeriod.value)}`
                    : 'Không có'],
                ]}
              />
              <CoverageView coverage={data.summary.coverage} />
              {data.baseline && (
                <p>
                  Mức lịch sử: {data.baseline.method} của các năm {data.baseline.referenceStartYear}–{data.baseline.referenceEndYear}
                  {data.baseline.excludesTargetYear ? `, bỏ năm ${data.year} để không tự so với chính nó` : ''}.
                  Chênh lệch chỉ là thống kê, không phải nhãn bất thường.
                </p>
              )}
              <table>
                <caption>Bấm một dòng để chọn {pentadMode ? 'pentad' : 'tháng'} đó</caption>
                <thead>
                  <tr>
                    <th>{pentadMode ? 'Pentad' : 'Tháng'}</th>
                    <th>Từ – đến</th>
                    <th>Giá trị</th>
                    <th>Trạng thái</th>
                    <th>Phạm vi dữ liệu</th>
                    <th>Origin</th>
                    <th>Mức lịch sử (median)</th>
                    <th>Số năm hợp lệ</th>
                    <th>Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  {data.values.map((value) => {
                    const baseline = baselineByPeriod.get(value.period)
                    const clickable = value.valueStatus !== 'OUTSIDE_DATASET_RANGE'
                    return (
                      <tr key={value.period} data-status={value.valueStatus} data-partial={value.partial}>
                        <td>
                          <button
                            type="button"
                            disabled={!clickable}
                            onClick={() => dispatch(pentadMode
                              ? { type: 'setPentad', pentad: value.period }
                              : { type: 'setMonth', month: value.period })}
                          >
                            {value.period}
                          </button>
                        </td>
                        <td>{formatDate(value.startDate)} – {formatDate(value.endDate)}</td>
                        <td><StatusValue value={value.value} status={value.valueStatus} /></td>
                        <td>{value.valueStatus}</td>
                        <td><CoverageBadge coverage={value.coverage} /></td>
                        <td><OriginText origin={value.origin} /></td>
                        <td>{baseline ? <StatusValue value={baseline.value} status={baseline.valueStatus} /> : '—'}</td>
                        <td>{baseline?.sampleSize ?? '—'}</td>
                        <td>{formatDelta(deltaFromBaseline(value, baseline))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <MetaView meta={data.meta} />
            </>
          )
        }}
      </Async>
    </Panel>
  )
}

/** 28–31 civil days of the month (wireframe v0.4: outside-range days stay visible but disabled). */
export function DayCalendar() {
  const state = useAppState()
  const dispatch = useDispatch()
  const month = dayCalendarMonth(state.filters)
  const days = useApi(dayCalendarRequest(state))

  return (
    <Panel id="day-calendar" title={month === null ? 'Lịch ngày' : `Lịch ngày tháng ${month}/${state.filters.year}`}>
      <Async state={days} idle={<p>Chọn một tháng (bấm dòng trong bảng 12 tháng) để xem lịch ngày.</p>}>
        {(data) => (
          <>
            <Fields
              rows={[
                ['Tổng tháng', <StatusValue key="total" value={data.summary.totalValue} status={data.summary.valueStatus} />],
                [data.summary.coverage.partial ? 'Ngày cao nhất (trong khoảng đã có dữ liệu)' : 'Ngày cao nhất',
                  data.summary.peakDate
                    ? `${formatDate(data.summary.peakDate.date)}: ${formatValue(data.summary.peakDate.value)}`
                    : 'Không có'],
              ]}
            />
            <CoverageView coverage={data.summary.coverage} />
            <table>
              <caption>Bấm một ngày có dữ liệu để xem bản đồ và nguồn của ngày đó (ngày bằng 0 vẫn bấm được)</caption>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Giá trị</th>
                  <th>Trạng thái</th>
                  <th>Một phần</th>
                  <th>Origin</th>
                  <th>Cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {data.values.map((value) => (
                  <tr
                    key={value.date}
                    data-status={value.valueStatus}
                    aria-selected={state.filters.timeMode === 'date' && state.filters.date === value.date}
                  >
                    <td>
                      <button
                        type="button"
                        disabled={value.valueStatus !== 'AVAILABLE'}
                        title={value.valueStatus === 'AVAILABLE' ? undefined : STATUS_COPY[value.valueStatus]}
                        onClick={() => dispatch({ type: 'setDate', date: value.date })}
                      >
                        {formatDate(value.date)}
                      </button>
                    </td>
                    <td><StatusValue value={value.value} status={value.valueStatus} /></td>
                    <td>{value.valueStatus}</td>
                    <td>{value.partial ? 'Có' : 'Không'}</td>
                    <td><OriginText origin={value.origin} /></td>
                    <td><WarningList codes={value.warnings} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <MetaView meta={data.meta} />
          </>
        )}
      </Async>
    </Panel>
  )
}
