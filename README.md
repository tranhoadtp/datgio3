# BVCL BedFlow Demo

Demo quản lý giường nội trú theo timeline, QR, realtime đa thiết bị và quản trị danh mục Phòng/Giường.

## Live demo
https://bqfphelckjvrwxdvekkl.supabase.co/functions/v1/giuong

## Source
https://github.com/tranhoadtp/datgio3

## BVCL BedFlow v0.4
- Frontend: HTML/CSS/JavaScript responsive, mobile-first.
- Host production: Vercel từ GitHub.
- Database: Supabase PostgreSQL.
- Realtime: Supabase Realtime / Postgres Changes.
- QR: token ổn định gắn với UUID giường vật lý.
- Giao dịch nghiệp vụ: PostgreSQL RPC.
- Audit: bảng audit_logs.

## Nghiệp vụ hiện có
- 1 khoa demo, 4 phòng, 20 giường, 25 BN giả.
- Timeline 24 giờ tự phân đoạn 1 BN / ghép 2 / ghép >=3.
- Xếp BN, chuyển giường, kết thúc lượt giường.
- Realtime đa thiết bị.
- QR cho từng giường và quét camera.
- Tạo và sửa Khoa.
- Chọn Khoa đang xem trên dashboard.
- Tạo và sửa Phòng thuộc từng Khoa.
- Tạo Giường trong từng Phòng.
- Đặt/sửa mã Giường.
- Chỉnh số BN tối đa trên Giường.
- Tạo QR ổn định cho từng Giường và tải QR PNG.
- Xóa thật Giường chưa từng có lịch sử.
- Giường đã có lịch sử: giữ dữ liệu và chuyển sang Ngưng sử dụng.
- Kích hoạt lại Giường đã ngưng.
- Audit đầy đủ thay đổi Khoa/Phòng/Giường.

## Bảo toàn lịch sử
- Giường vật lý có UUID cố định.
- QR token gắn với UUID, không đổi khi đổi mã giường.
- Giường chưa từng sử dụng có thể hard-delete.
- Giường đã có bed_stays không bị xóa vật lý; chỉ chuyển sang Ngưng sử dụng.
- Không cho xóa/ngưng Giường đang có BN.
- Không cho chuyển một Giường đã có lịch sử sang Phòng khác.

## An toàn
Đây là demo public. RLS được bật nhưng quyền ghi demo được mở cho anonymous để thử chức năng. KHÔNG nhập dữ liệu bệnh nhân thật.

## Quy tắc dữ liệu lõi
Nguồn gốc là:
`người bệnh – giường – start_at – end_at`.

Nằm ghép được suy ra từ overlap; không nhập “50%” thủ công.
