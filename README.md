# Lịch sử Đảng — Ôn thi cá nhân

**Website:** https://lsd-on-thi-huong511.creamcake65.chatgpt.site

Đã triển khai bản đăng nhập tên **Huong** và mật khẩu riêng. Tên/mật khẩu được ghi trong `.local-credentials.txt` trên máy tạo; file này và `.sites-secrets.json` không được commit. Chọn ghi nhớ 30 ngày nếu dùng thiết bị cá nhân.

**Trạng thái:** bản mới vẫn nằm sau lớp private của Sites (yêu cầu tài khoản ChatGPT chủ sở hữu). Việc mở trang đăng nhập cho thiết bị không dùng ChatGPT đang chờ người dùng cho phép rõ; hệ thống xét duyệt tự động đã từ chối chuyển audience private → public khi chưa có sự cho phép đó. Nội dung học do ứng dụng xác thực trước khi trả.

Tiến độ dùng localStorage trên từng trình duyệt, chưa đồng bộ giữa thiết bị. Bản Node.js dự phòng được mô tả bên dưới.

Nguồn GitHub công khai: https://github.com/huongtth511-rgb/lsd-on-thi. File HTML và câu hỏi trong repository có thể được mọi người xem. Nguồn Sites và GitHub là hai repository riêng; push GitHub không tự deploy Sites.

## Cập nhật bản Sites

Giữ Site ID và cơ sở dữ liệu D1. Mã triển khai nằm tại `sites-app/`, HTML và màn hình đăng nhập gốc ở root. Chạy `node scripts/build-sites.mjs` để đưa các tệp vào checkout `sites-deploy/`; dùng workflow Sites để build, đóng gói và deploy commit chính xác. Không ghi secrets vào source hay Git. Các migration trong `sites-app/drizzle/` được lưu để theo dõi schema, tránh tạo lại hoặc sửa migration đã áp dụng.

Các phần dưới mô tả **bản Node.js dự phòng**, không phải bản Sites đang chạy.

## Chạy trên máy

Yêu cầu Node.js 22 trở lên (Docker và CI dùng Node.js 24). Không có thư viện npm bên ngoài.

```sh
npm run setup
npm start
```

Mở http://localhost:3000. Lệnh setup tạo tài khoản `admin` với mật khẩu ngẫu nhiên trong `.local-credentials.txt`, đồng thời tạo `.env` chứa bản băm mật khẩu. Cả hai file có quyền đọc/ghi riêng cho chủ sở hữu, được loại khỏi Git và Docker. Setup sẽ từ chối ghi đè file đã tồn tại. Không gửi những file này vào repository hoặc chat.

```sh
npm test
```

## Cấu hình Railway tham khảo (không triển khai theo yêu cầu mới)

1. Đẩy mã nguồn lên nhánh `main` của repository trên. Đặt repository **Private** nếu muốn giữ riêng ngân hàng câu hỏi.
2. Trong Railway, tạo project → **Deploy from GitHub repo**, chọn `huongtth511-rgb/lsd-on-thi`, nhánh `main`. Nếu chưa thấy repo, cấp quyền Railway GitHub App cho đúng repo này.
3. Trong service → **Variables**, đặt:

| Biến | Giá trị |
| --- | --- |
| `AUTH_USERNAME` | Giá trị tương ứng trong `.env` (mặc định `admin`) |
| `AUTH_PASSWORD_HASH` | Sao chép nguyên giá trị từ `.env`, dạng `scrypt:...:...` |
| `NODE_ENV` | `production` |

4. Trong **Settings → Networking**, chọn **Generate Domain**. Railway cung cấp `RAILWAY_PUBLIC_DOMAIN`; ứng dụng dùng domain này để kiểm tra yêu cầu đăng nhập. Nếu dùng domain riêng hoặc muốn chỉ định rõ, đặt thêm `APP_ORIGIN=https://<domain-của-bạn>` (không có path). Không dùng `APP_ORIGIN=http://localhost:3000` trên production.
5. Deploy/redeploy sau khi cấu hình xong. Railway đọc `Dockerfile` và `railway.json`, ứng dụng lắng nghe `0.0.0.0:$PORT`; healthcheck là `/healthz`. Nếu deployment tự chạy trước khi có Variables/domain thì sẽ thất bại có chủ đích; redeploy sau khi bổ sung cấu hình.
6. Giữ **1 replica**. Sau khi healthcheck thành công, mở domain HTTPS, kiểm tra chuyển đến `/login`, đăng nhập bằng tài khoản trong `.local-credentials.txt`, thử mở một bộ câu hỏi và đăng xuất.
7. Khi service đã liên kết repo/nhánh, các commit mới trên `main` là nguồn để Railway triển khai. GitHub Actions kiểm thử bằng `npm test`; bật tùy chọn **Wait for CI** trong Railway nếu muốn chờ kiểm thử thành công trước khi deploy.

Tài liệu: [GitHub deployments](https://docs.railway.com/guides/github-autodeploys), [Config as Code](https://docs.railway.com/config-as-code/reference), [Healthchecks](https://docs.railway.com/deployments/healthchecks).

## Cách hoạt động và giới hạn

- Máy chủ chỉ trả trang ôn thi sau khi xác thực; không mở public thư mục dự án. File `.env`, mã máy chủ và Git không tải được qua HTTP.
- Mật khẩu băm bằng scrypt. Cookie phiên HttpOnly, SameSite=Strict; production thêm Secure và tiền tố `__Host-`. Phiên có hạn 12 giờ, đăng xuất hủy ngay trên máy chủ.
- CSRF token và kiểm tra Origin bảo vệ form đăng nhập/đăng xuất. Tối đa 20 lần gửi thông tin đăng nhập mỗi 15 phút cho toàn ứng dụng, tối đa 4 lượt kiểm tra đồng thời. Phù hợp với một tài khoản cá nhân.
- Phiên lưu trong RAM: redeploy/restart sẽ yêu cầu đăng nhập lại. Không cần database/volume cho phạm vi hiện tại.
- Ngân hàng câu hỏi và logic ôn thi được giữ nguyên. Nút đăng xuất được máy chủ thêm vào thanh điều hướng khi trả HTML.
- Tiến độ vẫn dùng `localStorage`: không đồng bộ giữa thiết bị, domain hoặc trình duyệt. Chuyển từ file mở trực tiếp sang website sẽ có vùng lưu trữ mới. Đăng xuất không xóa tiến độ cũ trên thiết bị.
- Trang đã tải có thể tiếp tục chạy trong tab hiện tại; giới hạn phiên được kiểm tra khi có yêu cầu đến máy chủ. Không có tính năng thu hồi nội dung đã tải về.
- Muốn đổi tài khoản: tạo bản băm mật khẩu mới bằng `hashPassword` trong `auth.mjs`, cập nhật `AUTH_USERNAME`/`AUTH_PASSWORD_HASH` trong Railway Variables rồi redeploy. Không sửa mật khẩu trực tiếp trong HTML.

## Xử lý lỗi

- **Ứng dụng không khởi động:** kiểm tra đầy đủ AUTH_USERNAME/AUTH_PASSWORD_HASH và domain production.
- **403 khi đăng nhập:** APP_ORIGIN phải trùng chính xác origin đang mở (HTTPS + tên miền + cổng nếu có). Sau khi đổi cấu hình, tải lại `/login` để nhận token mới.
- **429:** chờ 15 phút rồi thử lại.
- **Mất phiên sau deploy:** bình thường với phiên RAM; đăng nhập lại, tiến độ trên cùng trình duyệt/domain vẫn còn.

Trạng thái triển khai cụ thể được ghi trong [PLAN.MD](PLAN.MD).
