# BVCL BedFlow Demo

Demo quản lý giường nội trú theo timeline, QR và realtime đa thiết bị.

## Live demo
https://bqfphelckjvrwxdvekkl.supabase.co/functions/v1/bedflow

## Source
https://github.com/tranhoadtp/datgio3

## Kiến trúc v0.2
- Frontend: HTML/CSS/JavaScript responsive, mobile-first.
- Host live: Supabase Edge Function.
- Database: Supabase PostgreSQL.
- Realtime: Supabase Realtime / Postgres Changes.
- QR: camera trình duyệt + html5-qrcode.
- Giao dịch nghiệp vụ: PostgreSQL RPC `assign_bed`, `transfer_bed`, `end_bed_stay`.
- Audit: bảng `audit_logs`.
- Chống thao tác đồng thời: advisory transaction lock theo từng giường.
- Source code: GitHub.

## Chức năng hiện có
- 1 khoa, 4 phòng, 20 giường.
- 25 bệnh nhân giả lập.
- Testcase A/B/C/D có nằm ghép một phần ngày.
- Timeline 24 giờ tự phân đoạn 1 BN / ghép 2 / ghép >=3.
- Xếp bệnh nhân vào giường.
- Chuyển giường.
- Kết thúc lượt giường.
- Giới hạn tối đa số BN/giường.
- Realtime đa thiết bị.
- QR scanner qua camera trình duyệt.
- QR thật cho từng giường (BED:G01 ... BED:G20).
- Audit log.

## An toàn
Bản này chỉ dùng dữ liệu giả lập. Quyền public được mở để thuận tiện cho demo nên KHÔNG được nhập dữ liệu bệnh nhân thật.

## Quy tắc dữ liệu cốt lõi
Timeline thực tế là nguồn dữ liệu gốc. Hệ thống lưu:
`người bệnh – giường – start_at – end_at`.

Nằm ghép được suy ra từ các khoảng thời gian giao nhau; không nhập “50%” thủ công.

## Version
BVCL BedFlow v0.2
