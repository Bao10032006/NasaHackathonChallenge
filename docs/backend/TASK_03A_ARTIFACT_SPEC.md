# TASK 03A — Hợp đồng dữ liệu nội bộ Python ↔ Java (artifact spec)

- Phiên bản spec: `1.0.0-draft` — **chờ backend review và chốt**
- Người soạn: HoangAnh250 (Người 1 — Data/ML và artifact)
- Ngày: 14/11/2026
- Snapshot nguồn: pipeline **1.0** trong `backend/hoalich_data_v1/hoalich_data_v1/` (main `74735ed`)
- Căn cứ: Technical Design v0.3 §6 và §6A, API Contract v0.3, Decision Log D07, D08, D10–D13

Mục tiêu: Python xuất và Java đọc **cùng một định dạng byte**. Mọi con số "snapshot 1.0" dưới đây đã được đo trực tiếp trên dữ liệu trong repo, không phải giả định. Khi spec được chốt, mọi thay đổi định dạng phải tăng `schemaVersion`.

---

## 1. Phạm vi

Trong phạm vi:

- 4 file nhị phân xuất từ `tables/cube_daily_day_veg.npz` và 1 file `dataset-manifest.json`.
- Quy tắc layout, checksum, version, validation và sai số.
- Bộ fixture nhỏ cùng định dạng để backend test trước khi có artifact thật.

Ngoài phạm vi: anomaly, export CSV, bất kỳ thay đổi nào với artifact gốc (CSV/JSON/NPZ của snapshot giữ nguyên, không ghi đè).

## 2. Vị trí file

| Thành phần | Đường dẫn |
|---|---|
| Artifact xuất (thật) | `<HOALICH_DATASET_ROOT>/derived/` — với cấu hình mặc định: `backend/hoalich_data_v1/hoalich_data_v1/derived/` |
| Manifest | `<HOALICH_DATASET_ROOT>/derived/dataset-manifest.json` |
| Script xuất + kiểm định | `tools/data/export_daily_artifacts.py` |
| Môi trường Python ghim phiên bản | `tools/data/requirements.txt` |
| Báo cáo kết quả export | `docs/backend/TASK_03A_EXPORT_REPORT.md` |
| Fixture cho test Java | `backend/src/test/resources/fixtures/daily-mini/` (cùng tên file, có manifest riêng) |

Java chỉ resolve đường dẫn **tương đối** dưới dataset root; không dùng đường dẫn tuyệt đối.

## 3. Danh sách file và kiểu dữ liệu

Mọi file nhị phân: **không có header**, **little-endian**, **row-major `[date][cell]`**, kích thước = `dayCount × cellCount × bytesPerValue`.

Snapshot 1.0: `dayCount = 9509`, `cellCount = 587`, `valueCount = 5.581.783`.

| File | Kiểu (NumPy / Java) | Byte/giá trị | Kích thước snapshot 1.0 | Miền giá trị snapshot 1.0 | Nguồn trong NPZ |
|---|---|---:|---:|---|---|
| `daily-values.f32` | `<f4` / `float` | 4 | 22.327.132 B | 0 … 705,8286; hữu hạn, không âm, không NaN | `harmonized` (float32, sao chép nguyên bit) |
| `daily-source.u8` | `u1` / `byte` (đọc không dấu) | 1 | 5.581.783 B | {1, 2, 3, 4} | `src_code` (int8 → uint8) |
| `daily-input-count.i16` | `<i2` / `short` | 2 | 11.163.566 B | 0 … 154 | Số đếm của **vệ tinh ứng với source code** (§5.3) |
| `daily-source-input-valid.u8` | `u1` / `byte` | 1 | 5.581.783 B | {0, 1} | Cờ hợp lệ của **vệ tinh ứng với source code** (§5.4) |
| `dataset-manifest.json` | UTF-8, LF | — | — | — | §6 |

Tổng nhị phân snapshot 1.0: **44.654.264 B** (mỗi file < 100 MB).

## 4. Layout và cách đánh chỉ số

- `dateIndex` = số ngày lịch (UTC) kể từ `dateRange.start`; ngày liên tục, không bỏ ngày. Snapshot 1.0: `dateIndex 0 = 2000-11-01`, `dateIndex 9508 = 2026-11-13`.
- `cellIndex` = chỉ số dòng (0-based, bỏ header) trong `tables/cells_025.csv`. Manifest liệt kê lại `cellIds` theo đúng thứ tự này để Java đối chiếu.
- Vị trí giá trị: `elementIndex = dateIndex × cellCount + cellIndex`; `byteOffset = elementIndex × bytesPerValue`.
- Một ngày = một khúc liên tục `cellCount` giá trị → đọc theo khoảng ngày là đọc một vùng byte liên tục.

Gợi ý phía Java (không bắt buộc): `FileChannel.map(READ_ONLY, …)` rồi `.order(ByteOrder.LITTLE_ENDIAN)`; `getFloat(byteOffset)`, `getShort(byteOffset)`, `Byte.toUnsignedInt(get(byteOffset))`. Cộng dồn tổng vùng bằng `double`.

## 5. Ngữ nghĩa từng file

### 5.1. `daily-values.f32`

Giá trị `snpp_eq` cấp cell-day, **sao chép nguyên bit** từ `harmonized` của NPZ (không làm tròn, không đổi kiểu). Không có giá trị sentinel: trong dataset range không có missing. Giá trị `0` là thật (snapshot 1.0: 3.172.368 / 5.581.783 cell-day).

### 5.2. `daily-source.u8`

| Code | `source` | `origin` | `inputSatellite` | Snapshot 1.0: cell-day | Ngày đầu → ngày cuối |
|---:|---|---|---|---:|---|
| 1 | `TERRA` | `MODEL_REDISTRIBUTED` | Terra | 374.506 | 2000-11-01 → 2002-07-31 |
| 2 | `AQUA` | `MODEL_REDISTRIBUTED` | Aqua | 2.034.614 | 2002-08-01 → 2026-11-06 |
| 3 | `SNPP` | `DIRECT_OBSERVATION` | S-NPP | 3.129.684 | 2012-01-20 → 2026-11-01 |
| 4 | `NOAA20` | `SCALED_OBSERVATION` | NOAA-20 | 42.979 | 2018-05-06 → 2026-11-13 |

Code 2 sau 2012-01-20 là vá khi S-NPP và NOAA-20 đều không hợp lệ (2012: 27 ngày; 2017: 2 ngày; 2026: 1 ngày, 2026-11-06, 328 cell-day → warning `AQUA_FALLBACK_AFTER_ORBIT_DRIFT`). Code 4 trước 2026-11-02 là vá gap S-NPP; từ 2026-11-02 là nguồn chính.

### 5.3. `daily-input-count.i16`

Số phát hiện ban ngày đã lọc nguồn tĩnh của **đúng vệ tinh ứng với source code** tại cell-day: code 1 → `Terra`, 2 → `Aqua`, 3 → `SNPP`, 4 → `N20`. Đây là số đếm đầu vào, **không phải** `snpp_eq`. Với code 1|2, giá trị `daily-values` có thể dương dù input count = 0 (phân bổ từ mô hình cấp tháng).

### 5.4. `daily-source-input-valid.u8`

Cờ hợp lệ (`valid_Terra|valid_Aqua|valid_SNPP|valid_N20`) của **đúng vệ tinh ứng với source code**: `1` = vệ tinh đó có dữ liệu hợp lệ ngày đó; `0` = không.

Snapshot 1.0: chỉ code 1 có giá trị 0 (**28.763 cell-day**, các đợt Terra mất dữ liệu 2001–2002). Khi đó `daily-values` vẫn có giá trị (phân bổ theo khí hậu) và vẫn là `AVAILABLE`; cờ 0 chỉ dùng cho `sourceInputValid`/`sourceInputValidCellCount` của API, không biến giá trị thành missing.

## 6. `dataset-manifest.json`

### 6.1. Trường bắt buộc

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `schemaVersion` | string semver | Phiên bản spec này (`1.0.0`) |
| `dataVersion` | string | `hoalich-data-v1-2026-11-13` (D08) |
| `modelVersion` | string | `lai-clim-s2-k60-kappa3` (D08) |
| `pipelineVersion` | string | `1.0` (đọc từ `summary.json`) |
| `metric`, `unit`, `timeZone` | string | `snpp_eq`, `S-NPP-equivalent daytime detections`, `UTC` |
| `dateRange` | object | `start`, `end` (ISO date), `dayCount` |
| `dataThrough` | ISO date | Ngày dữ liệu cuối = `dateRange.end` |
| `grid` | object | `degrees` (0.25), `cellCount`, `cellOrderSource` (`tables/cells_025.csv`), `cellIds` (mảng theo thứ tự) |
| `layout` | object | `order` = `row-major[date][cell]`, `byteOrder` = `little-endian`, `header` = `none` |
| `files` | array | Mỗi file: `name`, `dtype`, `bytesPerValue`, `shape`, `byteSize`, `sha256`, `description` |
| `sourceCodes` | array | `code`, `source`, `origin`, `inputSatellite`, `firstDate`, `lastDate`, `cellDays` |
| `periods` | object | `partial` và `transitions` (§6.3) |
| `sources` | array | File nguồn đã dùng: `path` (tương đối dataset root), `sha256`, `byteSize` |
| `capabilities` | object | `optionalArtifacts`: artifact tùy chọn phát hiện được (snapshot 1.0: mảng rỗng) |
| `limitations` | array string | Mã giới hạn cố định cho `/metadata` |
| `validation` | object | Kết quả kiểm định lúc export (§8.1) và `regressionSamples` |
| `generator` | object | `script`, `python`, `numpy`, `pandas`, `generatedAt` |

Trường thêm mới ở phiên bản minor phải là tùy chọn; Java bỏ qua trường không biết.

### 6.2. Ví dụ (rút gọn `cellIds` và `validation.checks`)

```json
{
  "schemaVersion": "1.0.0",
  "dataVersion": "hoalich-data-v1-2026-11-13",
  "modelVersion": "lai-clim-s2-k60-kappa3",
  "pipelineVersion": "1.0",
  "metric": "snpp_eq",
  "unit": "S-NPP-equivalent daytime detections",
  "timeZone": "UTC",
  "dateRange": {"start": "2000-11-01", "end": "2026-11-13", "dayCount": 9509},
  "dataThrough": "2026-11-13",
  "grid": {"degrees": 0.25, "cellCount": 587, "cellOrderSource": "tables/cells_025.csv",
           "cellIds": ["34_419", "34_420", "..."]},
  "layout": {"order": "row-major[date][cell]", "byteOrder": "little-endian", "header": "none"},
  "files": [
    {"name": "daily-values.f32", "dtype": "float32", "bytesPerValue": 4, "shape": [9509, 587],
     "byteSize": 22327132, "sha256": "<64 hex>", "description": "harmonized snpp_eq, bit-exact copy"},
    {"name": "daily-source.u8", "dtype": "uint8", "bytesPerValue": 1, "shape": [9509, 587],
     "byteSize": 5581783, "sha256": "<64 hex>", "description": "source code 1-4"},
    {"name": "daily-input-count.i16", "dtype": "int16", "bytesPerValue": 2, "shape": [9509, 587],
     "byteSize": 11163566, "sha256": "<64 hex>", "description": "input count of the selected satellite"},
    {"name": "daily-source-input-valid.u8", "dtype": "uint8", "bytesPerValue": 1, "shape": [9509, 587],
     "byteSize": 5581783, "sha256": "<64 hex>", "description": "validity flag of the selected satellite"}
  ],
  "sourceCodes": [
    {"code": 1, "source": "TERRA", "origin": "MODEL_REDISTRIBUTED", "inputSatellite": "Terra",
     "firstDate": "2000-11-01", "lastDate": "2002-07-31", "cellDays": 374506},
    {"code": 2, "source": "AQUA", "origin": "MODEL_REDISTRIBUTED", "inputSatellite": "Aqua",
     "firstDate": "2002-08-01", "lastDate": "2026-11-06", "cellDays": 2034614},
    {"code": 3, "source": "SNPP", "origin": "DIRECT_OBSERVATION", "inputSatellite": "SNPP",
     "firstDate": "2012-01-20", "lastDate": "2026-11-01", "cellDays": 3129684},
    {"code": 4, "source": "NOAA20", "origin": "SCALED_OBSERVATION", "inputSatellite": "N20",
     "firstDate": "2018-05-06", "lastDate": "2026-11-13", "cellDays": 42979, "scaleDivisor": 1.0106}
  ],
  "periods": {
    "partial": [
      {"granularity": "year", "year": 2000, "coveredFrom": "2000-11-01"},
      {"granularity": "year", "year": 2026, "coveredTo": "2026-11-13"},
      {"granularity": "month", "year": 2026, "month": 11, "coveredTo": "2026-11-13"},
      {"granularity": "pentad", "year": 2026, "pentad": 64, "coveredTo": "2026-11-13"}
    ],
    "transitions": [
      {"date": "2002-08-01", "event": "TERRA_TO_AQUA"},
      {"date": "2012-01-20", "event": "SNPP_START"},
      {"date": "2026-11-02", "event": "SNPP_END_NOAA20_PRIMARY"}
    ]
  },
  "sources": [
    {"path": "tables/cube_daily_day_veg.npz", "byteSize": 0, "sha256": "ce62f017494b758b4a6a8cfe889601e1974dc3c4bb10113cd1e1b8a901900b93"},
    {"path": "tables/cells_025.csv", "byteSize": 0, "sha256": "f10c77b7defa784f5204e6489744b8f354fa92380f5c62acb994b1d31d953420"}
  ],
  "capabilities": {"optionalArtifacts": []},
  "limitations": ["SNPP_EQ_NOT_FIRE_EVENT_COUNT", "NO_DAILY_UNCERTAINTY_INTERVAL",
                  "TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY", "DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY"],
  "validation": {"status": "PASS", "checks": [], "regressionSamples": []},
  "generator": {"script": "tools/data/export_daily_artifacts.py", "python": "3.15.0",
                "numpy": "2.5.4", "pandas": "3.1.1", "generatedAt": "2026-11-14T00:00:00Z"}
}
```

`byteSize: 0` và `<64 hex>` trong ví dụ là chỗ trống; script điền giá trị thật.

### 6.3. Partial và transition (snapshot 1.0)

- Đầu chuỗi: năm 2000 partial (chỉ từ 2000-11-01). Tháng 11/2000 và pentad 62/2000 (bắt đầu đúng 2000-11-01) **đủ kỳ**; các tháng/pentad trước đó là **missing**, không phải partial.
- Cuối chuỗi: năm 2026, tháng 11/2026 và pentad 64/2026 (12–16/11) là **partial**.
- Mốc chuyển nguồn: 2002-08-01 (Terra → Aqua), 2012-01-20 (S-NPP bắt đầu), 2026-11-02 (S-NPP dừng, NOAA-20 thành nguồn chính).

Java đọc ma trận này từ manifest để sinh `PARTIAL_PERIOD`, `DATASET_EDGE_DATE` và warning theo nguồn; không tự viết cứng các ngày.

## 7. Checksum

- Thuật toán: **SHA-256**, chuỗi hex **chữ thường**, tính trên **toàn bộ byte** của file.
- File text (CSV/JSON) tính trên bản **LF** — đúng nội dung lưu trong Git nhờ `.gitattributes`. Checkout cũ trước khi có `.gitattributes` có thể là CRLF và cho hash khác; khi đó checkout lại file (đã gặp và xử lý khi soạn spec này).
- Manifest **không** chứa hash của chính nó.
- Hash nguồn snapshot 1.0 (bản LF, khớp blob trong Git):

| File nguồn | SHA-256 |
|---|---|
| `tables/cube_daily_day_veg.npz` | `ce62f017494b758b4a6a8cfe889601e1974dc3c4bb10113cd1e1b8a901900b93` |
| `tables/cells_025.csv` | `f10c77b7defa784f5204e6489744b8f354fa92380f5c62acb994b1d31d953420` |
| `tables/harmonized_025_month.csv` | `c6c93dcfb96b8820d237e8513463e56861b66a7cc577e2968f00ff3cb31f3197` |
| `tables/harmonized_regions_pentad.csv` | `77f741d51bd54e809daac7a9cbd77aedf7f4d2584bccb2d89fd1f6fd7aedcd6a` |
| `web_cells_pentad.json` | `24f00ac5fe28b0bf2a77583fb1459a34a2613bf5e60150e4004344fb46934343` |
| `summary.json` | `8493c9c8ed03bff94302967950c479ec3dcbd04fd1b5dca8633b09f793e9e3a0` |

- Export là **tất định**: cùng nguồn → cùng byte → cùng hash. `generator.generatedAt` không ảnh hưởng file nhị phân.

## 8. Validation

### 8.1. Lúc export (Python) — ghi vào `manifest.validation.checks`

Script dừng với lỗi và **không** ghi manifest nếu bất kỳ kiểm tra nào thất bại.

| # | Kiểm tra | Kết quả mong đợi (snapshot 1.0, đã đo) |
|---|---|---|
| E1 | Hash NPZ nguồn | `ce62f017…0b93` |
| E2 | Ngày liên tục, `dayCount` khớp lịch | 9.509 ngày, 2000-11-01 → 2026-11-13 |
| E3 | Thứ tự cell: `lat`/`lon` của NPZ khớp `cells_025.csv` (không đọc mảng `cell` pickle) | 587/587 |
| E4 | `harmonized` hữu hạn, không âm | 0 NaN, 0 âm |
| E5 | Source code ∈ {1..4} và đúng theo thời gian | không có code 1 từ 2002-08-01; không có code 3|4 trước 2012-01-20 |
| E6 | Code 3: giá trị = số đếm S-NPP | khớp tuyệt đối |
| E7 | Code 4: giá trị = NOAA-20 / 1.0106 | sai số ≤ 0,001 |
| E8 | Tổng ngày → `harmonized_025_month.csv` | lệch lớn nhất ≤ 0,01 (đo được 0,005) |
| E9 | Tổng ngày → `harmonized_regions_pentad.csv` | ≤ 0,01 (đo được 0,005) |
| E10 | Tổng ngày → `web_cells_pentad.json` | ≤ 0,05 (đo được 0,05 — file lưu 1 chữ số thập phân) |
| E11 | `null` trong `web_cells_pentad.json` chỉ ngoài dataset range | 0 trong range, 41.090 ngoài range |
| E12 | Input count ∈ [0, 32767] | 0 … 154 |
| E13 | Cờ hợp lệ ∈ {0,1}; vị trí 0 | 28.763, đều ở code 1 |
| E14 | Đọc lại file đã ghi, so nguyên bit với mảng nguồn | khớp |
| E15 | Sample regression (§8.3) | khớp |

### 8.2. Lúc khởi động (Java) — fail-fast

1. `schemaVersion` có major = `1`; major khác → từ chối.
2. Mọi file trong `files` tồn tại, `byteSize` đúng và bằng `shape[0] × shape[1] × bytesPerValue`.
3. SHA-256 của từng file khớp manifest (khoảng 45 MB, chấp nhận được khi startup).
4. `grid.cellIds` trùng thứ tự `tables/cells_025.csv`; `cellCount` khớp.
5. `dateRange.dayCount` = số ngày giữa `start` và `end` (tính cả hai đầu).
6. Quét `daily-source.u8` ∈ {1..4} và `daily-source-input-valid.u8` ∈ {0,1}.

Bất kỳ bước nào lỗi → không publish repository bean, startup thất bại với thông báo rõ (API tương ứng `DATASET_UNAVAILABLE`); không bao giờ trả số 0 thay thế.

### 8.3. Sample regression (dùng chung cho Python và Java)

| Mẫu | Kỳ vọng |
|---|---|
| `/daily` TayNguyen 2005-03-25: tổng `daily-values` của 122 cell vùng TayNguyen | `171.635599` (sai số 1e-6); toàn bộ code 2; tổng input count = 21; valid cell = 122 |
| `/seasonality` TayNguyen pentad 15, 2003–2025 (từ `harmonized_regions_pentad.csv`) | `n = 23`, `mean = 1672.6`, `median = 1373.0` |
| Ngày 2026-11-06 | có 328 cell-day code 2 (warning `AQUA_FALLBACK_AFTER_ORBIT_DRIFT`) |

## 9. Sai số và làm tròn

- File nhị phân: **không làm tròn** — nguyên bit float32 của nguồn.
- So tổng tự cộng với artifact tổng hợp: 0,01 cho `harmonized_025_month.csv` và `harmonized_regions_pentad.csv`; 0,05 cho `web_cells_pentad.json`.
- API làm tròn khi hiển thị (nếu có) là việc của mapper, không thuộc spec này.

## 10. Version

- `schemaVersion` (semver): patch = sửa tài liệu; minor = thêm trường/file tùy chọn (Java cũ vẫn đọc được); major = đổi layout/kiểu/tên file bắt buộc.
- `dataVersion`/`modelVersion`: theo D08; đổi snapshot pipeline thì đổi hai chuỗi này và xuất lại toàn bộ artifact.
- Đổi sang pipeline khác sau MVP: chạy lại script trên snapshot mới; nếu NPZ giữ cùng tên mảng thì không cần sửa Java.

## 11. Fixture `daily-mini` (Bước 1)

- Cùng 4 tên file + `dataset-manifest.json`, cùng layout và quy tắc; chỉ khác `shape`.
- Kích thước dự kiến: 4 ngày × 4 cell, cắt từ dữ liệu thật, chọn sao cho có đủ code 1, 2, 3, 4, một cờ hợp lệ = 0, giá trị 0 và giá trị dương.
- Manifest fixture có `cellIds` riêng và `sources` trỏ tới snapshot gốc; kèm bảng giá trị kỳ vọng để test Java.

## 12. Môi trường Python

`tools/data/requirements.txt` ghim phiên bản đã chạy thử: Python 3.15, `numpy==2.5.4`, `pandas==3.1.1`. Script chỉ cần thư viện chuẩn + numpy + pandas; backend Java không phụ thuộc Python.

## 13. Cần backend xác nhận để chốt

1. Vị trí `derived/` dưới dataset root và cách lưu: commit vào Git (44,7 MB, mỗi file < 100 MB) hay phát hành riêng kèm hash.
2. `daily-source-input-valid.u8` một byte/giá trị (đã đề xuất thay cho bitset) — giữ nguyên?
3. Manifest liệt kê đầy đủ `cellIds` (587 chuỗi) — đồng ý?
4. Danh sách mã trong `limitations` và `periods` có đủ cho `/metadata` chưa?
5. Java kiểm SHA-256 mỗi lần startup (§8.2 bước 3) — chấp nhận thời gian khởi động thêm?
