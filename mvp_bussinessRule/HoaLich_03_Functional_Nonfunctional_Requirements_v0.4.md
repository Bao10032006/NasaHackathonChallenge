---
subtitle: Functional & Non-functional Requirements
title: HỎA LỊCH
version: v0.4-proposed
updated: 2026-11-14
language: vi
status: frontend-aligned proposal; backend approval pending
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 03 · v0.4 PROPOSED**

# 1. Mục tiêu

Đặc tả yêu cầu kiểm thử được cho luồng demo v0.4. `snpp_eq` không phải số vụ cháy, diện tích cháy, risk hoặc forecast.

# 2. Functional Requirements

- **FR01 Must — Named spatial selection:** national, 5 diagnostic regions hoặc một cell hợp lệ.
- **FR02 Must — Bounding-box selection:** nhận đủ bốn biên, chọn center-inclusive, trả selection metadata; empty → `NO_CELLS_IN_BOUNDS`.
- **FR03 Must — Temporal selection:** exact date, year, year+month hoặc year+pentad theo endpoint contract.
- **FR04 Must — Grid map:** trả stable cell ID/bounds/value/status/origin/coverage cho date, year, month hoặc pentad; kèm summary tổng selection và min/max cell available.
- **FR05 Must — Calendars:** `/calendar` trả 12/73 period; `/calendar/days` trả đủ ngày lịch của một tháng.
- **FR06 Must — Summary:** year total + peak month; month total + peak day; date total + source composition.
- **FR07 Must — Trends:** cùng month/pentad qua nhiều năm với status/partial/origin/coverage.
- **FR08 Must — Seasonality:** mean, median, sample size cho month/pentad; median 2003–2025 mặc định.
- **FR09 Must — Dual-map comparison:** hai request có compatibility metadata; frontend chỉ tính delta khi compatible.
- **FR10 Must — Cell-period provenance:** endpoint on-demand trả source composition cho một cell và một temporal selector.
- **FR11 Must — Methodology:** metadata/copy giải thích source, metric, version, limitations; harmonization comparison là Optional.
- **FR12 Should — Anomaly/rank:** chỉ bật sau decision riêng.
- **FR13 Could — Export/persisted custom area/season aggregate:** deferred.

# 3. Spatial Rules

- **BR11:** Spatial selector là named area (`areaType+areaId`) hoặc bbox (`west+south+east+north`), không đồng thời.
- **BR12:** Bbox hợp lệ khi `west < east`, `south < north`, longitude trong `[-180,180]`, latitude trong `[-90,90]`; không tự đảo biên.
- **BR13:** Cell được chọn khi center thỏa `west <= lon <= east` và `south <= lat <= north`.
- **BR13a:** Quy tắc trên áp dụng cho toàn bộ catalog 587 cell Việt Nam; không áp thêm diagnostic-region filter ngầm. Bbox có thể chọn cell thuộc nhiều vùng.
- **BR14:** Ordered cell list theo canonical order của `cells_025.csv`; cùng bbox và dataVersion phải deterministic.
- **BR15:** Response trả `requestedBounds` và `selectedBounds` riêng. `selectedBounds` là bounding box nhỏ nhất bao toàn bộ hình học cell được chọn (`min west/south`, `max east/north`), không phải envelope của tâm cell.

# 4. Time, Coverage và Summary Rules

- **BR16:** Map nhận đúng một selector: date; year-only; year+month; year+pentad.
- **BR17:** Coverage gồm requested range, covered range, expected/covered/uncovered day count và `partial`.
- **BR18:** Aggregate partial chỉ cộng ngày giao với dataset range; không nội suy ngày ngoài range.
- **BR19:** Calendar days luôn có đủ số ngày dân lịch, kể cả 29/2.
- **BR20:** Item `/calendar`, `/calendar/days`, `/trends` có requested period không giao dataset dùng `value=null`, `valueStatus=OUTSIDE_DATASET_RANGE`; period giao chưa đủ dùng `AVAILABLE` + partial. `/daily` và map date ngoài range trả 422.
- **BR21:** Summary total do backend tính trên covered available values. Peak chỉ xét available, non-partial child item; tie lấy mốc sớm nhất; tất cả bằng 0 → peak null. Kỳ cha partial vẫn có thể có peak trong covered range và phải giữ coverage label.
- **BR22:** `sourceInputValid=false` là provenance/quality flag, không phải missing.
- **BR22a:** Summary calendar dùng `peakPeriod`, summary lịch ngày dùng `peakDate`; `partial` chỉ lấy từ coverage.
- **BR22b:** Baseline loại target year nếu target nằm trong reference range; loại missing/partial, giữ zero và công bố `excludesTargetYear` cùng sample size.

# 5. Comparison Rules

- **BR23:** Hai map comparable khi cùng dataVersion/modelVersion/metric/unit, cùng ordered cell IDs và cùng effective duration.
- **BR24:** Cell delta chỉ tính khi cả hai value `AVAILABLE`.
- **BR25:** Partial versus full hoặc hai effective ranges khác nhau → `differenceAvailable=false`; hai map vẫn có thể hiển thị độc lập.
- **BR26:** Không gọi delta là anomaly.

# 6. Existing Scientific Rules

- **BR01:** `snpp_eq` là số thập phân có thể do mô hình; không làm tròn thành fire-event count.
- **BR02:** Missing/outside-range khác zero; API error không được biểu diễn bằng zero.
- **BR03:** 2000, 2026 và kỳ biên có partial/warning phù hợp.
- **BR04:** Diagnostic regions không phải địa giới hành chính.
- **BR05:** Không cộng thô nhiều vệ tinh thay cho artifact harmonized.
- **BR06:** Source label tổng hợp không đủ cho provenance cell-period; phải aggregate daily code.
- **BR07:** Pentad 73 gồm ngày 366 ở năm nhuận.
- **BR08:** Không trộn FRP/brightness/confidence vào `snpp_eq`.
- **BR09:** Daily phải phân biệt direct/scaled/model redistributed.
- **BR10:** Raw comparison, nếu bật, dùng metric/unit riêng.

# 7. Value Status

- `AVAILABLE`: có giá trị; `0` vẫn available.
- `MISSING`: lẽ ra nằm trong supported range nhưng artifact không có giá trị.
- `OUTSIDE_DATASET_RANGE`: placeholder calendar nằm ngoài date range.
- `INSUFFICIENT_BASELINE`: không đủ mẫu cho thống kê lịch sử.

Chỉ `AVAILABLE` có numeric value; các status còn lại có `value=null`.

# 8. Non-functional Requirements

- **NFR01 Performance:** core API mục tiêu p95 ≤2 giây trên máy demo, 5 request đồng thời; đo trước khi công bố.
- **NFR02 Determinism:** cùng snapshot/query trả cùng cell order và aggregate trong tolerance 0,01.
- **NFR03 Consistency:** calendar day, `/daily` và map date khớp cùng selection.
- **NFR04 Traceability:** response có data/model version, coverage, metric/unit và warnings.
- **NFR05 Resilience:** schema/hash/file lỗi fail rõ, không trả payload zero giả.
- **NFR06 Security:** public read-only, validate bbox/time/limits, không lộ path/stack trace.
- **NFR07 Accessibility:** không truyền đạt status/scale chỉ bằng màu.
- **NFR08 Compatibility:** giữ request v0.3 nơi có cùng semantics; response revision có chủ đích phải ghi trong Document 07, không mô tả v0.4 là hoàn toàn additive.
- **NFR09 Payload:** map mặc định không mang full source composition của mọi cell; dùng details endpoint on-demand.

# 9. Definition of Done

- Documents 01–08 và OpenAPI v0.4 thống nhất field/status/rule.
- Named area và bbox chạy cùng service use cases.
- Year map, calendar days, summary, daily và cell details có unit/integration/contract tests.
- Full/partial/outside-range/zero/no-cell được test riêng.
- Error-code matrix, target-year exclusion và typed summary được contract-test.
- Bộ sample Tây Nguyên v0.4 dùng số thật và được backend/frontend cùng xác nhận như một regression fixture; coverage chức năng phải test thêm national/full-grid và bbox cắt nhiều vùng.
- Không cần anomaly, export, season aggregate hoặc raw comparison để hoàn thành core demo.
