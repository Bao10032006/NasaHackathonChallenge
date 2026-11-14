# TASK 02B — Verify Daily Dataset & Finalize Hỏa Lịch API Contract

Ngày review: 14/11/2026
Phạm vi: kiểm tra read-only tài liệu, pipeline và artifact; đề xuất contract v0.3; không sửa application source hoặc dataset.

## Executive Summary

Daily dataset **đã được kiểm tra trực tiếp** tại `backend/hoalich_data_v1/hoalich_data_v1/tables/cube_daily_day_veg.npz`. File chứa chuỗi daily harmonized dày theo 9.509 ngày × 587 cell, đúng mapping `cells_025.csv`, có số đếm của năm vệ tinh, cờ validity và `src_code` cấp cell-day.

Daily data **dùng được với qualification** cho tính năng chọn ngày cụ thể:

- 56,0696% cell-day là S-NPP trực tiếp.
- 0,7700% là NOAA-20 đã quy đổi.
- 43,1604% là kết quả mô hình Terra/Aqua cấp tháng được phân bổ xuống ngày.
- Không có interval bất định hoặc validation riêng ở cấp ngày; validation phát hành dừng ở pentad/tháng.

Vì vậy API phải gọi kết quả là “hoạt động hài hòa theo ngày” và trả provenance/origin. Không được mô tả mọi giá trị là hotspot đo trực tiếp hoặc số vụ cháy.

Đề xuất v0.3 giữ tương thích các endpoint v0.2, thêm `/seasonality`, thêm `/daily` và cho `/map/cells` nhận `date`. `/calendar` vẫn chỉ `month|pentad`; anomaly và CSV export tiếp tục deferred.

## 1. Existing Contract Assessment

### 1.1. Tài liệu thực tế

Đã đọc và đối chiếu:

- `mvp_bussinessRule/HoaLich_00_AI_README.md` — front matter là v0.2; không có file riêng tên `HoaLich_00_AI_README_v0.2.md`.
- Documents 01–06 v0.2.
- TASK 01 và TASK 02A reports.
- Dataset README, `summary.json`, pipeline, verify script và ba tài liệu handoff.
- Các bảng validation/evidence liên quan.

Không tìm thấy:

- `HoaLich_OpenAPI_v0.2.yaml`.
- `HoaLich_07_Challenge_Alignment_and_Decision_Log_v0.2.md`.

Do đó TASK 02B không thể tuyên bố đã review hai file v0.2 này. OpenAPI v0.3 và Decision Log v0.3 được tạo mới từ contract Markdown, requirements và dữ liệu đã kiểm chứng.

### 1.2. Điểm mạnh của contract v0.2

- Base path, area vocabulary, metric `snpp_eq`, missing khác zero và metadata/version đã được định hướng đúng.
- Năm endpoint core phù hợp artifact: metadata, areas, calendar, map/cells và trends.
- Daily bị gate thay vì được thêm theo giả định.
- Harmonization comparison tách khỏi query nghiệp vụ.
- Anomaly được feature-gated.

### 1.3. Khoảng trống và mâu thuẫn

1. Seasonality là Must trong requirements nhưng v0.2 không có endpoint `/seasonality` độc lập; chỉ đề xuất baseline trong calendar/trends.
2. Nhiều endpoint chỉ có mô tả high-level, chưa đủ request/response/error schema để frontend sinh client.
3. `includeBaseline` có nhưng baseline years/method vẫn là decision mở.
4. `/map/cells` chưa có temporal-selector rule loại trừ nhau.
5. `/trends` chưa chốt khi nào `period` bắt buộc/cấm.
6. `dataVersion` và `modelVersion` chưa có canonical string trong artifact.
7. v0.2 cấm `day`, trong khi daily artifact thực tế có thể hỗ trợ tính năng có qualification.
8. Source tháng là nhãn chiếm đa số cấp toàn miền, không được expose như provenance per-cell.
9. Error response chưa chuẩn hóa đủ cho frontend.

## 2. Actual Daily Dataset Verification

### 2.1. File identity

- Path: `backend/hoalich_data_v1/hoalich_data_v1/tables/cube_daily_day_veg.npz`.
- Size: 6.059.158 bytes.
- SHA-256: `CE62F017494B758B4A6A8CFE889601E1974DC3C4BB10113CD1E1B8A901900B93`.
- NPZ có 16 member arrays.

### 2.2. Fields, types và dimensions

| Field | dtype | shape | Ý nghĩa đã đối chiếu pipeline |
|---|---|---:|---|
| `dates` | int64 | `[9509]` | `YYYYMMDD`, liên tục 2000-11-01..2026-11-13. |
| `cell` | NumPy object/string | `[587]` | Cell ID; thứ tự khớp chính xác CSV. |
| `lat`, `lon` | float64 | `[587]` | Tâm cell; khớp `cells_025.csv`. |
| `Terra`, `Aqua`, `SNPP`, `N20`, `N21` | int16 | `[9509,587]` | Số phát hiện ban ngày sau lọc theo satellite/cell-day. |
| `valid_Terra`, `valid_Aqua`, `valid_SNPP`, `valid_N20`, `valid_N21` | bool | `[9509,587]` | Cờ availability suy luận bởi pipeline. |
| `harmonized` | float32 | `[9509,587]` | Daily harmonized `snpp_eq`. |
| `src_code` | int8 | `[9509,587]` | Nguồn được chọn cho từng cell-day. |

`cell.npy` dùng object dtype, khiến runtime reader cần pickle-aware NumPy semantics. Đây là một lý do không đọc NPZ trực tiếp trong Spring Boot.

### 2.3. Date và cell mapping

- 9.509 ngày là chuỗi lịch liên tục, không thiếu ngày trong range.
- 587/587 cell unique.
- Thứ tự cell trong NPZ khớp chính xác `cells_025.csv`.
- `lat`/`lon` khớp chính xác CSV.
- Range center: latitude 8,625..23,375; longitude 102,125..109,375.

### 2.4. Missing và valid zero

`harmonized` có 5.581.783 values:

- Finite: 5.581.783.
- NaN/Infinity: 0.
- Zero: 3.172.368.
- Positive: 2.409.415.
- Negative: 0.
- Range: 0..705,82861328125.

Daily cube v1 là dense và không dùng NaN/null cho harmonized value trong range. Zero không phải missing. Tuy nhiên, zero có thể là direct valid zero hoặc kết quả model bằng zero; phải đọc `src_code`/origin để diễn giải.

Current snapshot không có `src_code=0`. Nếu phiên bản tương lai có missing daily cell, API v0.3 dành `value=null`, `valueStatus=MISSING`; không được tạo zero.

### 2.5. Provenance và observation/estimate split

| Source code | Semantics | Cell-days | Tỷ lệ | Khoảng xuất hiện |
|---:|---|---:|---:|---|
| 1 | Terra → Aqua → S-NPP, model redistributed | 374.506 | 6,7094% | 2000-11-01..2002-07-31 |
| 2 | Aqua → S-NPP, model redistributed/fallback | 2.034.614 | 36,4510% | 2002-08-01..2026-11-06 |
| 3 | S-NPP direct observation | 3.129.684 | 56,0696% | 2012-01-20..2026-11-01 |
| 4 | NOAA-20 / 1,0106 | 42.979 | 0,7700% | 2018-05-06..2026-11-13 |

Kiểm tra số học:

- Với `src_code=3`, max absolute difference giữa `harmonized` và `SNPP` là `0`; không có mismatch.
- Với `src_code=4`, max absolute difference so với `N20/1.0106` là khoảng `0,0007245`, phù hợp float32.
- Nhánh code 1/2 tổng cộng 2.409.120 cell-days, tức 43,1604%, là model redistributed.

Điểm khoa học quan trọng:

- Code 1 có 337.087 positive harmonized values nhưng chỉ 3.413 cell-days có Terra raw count khác zero; 28.763 selected cell-days có `valid_Terra=false`.
- Code 2 có 1.813.500 positive harmonized values nhưng chỉ 51.351 selected cell-days có Aqua raw count khác zero.
- Đây là hệ quả dự kiến của việc dự báo tổng tháng và phân bổ xuống ngày theo `Aqua_day + kappa × climate_profile`, không phải lỗi file.

### 2.6. Aggregate consistency

Đã tự đọc binary NPZ bằng Python standard library vì runtime hiện có không cài NumPy; không sửa file và không regenerate model.

- Aggregate daily → cell-month so sánh đủ 183.731 rows.
- Max difference sau round 2 decimals: `0,00`.
- Daily total: `1.774.721,5885730286`.
- Monthly rounded CSV total: `1.774.716,01`.
- Relative difference do round cell-month: khoảng `3,14e-6`.

`verify_outputs.py` không chạy trong môi trường hiện tại vì Python không có NumPy/Pandas. TASK 02B không tuyên bố script mới PASS; các invariant trên được kiểm tra bằng reader read-only độc lập.

### 2.7. Verified samples

Tây Nguyên ngày 2005-03-25:

- 122 cell, toàn bộ source code 2.
- Harmonized value: `171,635599`.
- Aqua input observations: `21`.
- 122/122 source-valid cells.
- Đây là `MODEL_REDISTRIBUTED`.

Tây Nguyên ngày 2024-03-15:

- Harmonized value `161`.
- S-NPP input count `161`.
- Toàn bộ 122 cell là code 3, `DIRECT_OBSERVATION`.

Toàn quốc ngày 2024-05-30:

- S-NPP gap được thay bằng NOAA-20.
- Harmonized value `22,759219` từ 23 NOAA-20 counts.
- Toàn bộ 587 cell là code 4, `SCALED_OBSERVATION`.

## 3. Core API Readiness

### `/api/v1/metadata`

**Readiness:** Ready sau khi duyệt canonical version strings.
**Dependencies:** summary/manifest/hash.
**v0.3 fix:** schema hóa date range, granularities, source dictionary, daily qualification, limitations và partial notes.

### `/api/v1/areas`

**Readiness:** Ready.
**Dependencies:** `cells_025.csv`.
**v0.3 fix:** field types cho national/region/cell, center/bounds/cellCount và enum validation.

### `/api/v1/calendar`

**Readiness:** Ready cho month/pentad.
**Dependencies:** cell month/pentad và region pentad artifacts.
**Behavior:** trả 12/73 periods; missing khác zero; 2000/2026 partial.
**v0.3 decision:** không thêm day. Giữ `includeBaseline` tương thích, baseline median 2003–2025, loại missing/partial và target year nếu nằm trong range.

### `/api/v1/map/cells`

**Readiness:** Ready.
**Dependencies:** month/pentad artifacts, daily cube/derived index, cell bounds.
**v0.3 fix:** đúng một selector `date` hoặc `year+month` hoặc `year+pentad`. Daily cells có source/origin/input fields; month/pentad không giả provenance per-cell.

### `/api/v1/trends`

**Readiness:** Ready sau khi freeze period rule.
**v0.3 rule:** year cấm `period`; month bắt buộc 1..12; pentad bắt buộc 1..73. Không có daily trends ở v0.3.

### `/api/v1/seasonality`

**Readiness:** Data-supported, mới ở v0.3.
**Dependencies:** harmonized month/pentad historical series.
**Response:** mean, median, sampleSize và status cho mỗi period; default reference 2003–2025; minimum five valid samples.

### Harmonization comparison

**Readiness:** Ready cho national yearly evidence. Metric/unit raw và harmonized phải tách biệt.

### Optional endpoints

- **Cell detail:** data-supported, Should; không chặn core.
- **Anomaly:** không ready; thiếu method version/threshold/validation.
- **CSV export:** không ready; thiếu columns/limits/versioned filename contract.

## 4. Proposed Daily API Design

### 4.1. Endpoint

`GET /api/v1/daily?date=YYYY-MM-DD&areaType=...&areaId=...&includeCells=false`

Không mở rộng `/calendar` thành day để tránh thay đổi semantics và payload size. `/map/cells` nhận thêm `date` để frontend hiển thị spatial slice cùng exact-date selection.

### 4.2. Response semantics

Area-level fields:

- Area/date/metric/value/status.
- `origin`: direct, scaled, model redistributed hoặc mixed.
- `sourceComposition`: cell count, harmonized subtotal, selected input count và valid-cell count theo source.
- Metadata/warnings/version.
- Optional cell slice khi `includeCells=true`.

Cell-level fields:

- Cell/bounds/value/status.
- Source code/name/origin.
- Selected source input count và validity.

Không trả:

- Daily `lo90/hi90`.
- Tọa độ hotspot giả.
- Daily anomaly classification.
- Raw detections hoặc FRP/brightness/confidence.

### 4.3. Missing, partial và errors

- Date ngoài range → 422 `DATE_OUTSIDE_DATASET_RANGE`.
- Area không tồn tại → 404 `AREA_NOT_FOUND`.
- Date sai format → 400 `INVALID_PARAMETER`.
- Daily v1 bên trong range là dense; zero vẫn `AVAILABLE`.
- Source gap đã fallback không phải missing; origin/source composition giải thích cách tạo giá trị.
- Exact date là một ngày atomic. Partial vẫn giữ trong schema cho snapshot tương lai có explicit incomplete-day flag; v1 không có daily incomplete flag riêng.

## 5. Scientific and Data Limitations

1. `snpp_eq` không phải số vụ cháy hoặc diện tích cháy.
2. Chỉ phản ánh khung quan sát ban ngày tương đương S-NPP; không thấy toàn bộ hoạt động trong ngày.
3. Daily model values trước S-NPP và fallback Aqua được hiệu chuẩn cấp tháng rồi phân bổ xuống ngày.
4. Model value có thể dương khi raw input count đúng ngày bằng zero.
5. Không có daily uncertainty interval và không có validation độc lập ở cấp ngày.
6. Validation pentad có chất lượng khác nhau theo vùng; ĐBSH thấp hơn các vùng khác trong một số split.
7. Validity/outage flags là suy luận thống kê, không phải official cloud/coverage mask.
8. Terra early period tích lũy hai bước quy đổi và bất định lớn hơn.
9. NOAA-20 là scaled observation, không phải S-NPP direct.
10. Vùng chẩn đoán không phải địa giới hành chính.
11. Date UTC trùng local date chỉ theo đặc điểm daytime snapshot hiện tại; không tổng quát hóa cho dataset khác.

## 6. Proposed Changes from v0.2

### Additive, non-breaking

- Thêm `/seasonality`.
- Thêm `/daily`.
- Thêm `date` selector cho `/map/cells`.
- Thêm Problem Details schema.
- Schema hóa response/validation từng core endpoint.
- Thêm daily source/origin vocabulary.
- Thêm canonical version strings đề xuất.
- Thêm Technical Design n-layer và Decision Log v0.3.

### Clarified behavior

- `/calendar` vẫn chỉ month/pentad.
- `/trends` có rule period rõ ràng.
- Baseline và seasonality dùng cùng data semantics.
- Month/pentad source label không được nâng thành per-cell provenance.
- Anomaly/export không nằm trong approved core surface.

### Không có breaking change dự kiến

Endpoint và parameter v0.2 được giữ. `includeBaseline` vẫn hợp lệ. Client cũ không bắt buộc gọi endpoint mới.

## 7. Frontend Integration Requirements

- Sinh types/client từ OpenAPI v0.3 sau khi contract được approve.
- Dùng `valueStatus`; không dùng `value==0` để suy missing.
- Exact-date UI luôn hiển thị origin và warnings.
- Copy bắt buộc:
  - Direct: “Quan sát S-NPP ban ngày đã lọc”.
  - Scaled: “Quan sát NOAA-20 đã quy đổi về S-NPP”.
  - Model: “Ước lượng hài hòa theo ngày, phân bổ từ mô hình cấp tháng”.
- Không hiển thị error bar daily.
- Calendar/map/trends/seasonality phải dùng cùng area/time vocabulary.
- Không gọi diagnostic region là tỉnh/huyện.
- Không hiển thị anomaly badge từ historical delta.
- Cache/query key gồm toàn bộ filters và dataset/model version.
- Khi `/daily` và `/map/cells?date` có version khác nhau, frontend không ghép hai response.

## 8. Open Questions and Blockers

### Cần approval, nhưng không phải data blocker

1. Canonical IDs `hoalich-data-v1-2026-11-13` và `lai-clim-s2-k60-kappa3`.
2. Default baseline: median, 2003–2025, exclude target year, minimum sample size 5.
3. Product/Data duyệt copy “model redistributed daily estimate”.
4. Frontend duyệt exact Problem Details fields/error codes.

### Deferred blockers theo feature

- Anomaly: method/threshold/validation chưa có.
- CSV export: schema/limits chưa có.
- Daily uncertainty/anomaly/trends: dataset chưa có validation tương ứng.

### Environment note

Python 3.13 Store runtime bị access denied và Python 3.14 hiện không có NumPy/Pandas. Việc này không cản review vì NPZ đã được đọc bằng standard-library binary reader. Nó sẽ cản chạy `verify_outputs.py` trong Task 03 nếu không dùng môi trường data pipeline đã khai báo.

## 9. Recommended Contract to Approve

Đề nghị approve OpenAPI/Markdown v0.3 cho các endpoint:

- `/metadata`
- `/areas`
- `/calendar`
- `/map/cells`
- `/trends`
- `/seasonality`
- `/daily`
- `/harmonization/comparison`

Daily view được approve ở mức **qualified historical exploration**, không phải measured daily fire count. Anomaly, export và daily uncertainty không được approve trong đợt này.

Kiến trúc implementation được đề nghị approve:

- N-layer Spring MVC.
- Controller → service interface → `service.impl` → repository interface → `repository.file`.
- DTO/domain/mapper/config/exception tách riêng.
- Derived compact daily binary + manifest ở Task 03A; không đọc NPZ object/pickle trực tiếp trong request path.

Contract v0.3 đủ để frontend review, mock và chuẩn bị integration. Frontend chỉ nên coi đây là contract production sau khi bốn approval items ở Section 8 được chốt.

## 10. Files Created by TASK 02B

- `docs/backend/TASK_02B_API_CONTRACT_REVIEW.md`
- `mvp_bussinessRule/HoaLich_04_API_Data_Contract_v0.3.md`
- `mvp_bussinessRule/HoaLich_OpenAPI_v0.3.yaml`
- `mvp_bussinessRule/HoaLich_06_Technical_Design_Implementation_Plan_v0.3.md`
- `mvp_bussinessRule/HoaLich_07_Challenge_Alignment_and_Decision_Log_v0.3.md`

Không có source code, controller, loader, derived dataset hoặc original dataset nào bị thay đổi trong TASK 02B.
