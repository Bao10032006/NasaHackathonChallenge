# Data contract — Phân tích bất thường, so sánh và sự kiện cháy ước tính

| Mục | Giá trị |
|---|---|
| Phiên bản | `analytics-contract-v0.2-draft` (thay v0.1) |
| Quan hệ | Mở rộng, không ghi đè `HoaLich_04_API_Data_Contract_v0.4.md` |
| Quy tắc | `QUY_TAC_PHAN_TICH_BAT_THUONG_VA_SO_SANH.md` (**QT**; mã quy tắc EV-, AC-, AN-, DQ-, CMP-) |
| Cấu hình | `ANALYTICS_RULES_CONFIG.json` (**CFG**) |
| Phạm vi | **Tài liệu đặc tả.** Chưa có mã backend hay frontend nào được sửa |

Nguyên tắc giữ từ v0.4:

- Read-only `/api/v1`, Problem Details.
- Frontend điều khiển trạng thái theo `code`/`status`, không đọc `detail`.
- Không chạy harmonization hay gom sự kiện trong request.
- Mọi thời gian lưu theo UTC. Ngày hiển thị là ngày địa phương Asia/Ho_Chi_Minh (QT TM-02).

---

## 1. Phiên bản

| Trường | Giá trị hiện tại | Đổi khi |
|---|---|---|
| `pipelineVersion` / `dataVersion` / `modelVersion` | `1.0` / `hoalich-data-v1-2026-11-13` / `lai-clim-s2-k60-kappa3` | Có snapshot `snpp_eq` mới |
| `pointsVersion` | `hoalich-points-v1.6-2026-11-13` | Có tệp điểm mới, hoặc NRT được thay bằng archive |
| `filterVersion` | `event-filter-v1` (EV-01) | Đổi `type`/confidence/FRP |
| `eventRuleVersion` | `experimental_v1` (EV-02 … EV-04) | Đổi 10 phút / 1 km / 24 giờ |
| `baselineVersion` | `bl-v0.2` (QT Phần IV) | Đổi cửa sổ, chế độ, `n` tối thiểu |
| `anomalyMethodVersion` | `rank_a10_v0` (AN-01/02) | Đổi α hoặc phương pháp |
| `analyticsRulesVersion` | `analytics_rules_v0.2-draft` | Đổi CFG |

Mọi response mang **toàn bộ** các phiên bản liên quan trong `meta.versions`. Cache key phải chứa các phiên bản này.

---

## 2. Mô hình dữ liệu (offline → artifact → backend)

Python sinh tất cả bảng offline; backend chỉ đọc và kiểm tra sha256. Bảng nhánh B dùng lại artifact TASK 03A; bảng nhánh A là artifact mới `events/`.

### 2.1. `raw_detections` (nhánh A; nguồn: tệp điểm, giữ nguyên giá trị gốc)

| Cột | Kiểu | Null | Ghi chú |
|---|---|---|---|
| `detectionId` | string | không | SHA-256(`satellite`, `observedUtc`, `lat`, `lon`, `src`)[:16] |
| `lat`, `lon` | float64 | không | Tâm pixel |
| `observedUtc` | timestamp UTC (phút) | không | `acq_date` + `acq_time` 4 chữ số |
| `localDate` | date | không | TM-02 |
| `satellite` | enum `Terra`, `Aqua`, `SNPP`, `N20`, `N21` | không | |
| `instrument` | enum `MODIS`, `VIIRS` | không | |
| `dayNight` | `D` / `N` | không | |
| `frpMw` | float | có | Không thay null bằng 0 |
| `brightnessK`, `brightness31K` | float | có | Kênh khác nhau theo cảm biến (QT 1.2) |
| `scanKm`, `trackKm` | float | không | |
| `confidenceRaw` | string | có | Giá trị gốc (`"71"` hoặc `"n"`) |
| `confidenceClass` | `l` / `n` / `h` | có | |
| `type` | int 0–3 | **có** | NRT: null |
| `typeStatus` | `REPORTED`, `MISSING`, `INFERRED_FROM_STATIC_MASK` | không | |
| `src` | `archive` / `nrt` | không | |
| `version` | string | không | `6.03`, `6.1NRT`, `2`, `2.0NRT` |
| `cellId` | string | có | null nếu ngoài lưới 587 ô |
| `inStaticMask` | bool | không | |
| `brightnessFlag` | enum (§3.4) | không | |
| `filterPassed` | bool | không | EV-01 |
| `filterReasons` | string[] | không | Có thể nhiều lý do |
| `supersededBy` | string | có | `detectionId` archive thay cho bản NRT (§7) |

### 2.2. `observation_groups`

`groupId`, `satellite`, `startUtc`, `endUtc`, `detectionCount`, `passedCount`, `frpSumMw` (chỉ trong nhóm, **chưa loại trùng**, cờ `FRP_SUM_NOT_DEDUPLICATED`), `frpMaxMw`, `windowMinutes` (10), `groupingMethod` (`TIME_WINDOW_PROXY`, sau này `GRANULE`).

### 2.3. `clusters` và `events`

- `clusters`: `clusterId`, `groupId`, `eventId`, `detectionCount`, `linkStatus` (`NEW`, `LINKED`, `AMBIGUOUS`), `matchedEventIds[]`.
- `events`: `eventId`, `eventRuleVersion`, `linkStatus` (`CLEAR`, `AMBIGUOUS`), `firstObservedUtc`, `lastObservedUtc`, `observedSpanHours`, `detectionCount`, `observationGroupCount`, `satellites[]`, `cellIds[]`, `detectionBounds`, `maxFrpMw` cùng `maxFrpSatellite`, `containsNight`, `flags[]` (`LONG_CHAIN`, `TYPE_INFERRED`, `AT_SENSOR_CEILING_PRESENT`, `CROSSES_EVENT_DATA_THROUGH`).

Kết quả chạy thử (QT EV-04):

| Detection | Cụm | Sự kiện | Cụm `AMBIGUOUS` |
|---:|---:|---:|---:|
| 1.161.304 | 800.554 | 706.206 | 8.298 |

### 2.4. `cell_period_aggregates`

Khóa: `cellId` × `periodType` (`day`, `pentad`, `month`, `season`, `year`) × `periodKey` × `branch` (`A_DETECTIONS`, `B_SNPP_EQ`) × `filterVersion`.

| Nhánh | Cột |
|---|---|
| A | `detectionCountBySatDn{}`, `passedCount`, `detectionDays` (theo một vệ tinh), `groupCount`, `clusterCount`, `eventCountClear`, `ambiguousClusterCount`, `frpQuantilesBySatDn{}` |
| B | `snppEq`, `sourceCodeDays{1..4}`, `inputCount`, `lo90`, `hi90` (chỉ cấp tháng/pentad và chỉ mã 2) |
| Chung | `coverage` (v0.4 §4.2), `observation` (§3.3) |

Tổng hợp vùng = cộng theo `cellIds` của selection. Không nội suy giá trị ô cho vùng nhỏ hơn ô (QT SP-02).

### 2.5. `historical_baselines`

`baselineId`, `areaKey`, `periodType`, `periodKey`, `mode` (`RETROSPECTIVE` / `OPERATIONAL`), `window` (`FULL`, `RECENT`, `EXPANDING`), `startYear`, `endYear`, `excludedYears[]` kèm lý do, `n`, `median`, `j`, `lowCut`, `highCut`, `mad`, `values[]` (giữ nguyên để kiểm toán), `baselineVersion`, `dataVersion`.

### 2.6. `anomaly_assessments`

`assessmentId`, `ruleId`, `areaKey`, `period`, `mode`, `window`, `value`, `valueStatus`, `classification`, `classificationReason`, `attentionLevel` (0, 1, 1′, 2), `delta`, `deltaPct`, `percentile`, `rank`, `rankOf`, `robustZ`, `interval90`, `dataQualityFlags[]`, `explanation` (câu UI), `computedAtUtc`, `versions{}`.

### 2.7. `data_quality`

Theo ngày × vệ tinh × dải (`toan_quoc`, `Bac`, `Trung`, `Nam`):

- `observationStatus` (`OBSERVED_NO_KNOWN_GAP`, `OUTAGE`, `NOT_IN_ARCHIVE_YET`, `NRT_ONLY`, `SATELLITE_NOT_OPERATING`);
- `missingFieldCounts{type, confidence, frp}`;
- `versions[]`;
- `sourceCodeShare` cho ngày đó.

`OBSERVED_NO_KNOWN_GAP` **không** có nghĩa là quan sát đầy đủ: không có dữ liệu mây.

### 2.8. `rule_configurations`

Lưu nguyên CFG theo `analyticsRulesVersion`, kèm sha256. Response chỉ trích các tham số đã dùng (`meta.ruleParams`).

---

## 3. Trạng thái và phân biệt bắt buộc

### 3.1. Sáu trường hợp không được trộn

| Trường hợp | `value` | Trạng thái | Câu UI |
|---|---|---|---|
| Đo được và bằng 0 | `0` | `AVAILABLE` | “Không có phát hiện trong dữ liệu (0)” |
| Không có detection nào và trạng thái quan sát chưa rõ (ví dụ ngoài các đợt mất dữ liệu đã biết; không có thông tin mây) | `0` | `AVAILABLE` + `observation.status = OBSERVED_NO_KNOWN_GAP` + cảnh báo `NO_CLOUD_INFORMATION` | “Không có phát hiện; không xác định được có mây che hay không” |
| Không có quan sát hợp lệ (vệ tinh mất dữ liệu) | `null` | `MISSING` (nhánh A) hoặc `AVAILABLE` + `sourceCode = 4` (nhánh B đã vá) | “Vệ tinh không quan sát” / “Giá trị vá từ NOAA-20” |
| Ngoài phạm vi dữ liệu | `null` | `OUTSIDE_DATASET_RANGE` / `OUTSIDE_EVENT_RANGE` | “Chưa có dữ liệu” |
| Không đủ lịch sử | Có `value` | `classification = INSUFFICIENT_BASELINE` | “Chưa đủ số năm tham chiếu để xếp loại” |
| Không thể so sánh | `delta = null` | `differenceAvailable = false` + `reasons[]` | “Không so được: …” |

`null` không bao giờ bị hiển thị thành 0. 0 không bao giờ được dùng cho thiếu dữ liệu (D18).

### 3.2. `classification`

`HIGH`, `LOW`, `POSSIBLY_HIGH`, `POSSIBLY_LOW`, `TYPICAL`, `INSUFFICIENT_BASELINE`, `LOW_ACTIVITY`, `NOT_ASSESSED`, `NOT_CLASSIFIED_SCOPE`.

Giá trị `classificationReason`:

| Giá trị | Ý nghĩa |
|---|---|
| `ABOVE_HIGH_CUT`, `BELOW_LOW_CUT`, `BETWEEN_CUTS` | Vị trí so với ngưỡng |
| `INTERVAL_OVERLAPS_CUT` | Khoảng bất định chạm ngưỡng |
| `N_TOO_SMALL_FOR_ALPHA` | Không đủ số năm cho α |
| `MEDIAN_BELOW_MIN_ACTIVITY` | Mức hoạt động tham chiếu quá thấp |
| `SOURCE_CODE_1` | Kỳ thuộc đoạn Terra sớm |
| `DAY_LEVEL_NOT_LABELLED` | Không gắn nhãn ngày lẻ |
| `SCOPE_NOT_ENABLED` | Loại vùng chưa được bật nhãn |

### 3.3. `observation.status`

`OBSERVED_NO_KNOWN_GAP`, `OUTAGE`, `PARTIAL_OBSERVATION`, `NRT_ONLY`, `NOT_IN_ARCHIVE_YET`, `SATELLITE_NOT_OPERATING`.

### 3.4. `brightnessFlag`

`ABOVE_MODIS_THRESHOLD`, `BELOW_MODIS_THRESHOLD`, `VIIRS_NIGHT_TEMP_ONLY`, `VIIRS_NIGHT_BELOW`, `NO_FIXED_THRESHOLD`, `AT_SENSOR_CEILING`, `NOT_EVALUATED`.

### 3.5. `differenceAvailable` và `reasons`

Giá trị `reasons`:

- `VERSION_MISMATCH`
- `CELL_SET_MISMATCH`
- `COVERAGE_MISMATCH`
- `VALUE_UNAVAILABLE`
- `TERRA_EARLY_PERIOD`
- `BRANCH_MISMATCH`

`warnings`:

- `CROSS_SENSOR_ERA`
- `WITHIN_TYPICAL_YEAR_TO_YEAR_CHANGE`
- `SEASONAL_CHANGE_EXPECTED`

---

## 4. API

Các endpoint đều nhận spatial selector của v0.4 §3, trả `selection` như v0.4 §3.3, và nhận thêm `mode=RETROSPECTIVE|OPERATIONAL` (mặc định `OPERATIONAL` cho mọi nhãn chú ý).

| Endpoint | Mục đích | Quy tắc |
|---|---|---|
| `GET /area/day?date=` | Một vùng trong một ngày địa phương | AC-, FRP-, AN-01 (7 ngày), DQ- |
| `GET /area/period?start=&end=` | Khoảng tùy chọn | AC-, CMP-04 |
| `GET /anomaly?granularity=&...` | Đánh giá bất thường | AN-01, AN-02 |
| `GET /comparison?kind=PERIODS\|AREAS\|YTD\|MOM` | So sánh | CMP-01 … CMP-09 |
| `GET /seasons?startSeason=&endSeason=` | Mùa qua các năm | AN-05, CMP-05 … CMP-07 |
| `GET /attention?date=&level>=` | Danh sách mức chú ý **cấp vùng** | Mức chú ý (QT Phần VI) |
| `GET /events?start=&end=`, `GET /events/{id}`, `GET /events/series?satellite=` | Sự kiện | EV- |
| `GET /data-quality?start=&end=` | Chất lượng dữ liệu | DQ- |
| `GET /metadata` | Bổ sung `analytics` (phiên bản, `eventDataThrough` theo vệ tinh, capability) | — |

Spatial selector mở rộng:

- `lat`, `lon`, `radiusKm` cho SP-02;
- `POST /area/query` với GeoJSON polygon cho SP-03 (Should; bbox đã có).

Không có endpoint “cảnh báo từng ô mỗi ngày” (QT Phần V, so sánh bội).

Mã lỗi mới:

| HTTP | `code` |
|---:|---|
| 404 | `EVENT_NOT_FOUND` |
| 422 | `EVENTS_OUTSIDE_RANGE` |
| 422 | `RANGE_TOO_LARGE` |
| 422 | `DAY_LEVEL_NOT_LABELLED` |
| 503 | `EVENTS_UNAVAILABLE` (không làm hỏng nhánh B) |

---

## 5. JSON mẫu

Số liệu là kết quả thật của lần chạy 15/11/2026 (`ket_qua/analytics_v02.txt`, `ket_qua/examples_v02.txt`), trừ chỗ ghi `"example": true`. `cellIds` được rút gọn.

### 5.1. Một vùng trong một ngày — Tây Bắc, 05/03/2024

```json
{
  "request": {"area": {"type": "diagnostic_region", "id": "TayBac"}, "localDate": "2024-03-05", "timeZone": "Asia/Ho_Chi_Minh", "mode": "OPERATIONAL"},
  "updatedAtUtc": "2026-11-15T00:00:00Z",
  "selection": {"type": "NAMED_AREA", "cellCount": 99, "cellIds": []},
  "periodCompleteness": {"expectedDays": 1, "coveredDays": 1, "partial": false},
  "branchB": {
    "metric": "snpp_eq", "unit": "S-NPP-equivalent daytime detections",
    "value": 513.0, "valueStatus": "AVAILABLE",
    "sourceCodeCellDays": {"3": 99}, "origin": "DIRECT_OBSERVATION",
    "dayLevelClassification": "NOT_ASSESSED", "classificationReason": "DAY_LEVEL_NOT_LABELLED",
    "window7Days": {
      "ruleId": "AN-01", "value": 1335.0, "range": ["2024-03-02", "2024-03-08"],
      "baseline": {"mode": "OPERATIONAL", "startYear": 2012, "endYear": 2023, "n": 12, "median": 850.0, "j": 1, "lowCut": 103.0, "highCut": 4938.0},
      "delta": 485.0, "deltaPct": 57.1, "classification": "TYPICAL", "attentionLevel": 0,
      "explanation": "Tổng 7 ngày cao hơn trung vị 2012–2023 nhưng vẫn trong phạm vi các năm trước."
    }
  },
  "branchA": {
    "filterVersion": "event-filter-v1",
    "dateBasisNote": "Ví dụ đếm theo ngày UTC; với ban ngày, ngày UTC trùng ngày địa phương (QT TM-02). Số ban đêm sẽ đếm lại theo ngày địa phương.",
    "detectionsDaytimeBySatellite": {"Terra": 28, "Aqua": 78, "SNPP": 513, "N20": 472, "N21": 394},
    "detectionsNightBySatelliteUtcDate": {"Terra": 5, "SNPP": 50, "N20": 70, "N21": 48},
    "inStaticMask": 1,
    "filterPassed": 889,
    "cellsWithDetection": 73,
    "clusters": 532, "eventsObserved": 398, "eventsNew": 364,
    "frpMax": {"valueMw": 561.8, "satellite": "Aqua", "observedUtc": "2024-03-05T06:31:00Z", "confidence": "h", "dayNight": "D"},
    "frpMedianDaytimeMwBySatellite": {"Terra": 19.2, "Aqua": 25.9, "SNPP": 7.2, "N20": 5.2, "N21": 8.3},
    "frpNote": "Trung vị FRP không so được giữa MODIS và VIIRS do kích thước pixel khác nhau."
  },
  "dataQuality": {"observation": [{"satellite": "SNPP", "status": "OBSERVED_NO_KNOWN_GAP"}, {"satellite": "N20", "status": "OBSERVED_NO_KNOWN_GAP"}],
    "warnings": ["NO_CLOUD_INFORMATION", "DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY"]},
  "meta": {"versions": {"pipelineVersion": "1.0", "dataVersion": "hoalich-data-v1-2026-11-13", "pointsVersion": "hoalich-points-v1.6-2026-11-13", "filterVersion": "event-filter-v1", "eventRuleVersion": "experimental_v1", "baselineVersion": "bl-v0.2", "anomalyMethodVersion": "rank_a10_v0", "analyticsRulesVersion": "analytics_rules_v0.2-draft"}}
}
```

Ghi chú:

- `deltaPct` = 1.335,0 / 850,0 − 1 = 57,1%.
- Cột “phát hiện ban đêm” trong ví dụ đếm theo ngày UTC. Bản chính thức đếm theo ngày địa phương.

### 5.2. So sánh hai tháng — Tây Nguyên 03/2024 với 03/2025

```json
{
  "ruleId": "CMP-02",
  "kind": "PERIODS",
  "mode": "OPERATIONAL",
  "updatedAtUtc": "2026-11-15T00:00:00Z",
  "area": {
    "type": "diagnostic_region",
    "id": "TayNguyen"
  },
  "metric": "snpp_eq",
  "unit": "S-NPP-equivalent daytime detections",
  "a": {
    "period": "2024-03",
    "value": 3880.0,
    "valueStatus": "AVAILABLE",
    "origin": "DIRECT_OBSERVATION",
    "coverage": {
      "expectedDayCount": 31,
      "coveredDayCount": 31,
      "partial": false
    }
  },
  "b": {
    "period": "2025-03",
    "value": 3034.0,
    "valueStatus": "AVAILABLE",
    "origin": "DIRECT_OBSERVATION",
    "coverage": {
      "expectedDayCount": 31,
      "coveredDayCount": 31,
      "partial": false
    }
  },
  "anomalyContext": {
    "a": {
      "ruleId": "AN-02",
      "window": "FULL",
      "baseline": {
        "startYear": 2003,
        "endYear": 2023,
        "n": 21,
        "lowCut": 5073.0,
        "highCut": 15252.0
      },
      "classification": "LOW"
    },
    "b": {
      "ruleId": "AN-02",
      "window": "FULL",
      "baseline": {
        "startYear": 2003,
        "endYear": 2024,
        "n": 22,
        "lowCut": 3880.0,
        "highCut": 15252.0
      },
      "classification": "LOW"
    },
    "note": "Cả hai tháng đều thấp hơn hầu hết các năm trước nó (chế độ vận hành)."
  },
  "differenceAvailable": true,
  "reasons": [],
  "delta": -846.0,
  "deltaPct": -21.8,
  "log2Ratio": -0.355,
  "context": {
    "typicalAbsLog2YearToYear": {
      "p50": 0.55,
      "p75": 0.97,
      "p90": 1.44,
      "n": 606
    }
  },
  "warnings": [
    "WITHIN_TYPICAL_YEAR_TO_YEAR_CHANGE"
  ],
  "dataQuality": {
    "sourceCodes": {
      "a": [
        "3"
      ],
      "b": [
        "3"
      ]
    },
    "observation": "OBSERVED_NO_KNOWN_GAP",
    "flags": [],
    "warnings": [
      "NO_CLOUD_INFORMATION"
    ]
  },
  "explanation": "Tháng 3/2025 thấp hơn tháng 3/2024 khoảng 22%; mức thay đổi này nằm trong biến động thường gặp giữa hai năm liền nhau. Cả hai tháng đều thấp hơn hầu hết các năm trước nó.",
  "meta": {
    "versions": {
      "pipelineVersion": "1.0",
      "dataVersion": "hoalich-data-v1-2026-11-13",
      "modelVersion": "lai-clim-s2-k60-kappa3",
      "pointsVersion": "hoalich-points-v1.6-2026-11-13",
      "filterVersion": "event-filter-v1",
      "eventRuleVersion": "experimental_v1",
      "baselineVersion": "bl-v0.2",
      "anomalyMethodVersion": "rank_a10_v0",
      "analyticsRulesVersion": "analytics_rules_v0.2-draft"
    }
  }
}
```

### 5.3. Cùng mùa qua nhiều năm — Tây Nguyên, năm-mùa bắt đầu tháng 12

```json
{
  "ruleId": "AN-05",
  "mode": "RETROSPECTIVE",
  "area": {
    "type": "diagnostic_region",
    "id": "TayNguyen"
  },
  "seasonDefinition": {
    "startMonth": 12,
    "basis": "Tháng sau tháng có trung vị thấp nhất 2003–2025",
    "assumption": true
  },
  "metricDefinitions": {
    "onset": "Ngày đạt 10% tích lũy snpp_eq của năm-mùa",
    "center": "50%",
    "end": "90%",
    "max30Share": "Tổng 30 ngày lớn nhất / tổng mùa"
  },
  "seasons": [
    {
      "season": "2021-2022",
      "total": 11689.9,
      "onset": "2022-02-04",
      "center": "2022-03-19",
      "end": "2022-08-19",
      "durationDays": 197
    },
    {
      "season": "2022-2023",
      "total": 14733.5,
      "onset": "2023-02-06",
      "center": "2023-03-22",
      "end": "2023-07-15",
      "durationDays": 160
    },
    {
      "season": "2023-2024",
      "total": 17020.7,
      "onset": "2024-01-25",
      "center": "2024-03-16",
      "end": "2024-07-15",
      "durationDays": 173
    },
    {
      "season": "2024-2025",
      "total": 11669.9,
      "onset": "2025-01-24",
      "center": "2025-03-19",
      "end": "2025-08-02",
      "durationDays": 191,
      "max30Share": 0.282
    }
  ],
  "assessmentOfLatest": {
    "baseline": {
      "seasons": "2003-2004..2023-2024",
      "n": 21
    },
    "total": {
      "value": 11669.9,
      "median": 27561.9,
      "lowCut": 14733.5,
      "highCut": 44352.9,
      "classification": "LOW"
    },
    "onsetDayOfSeason": {
      "value": 54,
      "median": 60.0,
      "classification": "TYPICAL"
    },
    "centerDayOfSeason": {
      "value": 108,
      "median": 106.0,
      "classification": "TYPICAL"
    },
    "endDayOfSeason": {
      "value": 244,
      "median": 170.0,
      "classification": "HIGH"
    },
    "durationDays": {
      "value": 191,
      "median": 116.0,
      "classification": "HIGH"
    },
    "max30Share": {
      "value": 0.282,
      "median": 0.343,
      "classification": "LOW"
    }
  },
  "explanation": "Mùa 2024-2025 có tổng thấp, đỉnh đúng thời điểm thường gặp; mốc 90% đến muộn và mùa trải dài hơn, tức hoạt động phân tán hơn. Mốc 10% không phải ngày bắt đầu mùa cháy thực tế.",
  "warnings": [
    "SEASON_METRICS_SENSITIVE_WHEN_TOTAL_LOW",
    "BASELINE_MIXES_SENSOR_ERAS"
  ],
  "updatedAtUtc": "2026-11-15T00:00:00Z",
  "metric": "snpp_eq",
  "unit": "S-NPP-equivalent daytime detections",
  "periodCompleteness": {
    "seasonsComplete": "2003-2004..2024-2025",
    "currentSeason": {
      "season": "2025-2026",
      "partial": true,
      "coveredTo": "2026-11-13",
      "assessed": false
    }
  },
  "dataQuality": {
    "sourceEras": [
      {
        "seasons": "2003-2004..2010-2011",
        "origin": "MODEL_REDISTRIBUTED",
        "interval90": "monthly/pentad only"
      },
      {
        "seasons": "2011-2012",
        "origin": "MIXED (ước lượng Aqua đến 19/01/2012, S-NPP từ 20/01/2012)"
      },
      {
        "seasons": "2012-2013..2024-2025",
        "origin": "DIRECT_OBSERVATION (+ vá NOAA-20/Aqua)"
      }
    ],
    "flags": [
      "CROSS_SENSOR_ERA"
    ]
  },
  "meta": {
    "versions": {
      "pipelineVersion": "1.0",
      "dataVersion": "hoalich-data-v1-2026-11-13",
      "modelVersion": "lai-clim-s2-k60-kappa3",
      "pointsVersion": "hoalich-points-v1.6-2026-11-13",
      "filterVersion": "event-filter-v1",
      "eventRuleVersion": "experimental_v1",
      "baselineVersion": "bl-v0.2",
      "anomalyMethodVersion": "rank_a10_v0",
      "analyticsRulesVersion": "analytics_rules_v0.2-draft"
    }
  }
}
```

### 5.4. Một mức chú ý — Toàn quốc, tháng 10/2026

```json
{
  "ruleId": "AN-01",
  "mode": "OPERATIONAL",
  "area": {
    "type": "national",
    "id": "ToanQuoc"
  },
  "period": {
    "granularity": "month",
    "year": 2026,
    "month": 10,
    "coverage": {
      "expectedDayCount": 31,
      "coveredDayCount": 31,
      "partial": false
    }
  },
  "metric": "snpp_eq",
  "value": 2614.3,
  "valueStatus": "AVAILABLE",
  "assessments": [
    {
      "window": "FULL",
      "baseline": {
        "startYear": 2003,
        "endYear": 2025,
        "n": 23,
        "median": 837.0,
        "j": 2,
        "highCut": 1665.5
      },
      "delta": 1777.3,
      "deltaPct": 212.3,
      "rank": 1,
      "rankOf": 24,
      "classification": "HIGH",
      "classificationReason": "ABOVE_HIGH_CUT"
    },
    {
      "window": "RECENT",
      "baseline": {
        "startYear": 2017,
        "endYear": 2025,
        "n": 9,
        "median": 996.0,
        "j": 1,
        "highCut": 1665.5
      },
      "delta": 1618.3,
      "deltaPct": 162.5,
      "rank": 1,
      "rankOf": 10,
      "classification": "HIGH",
      "classificationReason": "ABOVE_HIGH_CUT"
    }
  ],
  "attentionLevel": 2,
  "attentionLabel": "Cao hơn mọi năm cùng kỳ (2003–2025 và 2017–2025)",
  "dataQuality": {
    "sourceCodeCellDays": {
      "3": 17351,
      "4": 846
    },
    "flags": [
      "SOURCE_SWITCH_IN_PERIOD"
    ],
    "note": "4,6% ô-ngày dùng NOAA-20 quy đổi do S-NPP thiếu dữ liệu"
  },
  "explanation": "Hoạt động phát hiện tháng 10/2026 cao nhất trong 24 năm cùng tháng. Đây là nhãn thống kê, không phải xác nhận cháy; tháng 10 vốn là tháng hoạt động thấp nên giá trị tuyệt đối vẫn nhỏ so với mùa khô.",
  "warnings": [
    "NO_CLOUD_INFORMATION",
    "STATISTICAL_LABEL_NOT_FIRE_CONFIRMATION"
  ],
  "updatedAtUtc": "2026-11-15T00:00:00Z",
  "unit": "S-NPP-equivalent daytime detections",
  "meta": {
    "versions": {
      "pipelineVersion": "1.0",
      "dataVersion": "hoalich-data-v1-2026-11-13",
      "modelVersion": "lai-clim-s2-k60-kappa3",
      "pointsVersion": "hoalich-points-v1.6-2026-11-13",
      "filterVersion": "event-filter-v1",
      "eventRuleVersion": "experimental_v1",
      "baselineVersion": "bl-v0.2",
      "anomalyMethodVersion": "rank_a10_v0",
      "analyticsRulesVersion": "analytics_rules_v0.2-draft"
    }
  }
}
```

### 5.5. Không đủ dữ liệu — điểm bán kính 5 km quanh (13,95; 107,435), ngày 15/09/2026

```json
{
  "request": {
    "lat": 13.95,
    "lon": 107.435,
    "radiusKm": 5,
    "localDate": "2026-09-15",
    "mode": "OPERATIONAL"
  },
  "updatedAtUtc": "2026-11-15T00:00:00Z",
  "metric": "snpp_eq",
  "unit": "S-NPP-equivalent daytime detections",
  "periodCompleteness": {
    "expectedDays": 1,
    "coveredDays": 1,
    "partial": false,
    "dataThrough": "2026-11-13"
  },
  "selection": {
    "type": "POINT_RADIUS",
    "selectionRule": "CENTER_INCLUSIVE",
    "cellCount": 0,
    "nearestCell": {
      "cellId": "55_429",
      "distanceKm": 10.56
    }
  },
  "branchB": {
    "value": null,
    "valueStatus": "NO_CELL_CENTER_IN_AREA",
    "contextCell": {
      "cellId": "55_429",
      "value": 0.0,
      "valueStatus": "AVAILABLE",
      "sourceCode": 3,
      "note": "Giá trị của cả ô 0,25° (~740 km²), không phải của vùng 78,5 km² đã chọn"
    },
    "classification": "NOT_CLASSIFIED_SCOPE"
  },
  "branchA": {
    "detections": 0,
    "detectionStatus": "AVAILABLE",
    "detectionSource": "nrt",
    "typeStatusOfPeriod": "MISSING",
    "events": null,
    "eventCountStatus": "OUTSIDE_EVENT_RANGE",
    "eventDataThrough": {
      "SNPP": "2026-07-31",
      "N20": "2026-07-31",
      "N21": "2026-07-31",
      "Aqua": "2026-08-29",
      "Terra": "2026-08-30"
    }
  },
  "dataQuality": {
    "observation": [
      {
        "satellite": "SNPP",
        "band": "Trung(13.5-18.5N)",
        "status": "NRT_ONLY"
      },
      {
        "satellite": "N20",
        "band": "Trung(13.5-18.5N)",
        "status": "NRT_ONLY"
      }
    ],
    "warnings": [
      "NO_CLOUD_INFORMATION",
      "NRT_SUBJECT_TO_REPLACEMENT"
    ]
  },
  "explanation": "Không có phát hiện NRT trong bán kính 5 km ngày 15/09/2026, nhưng chưa xác định được có mây che. Vùng chọn nhỏ hơn một ô thống kê nên không có giá trị snpp_eq riêng. Sự kiện ước tính chưa có cho giai đoạn này vì dữ liệu NRT thiếu trường type.",
  "meta": {
    "versions": {
      "pipelineVersion": "1.0",
      "dataVersion": "hoalich-data-v1-2026-11-13",
      "modelVersion": "lai-clim-s2-k60-kappa3",
      "pointsVersion": "hoalich-points-v1.6-2026-11-13",
      "filterVersion": "event-filter-v1",
      "eventRuleVersion": "experimental_v1",
      "baselineVersion": "bl-v0.2",
      "anomalyMethodVersion": "rank_a10_v0",
      "analyticsRulesVersion": "analytics_rules_v0.2-draft"
    }
  }
}
```

Sáu trạng thái của §3.1 xuất hiện trong ví dụ này:

| Trạng thái | Trường thể hiện |
|---|---|
| 0 đo được | `contextCell.value = 0.0` |
| Không có detection, chưa biết quan sát | `branchA.detections = 0` + `NO_CLOUD_INFORMATION` |
| `null` | `branchB.value` |
| Ngoài phạm vi | `OUTSIDE_EVENT_RANGE` |
| Không xếp loại | `NOT_CLASSIFIED_SCOPE` |
| Nguồn tạm | `NRT_SUBJECT_TO_REPLACEMENT` |

---

## 6. Test vector cho backend

Golden value phải sinh lại từ `derived/` trước khi chốt dung sai.

| ID | Kỳ vọng |
|---|---|
| A1 | Tây Nguyên 03/2024, `RETROSPECTIVE`, `FULL`: n = 22, X = 3.880,0, `lowCut` = 3.875,0 → TYPICAL |
| A2 | Tây Nguyên 03/2024, `RECENT`: n = 8 → `INSUFFICIENT_BASELINE` |
| A2b | Tây Nguyên 03/2024, `OPERATIONAL`, `FULL` (2003–2023): n = 21, `lowCut` = 5.073,0 → LOW (khác A1 hồi cứu: chế độ ảnh hưởng nhãn) |
| A2c | Tây Nguyên 03/2025, `OPERATIONAL`, `FULL` (2003–2024): n = 22, `lowCut` = 3.880,0, X = 3.034,0 → LOW |
| A3 | Toàn quốc 03/2026: `FULL` → LOW; `RECENT` → TYPICAL; `BASELINES_DISAGREE` |
| A4 | Toàn quốc 10/2026, `OPERATIONAL`: hai cửa sổ HIGH, `attentionLevel` = 2 |
| A5 | `granularity=day` → `422 DAY_LEVEL_NOT_LABELLED` |
| C1 | Tây Nguyên 03/2024 với 03/2025: `delta` = −846,0 |
| C2 | Tháng 11/2026 với tháng 11/2025 → `COVERAGE_MISMATCH`; chế độ YTD 01–13/11: 398,5 so với median 493,0 |
| C3 | Toàn quốc 02 → 03/2026, `MOM`: ×2,54 so với trung vị ×1,81 → TYPICAL, `SEASONAL_CHANGE_EXPECTED` |
| E1 | 1.161.304 → 800.554 → 706.206; 8.298 cụm `AMBIGUOUS` |
| E2 | `/events/series?satellite=SNPP`: 2012 = 20.646; 2024 = 15.688 |
| E3 | `/events` với khoảng từ 01/09/2026 → `422 EVENTS_OUTSIDE_RANGE` |
| Q1 | Ngày 11/07/2026: nhánh B = 18,8 với `sourceCode` 4 trên cả 587 ô; nhánh A S-NPP `OUTAGE` |

---

## 7. Khi archive thay NRT

Theo [README của FIRMS](https://firms.modaps.eosdis.nasa.gov/download/Readme.txt), NRT được thay bằng dữ liệu chuẩn khi có, khoảng 3 tháng sau.

1. **Không sửa tại chỗ.** Mỗi lần nạp archive tạo `pointsVersion` mới.
2. **Khớp NRT và archive** theo vệ tinh + `observedUtc` + khoảng cách ≤ nửa kích thước pixel.
   - Bản NRT được đặt `supersededBy`.
   - Detection NRT không khớp được giữ ở bảng kiểm toán, với lý do `DROPPED_IN_ARCHIVE`.
3. **Tính lại** cho các ngày bị ảnh hưởng ± 24 giờ (khoảng nối EV-04): cụm, sự kiện, aggregate, assessment. `eventId` có thể đổi nên lưu bảng ánh xạ `previousEventId → eventId`.
4. **Lưu lịch sử đánh giá.**
   - Assessment cũ giữ nguyên, có `supersededAtUtc`.
   - UI hiển thị “Kết quả đã cập nhật khi dữ liệu chuẩn thay dữ liệu NRT”, kèm nhãn trước và sau nếu khác nhau.
5. **Nhánh B** chỉ đổi khi có snapshot `snpp_eq` mới (`dataVersion` mới). Không trộn hai snapshot trong một response.
6. Ngay ở lần chuyển 08–11/2026 tới: khoảng 22.157 detection NRT sẽ có `type`. Ước lượng theo mặt nạ là khoảng 10.469 đạt bộ lọc (QT S10, giả định).
