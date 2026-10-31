# Kế hoạch triển khai website ôn thi Lịch sử Đảng

Cập nhật: 30/10/2026. Người dùng yêu cầu chuyển sang hosting khác, không dùng Railway.

## Kết quả hiện tại

- **Đã triển khai thành công:** https://lsd-on-thi-huong511.creamcake65.chatgpt.site
- **Hosting:** Sites. Site private, chỉ chủ sở hữu được truy cập.
- **Đăng nhập:** tài khoản ChatGPT của chủ sở hữu, do nền tảng xác thực trước khi trả trang. Không cần mật khẩu website riêng trên bản đang chạy.
- **GitHub được chỉ định:** https://github.com/huongtth511-rgb/lsd-on-thi
- Nội dung HTML gốc được giữ nguyên; bản deploy thêm nút đăng xuất và nhãn không gian học cá nhân.
- Tiến độ vẫn lưu bằng localStorage, chưa đồng bộ giữa thiết bị/domain/trình duyệt.

## Các bước và trạng thái

- [x] Kiểm tra HTML gốc và nhu cầu một tài khoản cá nhân.
- [x] Tạo bản Node.js có đăng nhập tên người dùng/mật khẩu, scrypt, cookie phiên, chống CSRF và giới hạn thử mật khẩu.
- [x] Thêm Docker, cấu hình Railway tham khảo và GitHub Actions.
- [x] Chạy 7 kiểm thử Node.js: tất cả thành công.
- [x] Chuyển phương án hosting sang Sites theo yêu cầu mới; Railway không được triển khai.
- [x] Tạo Site private và lưu định danh trong sites-deploy/.openai/hosting.json.
- [x] Tạo scripts/build-sites.mjs để chuyển HTML gốc sang bản deploy, thêm đăng xuất nền tảng.
- [x] Kiểm tra cú pháp toàn bộ script inline của bản deploy.
- [x] Commit/push mã nguồn sang repository của Sites và đóng gói đúng commit.
- [x] Publish Site; nền tảng trả trạng thái succeeded cùng URL HTTPS.
- [x] Khởi tạo Git local, nhánh main, cấu hình origin tới repository GitHub được chỉ định.
- [x] Commit/push bản nguồn chính lên GitHub và xác minh remote (commit triển khai ban đầu: 5ff4b95b75e353d2cb18c5e7256d4aada27e3c72).

## Xác minh và giới hạn

- Bản Node.js: 7/7 kiểm thử đạt, gồm chặn tải HTML/file nhạy cảm, đăng nhập đúng/sai, cookie giả, đăng xuất, CSRF, body quá lớn, production HTTPS, hết hạn phiên và giới hạn thử mật khẩu.
- Bản Sites: script inline hợp lệ; đóng gói thành công; deployment succeeded.
- Lớp xác thực của bản Sites do nền tảng quản lý, không dùng bộ session Node.js. Bộ kiểm thử Node.js không thay thế kiểm thử đăng nhập ChatGPT thực tế.
- Kiểm tra Chrome qua giao diện native cho thấy 403: tài khoản đang đăng nhập trong Chrome khác tài khoản chủ sở hữu Site trong phiên Codex này. Lớp bảo vệ riêng tư đã chặn truy cập. Cần đăng nhập đúng tài khoản ChatGPT sở hữu Site để sử dụng; chưa kiểm thử luồng học sau đăng nhập của chủ sở hữu.
- Không tự đổi quyền Site thành public hoặc cấp quyền cho tài khoản khác. Site đã deploy nhưng truy cập bằng tài khoản hiện tại trên Chrome còn vướng khác tài khoản.
- Không tạo .env hay mật khẩu local vì bản Sites dùng tài khoản ChatGPT.
- GitHub lưu mã nguồn chính. Sites có repository riêng để xuất bản; push GitHub không tự deploy Sites.
- Giữ các file Node.js/Docker/Railway làm phương án tham khảo cho hosting Node.js khác; không có tài nguyên Railway được tạo.

## Thông tin triển khai để tiếp tục bảo trì

- project_id: appgprj_6ae458b857808191853ff9c349cda1ff
- deployment_id: appgdep_6ae459eb2f78819181a9b17b56b8100c
- version_id: appgprj_6ae458b857808191853ff9c349cda1ff~appgver_517ade97e0f08191a8de94e86f55d2b1
- Commit nguồn Sites: ca6d573b16822b32fc9d8defe15d9f21c631c8e2
- Checkout: sites-deploy/ (Git độc lập, không đưa Git lồng nhau vào repository chính).
- Bản đóng gói: sites-deploy.tar.gz (không đưa lên repository chính).

## Cập nhật website

1. Sửa HTML gốc trong workspace.
2. Chạy node scripts/build-sites.mjs.
3. Dùng workflow Sites với đúng project_id để commit/push/đóng gói và deploy bản mới, giữ quyền owner-private.
4. Chỉ báo hoàn tất khi deployment trả succeeded; ghi URL và commit mới vào PLAN.MD.
5. Đồng bộ mã nguồn chính lên GitHub riêng.

## Yêu cầu mới: đăng nhập Huong trên nhiều thiết bị — 30/10/2026

- [x] Tạo ứng dụng đăng nhập trên máy chủ cho tài khoản `Huong`, mật khẩu ngẫu nhiên mạnh trong `.local-credentials.txt` (không commit).
- [x] Dùng D1 lưu phiên; tùy chọn ghi nhớ 30 ngày, đăng xuất thu hồi phiên; kiểm tra Origin/CSRF và giới hạn thử mật khẩu.
- [x] Chạy 10/10 kiểm thử thành công; kiểm thử Worker thực tế với D1 local, đăng nhập, tải nội dung và đăng xuất thành công. Kiểm tra bundle client không chứa ngân hàng câu hỏi.
- [x] Cấu hình biến bí mật trong Sites và triển khai bản mới thành công dưới lớp private của Sites.
- [ ] Chuyển lớp truy cập Sites để trang đăng nhập có thể được mở từ thiết bị không đăng nhập ChatGPT. Hệ thống xét duyệt tự động đã từ chối thay đổi private → public: cần người dùng cho phép rõ việc công khai trang đăng nhập; có rủi ro lộ nội dung nếu xác thực ứng dụng bị lỗi.
- [ ] Sau khi được phép: xác minh truy cập HTTPS chưa đăng nhập không trả câu hỏi, đăng nhập đúng/sai, đăng xuất và kiểm tra trải nghiệm trên điện thoại/laptop. Không bỏ qua lớp xác thực ứng dụng.
- Tiến độ hiện lưu trên từng trình duyệt, chưa đồng bộ thiết bị.
- Site hiện vẫn yêu cầu tài khoản ChatGPT chủ sở hữu trước khi hiện form Huong. Không mô tả là đã hoàn tất truy cập độc lập.
- Site source commit: 30346f9f766b7aa58c4799d70b348e62d0212df7; deployment: appgdep_6ae4664f6fd48191be8c00d74a61fe65.

## Cập nhật GitHub public

- [x] Người dùng đã chuyển `huongtth511-rgb/lsd-on-thi` sang public; kiểm tra API GitHub không đăng nhập trả HTTP 200. File HTML và các câu hỏi trong repository hiện công khai.
- [ ] Site riêng `lsd-on-thi-huong511.creamcake65.chatgpt.site` vẫn ở chế độ private. Xét duyệt tự động từ chối đổi access_mode sang public do yêu cầu hiện tại chỉ xác nhận rõ GitHub. Cần người dùng cho phép rõ chuyển chính Site này sang public; ứng dụng vẫn yêu cầu tên/mật khẩu khi trả nội dung.

## Hoàn tất website công khai với đăng nhập Huong

- [x] Người dùng xác nhận chuyển riêng Site sang public. Access mode hiện là `public` (revision 2).
- [x] Site: https://lsd-on-thi-huong511.creamcake65.chatgpt.site
- [x] Kiểm thử trực tiếp production: chưa đăng nhập `/` chuyển đến `/login`; healthcheck 200; trang đăng nhập 200; sai mật khẩu 401; đúng mật khẩu đăng nhập thành công, HTML ôn thi 200; đăng xuất hủy phiên, truy cập lại chuyển đến đăng nhập.
- [x] Mật khẩu cho tài khoản Huong được lưu riêng trong `.local-credentials.txt` trên máy tạo, file và các bí mật không được commit. Có thể chọn ghi nhớ đăng nhập 30 ngày trên thiết bị cá nhân.
- [x] Repository GitHub công khai; HTML và câu hỏi trong mã nguồn công khai cho mọi người xem.
- Tiến độ tiếp tục lưu trên từng trình duyệt, không tự đồng bộ giữa điện thoại và laptop.
- Các mục chờ xác nhận Site trong các phần ghi lịch sử phía trên đã được giải quyết ở mục này.

## Sửa đăng nhập iPhone/Zalo

- Nhật ký production cho thấy POST `/login` từ iPhone trong Zalo bị HTTP 403 với `Origin: null`, `Sec-Fetch-Site: same-origin`. Chính sách `no-referrer` trước đây khiến trình duyệt gửi origin dạng null; máy chủ chỉ chấp nhận origin chính xác.
- Đổi Referrer-Policy sang `same-origin`. Với trang đăng nhập cũ đang mở, cho phép `Origin: null` duy nhất khi trình duyệt cung cấp `Sec-Fetch-Site: same-origin`; CSRF token độc lập vẫn bắt buộc.
- 11/11 kiểm thử đạt. Production: kiểm tra mô phỏng yêu cầu iPhone/Zalo đăng nhập, mở nội dung và đăng xuất thành công; cross-site và CSRF giả vẫn bị chặn. Chưa trực tiếp thao tác trên điện thoại của người dùng.
- Site source commit: c56dadf0bcdb9893de763cc06cda51375e60f1c8. Deployment: appgdep_6ae469dc435081918dbb008dcaff8654.

## Ôn đáp án và phản hồi ngay — 31/10/2026

- [x] Thêm nút **Hiện toàn bộ đáp án** trong phần xem trước của bộ đề; hiện tất cả câu phù hợp và đánh dấu đáp án gợi ý. Câu chưa có đáp án được ghi rõ, không tự tạo đáp án.
- [x] Thêm nút **Luyện & xem đúng sai ngay** trong cấu hình luyện theo file. Mỗi câu phản hồi ngay khi chọn; xóa hoặc thay đổi đáp án cập nhật phản hồi.
- [x] Giữ nút luyện bình thường và chế độ đề 40 câu theo cách chấm sau khi nộp; lượt cũ không có cờ phản hồi vẫn giữ chế độ cũ.
- [x] Chạy 14/14 kiểm thử, build, deploy và kiểm tra bản online có các chức năng mới. Browser access host không khả dụng, chưa kiểm thử tương tác bằng giao diện trình duyệt.
- Source Sites: 113b80acb88e45e9410e57cdc02b82c8d6834a29; deployment: appgdep_6ae56be177408191af2c6ad368c3798e.

## Chế độ học cả bộ và rà soát đáp án

- [x] Hiển thị toàn bộ câu trong bộ đề; nút hiện/ẩn toàn bộ đáp án. Khi ẩn, xóa lựa chọn đang xem để đáp án trở về trạng thái ẩn.
- [x] Bấm trực tiếp phương án trong từng câu: phản hồi đúng/sai và hiển thị giải thích khi đã biên soạn. Không chấm câu không có đáp án; vẫn giữ chế độ thi 40 câu chấm sau nộp.
- [x] Kiểm tra 710 câu về số lượng, cấu trúc phương án và khóa đáp án; tham khảo các nguồn trong `data/NGUON_VA_TIEN_DO.md`.
- [x] Thêm 177 giải thích và 112 đáp án gợi ý cho câu vốn thiếu; đánh dấu 5 câu lỗi/mơ hồ để không chấm.
- [ ] Rà soát nội dung và đối chiếu nguồn cho toàn bộ ngân hàng; hiện vẫn còn 37 câu chưa có đáp án và 533 câu chưa có giải thích. Các đáp án gốc khác chưa được xác nhận đồng loạt bởi giảng viên. Không coi tác vụ nghiên cứu là hoàn tất.
- [x] 16/16 kiểm thử đạt; kiểm tra production bằng cách đăng nhập và chạy logic HTML. Chưa kiểm tra tương tác bằng giao diện trên thiết bị người dùng.
- Source Sites: 8d6b78b6a8e8d1451ebf11a5ab6ca60b83d7de01; deployment: appgdep_6ae5746c872c8191a65cac8f6d9070c7.
