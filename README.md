# Kotoba Dojo

Ứng dụng học từ vựng tiếng Nhật theo bài, xây dựng theo hướng cộng đồng và ưu tiên trải nghiệm điện thoại.

> A community-oriented Japanese vocabulary learning app with a mobile-first experience.

## Bắt đầu nhanh / Quick start

Tại thư mục dự án, chạy / From the project directory, run:

```powershell
python -m http.server 4173
```

Mở `http://127.0.0.1:4173` trong trình duyệt. Local server là cần thiết để ứng dụng tải các gói dữ liệu CSV.

Open `http://127.0.0.1:4173` in a browser. A local server is required because the app loads CSV data packs.

## Tính năng / Features

- **Flashcard**: lật thẻ, vuốt đổi thẻ, đánh dấu `Cần ôn` hoặc `Đã nhớ`.
- **Hiragana**: xem nghĩa tiếng Việt và nhập cách đọc.
- **Ghép Hán tự**: chạm các mảnh chữ xáo trộn để ghép đúng đáp án, gồm cả kana, dấu câu và ký tự lặp trong dữ liệu.
- **Hán - Việt**: xem chữ tiếng Nhật và nhập âm Hán - Việt.
- **Mobile-first**: màn học toàn màn hình trên điện thoại, vùng chạm lớn, hỗ trợ safe area và bàn phím ảo.

- **Flashcards**: flip cards, swipe between words, and mark words as `Review` or `Known`.
- **Hiragana**: read the Vietnamese meaning and type the Japanese reading.
- **Kanji builder**: tap shuffled character tiles to assemble the exact answer, including kana, punctuation, and repeated characters in the source data.
- **Sino-Vietnamese**: read Japanese text and type its Sino-Vietnamese reading.
- **Mobile-first**: full-screen phone views, large touch targets, safe-area, and virtual-keyboard support.

## Gói từ vựng cộng đồng / Community vocabulary packs

Mỗi gói là dữ liệu khai báo, không chạy JavaScript do người đóng góp cung cấp:

```text
packs/
  registry.json                # Danh sách gói được ứng dụng tải
  your-pack/
    manifest.json              # Metadata, quyền nội dung, ánh xạ cột
    words.csv                  # Từ vựng của gói
```

Ứng dụng tải theo luồng `registry.json → manifest.json → words.csv`. Điều này phù hợp với web tĩnh và cho phép cộng đồng thêm gói bằng pull request, không cần sửa logic luyện tập.

The app loads `registry.json → manifest.json → words.csv`. This works with static hosting and lets the community add packs through pull requests without changing learning logic.

Xem [định dạng gói dữ liệu](docs/pack-format.md) và [gói mẫu](packs/example-open-pack/) trước khi đóng góp.

See the [pack format](docs/pack-format.md) and [example pack](packs/example-open-pack/) before contributing.

## Đóng góp / Contributing

Chúng tôi hoan nghênh đóng góp về:

- Gói từ vựng có quyền sử dụng rõ ràng.
- Sửa dữ liệu, bản dịch, giao diện và khả năng truy cập.
- Tính năng hoặc chế độ luyện tập mới.
- Tài liệu song ngữ Việt - Anh.

We welcome contributions of:

- Vocabulary packs with clear content rights.
- Data corrections, translations, UI, and accessibility improvements.
- New features or practice modes.
- Vietnamese-English documentation.

Đọc [CONTRIBUTING.md](CONTRIBUTING.md), [chính sách nội dung](docs/content-policy.md), và [quy tắc ứng xử](CODE_OF_CONDUCT.md). Báo lỗi bảo mật theo [SECURITY.md](SECURITY.md).

Read [CONTRIBUTING.md](CONTRIBUTING.md), the [content policy](docs/content-policy.md), and the [code of conduct](CODE_OF_CONDUCT.md). Report security issues according to [SECURITY.md](SECURITY.md).

## Lưu tiến độ / Saved progress

- Điểm luyện tập: `localStorage` key `kotoba-dojo-progress`.
- Tiến độ flashcard: `localStorage` key `kotoba-dojo-flashcard-progress`.
- Dữ liệu chỉ nằm trong trình duyệt hiện tại; xóa dữ liệu website sẽ xóa tiến độ.

- Quiz progress: `localStorage` key `kotoba-dojo-progress`.
- Flashcard progress: `localStorage` key `kotoba-dojo-flashcard-progress`.
- Data remains in the current browser; clearing site data removes progress.

## Bản quyền / Content rights

Mã nguồn được cấp phép theo [MIT License](LICENSE). Dữ liệu từ vựng có thể có quyền riêng; không mặc định được cấp phép cùng mã nguồn. Mỗi gói phải ghi rõ nguồn và giấy phép trong `manifest.json`.

The source code is licensed under the [MIT License](LICENSE). Vocabulary content may have separate rights and is not automatically licensed with the code. Every pack must declare its source and license in `manifest.json`.
