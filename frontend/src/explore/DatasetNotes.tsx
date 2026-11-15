import { useI18n } from '../i18n'

const warnings: Readonly<Record<string, readonly [string, string]>> = {
  PARTIAL_PERIOD: ['Kỳ được chọn chỉ có dữ liệu cho một phần số ngày.', 'The selected period has data for only some days.'],
  DATASET_EDGE_DATE: ['Đây là ngày cuối cùng có dữ liệu.', 'This is the last date available in the dataset.'],
  TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY: [
    'Một số giá trị từ tháng 11/2000 đến tháng 7/2002 là ước tính và có thể kém chính xác hơn.',
    'Some values from November 2000 to July 2002 are estimates and may be less precise.',
  ],
  MODEL_REDISTRIBUTED_DAILY_VALUE: ['Giá trị ngày được phân bổ từ ước lượng cấp tháng.', 'Daily values are apportioned from monthly estimates.'],
  NO_DAILY_UNCERTAINTY_INTERVAL: ['Chưa có thông tin về mức sai số theo ngày.', 'There is no estimate of how much daily values may vary.'],
  DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY: [
    'Các vùng chẩn đoán dùng phạm vi riêng và có thể khác địa giới hành chính.',
    'Diagnostic regions use custom extents that may differ from administrative boundaries.',
  ],
  AQUA_FALLBACK_AFTER_ORBIT_DRIFT: [
    'Một số giá trị dùng dữ liệu từ vệ tinh dự phòng có thời điểm quan sát thay đổi theo thời gian.',
    'Some values use data from a backup satellite whose observation time shifted over time.',
  ],
}

// The API exposes limitation descriptions without stable codes.
const englishLimitations: Readonly<Record<string, string>> = {
  'snpp_eq là số phát hiện tương đương S-NPP, không phải số vụ cháy hay diện tích cháy.': 'The snpp_eq metric represents S-NPP-equivalent detections. Fire event counts and burned area are outside its scope.',
  'Phân tích lịch sử, không phải cảnh báo thời gian thực hay dự báo.': 'This product supports historical analysis. Real-time alerts and forecasts are outside its scope.',
  'Chỉ phát hiện ban ngày; đã lọc nguồn nhiệt tĩnh.': 'The dataset includes daytime detections after filtering static heat sources.',
  'Không có khoảng bất định cấp ngày.': 'Daily uncertainty intervals are unavailable.',
  'Kiểm định phát hành ở cấp tháng/pentad, chưa có kiểm định riêng cấp ngày.': 'Validation covers monthly and five-day periods. Separate daily validation is unavailable.',
  '11/2000-7/2002 dựng từ Terra, độ tin cậy thấp.': 'Estimates from Terra/MODIS from November 2000 to July 2002 have higher uncertainty.',
  '8/2002-1/2012 là ước lượng từ Aqua đã hiệu chuẩn.': 'Values from August 2002 to January 2012 are estimated from calibrated Aqua/MODIS observations.',
  'Tây Nguyên trước 2012 có thể bị ước lượng cao khoảng 6-10%.': 'Values for the Central Highlands before 2012 may be overestimated by about 6–10%.',
  'Baseline 2003-2025 gồm giai đoạn Aqua ước lượng và S-NPP/NOAA-20.': 'The 2003–2025 baseline spans Aqua-based estimates and the S-NPP and NOAA-20 observation period.',
  'Vùng chẩn đoán không phải ranh giới hành chính.': 'Diagnostic regions use custom extents that may differ from administrative boundaries.',
  'Pentad 73 có 6 ngày ở năm nhuận.': 'The 73rd pentad has six days in leap years.',
}

export function DatasetWarning({ code, message }: { code: string; message: string }) {
  const { language } = useI18n()
  const translation = warnings[code]
  return <p className="notice" lang={translation ? undefined : 'vi'}>{translation?.[language === 'vi' ? 0 : 1] ?? message}</p>
}

export function DatasetLimitations({ limitations }: { limitations: string[] }) {
  const { language } = useI18n()
  if (!limitations.length) return null
  return <ul>{limitations.map((note) => {
    const english = englishLimitations[note]
    return <li key={note} lang={language === 'en' && !english ? 'vi' : undefined}>
      {language === 'en' && english ? english : note}
    </li>
  })}</ul>
}
