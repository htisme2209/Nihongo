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
- **Ôn kết hợp nhiều bài**: chọn nhiều bài vào cùng một bộ ôn và chọn trộn hoặc giữ thứ tự từ khi bắt đầu.
- **Nhập CSV cá nhân**: thêm danh sách từ vựng, xem trước nội dung và lưu lại trong trình duyệt để học cùng các bài có sẵn.
- **Hiragana**: xem nghĩa tiếng Việt và nhập cách đọc.
- **Ghép Hán tự**: chạm các mảnh chữ xáo trộn để ghép đúng đáp án, gồm cả kana, dấu câu và ký tự lặp trong dữ liệu.
- **Hán - Việt**: ôn cả từ hoặc tách từng Hán tự để ghi nhớ âm Hán - Việt riêng của từng chữ.
- **Mobile-first**: màn học toàn màn hình trên điện thoại, vùng chạm lớn, hỗ trợ safe area và bàn phím ảo.

- **Flashcards**: flip cards, swipe between words, and mark words as `Review` or `Known`.
- **Combined lesson review**: select several lessons for one study deck, with shuffled or source-order starts.
- **Personal CSV import**: preview and save vocabulary lists in your browser, then study them alongside existing lessons.
- **Hiragana**: read the Vietnamese meaning and type the Japanese reading.
- **Kanji builder**: tap shuffled character tiles to assemble the exact answer, including kana, punctuation, and repeated characters in the source data.
- **Sino-Vietnamese**: practice complete words or individual Kanji with their own Sino-Vietnamese readings.
- **Mobile-first**: full-screen phone views, large touch targets, safe-area, and virtual-keyboard support.

## Nhập danh sách CSV / Import a CSV list

Trong **Từ vựng theo bài**, chọn **Nhập CSV**, chọn file, kiểm tra tên danh sách và nội dung xem trước rồi bấm **Thêm danh sách**. Ví dụ, file `tuvungbai26.csv` được gợi ý tên **Bài 26**. Danh sách mới được chọn ngay để học và có thể kết hợp với các bài khác.

Under **Từ vựng theo bài**, select **Nhập CSV**, choose a file, review the name and preview, then select **Thêm danh sách**. The imported list is immediately selected for study and can be combined with other lessons.

File phải dùng UTF-8, tối đa 2 MB / 5.000 từ, **không có dòng tiêu đề**, gồm 2 cột: cách đọc và `Hán tự | Hán-Việt | nghĩa tiếng Việt`. Nội dung có dấu phẩy phải được đặt trong dấu ngoặc kép. Phần Hán tự/Hán-Việt có thể để trống hoặc dùng `—`; các chế độ cần đáp án này sẽ bỏ qua từ thiếu dữ liệu.

Use UTF-8, at most 2 MB / 5,000 words, **no header row**, and two columns: reading and `written form | Sino-Vietnamese | Vietnamese meaning`. Quote fields containing commas. Written forms and Sino-Vietnamese readings may be empty or `—`; modes requiring these answers skip missing entries.

```csv
みます,"見ます | KIẾN | xem, nhìn"
みます,"診ます | CHẨN | chẩn đoán, khám bệnh"
ごみ,— | — | rác
```

Mỗi dòng được giữ riêng, kể cả các từ cùng cách đọc. File sai định dạng sẽ được báo dòng lỗi để sửa trước khi nhập. Danh sách được lưu riêng, không ghi đè dữ liệu bài có sẵn. Hãy giữ file CSV gốc để nhập lại khi chuyển trình duyệt hoặc xóa dữ liệu website.

Each row is retained, including words with identical readings. Invalid files report the affected line before import. Lists are stored separately from built-in lessons. Keep the original CSV to import again on another browser or after clearing site data.

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

Kiểm thử nhập CSV (cần Node.js) / Run CSV import tests (requires Node.js):

```sh
node --test tests/vocabulary-csv.test.mjs
```

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
- Danh sách CSV cá nhân: `localStorage` key `kotoba-dojo-imported-lists-v1`.
- Dữ liệu chỉ nằm trong trình duyệt hiện tại; xóa dữ liệu website sẽ xóa tiến độ.

- Quiz progress: `localStorage` key `kotoba-dojo-progress`.
- Flashcard progress: `localStorage` key `kotoba-dojo-flashcard-progress`.
- Personal CSV lists: `localStorage` key `kotoba-dojo-imported-lists-v1`.
- Data remains in the current browser; clearing site data removes progress.

## Bản quyền / Content rights

Mã nguồn được cấp phép theo [MIT License](LICENSE). Dữ liệu từ vựng có thể có quyền riêng; không mặc định được cấp phép cùng mã nguồn. Mỗi gói phải ghi rõ nguồn và giấy phép trong `manifest.json`.

The source code is licensed under the [MIT License](LICENSE). Vocabulary content may have separate rights and is not automatically licensed with the code. Every pack must declare its source and license in `manifest.json`.
