# BVCL BedFlow Demo

Demo PWA quản lý giường nội trú theo timeline.

## Chức năng hiện có
- Sơ đồ 20 giường / 4 phòng.
- Dữ liệu giả lập, gồm tình huống A/B/C/D có nằm ghép một phần ngày.
- Timeline 24 giờ tự phân đoạn 1 BN / ghép 2 / ghép >=3.
- Xếp BN, chuyển giường, kết thúc lượt giường.
- QR scanner qua camera trình duyệt (mã mẫu: `BED:G01` ... `BED:G20`).
- PWA / Add to Home Screen.
- Audit log.
- Đồng bộ realtime giữa các tab/cửa sổ cùng trình duyệt bằng BroadcastChannel.

## Lưu ý
Bản v0.1 dùng localStorage để demo UI/logic, chưa phải realtime nhiều thiết bị. Không dùng dữ liệu bệnh nhân thật.

## Roadmap
v0.2: backend cloud free + realtime đa thiết bị + phân quyền.
v0.3: correction workflow + department timeline.
