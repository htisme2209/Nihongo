# Đóng góp cho Kotoba Dojo / Contributing to Kotoba Dojo

Cảm ơn bạn muốn giúp Kotoba Dojo trở thành nơi học từ vựng do cộng đồng xây dựng.

Thank you for helping make Kotoba Dojo a community-built place to learn vocabulary.

## Bạn có thể đóng góp gì? / What can you contribute?

- Gói từ vựng mới, sửa lỗi hoặc bản dịch.
- Cải tiến giao diện, khả năng truy cập và trải nghiệm di động.
- Chế độ học mới, miễn là không làm suy giảm các chế độ đang có.
- Tài liệu, ví dụ và kiểm thử.

- New vocabulary packs, corrections, or translations.
- UI, accessibility, and mobile-experience improvements.
- New learning modes that do not regress existing modes.
- Documentation, examples, and tests.

## Thiết lập / Setup

```powershell
python -m http.server 4173
```

Mở `http://127.0.0.1:4173`. Không cần cài dependency cho phiên bản hiện tại.

Open `http://127.0.0.1:4173`. The current version requires no installed dependencies.

## Đóng góp gói từ vựng / Adding a vocabulary pack

1. Tạo `packs/<pack-id>/manifest.json` và `words.csv` từ [gói mẫu](packs/example-open-pack/).
2. Đọc [định dạng gói](docs/pack-format.md) và [chính sách nội dung](docs/content-policy.md).
3. Khai báo nguồn, tác giả và giấy phép phù hợp trong manifest.
4. Thêm manifest vào `packs/registry.json` khi gói sẵn sàng được tải trong ứng dụng.
5. Kiểm tra CSV là UTF-8, `id` duy nhất, `unit` không trống và đáp án chính xác.

1. Create `packs/<pack-id>/manifest.json` and `words.csv` from the [example pack](packs/example-open-pack/).
2. Read the [pack format](docs/pack-format.md) and [content policy](docs/content-policy.md).
3. Declare the source, author, and compatible license in the manifest.
4. Add the manifest to `packs/registry.json` when the pack is ready for the app to load.
5. Verify UTF-8 CSV encoding, unique `id` values, non-empty `unit` values, and accurate answers.

## Đóng góp tính năng / Adding a feature

- Dùng HTML, CSS và JavaScript thuần nếu có thể; không thêm dependency/backend khi chưa thảo luận trong issue.
- Gói dữ liệu chỉ là khai báo. Không thêm JavaScript từ contributor vào manifest hoặc CSV.
- Giữ trải nghiệm điện thoại: nút chạm quan trọng tối thiểu 44px, thử trên kích thước hẹp và kiểm tra bàn phím ảo với form.
- Nếu thay đổi `localStorage`, phải có kế hoạch tương thích tiến độ cũ.

- Prefer plain HTML, CSS, and JavaScript; discuss dependencies or backend additions in an issue first.
- Data packs are declarative. Do not add contributor-provided JavaScript to manifests or CSV files.
- Preserve the mobile experience: important targets need at least 44px, test narrow layouts and virtual keyboards for forms.
- Changes to `localStorage` require a backwards-compatible progress plan.

## Quy trình pull request / Pull request workflow

1. Tạo branch rõ mục đích, ví dụ `feat/jlpt-n5-pack` hoặc `fix/kanji-builder`.
2. Dùng commit message ngắn, mệnh lệnh: `feat: add jlpt n5 vocabulary pack`.
3. Chạy `deno check app.js` nếu sửa JavaScript và kiểm tra ứng dụng qua local server.
4. Điền đầy đủ pull request template, gồm ảnh màn hình nếu có thay đổi giao diện.

1. Create a purpose-specific branch, for example `feat/jlpt-n5-pack` or `fix/kanji-builder`.
2. Use a concise imperative commit message: `feat: add jlpt n5 vocabulary pack`.
3. Run `deno check app.js` when JavaScript changes and test the app through a local server.
4. Complete the pull request template, including screenshots for UI changes.
