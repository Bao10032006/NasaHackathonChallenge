---
subtitle: REST API Specification & Data Contract
title: HỎA LỊCH
version: v0.2
updated: 2026-11-14
language: vi
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 04 · v0.2**

# 1. Phạm vi

API read-only `/api/v1` được triển khai bằng Spring Boot và đọc các artifact harmonization đã xử lý. API không retrain mô hình, không truy vấn NASA FIRMS trực tiếp và không yêu cầu database trong MVP.

Day View chưa thuộc contract production v0.2. Granularity hợp lệ là `year`, `month` hoặc `pentad` tùy endpoint.

# 2. Nguồn dữ liệu chính

| Artifact | Vai trò API |
|---|---|
| `web_cells_pentad.json` | Calendar/map pentad cấp cell, có null và source code cấp chuỗi. |
| `tables/cells_025.csv` | Cell ID, tâm, bounds và vùng chẩn đoán. |
| `tables/harmonized_025_month.csv` | Chuỗi cell × tháng và uncertainty. |
| `tables/harmonized_regions_pentad.csv` | Calendar pentad cho ToanQuoc và 5 vùng. |
| `tables/harmonized_national_year.csv` | Xu hướng quốc gia và minh chứng raw/harmonized. |
| `tables/exposure_month.csv`, `data_gaps.csv` | Coverage/gap metadata; không phải cloud mask hoàn chỉnh. |
| `summary.json`, validation/evidence tables | Metadata phương pháp và số đối chứng cho phần harmonization. |

`cube_daily_day_veg.npz` chỉ được đánh giá trong Day View discovery; backend v0.2 không phải phục vụ nó.

# 3. Quy ước contract

- JSON UTF-8; ngày `YYYY-MM-DD`; number hoặc `null`; không trả NaN/Infinity.
- `areaType = national | diagnostic_region | cell`.
- `areaId = ToanQuoc | DBSCL | DBSH | TayNguyen | TayBac | Khac | <cellId>` phù hợp `areaType`.
- `metric = snpp_eq`; display name “Số phát hiện tương đương S-NPP”.
- `granularity = year | month | pentad` theo endpoint; không chấp nhận `day` trong v0.2.
- `status = observed | estimated | missing` khi artifact cho phép phân biệt; `partial` là cờ coverage độc lập.
- Mọi response dữ liệu có `meta` hoặc tham chiếu metadata gồm `dataVersion`, `modelVersion`, `dataThrough`, `units`, `partial`, `warnings`.
- `0` là giá trị hợp lệ; missing dùng `null`/`status=missing`.
- HTTP 400 cho tham số sai, 404 cho area không tồn tại, 422 cho tổ hợp không hỗ trợ và 500 cho lỗi nội bộ.

# 4. Core Endpoints

| Method / URI | Parameters chính | Trách nhiệm |
|---|---|---|
| `GET /metadata` | — | Range, metric/unit, granularity, model/data version, partial/gap, source và giới hạn. |
| `GET /areas` | `type?` | Danh sách phạm vi/cell được hỗ trợ. |
| `GET /calendar` | `areaType,areaId,year,granularity=month|pentad,includeBaseline?` | Calendar một năm; có thể kèm baseline cùng kỳ. |
| `GET /map/cells` | `year,month` hoặc `year,pentad`; `areaType?,areaId?` | Slice cell cho bản đồ. |
| `GET /trends` | `areaType,areaId,startYear,endYear,granularity,period?` | Chuỗi lịch sử cùng metric; `period` dùng so cùng tháng/pentad. |

# 5. Supporting / Gated Endpoints

| Method / URI | Trạng thái | Trách nhiệm |
|---|---|---|
| `GET /harmonization/comparison` | Must cho demo | Trả chuỗi/số đối chứng raw versus harmonized đã kiểm tra; không chạy mô hình. |
| `GET /cells/{cellId}` | Should | Chi tiết cell cho kỳ được hỗ trợ. |
| `GET /anomalies` | Should, feature-gated | Chỉ bật sau khi chốt method/threshold/sample size. |
| `GET /export.csv` | Could | Xuất dữ liệu theo filter, kèm metadata. |

Không thêm `/daily` hoặc `granularity=day` nếu chưa phát hành contract mới sau Day View readiness review.

# 6. Calendar và baseline schema

Ví dụ minh họa schema, không phải số liệu thật. Giá trị `median` và khoảng năm bên dưới là phương án đề xuất; chỉ trở thành mặc định sau khi D02 Baseline được chốt:

```json
{
  "area": {"type": "diagnostic_region", "id": "TayNguyen"},
  "metric": "snpp_eq",
  "granularity": "pentad",
  "year": 2024,
  "values": [
    {"period": 1, "value": null, "status": "missing", "partial": false}
  ],
  "baseline": {
    "method": "median",
    "referenceStartYear": 2003,
    "referenceEndYear": 2023,
    "excludesTargetYear": true,
    "values": [
      {"period": 1, "value": 12.5, "sampleSize": 20, "status": "available"}
    ]
  },
  "meta": {
    "dataVersion": "v1-k60",
    "modelVersion": "k_cell_60",
    "dataThrough": "2026-11-13",
    "partial": false,
    "units": "S-NPP-equivalent daytime detections",
    "warnings": []
  }
}
```

Quy tắc:

- `baseline` chỉ xuất hiện khi `includeBaseline=true`.
- Baseline so đúng cùng period và area; giữ `0`, loại missing/không đạt coverage.
- `sampleSize` được tính riêng cho từng period.
- Baseline là ngữ cảnh lịch sử, không tự tạo anomaly label.

# 7. Trends và historical comparison

- `granularity=year` trả tổng năm phù hợp nguồn.
- `granularity=month|pentad` cần `period` để trả cùng kỳ qua nhiều năm.
- Mỗi point gồm `year`, `period?`, `value`, `status`, `partial`, `coverage?`.
- Response có thể kèm `comparison` gồm `targetValue`, `baselineValue`, `absoluteDelta`, `relativeDelta` khi phép chia có nghĩa, `sampleSize` và method.
- Không trả phần trăm thay đổi khi baseline bằng `0`; dùng warning hoặc `relativeDelta=null`.

# 8. Anomaly contract gate

`GET /anomalies` chỉ được bật khi metadata có một `anomalyMethodVersion` đã chốt. Response tối thiểu phải chứa:

- Area, metric, granularity và period.
- Target value và target coverage.
- Baseline method, reference years, sample size và threshold.
- `classification = high | typical | low | insufficient_baseline` hoặc bộ nhãn được phê duyệt.
- Warning rằng đây là phân tích lịch sử, không phải cảnh báo cháy.

Khi feature chưa sẵn sàng, endpoint không được trả classification giả; có thể không đăng ký route hoặc trả trạng thái feature-unavailable đã tài liệu hóa.

# 9. Harmonization comparison

Endpoint/payload demo chỉ đọc số liệu đối chứng đã xuất. Mỗi series phải có:

- `seriesType = raw_modis | raw_viirs | raw_merged_reference | harmonized`.
- Metric/unit riêng; UI không dùng chung scale/label nếu đơn vị không tương đương.
- Khoảng thời gian, nguồn artifact, data/model version và explanation key.
- Cảnh báo rằng raw counts từ cảm biến khác nhau không thể dùng như một chuỗi nhất quán.

# 10. Validation / Contract Tests

- **API-T01:** `/metadata` công bố Java API data contract, metric, range, `dataThrough`, versions và không hỗ trợ `day`.
- **API-T02:** `/areas` chỉ trả ToanQuoc, 5 vùng chẩn đoán và tối đa tập cell phát hành.
- **API-T03:** `/calendar` trả đúng 12 tháng hoặc 73 pentad, giữ missing/zero và partial.
- **API-T04:** `/calendar?includeBaseline=true` trả method, reference years và sample size cho từng period.
- **API-T05:** `/map/cells` khớp artifact nguồn trong sai số 0,01.
- **API-T06:** `/trends` không biến missing thành zero và cảnh báo năm partial.
- **API-T07:** area/time/granularity sai trả 4xx; `granularity=day` bị từ chối trong v0.2.
- **API-T08:** harmonization comparison khớp bảng đối chứng và không gắn cùng unit sai cho raw/harmonized.
- **API-T09:** anomaly endpoint không hoạt động nếu thiếu method version; khi bật phải có `insufficient_baseline`.
