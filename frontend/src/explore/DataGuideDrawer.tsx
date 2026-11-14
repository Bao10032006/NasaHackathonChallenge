import { ORIGIN_COPY, SOURCE_LABEL, formatDate } from '../lib/format'
import { useDispatch } from '../state/AppState'
import { useMetadata, useSnapshot } from '../state/Metadata'

/** "Nguồn và cách đọc dữ liệu", reachable in one click from Explore (wireframe v0.4 checklist). */
export function DataGuideDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const metadata = useMetadata()
  const { areas } = useSnapshot()
  const dispatch = useDispatch()
  const nationalCells = areas.status === 'success'
    ? areas.data.items.find((item) => item.type === 'national')?.cellCount
    : undefined
  if (!open) {
    return null
  }
  return (
    <aside className="drawer drawer-wide" role="dialog" aria-modal="false" aria-labelledby="guide-title" onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <div className="drawer-head">
        <h2 id="guide-title">Nguồn và cách đọc dữ liệu</h2>
        <button type="button" className="button" onClick={onClose} aria-label="Đóng hướng dẫn" autoFocus>✕</button>
      </div>
      <div className="drawer-body guide">
        <h3>Dữ liệu đến từ đâu</h3>
        <p>
          Điểm cháy được lấy từ NASA FIRMS (Fire Information for Resource Management System): cảm biến MODIS trên vệ tinh
          Terra, Aqua và VIIRS trên S‑NPP, NOAA‑20. Mỗi cảm biến nhìn thấy số lượng điểm cháy khác nhau nên không cộng thô được.
        </p>
        <h3>snpp_eq là gì</h3>
        <p>
          <strong>snpp_eq — số phát hiện tương đương S‑NPP</strong>: mọi nguồn được hài hòa về thang của VIIRS S‑NPP (chỉ phát
          hiện ban ngày, đã lọc nguồn nhiệt cố định). Giá trị có thể là số thập phân. Đây không phải số vụ cháy, diện tích cháy,
          dự báo hay cảnh báo cháy.
        </p>
        <h3>Ô lưới trên bản đồ</h3>
        <p>
          Việt Nam được chia thành {nationalCells ?? 'các'} ô {metadata?.gridDegrees ?? 0.25}° (khoảng 27 km). Mỗi ô mang tổng
          snpp_eq của kỳ đang xem; tâm ô chỉ là ký hiệu lưới, không phải tọa độ điểm cháy. Vùng phân tích (Tây Nguyên, Tây Bắc…)
          không phải ranh giới hành chính.
        </p>
        <h3>Ngày chốt và phạm vi</h3>
        <p>
          {metadata
            ? <>Dữ liệu có từ {formatDate(metadata.dateRange.start)} đến hết {formatDate(metadata.meta.dataThrough)} (giờ UTC). Năm {metadata.yearRange.start} và {metadata.yearRange.end} chưa đủ năm; ngày ngoài khoảng này hiển thị “ngoài phạm vi”, không phải 0.</>
            : 'Đang tải phạm vi dữ liệu…'}
        </p>
        <h3>Đọc nguồn gốc của giá trị</h3>
        <ul>
          {metadata?.sourceCodes.map((source) => (
            <li key={source.code}><strong>{SOURCE_LABEL[source.source]}</strong>: {ORIGIN_COPY[source.origin]}</li>
          ))}
        </ul>
        <h3>Giới hạn của giá trị theo ngày</h3>
        <p>
          Với giai đoạn MODIS (trước 2012 và các ngày vá), giá trị ngày là tổng tháng của mô hình được phân bổ xuống ngày, nên có
          thể dương khi vệ tinh không ghi nhận gì trong ngày.
          {metadata?.daily.uncertaintyIntervalAvailable ? '' : ' Không có khoảng bất định cho giá trị theo ngày;'} kiểm định
          chủ yếu ở cấp tháng và kỳ 5 ngày.
        </p>
        {metadata && (
          <>
            <h3>Giới hạn diễn giải</h3>
            <ul>{metadata.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
            <p className="muted small">Phiên bản dữ liệu {metadata.meta.dataVersion} · mô hình {metadata.meta.modelVersion}</p>
          </>
        )}
        <button type="button" className="button" onClick={() => { onClose(); dispatch({ type: 'setScreen', screen: 'notes' }) }}>
          Xem đầy đủ ở màn Nguồn dữ liệu
        </button>
      </div>
    </aside>
  )
}
