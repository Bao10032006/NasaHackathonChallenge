---
subtitle: REST API Specification & Data Contract
title: HỎA LỊCH
source_docx: HoaLich_04_API_Data_Contract_v0.1.docx
format: github-flavored-markdown
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 04**

| **Thông tin** | **Giá trị**                                                               |
|---------------|---------------------------------------------------------------------------|
| **Phiên bản** | v0.1 – Bản thiết kế để nhóm rà soát                                       |
| **Ngày**      | 14/11/2026                                                                |
| **Dự án**     | NASA Space Apps Challenge 2026                                            |
| **Căn cứ**    | Vision & Scope v0.1; User Stories v0.1; Hỏa Lịch harmonization handoff v1 |

# 1. Phạm vi & dữ liệu nguồn

Đề xuất API read-only /api/v1 trên backend Spring Boot (hoặc framework tương đương). Số liệu được đọc từ artifacts đã harmonization, không huấn luyện lại mô hình trong mỗi request.

| **Nguồn trong ZIP v1**                       | **Ứng dụng / điều kiện**                                                                                                                |
|----------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| **web_cells_pentad.json**                    | 587 cells, years 2000–2026, pentad\[73\] từng ô/năm, có null; meta/src là thông tin cấp chuỗi, không phải nguồn đầy đủ cho từng ô–ngày. |
| **tables/cells_025.csv**                     | cell,cy,cx,lat,lon,lat_s,lon_w,region; dùng cho chọn ô và polygon 0,25°.                                                                |
| **tables/harmonized_025_month.csv**          | cell,year,month,snpp_eq,lo90,hi90,src; thống kê theo tháng; src là nhãn tổng hợp hạn chế.                                               |
| **tables/harmonized_regions_pentad.csv**     | vung,year,pentad,snpp_eq,lo90,hi90,src; gồm ToanQuoc và 5 vùng chẩn đoán.                                                               |
| **tables/harmonized_national_year.csv**      | year,hai_hoa_snpp_eq và các chuỗi đối chứng; dùng cho xu hướng quốc gia và trình diễn kỹ thuật.                                         |
| **tables/exposure_month.csv, data_gaps.csv** | Tài liệu về coverage/gap; exposure là suy luận thống kê, không phải cloud mask hoàn chỉnh.                                              |

# 2. Quy ước contract

- Base URL: /api/v1; response JSON UTF-8; ngày YYYY-MM-DD; số là number hoặc null; không truyền NaN/Infinity.

- areaType = national \| diagnostic_region \| cell; areaId = ToanQuoc, DBSCL/DBSH/TayNguyen/TayBac/Khac, hoặc cell dạng cy_cx có trong cells_025.csv.

- granularity = month \| pentad \| year; năm trong metadata dataset (2000–2026). pentad 1..73, không đồng nghĩa “tháng 5”.

- Canonical metric key: snpp_eq; displayName: “Số phát hiện tương đương S-NPP”; unit có giải thích quan sát ban ngày và lọc nguồn tĩnh.

- Bản ghi 0 là quan sát/ước lượng hợp lệ ở độ phân giải đã cấp; missing là null, không có bản ghi hoặc status=missing. Phân biệt trong payload.

- Mỗi response cung cấp meta {dataVersion, modelVersion, dataThrough, partial, warnings, units} hoặc tài liệu tham chiếu metadata.

- HTTP 400 cho filter sai; 404 cho areaId không hỗ trợ; 422 cho tổ hợp filter không thể xử lý; 500 cho lỗi nội bộ. Không trả giá trị 0 giả.

# 3. Đề xuất REST Endpoints

| **Method / URI**        | **Parameters chính**                                      | **Response & User Stories**                                                       |
|-------------------------|-----------------------------------------------------------|-----------------------------------------------------------------------------------|
| **GET /metadata**       | —                                                         | Dataset range, unit, 0,25°, k_cell=60, source limitations, incomplete flags; US07 |
| **GET /areas**          | type?                                                     | Danh sách quốc gia, 5 vùng chẩn đoán và các ô có dữ liệu; US01                    |
| **GET /calendar**       | areaType,areaId,year,granularity=month\|pentad            | Mảng kỳ 1..12 hoặc 1..73 gồm snpp_eq, valueStatus, partial; US02–US03             |
| **GET /map/cells**      | year,month hoặc year,pentad; areaType?,areaId?            | Tập cell {cellId,bounds,snpp_eq,status} cho heatmap; US04/US08                    |
| **GET /trends**         | areaType,areaId,startYear,endYear,granularity=year\|month | Chuỗi cùng chỉ số, kèm coverage/partial per point; US05                           |
| **GET /cells/{cellId}** | year,month                                                | Chi tiết ô–tháng, giá trị, giới hạn nguồn; US08                                   |
| **GET /anomalies**      | areaType,areaId,year,granularity,period                   | So với baseline cùng mùa; Should, bật sau khi chốt quy tắc; US06                  |
| **GET /export.csv**     | filters như calendar/trends                               | CSV cùng số liệu và metadata; Could, US09                                         |

# 4. Ví dụ response (minh họa schema, không phải số liệu kết quả)

`GET /api/v1/calendar?areaType=diagnostic_region&areaId=TayNguyen&year=2024&granularity=pentad`

```json
{
  "area": {
    "type": "diagnostic_region",
    "id": "TayNguyen"
  },
  "metric": "snpp_eq",
  "granularity": "pentad",
  "year": 2024,
  "values": [
    {
      "period": 1,
      "value": null,
      "status": "missing"
    }
  ],
  "meta": {
    "dataVersion": "v1-k60",
    "dataThrough": "2026-11-13",
    "partial": false,
    "warnings": []
  }
}
```

Lưu ý: Giá trị null trong ví dụ chỉ minh họa kiểu dữ liệu, không phản ánh số liệu thật của Tây Nguyên trong pentad 1/2024.

# 5. Quy tắc tính toán & provenance

- Đối với calendar theo vùng: ưu tiên đọc bảng harmonized_regions_pentad.csv thay vì tự cộng điểm thô; theo ô: dùng web_cells_pentad.json hoặc bảng tháng tùy granularity.

- Đối với bản đồ tháng: dùng harmonized_025_month.csv ghép tọa độ từ cells_025.csv; map pentad dùng web_cells_pentad.json.

- Đối với xu hướng toàn quốc theo năm: dùng harmonized_national_year.csv; nếu tổng hợp từ các kỳ, cần kiểm đối chiếu với bảng đã xuất để tránh sai số rounding.

- Giá trị bất thường: bản đề xuất chọn median cùng period, tối thiểu 5 năm đủ kỳ; đánh dấu trên median + ngưỡng tùy chốt. Chưa coi anomaly là dự báo.

- Trường src của bảng tháng v1 chỉ là nhãn nguồn chiếm đa số của toàn miền trong kỳ; không đưa lên UI như provenance tuyệt đối theo cell.

- lo90,hi90 là khoảng dựa trên phân vị sai số thực nghiệm v1; không gắn nhãn “90% bảo đảm” cho mọi trường hợp.

- Không dùng artifacts/harmonized_with_detections.json (~1,08 GB) làm payload frontend; chỉ bật điểm gốc khi có endpoint truy vấn giới hạn/tối ưu.

# 6. Validation / Test Cases

| **Test ID** | **Kiểm tra**                | **Kỳ vọng**                                                            |
|-------------|-----------------------------|------------------------------------------------------------------------|
| **API-T01** | GET /areas                  | Có 5 vùng chẩn đoán + ToanQuoc; số cell không vượt tập 587 đã công bố. |
| **API-T02** | GET /calendar year=2026     | Có partial warning; các pentad chưa có dữ liệu trả missing/null.       |
| **API-T03** | GET /map/cells: 2024/3      | Giá trị cell khớp bảng harmonized_025_month.csv với sai số 0,01.       |
| **API-T04** | GET /trends: 2000–2026      | Không biến thiếu dữ liệu thành 0; so năm 2026 có cảnh báo.             |
| **API-T05** | areaId bất hợp lệ, month=15 | 4xx kèm message; không 500.                                            |
| **API-T06** | GET /metadata               | Nêu rõ thước đo S-NPP, k_cell=60 và giới hạn provenance.               |
