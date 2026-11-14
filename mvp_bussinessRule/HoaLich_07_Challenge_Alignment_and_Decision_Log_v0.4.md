---
subtitle: Challenge Alignment & Decision Log
title: HỎA LỊCH
version: v0.4-proposed
updated: 2026-11-14
language: vi
status: frontend-aligned proposal; backend approval pending
---

**PRODUCT / ENGINEERING DECISION LOG · DOCUMENT 07 · v0.4 PROPOSED**

# 1. Version policy

v0.3 là baseline của TASK 03A. v0.4 ghi thay đổi frontend review; không hồi tố Artifact Spec 1.0.0 hoặc commit repository đã phát hành.

# 2. Decisions inherited from v0.3

- D02 baseline median 2003–2025, minimum sample size 5.
- D03 anomaly deferred.
- D04 daily verified with qualification.
- D06 n-layer architecture.
- D07 derived binary + manifest.
- D08 canonical versions.
- D10 source composition field names.
- D11 period origin từ daily composition.
- D12 Aqua fallback warning.
- D13 MVP dùng pipeline 1.0.

# 3. v0.4 Decisions

## D14 — Bounding-box spatial selection

**Status:** frontend approved; backend approval pending.

Nhận `west,south,east,north`, chọn center-inclusive trên toàn bộ 587 cell và giữ canonical order. Bbox không bị giới hạn bởi diagnostic region và có thể cắt nhiều vùng. Named area và bbox loại trừ nhau. Không persist custom area trong MVP.

## D15 — Empty bounding box

**Status:** proposed.

Không trả list rỗng 200. Trả 422 `NO_CELLS_IN_BOUNDS` để UI hướng dẫn khoanh lại.

## D16 — Annual map

**Status:** proposed.

`/map/cells` nhận year-only bên cạnh date/year+month/year+pentad. Annual value là tổng covered days; 2000/2026 partial.

## D17 — Daily month calendar

**Status:** frontend approved; backend approval pending.

Thêm `/calendar/days`; luôn trả 28–31 civil dates. Outside-range item có null/status riêng. Exact-date endpoint ngoài range vẫn 422.

## D18 — Zero versus outside range

**Status:** approved product/data invariant.

Không dùng zero cho missing/outside/error. `OUTSIDE_DATASET_RANGE` luôn `value=null`; zero trong range luôn `AVAILABLE`.

## D19 — Summary and peak

**Status:** proposed.

Backend trả total/coverage. Peak chỉ xét available non-partial child item; tie earliest; all-zero/no-valid → null. Parent partial có thể có peak trong covered range và phải mang coverage label.

## D20 — Dual-map comparison

**Status:** frontend approved; backend approval pending.

Không tạo endpoint riêng. Hai map chỉ có delta khi version/metric/unit/cell set/effective duration tương thích và cả hai values available.

## D21 — Cell-period provenance

**Status:** proposed.

Composition tải on-demand qua `/cells/{cellId}/period-details`; map mặc định chỉ cần origin. Không trả raw detections.

## D22 — Harmonization comparison scope

**Status:** product/frontend decision.

`/harmonization/comparison` chuyển Optional, không thuộc demo DoD. Data Notes về nguồn, harmonization và limitations vẫn Must.

## D23 — Seasonal aggregate and rank

**Status:** deferred.

Chưa định nghĩa tháng của mùa/mùa vắt năm; percentile/rank chưa cần cho MVP vì median đủ cho historical context.

# 4. Approval gates

- Backend xác nhận spatial/temporal cross-field schema và error codes.
- Frontend xác nhận selection/coverage/summary field names trong OpenAPI.
- Product xác nhận peak loại partial và all-zero behavior.
- Data owner xác nhận examples Document 08 trong tolerance 0,01.
- Chỉ sau bốn mục trên, v0.4 mới thay v0.3 cho TASK 03B/03C surface.
