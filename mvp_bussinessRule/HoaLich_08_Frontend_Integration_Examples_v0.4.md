---
subtitle: Frontend Integration Golden Examples
title: HỎA LỊCH
version: v0.4-proposed
updated: 2026-11-14
language: vi
status: verified values; response envelope pending backend approval
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 08 · v0.4 PROPOSED**

# 1. Mục đích

Bộ mẫu dùng chung cho backend contract tests và frontend fixtures theo một flow minh họa:

`bbox ví dụ tại Tây Nguyên → annual map + 12 months → March day calendar → exact date → March dual-map comparison`.

Tây Nguyên không phải giới hạn sản phẩm. API bbox phải bao phủ toàn bộ 587 cell Việt Nam, gồm khung nằm trong một vùng, cắt nhiều vùng và khung bao toàn bộ lưới. Fixture này được chọn vì nhỏ, deterministic và dễ review số liệu.

Giá trị dưới đây được đọc trực tiếp từ derived binary snapshot `hoalich-data-v1-2026-11-13` ngày 14/11/2026, cộng float32 bằng double. Aggregate JSON có thể làm tròn hiển thị nhưng contract test dùng tolerance `0.01`.

# 2. Spatial fixture

Request:

```text
west=107&south=12&east=108&north=13
```

Rule: `CENTER_INCLUSIVE`.

Expected selection:

```json
{
  "type":"BOUNDING_BOX",
  "selectionRule":"CENTER_INCLUSIVE",
  "requestedBounds":{"west":107.0,"south":12.0,"east":108.0,"north":13.0},
  "selectedBounds":{"west":107.0,"south":12.0,"east":108.0,"north":13.0},
  "cellCount":13,
  "cellIds":[
    "48_428","48_429","48_430","48_431",
    "49_428","49_429","49_430","49_431",
    "50_430","50_431","51_429","51_430","51_431"
  ]
}
```

Tất cả 13 cell có diagnostic region `TayNguyen` nhưng selection type vẫn là bounding box, không đổi thành named area.

# 3. Annual map và đường 12 tháng — 2024

Request map:

```text
GET /api/v1/map/cells?west=107&south=12&east=108&north=13&year=2024
```

Expected annual aggregate:

```json
{
  "value":2182.780156,
  "valueStatus":"AVAILABLE",
  "origin":"MIXED",
  "coverage":{
    "requestedStartDate":"2024-01-01",
    "requestedEndDate":"2024-12-31",
    "coveredStartDate":"2024-01-01",
    "coveredEndDate":"2024-12-31",
    "expectedDayCount":366,
    "coveredDayCount":366,
    "uncoveredDayCount":0,
    "partial":false
  }
}
```

Expected 12-month series:

```json
[
  {"period":1,"value":494.790625},
  {"period":2,"value":893.0},
  {"period":3,"value":450.0},
  {"period":4,"value":266.0},
  {"period":5,"value":31.0},
  {"period":6,"value":19.0},
  {"period":7,"value":0.0},
  {"period":8,"value":14.0},
  {"period":9,"value":1.0},
  {"period":10,"value":0.0},
  {"period":11,"value":6.989531},
  {"period":12,"value":7.0}
]
```

Year summary:

```json
{
  "totalValue":2182.780156,
  "peakPeriod":{"period":2,"value":893.0},
  "partial":false
}
```

Tháng 7 và 10 là zero hợp lệ, không phải missing.

# 4. Lịch ngày tháng 3/2024

Request:

```text
GET /api/v1/calendar/days?west=107&south=12&east=108&north=13&year=2024&month=3
```

Expected values:

```json
[
  {"date":"2024-03-01","value":9.0},
  {"date":"2024-03-02","value":21.0},
  {"date":"2024-03-03","value":9.0},
  {"date":"2024-03-04","value":16.0},
  {"date":"2024-03-05","value":13.0},
  {"date":"2024-03-06","value":4.0},
  {"date":"2024-03-07","value":10.0},
  {"date":"2024-03-08","value":27.0},
  {"date":"2024-03-09","value":11.0},
  {"date":"2024-03-10","value":0.0},
  {"date":"2024-03-11","value":4.0},
  {"date":"2024-03-12","value":21.0},
  {"date":"2024-03-13","value":26.0},
  {"date":"2024-03-14","value":6.0},
  {"date":"2024-03-15","value":16.0},
  {"date":"2024-03-16","value":18.0},
  {"date":"2024-03-17","value":25.0},
  {"date":"2024-03-18","value":53.0},
  {"date":"2024-03-19","value":31.0},
  {"date":"2024-03-20","value":18.0},
  {"date":"2024-03-21","value":4.0},
  {"date":"2024-03-22","value":30.0},
  {"date":"2024-03-23","value":23.0},
  {"date":"2024-03-24","value":6.0},
  {"date":"2024-03-25","value":8.0},
  {"date":"2024-03-26","value":23.0},
  {"date":"2024-03-27","value":5.0},
  {"date":"2024-03-28","value":1.0},
  {"date":"2024-03-29","value":0.0},
  {"date":"2024-03-30","value":9.0},
  {"date":"2024-03-31","value":3.0}
]
```

Tất cả item: `valueStatus=AVAILABLE`, `origin=DIRECT_OBSERVATION`, `partial=false`. Summary:

```json
{
  "totalValue":450.0,
  "peakDate":{"date":"2024-03-18","value":53.0},
  "coverage":{"expectedDayCount":31,"coveredDayCount":31,"uncoveredDayCount":0,"partial":false}
}
```

# 5. Exact date — 18/03/2024

Hai request phải khớp total:

```text
GET /api/v1/daily?...&date=2024-03-18
GET /api/v1/map/cells?...&date=2024-03-18
```

Expected aggregate:

```json
{
  "date":"2024-03-18",
  "value":53.0,
  "valueStatus":"AVAILABLE",
  "origin":"DIRECT_OBSERVATION",
  "partial":false,
  "sourceComposition":[{
    "sourceCode":3,
    "source":"SNPP",
    "origin":"DIRECT_OBSERVATION",
    "cellCount":13,
    "contributingCellDayCount":13,
    "harmonizedValue":53.0,
    "inputObservationCount":53,
    "sourceInputValidCellCount":13
  }]
}
```

# 6. Dual-map comparison — March 2005 vs March 2024

Aggregate A:

```json
{"year":2005,"month":3,"value":3039.161190,"origin":"MODEL_REDISTRIBUTED","partial":false}
```

Aggregate B:

```json
{"year":2024,"month":3,"value":450.0,"origin":"DIRECT_OBSERVATION","partial":false}
```

Per-cell expected values:

```json
[
  {"cellId":"48_428","value2005":185.077867,"value2024":2.0},
  {"cellId":"48_429","value2005":757.173214,"value2024":34.0},
  {"cellId":"48_430","value2005":463.340691,"value2024":47.0},
  {"cellId":"48_431","value2005":432.395214,"value2024":50.0},
  {"cellId":"49_428","value2005":0.010864,"value2024":0.0},
  {"cellId":"49_429","value2005":132.642979,"value2024":6.0},
  {"cellId":"49_430","value2005":317.438563,"value2024":26.0},
  {"cellId":"49_431","value2005":387.635774,"value2024":69.0},
  {"cellId":"50_430","value2005":76.424433,"value2024":76.0},
  {"cellId":"50_431","value2005":258.575795,"value2024":28.0},
  {"cellId":"51_429","value2005":2.523358,"value2024":1.0},
  {"cellId":"51_430","value2005":13.958186,"value2024":33.0},
  {"cellId":"51_431","value2005":11.964253,"value2024":78.0}
]
```

Hai kỳ full, cùng 31 ngày/cell set/version nên frontend được tính delta. Khác origin không làm comparison invalid nhưng phải hiển thị provenance.

# 7. Partial fixture — November 2026

Snapshot chỉ có đến 13/11/2026. Calendar days trả 30 items:

- 01–13/11: `AVAILABLE`.
- 14–30/11: `value=null`, `valueStatus=OUTSIDE_DATASET_RANGE`.

Expected covered aggregate:

```json
{
  "value":3.185015,
  "origin":"MIXED",
  "coverage":{
    "requestedStartDate":"2026-11-01",
    "requestedEndDate":"2026-11-30",
    "coveredStartDate":"2026-11-01",
    "coveredEndDate":"2026-11-13",
    "expectedDayCount":30,
    "coveredDayCount":13,
    "uncoveredDayCount":17,
    "partial":true
  },
  "peakDate":{"date":"2026-11-09","value":1.979063}
}
```

Peak này chỉ có nghĩa “cao nhất trong khoảng đã có dữ liệu 01–13/11”, không đại diện cả tháng. Request exact date `2026-11-14` trả 422, không trả zero.

# 8. Missing contract fixture

Snapshot thật không có missing daily value bên trong date range, nên không được bịa một ca missing và gắn nhãn “dữ liệu thật”. Để test UI `MISSING`, dùng fixture tổng hợp riêng:

```json
{"date":"2024-03-12","value":null,"valueStatus":"MISSING","origin":null,"partial":false}
```

Fixture này chỉ kiểm state rendering, không phải regression khoa học. Golden integration với snapshot dùng `OUTSIDE_DATASET_RANGE` ở §7.

# 9. Golden-test rules

- Selection cell IDs so sánh exact order.
- Numeric aggregate tolerance `0.01`.
- Repository cell float probes vẫn bit-exact theo TASK 03A.
- Status/null/partial/origin so sánh exact.
- Frontend không hardcode values này cho production; chỉ dùng fixture/test/demo verification.
