---
subtitle: Architecture, Implementation Plan & Readiness Checklist
title: HỎA LỊCH
version: v0.2
updated: 2026-11-14
language: vi
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 06 · v0.2**

> Quyết định kỹ thuật: backend dùng Java 21 + Spring Boot 4.1.2, Spring MVC và file-backed dataset; frontend dùng React + TypeScript; Python chỉ chạy pipeline harmonization offline. MVP không dùng JPA, PostgreSQL, Redis, Spring Security, WebFlux hoặc JDBC Session.

# 1. Kiến trúc tham chiếu

| Layer | Trách nhiệm |
|---|---|
| Data Preparation — Python | Sinh và kiểm định snapshot CSV/JSON/NPZ; không chạy trong request web. |
| Dataset Storage — Files | Snapshot version cố định, đường dẫn cấu hình ngoài ứng dụng; không sửa artifact nguồn. |
| Backend — Spring Boot | Load/index chọn lọc artifact cần thiết, validate filter, query read-only, baseline/comparison, metadata và error handling. |
| Frontend — React/TS | Filter state, calendar, map, seasonality/comparison, trend, harmonization explanation và UI states. |
| Deployment | Frontend static + backend container/process; mount snapshot; CORS giới hạn domain demo. |

Dataset root được externalize bằng `hoalich.dataset.root` hoặc `HOALICH_DATASET_ROOT`. Backend không được phụ thuộc đường dẫn tuyệt đối của máy phát triển.

# 2. Backend Modules

| Module | Đầu vào | Trách nhiệm / đầu ra |
|---|---|---|
| Dataset Configuration | Application properties / environment | Resolve dataset root và validate cấu hình. |
| Dataset Manifest Loader | README/summary/manifest và file headers | Data/model version, range, `dataThrough`, artifact availability; fail-fast khi schema bắt buộc sai. |
| Area Index | `cells_025.csv` | Area/cell validation, bounds và region mapping. |
| Calendar Repository | Region/cell month/pentad artifacts | Slice calendar theo area/year/granularity; giữ null/status. |
| Map Repository | Cell month/pentad artifacts | Slice cell cho một period, không load detections 1,08 GB. |
| Trend Repository | National/region/cell summaries | Chuỗi nhiều năm theo comparable period. |
| Historical Baseline Service | Comparable historical series | Median/reference years/sample size/delta; không classification anomaly. |
| Harmonization Evidence Service | National/evidence/summary artifacts | Payload raw versus harmonized đã kiểm định. |
| Anomaly Service | Baseline + versioned rule | Should, feature-gated; classification hoặc insufficient baseline. |
| REST Controllers | Validated query/filter | Contract v0.2, 4xx rõ nghĩa, metadata/warnings nhất quán. |

# 3. Loading và bộ nhớ

- Không load toàn bộ dataset hoặc file detections lớn khi khởi động.
- Chỉ đọc/index các artifact cần cho endpoint MVP; ưu tiên stream CSV một lần vào index gọn hoặc parse JSON đã tối ưu.
- Tách loader theo artifact để test schema và lỗi riêng.
- `harmonized_with_detections.json` khoảng 1,08 GB không thuộc runtime path.
- NPZ ngày không thuộc runtime MVP; Day View discovery phải đánh giá thư viện đọc, bộ nhớ và format phục vụ trước.
- Cache chỉ dùng cho metadata/index bất biến và query phổ biến; không yêu cầu Redis.

# 4. Calculation Responsibilities

- Backend không tái thực hiện harmonization và không cộng raw detections để tạo `snpp_eq`.
- Calendar/map/trends ưu tiên artifact phát hành đúng cấp tổng hợp.
- Historical Baseline Service được phép tính median/sample size/delta từ chuỗi harmonized đã load, theo rule versioned.
- Anomaly classification là module riêng và không được suy ra ngầm từ comparison.
- Raw versus harmonized demo đọc bảng đối chứng; metric/unit của từng series được giữ riêng.

# 5. Delivery Plan

| Increment | Đầu ra | Điều kiện hoàn thành |
|---|---|---|
| 0. Stabilization | Maven Wrapper, Java 21, MVC-only, external dataset config | Hoàn thành bởi TASK 02A; build/test pass. |
| 1. Data handoff | Manifest/schema/sample/hash checks cho artifact MVP | Xác nhận cell count, years, periods, missing/partial và 3 mẫu đối chiếu. |
| 2. API core | `/metadata`, `/areas`, `/calendar`, `/map/cells`, `/trends` | Integration tests, validation, missing != zero. |
| 3. Baseline + evidence | Seasonal baseline/comparison và harmonization payload | Reference years/sample size rõ; số đối chứng khớp artifact. |
| 4. UI core | Explore filters, calendar, map, comparison, trend và Data Notes | Demo flow desktop/mobile với dữ liệu thật. |
| 5. Accuracy + UX | Cross-check, partial/error states, accessibility, performance | Regression samples và visual QA pass. |
| 6. Enhancements | Cell details, anomaly, export | Chỉ bật feature có readiness gate đạt. |
| 7. Submission | Demo script, deployment, README, citations, rehearsal | Chạy ổn định từ snapshot, không phụ thuộc nguồn live. |

Day View không nằm trong delivery plan MVP; nếu D07 được duyệt thì tạo increment riêng.

# 6. Verification Strategy

- **Configuration tests:** default dataset root và environment override bind đúng; invalid/missing artifact có lỗi rõ.
- **Loader tests:** schema/header, duplicate key, period range, null/zero và version metadata.
- **Data regression:** cell/month/pentad/national mẫu khớp artifact trong sai số 0,01.
- **Baseline tests:** cùng period/area, loại missing/partial theo rule, giữ zero, sample size chính xác, baseline zero không chia phần trăm.
- **API integration:** 200/4xx, filters, partial warning, unsupported `day`, feature gate anomaly.
- **Frontend E2E:** Tây Nguyên 2024 pentad → calendar → map → baseline → trend → harmonization.
- **Performance:** đo p95 trên máy demo sau khi có loader/index thật; không tuyên bố trước khi đo.
- **Scientific copy review:** kiểm tra metric, raw/harmonized, anomaly wording và guardrails.

# 7. Open Decisions & Readiness Gates

| Mã | Quyết định / gate | Điều kiện chốt |
|---|---|---|
| D01 | Area scope | Giữ ToanQuoc + 5 vùng chẩn đoán + cell phát hành; chưa dùng tỉnh/huyện. |
| D02 | Baseline | Chốt median/reference years/exclusion/coverage rule và ghi `baselineMethodVersion`. |
| D03 | Anomaly | Chốt threshold, minimum sample size, labels và validation; giữ feature off trước đó. |
| D04 | Partial/coverage | Chốt `dataThrough`, transition years và rule loại/include trong baseline. |
| D05 | Provenance | Chỉ hiển thị source ở cấp artifact hỗ trợ; không suy provenance cell-day từ nhãn tháng. |
| D06 | Snapshot ownership | Chỉ định người phát hành snapshot, hash/manifest và người duyệt regression. |
| D07 | Day View | Data team xác nhận daily semantics, observed/estimated split, validation, uncertainty, leap-day và serving format. |
| D08 | Hosting/performance | Chốt resource limits, dataset mount, CORS và kết quả benchmark. |

# 8. Day View Discovery Gate

Day View chỉ chuyển từ Discovery sang Ready khi có tài liệu riêng xác nhận:

- Daily metric được tạo như thế nào và phần nào là phân bổ/ước lượng.
- Coverage/missing/gap-fill và nguồn theo ngày.
- Kiểm định phù hợp cho use case ngày, không chỉ pentad/tháng.
- Contract `granularity=day`, timezone/date rules và ngày nhuận.
- Kích thước payload, index/serving format và performance.
- UI copy không khiến người dùng hiểu đó là số vụ cháy chính xác theo ngày.

# 9. Implementation Readiness

- Sẵn sàng triển khai data loader và năm endpoint API lõi sau khi xác nhận snapshot/schema trong Increment 1.
- Baseline comparison có thể triển khai độc lập với anomaly classification sau khi D02 chốt.
- Anomaly chưa Ready cho đến khi D03 đạt.
- Day View chưa Ready cho đến khi D07 đạt.
- Không để Should/Could/Discovery chặn core API và core UI.
- Mỗi thay đổi phải truy vết tới US/FR/API test và không sửa artifact dữ liệu nguồn.

