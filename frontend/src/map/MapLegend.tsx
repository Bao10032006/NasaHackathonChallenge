import { ACTIVITY_COLORS, ZERO_COLOR, readableValue } from '../lib/scale'

/**
 * Colour legend, shown as a strip under the map so it never hides cells. The scale is normalised per
 * view: 0 → the highest cell of the period (or of both periods in Compare), so colours are comparable
 * inside one view, not across periods.
 */
export function MapLegend({ max, middle, shared = false }: { max: number | null; middle: number; shared?: boolean }) {
  return (
    <div className="map-legend" role="group" aria-label="Chú giải màu bản đồ">
      <span className="map-legend-title">snpp_eq mỗi ô</span>
      <div className="legend-scale">
        <div className="legend-ramp" aria-hidden="true">
          {ACTIVITY_COLORS.map((color) => <span key={color} style={{ background: color }} />)}
        </div>
        <div className="legend-ramp-labels num">
          <span>&gt;0</span>
          <span>{readableValue(middle)}</span>
          <span>{readableValue(max)}</span>
        </div>
      </div>
      <span className="legend-row"><span className="swatch" style={{ background: ZERO_COLOR }} />0 · không có phát hiện</span>
      <span className="legend-row"><span className="swatch swatch-outside" />Ngoài phạm vi dữ liệu</span>
      <p className="legend-note">
        {shared
          ? 'Thang chung cho cả hai bản đồ, chuẩn hóa theo ô cao nhất của hai kỳ.'
          : 'Thang tự chuẩn hóa theo ô cao nhất của kỳ đang xem; không so màu giữa các kỳ.'}
      </p>
    </div>
  )
}
