# BVCL BedFlow Demo

Demo quản lý giường nội trú theo timeline, QR, realtime đa thiết bị và quản trị danh mục Phòng/Giường.

## Live demo
https://bqfphelckjvrwxdvekkl.supabase.co/functions/v1/giuong

## Source
https://github.com/tranhoadtp/datgio3

## BVCL BedFlow v0.3
- Frontend: HTML/CSS/JavaScript responsive, mobile-first.
- Host live: Supabase Edge Function.
- Database: Supabase PostgreSQL.
- Realtime: Supabase Realtime / Postgres Changes.
- QR: camera trình duyệt + html5-qrcode.
- Giao dịch nghiệp vụ: PostgreSQL RPC.
- Audit: bảng audit_logs.
- Chống thao tác đồng thời: advisory transaction lock theo từng giường.

## Nghiệp vụ hiện có
- 1 khoa demo, 4 phòng, 20 giường, 25 BN giả.
- Timeline 24 giờ tự phân đoạn 1 BN / ghép 2 / ghép >=3.
- Xếp BN, chuyển giường, kết thúc lượt giường.
- Realtime đa thiết bị.
- QR cho từng giường và quét camera.
- Thêm phòng.
- Sửa mã/tên phòng.
- Thêm giường vào một phòng.
- Sửa mã giường.
- Chỉnh số BN tối đa trên giường.
- Ngưng/kích hoạt giường.
- Audit các thay đổi danh mục.

## Bảo toàn lịch sử
- Không hard-delete giường.
- Không cho ngưng giường đang có BN.
- Không cho chuyển một giường đã có lịch sử sang phòng khác.
- Mã giường có thể đổi nhưng UUID vật lý của giường không đổi.

## An toàn
Đây là demo public. RLS được bật nhưng quyền ghi demo được mở cho anonymous để thử chức năng. KHÔNG nhập dữ liệu bệnh nhân thật.

## Quy tắc dữ liệu lõi
Nguồn gốc là:
`người bệnh – giường – start_at – end_at`.

Nằm ghép được suy ra từ overlap; không nhập “50%” thủ công.
