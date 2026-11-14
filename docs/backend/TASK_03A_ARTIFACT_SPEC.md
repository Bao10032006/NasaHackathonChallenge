# TASK 03A — Hợp đồng dữ liệu nội bộ Python ↔ Java (artifact spec)

- Phiên bản spec: `1.0.0-draft.2` — binary layout **đã được backend duyệt**; chờ chốt các phần còn lại
- Người soạn: HoangAnh250 (Người 1 — Data/ML và artifact)
- Ngày: 14/11/2026
- Snapshot nguồn: pipeline **1.0** trong `backend/hoalich_data_v1/hoalich_data_v1/`
- Căn cứ: Technical Design v0.3 §6 và §6A, API Contract v0.3, Decision Log D07, D08, D10–D13

Mục tiêu: Python xuất và Java đọc **cùng một định dạng byte**. Mọi con số "snapshot 1.0" dưới đây đã được đo trực tiếp trên dữ liệu trong repo. Khi spec chốt, mọi thay đổi định dạng phải tăng `schemaVersion`.

## Thay đổi so với `1.0.0-draft`

Theo feedback backend:

1. Fixture `daily-mini` **tự chứa**: dữ liệu tổng hợp, có `cells_025.csv` riêng, không phụ thuộc snapshot thật (§11).
2. Tách rõ lỗi lúc **khởi động** (ứng dụng không chạy) và lỗi **runtime** (`503 DATASET_UNAVAILABLE`) (§8.2).
3. Sửa quy tắc version: đổi snapshot thì **bắt buộc** đổi `dataVersion`; `modelVersion` chỉ đổi khi mô hình/thuật toán đổi (§10).
4. Định nghĩa `capabilities.optionalArtifacts`, danh mục `warningCatalog` và `limitations` mà Java đọc từ manifest (§6.4–§6.6).
5. Exporter ghi vào thư mục tạm, chỉ chuyển sang `derived/` khi mọi kiểm định đạt (§12).
6. Thêm regression thật cho S-NPP direct và NOAA-20 scaled (§8.3).

Phát hiện thêm khi làm (5): hệ số NOAA-20 thực tế trong cube là **1,0105795**; `summary.json` làm tròn thành 1,0106 (§5.2, E7).

Backend đã đồng ý: giữ `derived/`; validity dạng `.u8`; manifest liệt kê đủ 587 `cellIds`; kiểm SHA-256 mỗi lần startup; MVP commit một bộ artifact bất biến vào Git, snapshot tương lai phát hành riêng.

---

## 1. Phạm vi

Trong phạm vi: 4 file nhị phân xuất từ `tables/cube_daily_day_veg.npz`, `dataset-manifest.json`, quy tắc layout/checksum/version/validation/sai số, exporter và fixture tự chứa.

Ngoài phạm vi: anomaly, export CSV, thay đổi artifact gốc (CSV/JSON/NPZ của snapshot giữ nguyên).

## 2. Vị trí file

| Thành phần | Đường dẫn |
|---|---|
| Artifact xuất (thật) | `<HOALICH_DATASET_ROOT>/derived/` — mặc định `backend/hoalich_data_v1/hoalich_data_v1/derived/` |
| Manifest | `<HOALICH_DATASET_ROOT>/derived/dataset-manifest.json` |
| Exporter + kiểm định | `tools/data/export_daily_artifacts.py` |
| Môi trường Python ghim phiên bản | `tools/data/requirements.txt` |
| Báo cáo kết quả export | `docs/backend/TASK_03A_EXPORT_REPORT.md` |
| Fixture (một dataset root thu nhỏ) | `backend/src/test/resources/fixtures/daily-mini/` gồm `tables/cells_025.csv`, `derived/*` và `fixture-expected.json` |

Java chỉ resolve đường dẫn **tương đối** dưới dataset root.

## 3. Danh sách file và kiểu dữ liệu

Mọi file nhị phân: **không header**, **little-endian**, **row-major `[date][cell]`**, kích thước = `dayCount × cellCount × bytesPerValue`.

Snapshot 1.0: `dayCount = 9509`, `cellCount = 587`, `valueCount = 5.581.783`.

| File | Kiểu (NumPy / Java) | Byte/giá trị | Kích thước snapshot 1.0 | Miền giá trị snapshot 1.0 | Nguồn trong NPZ |
|---|---|---:|---:|---|---|
| `daily-values.f32` | `<f4` / `float` | 4 | 22.327.132 B | 0 … 705,8286; hữu hạn, không âm | `harmonized` (float32, sao chép nguyên bit) |
| `daily-source.u8` | `u1` / `byte` (đọc không dấu) | 1 | 5.581.783 B | {1, 2, 3, 4} | `src_code` |
| `daily-input-count.i16` | `<i2` / `short` | 2 | 11.163.566 B | 0 … 154 | Số đếm của vệ tinh ứng với source code (§5.3) |
| `daily-source-input-valid.u8` | `u1` / `byte` | 1 | 5.581.783 B | {0, 1} | Cờ hợp lệ của vệ tinh ứng với source code (§5.4) |
| `dataset-manifest.json` | UTF-8, LF | — | — | — | §6 |

Tổng nhị phân snapshot 1.0: **44.654.264 B** (mỗi file < 100 MB).

## 4. Layout và cách đánh chỉ số

- `dateIndex` = số ngày lịch (UTC) kể từ `dateRange.start`; ngày liên tục. Snapshot 1.0: `0 = 2000-11-01`, `9508 = 2026-11-13`.
- `cellIndex` = chỉ số dòng (0-based, bỏ header) trong `tables/cells_025.csv` của cùng dataset root; manifest liệt kê lại `grid.cellIds` theo đúng thứ tự.
- `elementIndex = dateIndex × cellCount + cellIndex`; `byteOffset = elementIndex × bytesPerValue`.
- Một ngày là một khúc liên tục `cellCount` giá trị.

Gợi ý Java: `FileChannel.map(READ_ONLY, …)` + `.order(ByteOrder.LITTLE_ENDIAN)`; `getFloat`, `getShort`, `Byte.toUnsignedInt(get(...))`; cộng dồn bằng `double`.

## 5. Ngữ nghĩa từng file

### 5.1. `daily-values.f32`

`snpp_eq` cấp cell-day, sao chép nguyên bit từ `harmonized`. Không có sentinel; trong dataset range không có missing. Giá trị `0` là thật (snapshot 1.0: 3.172.368 / 5.581.783 cell-day).

### 5.2. `daily-source.u8`

| Code | `source` | `origin` | `inputSatellite` | Snapshot 1.0: cell-day | Ngày đầu → ngày cuối |
|---:|---|---|---|---:|---|
| 1 | `TERRA` | `MODEL_REDISTRIBUTED` | `Terra` | 374.506 | 2000-11-01 → 2002-07-31 |
| 2 | `AQUA` | `MODEL_REDISTRIBUTED` | `Aqua` | 2.034.614 | 2002-08-01 → 2026-11-06 |
| 3 | `SNPP` | `DIRECT_OBSERVATION` | `SNPP` | 3.129.684 | 2012-01-20 → 2026-11-01 |
| 4 | `NOAA20` | `SCALED_OBSERVATION` | `N20` | 42.979 | 2018-05-06 → 2026-11-13 |

- Code 2 sau 2012-01-20 là vá khi S-NPP và NOAA-20 đều không hợp lệ (2012: 27 ngày; 2017: 2 ngày; 2026-11-06: 328 cell-day).
- Code 4 trước 2026-11-02 là vá gap S-NPP; từ 2026-11-02 là nguồn chính.
- **Hệ số NOAA-20:** trong cube, `value = N20 / k` với `k = 1,0105795` (đo trên 1.615 cell-day có N20 > 0, dao động 1,01057943–1,01057952 do float32). `summary.json` ghi `1.0106` là số đã làm tròn. Manifest ghi cả hai: `scaleDivisor` (đo được) và `scaleDivisorReported` (`1.0106`).

### 5.3. `daily-input-count.i16`

Số phát hiện ban ngày đã lọc nguồn tĩnh của **đúng vệ tinh ứng với source code**: 1 → `Terra`, 2 → `Aqua`, 3 → `SNPP`, 4 → `N20`. Không phải `snpp_eq`. Với code 1|2, `daily-values` có thể dương khi input count = 0.

### 5.4. `daily-source-input-valid.u8`

Cờ hợp lệ của **đúng vệ tinh ứng với source code** (`1` hợp lệ, `0` không). Snapshot 1.0: chỉ code 1 có giá trị 0 (**28.763 cell-day**, các đợt Terra mất dữ liệu 2001–2002). Giá trị ngày đó vẫn `AVAILABLE`; cờ 0 chỉ phục vụ `sourceInputValid`/`sourceInputValidCellCount` của API.

## 6. `dataset-manifest.json`

### 6.1. Trường bắt buộc

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `schemaVersion` | string semver | Phiên bản định dạng (`1.0.0`) |
| `dataVersion` | string | `hoalich-data-v1-2026-11-13` (D08); quy tắc §10 |
| `modelVersion` | string | `lai-clim-s2-k60-kappa3` (D08); quy tắc §10 |
| `pipelineVersion` | string | `1.0` (từ `summary.json`) |
| `kind` | string | `snapshot` (artifact thật) hoặc `fixture` |
| `metric`, `unit`, `timeZone` | string | `snpp_eq`, `S-NPP-equivalent daytime detections`, `UTC` |
| `dateRange` | object | `start`, `end`, `dayCount` |
| `dataThrough` | ISO date | = `dateRange.end` |
| `grid` | object | `degrees` 0.25, `cellCount`, `cellOrderSource` (`tables/cells_025.csv`), `cellIds` |
| `layout` | object | `order` `row-major[date][cell]`, `byteOrder` `little-endian`, `header` `none` |
| `files` | array | `name`, `dtype`, `bytesPerValue`, `shape`, `byteSize`, `sha256`, `description` |
| `sourceCodes` | array | `code`, `source`, `origin`, `inputSatellite`, `firstDate`, `lastDate`, `cellDays`; code 4 thêm `scaleDivisor`, `scaleDivisorReported` |
| `periods` | object | `partial`, `transitions` (§6.3) |
| `sources` | array | File nguồn: `path` (tương đối dataset root), `byteSize`, `sha256`; fixture: chỉ `tables/cells_025.csv` của chính nó |
| `capabilities` | object | §6.4 |
| `warningCatalog` | array | §6.5 |
| `limitations` | array | §6.6 |
| `validation` | object | `status`, `checks`, `regressionSamples` (§8) |
| `generator` | object | `script`, `python`, `numpy`, `pandas`, `generatedAt` |

Trường thêm ở bản minor là tùy chọn; Java bỏ qua trường không biết.

### 6.2. Ví dụ rút gọn

```json
{
  "schemaVersion": "1.0.0",
  "kind": "snapshot",
  "dataVersion": "hoalich-data-v1-2026-11-13",
  "modelVersion": "lai-clim-s2-k60-kappa3",
  "pipelineVersion": "1.0",
  "metric": "snpp_eq",
  "unit": "S-NPP-equivalent daytime detections",
  "timeZone": "UTC",
  "dateRange": {"start": "2000-11-01", "end": "2026-11-13", "dayCount": 9509},
  "dataThrough": "2026-11-13",
  "grid": {"degrees": 0.25, "cellCount": 587, "cellOrderSource": "tables/cells_025.csv", "cellIds": ["34_419", "..."]},
  "layout": {"order": "row-major[date][cell]", "byteOrder": "little-endian", "header": "none"},
  "files": [{"name": "daily-values.f32", "dtype": "float32", "bytesPerValue": 4, "shape": [9509, 587],
             "byteSize": 22327132, "sha256": "<64 hex>", "description": "harmonized snpp_eq, bit-exact copy"}],
  "sourceCodes": [{"code": 4, "source": "NOAA20", "origin": "SCALED_OBSERVATION", "inputSatellite": "N20",
                   "firstDate": "2018-05-06", "lastDate": "2026-11-13", "cellDays": 42979,
                   "scaleDivisor": 1.0105795, "scaleDivisorReported": 1.0106}],
  "periods": {"partial": [{"granularity": "pentad", "year": 2026, "period": 64,
                           "periodStart": "2026-11-12", "periodEnd": "2026-11-16",
                           "coveredFrom": "2026-11-12", "coveredTo": "2026-11-13"}],
              "transitions": [{"date": "2026-11-02", "event": "SNPP_END_NOAA20_PRIMARY"}]},
  "sources": [{"path": "tables/cube_daily_day_veg.npz", "byteSize": 0, "sha256": "ce62f017…0b93"}],
  "capabilities": {"optionalArtifacts": []},
  "warningCatalog": [{"code": "DATASET_EDGE_DATE", "trigger": "DATE_IS_DATA_THROUGH", "params": {},
                      "appliesTo": ["/daily", "/map/cells"], "description": "..."}],
  "limitations": [{"code": "SNPP_EQ_NOT_FIRE_EVENT_COUNT", "description": "..."}],
  "validation": {"status": "PASS", "checks": [], "regressionSamples": []},
  "generator": {"script": "tools/data/export_daily_artifacts.py", "python": "3.15.0", "numpy": "2.5.4",
                "pandas": "3.1.1", "generatedAt": "2026-11-14T00:00:00Z"}
}
```

### 6.3. `periods`

Exporter **tính** từ `dateRange` (không viết cứng), áp dụng chung cho snapshot và fixture.

- `partial`: mọi năm/tháng/pentad **giao** với dataset range nhưng **không được phủ đủ**. Mỗi phần tử: `granularity` (`year|month|pentad`), `year`, `period` (tháng 1–12 hoặc pentad 1–73; bỏ với `year`), `periodStart`, `periodEnd`, `coveredFrom`, `coveredTo`. Kỳ nằm hoàn toàn ngoài range là **missing**, không liệt kê.
  - Snapshot 1.0: năm 2000 (phủ từ 2000-11-01), năm 2026, tháng 11/2026, pentad 64/2026 (12–16/11, phủ đến 13/11). Tháng 11/2000 và pentad 62/2000 (bắt đầu đúng 2000-11-01) đủ kỳ.
- `transitions`: tính từ `daily-source`:
  - `TERRA_TO_AQUA`: ngày đầu có code 2, nếu trước đó có code 1.
  - `SNPP_START`: ngày đầu có code 3, nếu không phải ngày đầu dataset.
  - `SNPP_END_NOAA20_PRIMARY`: ngày sau ngày cuối có code 3, nếu ngày đó ≤ `dataThrough` và sau đó có code 4.
  - Snapshot 1.0: 2002-08-01, 2012-01-20, 2026-11-02. Fixture: rỗng.

### 6.4. `capabilities.optionalArtifacts`

Mảng artifact tùy chọn mà exporter **phát hiện** dưới dataset root. Mỗi phần tử:

| Trường | Ý nghĩa |
|---|---|
| `name` | Tên ổn định, thuộc danh sách dự trữ bên dưới |
| `path` | Đường dẫn tương đối dataset root |
| `byteSize`, `sha256` | Như §7 |
| `description` | Mô tả ngắn |

Tên dự trữ (artifact của các bản pipeline sau): `calendar_regions_pentad` (`tables/calendar_regions_pentad.csv`), `anomaly_regions_pentad` (`tables/anomaly_regions_pentad.csv`).

Quy tắc Java: không bắt buộc; nếu có thì kiểm hash; **không tự bật tính năng** chỉ vì artifact có mặt (anomaly vẫn gate theo D03). Snapshot 1.0: `[]`.

### 6.5. `warningCatalog`

Java **không viết cứng** mã warning, điều kiện hay ngày; đọc từ manifest. Mỗi phần tử: `code`, `trigger` (một trong các khóa dưới), `params`, `appliesTo` (endpoint), `description` (tiếng Việt, cho tài liệu; frontend tự ánh xạ copy theo `code`).

| `code` | `trigger` | `params` | Phát khi |
|---|---|---|---|
| `PARTIAL_PERIOD` | `PERIOD_IN_PARTIAL` | — | Kỳ được hỏi nằm trong `periods.partial` |
| `DATASET_EDGE_DATE` | `DATE_IS_DATA_THROUGH` | — | Ngày được hỏi = `dataThrough` |
| `TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY` | `ANY_SOURCE_CODE` | `{"codes": [1]}` | Có cell-day đóng góp mang code 1 |
| `MODEL_REDISTRIBUTED_DAILY_VALUE` | `ANY_SOURCE_CODE` | `{"codes": [1, 2]}` | Response ngày có cell-day code 1 hoặc 2 |
| `NO_DAILY_UNCERTAINTY_INTERVAL` | `ALWAYS_FOR_ENDPOINT` | — | Mọi response `/daily` và `/map/cells?date=` |
| `DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY` | `AREA_TYPE` | `{"areaTypes": ["diagnostic_region"]}` | Area là vùng chẩn đoán |
| `AQUA_FALLBACK_AFTER_ORBIT_DRIFT` | `ANY_SOURCE_CODE_FROM_DATE` | `{"codes": [2], "fromDate": "2022-01-01"}` | Có cell-day code 2 từ `fromDate` |

### 6.6. `limitations`

Danh sách cố định Java trả nguyên trong `/metadata`. Mỗi phần tử: `code`, `description`.

| `code` | Nội dung |
|---|---|
| `SNPP_EQ_NOT_FIRE_EVENT_COUNT` | `snpp_eq` là số phát hiện tương đương S-NPP, không phải số vụ cháy hay diện tích cháy |
| `HISTORICAL_ANALYSIS_NOT_REALTIME_ALERT` | Phân tích lịch sử, không phải cảnh báo thời gian thực hay dự báo |
| `DAYTIME_STATIC_SOURCES_FILTERED` | Chỉ phát hiện ban ngày; đã lọc nguồn nhiệt tĩnh |
| `NO_DAILY_UNCERTAINTY_INTERVAL` | Không có khoảng bất định cấp ngày |
| `DAILY_VALIDATION_AT_MONTH_PENTAD` | Kiểm định phát hành ở cấp tháng/pentad, chưa có kiểm định riêng cấp ngày |
| `TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY` | 11/2000–7/2002 dựng từ Terra, độ tin cậy thấp |
| `AQUA_ERA_MODEL_ESTIMATED` | 8/2002–1/2012 là ước lượng từ Aqua đã hiệu chuẩn |
| `TAY_NGUYEN_PRE_2012_POSSIBLE_OVERESTIMATE` | Tây Nguyên trước 2012 có thể bị ước lượng cao khoảng 6–10% |
| `BASELINE_MIXES_SENSOR_ERAS` | Baseline 2003–2025 gồm giai đoạn Aqua ước lượng và S-NPP/NOAA-20 |
| `DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY` | Vùng chẩn đoán không phải ranh giới hành chính |
| `PENTAD_73_INCLUDES_LEAP_DAY` | Pentad 73 có 6 ngày ở năm nhuận |

## 7. Checksum

- **SHA-256**, hex **chữ thường**, trên toàn bộ byte của file.
- File text tính trên bản **LF** (đúng nội dung Git nhờ `.gitattributes`). Checkout trước khi có `.gitattributes` có thể là CRLF → checkout lại file.
- Manifest không chứa hash của chính nó.
- Hash nguồn snapshot 1.0 (khớp blob trong Git):

| File nguồn | SHA-256 |
|---|---|
| `tables/cube_daily_day_veg.npz` | `ce62f017494b758b4a6a8cfe889601e1974dc3c4bb10113cd1e1b8a901900b93` |
| `tables/cells_025.csv` | `f10c77b7defa784f5204e6489744b8f354fa92380f5c62acb994b1d31d953420` |
| `tables/harmonized_025_month.csv` | `c6c93dcfb96b8820d237e8513463e56861b66a7cc577e2968f00ff3cb31f3197` |
| `tables/harmonized_regions_pentad.csv` | `77f741d51bd54e809daac7a9cbd77aedf7f4d2584bccb2d89fd1f6fd7aedcd6a` |
| `web_cells_pentad.json` | `24f00ac5fe28b0bf2a77583fb1459a34a2613bf5e60150e4004344fb46934343` |
| `summary.json` | `8493c9c8ed03bff94302967950c479ec3dcbd04fd1b5dca8633b09f793e9e3a0` |

- Export **tất định**: cùng nguồn → cùng byte nhị phân → cùng hash. `generator.generatedAt` chỉ nằm trong manifest.

## 8. Validation

### 8.1. Lúc export (Python)

Mọi kiểm tra chạy trên **thư mục tạm** (§12). Một kiểm tra lỗi → exporter dừng, xóa thư mục tạm, không chạm `derived/`.

| # | Kiểm tra | Kết quả mong đợi (snapshot 1.0) |
|---|---|---|
| E1 | Hash NPZ nguồn | `ce62f017…0b93` |
| E2 | Ngày liên tục, `dayCount` khớp lịch | 9.509 ngày, 2000-11-01 → 2026-11-13 |
| E3 | `lat`/`lon` NPZ khớp `cells_025.csv` (không đọc mảng `cell` pickle) | 587/587 |
| E4 | `harmonized` hữu hạn, không âm | 0 NaN, 0 âm |
| E5 | Source code ∈ {1..4}, đúng theo thời gian | không có code 1 từ 2002-08-01; không có code 3|4 trước 2012-01-20 |
| E6 | Code 3: giá trị = số đếm S-NPP | khớp tuyệt đối |
| E7 | Code 4: giá trị = N20 / `scaleDivisor` | sai số tương đối ≤ 1e-6 với hệ số đo được; ≤ 3e-5 với `1.0106` |
| E8 | Tổng ngày → `harmonized_025_month.csv` | ≤ 0,01 (đo được 0,005) |
| E9 | Tổng ngày → `harmonized_regions_pentad.csv` | ≤ 0,01 (đo được 0,005) |
| E10 | Tổng ngày → `web_cells_pentad.json` | ≤ 0,05 (đo được 0,05; file lưu 1 chữ số thập phân) |
| E11 | `null` trong `web_cells_pentad.json` chỉ ngoài range | 0 trong range, 41.090 ngoài range |
| E12 | Input count ∈ [0, 32767] | 0 … 154 |
| E13 | Cờ hợp lệ ∈ {0,1}; vị trí 0 | 28.763, đều ở code 1 |
| E14 | Đọc lại file đã ghi, so nguyên bit với mảng nguồn | khớp |
| E15 | Regression samples (§8.3) | khớp |

Fixture chỉ chạy các kiểm tra áp dụng được với dữ liệu tổng hợp (E2–E4, E12–E14 và bảng kỳ vọng §11).

### 8.2. Java: lúc khởi động và lúc chạy

**Khởi động (fail-fast):**

1. `schemaVersion` major = `1`.
2. Mọi file trong `files` tồn tại; `byteSize` đúng và = `shape[0] × shape[1] × bytesPerValue`.
3. SHA-256 từng file khớp manifest.
4. `grid.cellIds` trùng thứ tự `tables/cells_025.csv` của dataset root; `cellCount` khớp.
5. `dateRange.dayCount` = số ngày từ `start` đến `end` (tính cả hai đầu).
6. `daily-source.u8` ∈ {1..4}; `daily-source-input-valid.u8` ∈ {0,1}.

Bất kỳ bước nào lỗi → **ứng dụng không khởi động** (context Spring thất bại, log rõ bước và file lỗi). Khi đó không có HTTP nào được phục vụ, nên **không có** response 503.

**Lúc chạy:** `503 DATASET_UNAVAILABLE` chỉ dành cho lỗi xảy ra **sau khi** ứng dụng đã khởi động thành công (ví dụ lỗi I/O khi đọc vùng file đã map). Không bao giờ trả số 0 thay thế.

### 8.3. Regression samples (dùng chung Python và Java, số thật snapshot 1.0)

| # | Mẫu | Kỳ vọng |
|---|---|---|
| R1 | TayNguyen 2005-03-25, tổng 122 cell — **Aqua model** | `171.635599` (±1e-6); toàn bộ code 2; input 21; valid 122 |
| R2 | ToanQuoc 2012-03-06, tổng 587 cell — **S-NPP direct** | `2275.0` (chính xác); toàn bộ code 3; input 2275; valid 587 |
| R3 | ToanQuoc 2026-04-29, tổng 587 cell — **NOAA-20 scaled** | `193.948132` (±1e-6); toàn bộ code 4; input 196; valid 587 |
| R4 | Cell `59_430` ngày 2019-01-07 — S-NPP direct | value `2.0`; code 3; input 2; valid 1 |
| R5 | Cell `87_422` ngày 2024-09-27 — NOAA-20 scaled | value `0.9895312786102295` (float32 bits `0x3F7D51EC`); code 4; input 1; valid 1 |
| R6 | Ngày 2026-11-06 | đúng 328 cell-day code 2 (kích hoạt `AQUA_FALLBACK_AFTER_ORBIT_DRIFT`) |
| R7 | Seasonality TayNguyen pentad 15, 2003–2025 (`harmonized_regions_pentad.csv`) | `n = 23`, `mean = 1672.6`, `median = 1373.0` |

R1–R6 kiểm trên file nhị phân; R7 kiểm trên bảng pentad (dùng cho 03B).

## 9. Sai số và làm tròn

- File nhị phân: không làm tròn, nguyên bit float32.
- Tổng tự cộng so với artifact tổng hợp: 0,01 (`harmonized_025_month.csv`, `harmonized_regions_pentad.csv`); 0,05 (`web_cells_pentad.json`).
- Tổng vùng trong Java cộng bằng `double` trên giá trị float32; regression R1/R3 chấp nhận ±1e-6.

## 10. Version

| Chuỗi | Khi nào đổi |
|---|---|
| `schemaVersion` | Định dạng artifact: patch = sửa tài liệu; minor = thêm trường/file tùy chọn; major = đổi layout, kiểu hoặc tên file bắt buộc |
| `dataVersion` | **Bắt buộc đổi** khi snapshot nguồn đổi (bất kỳ hash nguồn nào khác). Chạy lại exporter trên cùng snapshot → giữ `dataVersion`, file nhị phân giống từng byte |
| `modelVersion` | **Chỉ đổi** khi mô hình hoặc thuật toán harmonization đổi (ví dụ `k_cell`, `kappa`, cấu trúc mô hình). Snapshot mới cùng mô hình → giữ `modelVersion` |

Đổi pipeline sau MVP: chạy lại exporter trên snapshot mới; nếu NPZ giữ cùng tên mảng thì không cần sửa Java.

## 11. Fixture `daily-mini` (tự chứa)

Một **dataset root thu nhỏ**, dữ liệu **tổng hợp** (không cắt từ snapshot), Java test không cần dataset thật:

```text
backend/src/test/resources/fixtures/daily-mini/
├── tables/cells_025.csv          4 dòng (cùng cột với bản thật)
├── derived/
│   ├── dataset-manifest.json     kind = "fixture"
│   ├── daily-values.f32          4 × 4 × 4 B = 64 B
│   ├── daily-source.u8           16 B
│   ├── daily-input-count.i16     32 B
│   └── daily-source-input-valid.u8  16 B
└── fixture-expected.json         toàn bộ giá trị kỳ vọng + byte kiểm endian
```

- `dateRange`: 2026-11-10 → 2026-11-13 (4 ngày). Cell theo thứ tự: `34_419`, `34_420` (DBSCL), `45_428`, `45_429` (TayNguyen) — tọa độ/bounds lấy đúng dòng của `cells_025.csv` thật.
- Giá trị **tổng hợp, không phản ánh thực tế thời gian** (ví dụ code 1 vào năm 2026); mục đích là kiểm reader, tổng vùng, origin và trạng thái.

| Ngày | Cell | `34_419` | `34_420` | `45_428` | `45_429` |
|---|---|---|---|---|---|
| 2026-11-10 | value / code / count / valid | 0.0 / 3 / 0 / 1 | 1.0 / 3 / 1 / 1 | 2.0 / 3 / 2 / 1 | 154.0 / 3 / 154 / 1 |
| 2026-11-11 | | 0.0 / 4 / 0 / 1 | 0.75 / 4 / 1 / 1 | 1.5 / 4 / 2 / 1 | 255.25 / 4 / 258 / 1 |
| 2026-11-12 | | 0.5 / 2 / 0 / 1 | 1.5 / 2 / 1 / 1 | 0.0 / 4 / 0 / 1 | 3.0 / 4 / 3 / 1 |
| 2026-11-13 | | 0.25 / 1 / 0 / 0 | 3.75 / 1 / 0 / 0 | 0.0 / 2 / 0 / 1 | 5.0 / 3 / 5 / 1 |

Mọi giá trị float đều biểu diễn chính xác bằng float32 để test so sánh bằng nhau.

Ca kiểm tra gợi ý (có trong `fixture-expected.json`):

- Endian: `daily-input-count.i16` tại byte offset 14 (ngày 2026-11-11, cell `45_429`, giá trị 258) là `02 01`; `daily-values.f32` tại offset 28 (255.25) là `00 40 7F 43`.
- Tổng toàn bộ theo ngày: 157.0, 257.5, 5.0, 9.0.
- DBSCL 2026-11-13: 4.0, toàn bộ code 1, valid 0/2 → `MODEL_REDISTRIBUTED`, warning `TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY`, `DATASET_EDGE_DATE`.
- TayNguyen 2026-11-12: 3.0, toàn bộ code 4 → `SCALED_OBSERVATION`; TayNguyen 2026-11-13: 5.0, code {2, 3} → `MIXED`.
- `periods.partial` của fixture: năm 2026, tháng 11/2026, pentad 63 (07–11/11) và pentad 64 (12–16/11).

## 12. Exporter

```bash
python tools/data/export_daily_artifacts.py --dataset-root backend/hoalich_data_v1/hoalich_data_v1
python tools/data/export_daily_artifacts.py --fixture backend/src/test/resources/fixtures/daily-mini --cells-source backend/hoalich_data_v1/hoalich_data_v1/tables/cells_025.csv
```

1. Ghi mọi file vào thư mục tạm cùng cấp `derived.tmp-<pid>/` (cùng ổ đĩa để đổi tên an toàn).
2. Chạy toàn bộ §8.1 trên thư mục tạm, kể cả đọc lại file đã ghi (E14).
3. Ghi `dataset-manifest.json` **cuối cùng**, sau khi mọi kiểm tra đạt.
4. Nếu `derived/` đã tồn tại: dừng, trừ khi có `--replace`; với `--replace`, đổi tên `derived/` cũ sang `derived.prev-<timestamp>/`, đổi tên thư mục tạm thành `derived/`, rồi xóa bản cũ.
5. Lỗi ở bất kỳ bước nào: xóa thư mục tạm, `derived/` giữ nguyên, thoát mã khác 0.

## 13. Môi trường Python

`tools/data/requirements.txt`: Python 3.15, `numpy==2.5.4`, `pandas==3.1.1` (đã chạy thử). Backend Java không phụ thuộc Python.

## 14. Còn chờ chốt

1. Danh sách `warningCatalog` (§6.5) và `limitations` (§6.6) đủ cho `/metadata` và các endpoint chưa.
2. Bảng fixture (§11) có đủ ca cho repository test chưa.
3. Khi hai mục trên được đồng ý: đổi phiên bản spec thành `1.0.0`.
