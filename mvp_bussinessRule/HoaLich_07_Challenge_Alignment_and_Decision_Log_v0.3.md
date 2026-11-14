---
subtitle: Challenge Alignment & Decision Log
title: HỎA LỊCH
version: v0.3-proposed
updated: 2026-11-14
language: vi
status: proposed decisions from TASK 02B
---

**PRODUCT / ENGINEERING DECISION LOG · DOCUMENT 07 · v0.3 PROPOSED**

# 1. Ghi chú tài liệu

TASK 02B không tìm thấy `HoaLich_07_Challenge_Alignment_and_Decision_Log_v0.2.md` trong workspace. File này được tạo mới ở v0.3; không tuyên bố kế thừa nội dung của một file v0.2 không tồn tại.

# 2. Challenge alignment

- Harmonization được thể hiện bằng metric `snpp_eq`, metadata khoa học và endpoint comparison.
- Web application hỗ trợ area, calendar month/pentad, map, trends, seasonality và exact-date exploration có qualification.
- Exact-date selection là trải nghiệm khám phá chuỗi harmonized; không được diễn giải thành ground-truth daily fire-event count.
- Anomaly, forecast, real-time alert, burned area và fire spread không nằm trong core contract v0.3.

# 3. Decision log

## D01 — Area scope

**Status:** giữ nguyên, đề xuất phê duyệt.

MVP hỗ trợ `ToanQuoc`, 5 diagnostic regions và 587 cell 0,25°. Không gọi diagnostic region là ranh giới hành chính.

## D02 — Seasonality baseline

**Status:** đề xuất phê duyệt.

- Endpoint riêng `/seasonality`.
- Default reference `2003..2025` để tránh đầu chuỗi partial và năm 2026 partial.
- Trả cả mean và median; median là baseline mặc định cho comparison.
- Loại missing/partial theo period; minimum sample size 5.

## D03 — Anomaly

**Status:** deferred.

Chưa tạo endpoint production cho đến khi chốt threshold/method version, validation và copywriting. Historical delta không tự động là anomaly.

## D04 — Daily data readiness

**Status:** verified with qualification.

NPZ thực tế có daily harmonized values theo 9.509 ngày × 587 cell và provenance code 1–4. Daily được phép hiển thị nếu response phân biệt direct observation, scaled observation và model-redistributed estimate; không có daily uncertainty interval.

## D05 — Daily API shape

**Status:** đề xuất phê duyệt.

- Thêm `/daily?date&areaType&areaId`.
- Thêm selector `date` cho `/map/cells`.
- Không thêm `granularity=day` vào `/calendar` hoặc `/trends` v0.3.
- Giữ month/pentad contract cũ để tránh breaking change.

## D06 — Backend architecture

**Status:** được Product/Engineering owner yêu cầu trong hội thoại, ghi nhận để triển khai.

N-layer: controller → service interface → `service.impl` → repository interface → `repository.file`, cùng DTO/domain/mapper/config/exception. Không dùng JPA/database cho repository file-backed.

## D07 — Daily serving format

**Status:** đề xuất phê duyệt cho TASK 03A.

Không đọc NPZ/pickle trực tiếp trong request path. Tạo derived binary index + JSON manifest có hash và regression checks; giữ NPZ gốc bất biến.

## D08 — Canonical API versions

**Status:** đề xuất phê duyệt.

- `dataVersion=hoalich-data-v1-2026-11-13`.
- `modelVersion=lai-clim-s2-k60-kappa3`.

Hai ID này phản ánh đúng summary/pipeline v1 và không ngụ ý đã áp dụng `k_cell=100`.

## D09 — Optional endpoints

**Status:** deferred.

Cell detail có data dependency nhưng là Should. CSV export thiếu column/limit contract. Cả hai không chặn core. Anomaly bị gate riêng theo D03.

## D10 — Tên trường source composition

**Status:** đề xuất phê duyệt (review 14/11/2026).

Thống nhất `sourceInputValidCellCount` ở cả Contract v0.3 và OpenAPI v0.3 (trước đây OpenAPI dùng `sourceValidCellCount`, Markdown dùng `sourceInputValidCellCount`; schema có `additionalProperties: false` nên lệch tên sẽ làm client/server không tương thích).

## D11 — Origin cho month/pentad

**Status:** đề xuất phê duyệt (review 14/11/2026).

Calendar, trends và map month/pentad trả `origin` khi `valueStatus=AVAILABLE`, tính từ thành phần source của daily cube trong period (Contract v0.3 §3.5). Lý do: Vision v0.2 §6.1 (Must) yêu cầu phân biệt dữ liệu ước lượng; `ValueStatus` v0.3 không còn `observed/estimated` như v0.2. Thay đổi là additive.

## D12 — Warning Aqua dự phòng sau quỹ đạo trôi

**Status:** đề xuất phê duyệt (review 14/11/2026).

Thêm mã `AQUA_FALLBACK_AFTER_ORBIT_DRIFT` khi có cell-day `src_code=2` từ năm 2022. Snapshot 1.0: 328 cell-day, 1 ngày năm 2026.

## D13 — Dữ liệu MVP và đường chuyển pipeline

**Status:** ghi nhận quyết định của đội.

MVP dùng snapshot **pipeline 1.0**. Sau MVP sẽ chuyển sang pipeline hoàn chỉnh; TASK 03A thiết kế manifest/schema/export theo hướng thay snapshot không cần sửa code Java (Technical Design v0.3 §6A).

# 4. Approval checklist

- Product/Data xác nhận wording daily model estimate.
- Backend/Frontend xác nhận field names và Problem Details schema trong OpenAPI v0.3.
- Data owner xác nhận canonical version strings và default baseline years.
- Backend/Frontend xác nhận D10–D12 (tên trường, `origin` theo period, warning mới).
- Sau khi ba mục trên được duyệt, TASK 03A có thể bắt đầu mà không thay endpoint surface.

