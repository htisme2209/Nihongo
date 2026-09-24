# Kotoba Dojo

Ứng dụng học từ vựng tiếng Nhật theo bài, xây dựng theo hướng cộng đồng và ưu tiên trải nghiệm điện thoại.

> A community-oriented Japanese vocabulary learning app with a mobile-first experience.

## Bắt đầu nhanh / Quick start

Tại thư mục dự án, chạy / From the project directory, run:

```powershell
python3 server.py
```

Mở `http://127.0.0.1:4173` trong trình duyệt. Cần Python 3.10 trở lên, không cần cài thư viện ngoài. Server tự lưu các file CSV được nhập vào thư mục `imported-lists/` trong dự án. Có thể đổi cổng, ví dụ `python3 server.py 5501`.

Open `http://127.0.0.1:4173` in a browser. Requires Python 3.10 or later and no external dependencies. The server automatically saves imported CSV files under `imported-lists/` in the project. To use another port, run e.g. `python3 server.py 5501`.

Nếu dùng Live Server, `python -m http.server` hoặc hosting tĩnh, danh sách vẫn chỉ được lưu trong trình duyệt. Để chuyển list cũ sang file, dừng server cũ rồi chạy `server.py` trên cùng cổng và mở đúng địa chỉ trước đây (giữ nguyên `localhost` hoặc `127.0.0.1`). App tự chuyển các list cũ sang thư mục dự án khi mở trang.

Live Server, `python -m http.server`, and static hosting retain browser-only storage. To migrate existing lists to files, stop the old server, run `server.py` on the same port, and open the exact previous address (including `localhost` versus `127.0.0.1`). Existing browser lists migrate automatically on startup.

## Tính năng / Features

- **Flashcard**: lật thẻ, vuốt đổi thẻ, đánh dấu `Cần ôn` hoặc `Đã nhớ`.
- **Ôn kết hợp nhiều bài**: chọn nhiều bài vào cùng một bộ ôn và chọn trộn hoặc giữ thứ tự từ khi bắt đầu.
- **Nhập CSV cá nhân**: xem trước nội dung, tự lưu file vào dự án và nạp lại danh sách ở lần mở app sau.
- **Hiragana**: xem nghĩa tiếng Việt và nhập cách đọc.
- **Ghép Hán tự**: chạm các mảnh chữ xáo trộn để ghép đúng đáp án, gồm cả kana, dấu câu và ký tự lặp trong dữ liệu.
- **Hán - Việt**: ôn cả từ hoặc tách từng Hán tự để ghi nhớ âm Hán - Việt riêng của từng chữ.
- **Mobile-first**: màn học toàn màn hình trên điện thoại, vùng chạm lớn, hỗ trợ safe area và bàn phím ảo.

- **Flashcards**: flip cards, swipe between words, and mark words as `Review` or `Known`.
- **Combined lesson review**: select several lessons for one study deck, with shuffled or source-order starts.
- **Personal CSV import**: preview vocabulary, automatically save CSV files to the project, and restore lists on the next visit.
- **Hiragana**: read the Vietnamese meaning and type the Japanese reading.
- **Kanji builder**: tap shuffled character tiles to assemble the exact answer, including kana, punctuation, and repeated characters in the source data.
- **Sino-Vietnamese**: practice complete words or individual Kanji with their own Sino-Vietnamese readings.
- **Mobile-first**: full-screen phone views, large touch targets, safe-area, and virtual-keyboard support.

## Nhập danh sách CSV / Import a CSV list

Trong **Từ vựng theo bài**, chọn **Nhập CSV**, chọn file, kiểm tra tên danh sách, chọn **Loại danh sách** và nội dung xem trước rồi bấm **Thêm danh sách**. Ví dụ, file `tuvungbai26.csv` được gợi ý tên **Bài 26**. Danh sách mới được chọn ngay để học và có thể kết hợp với các bài khác.

Under **Từ vựng theo bài**, select **Nhập CSV**, choose a file, review the name and preview, choose a **Loại danh sách** (list type), then select **Thêm danh sách**. The imported list is immediately selected for study and can be combined with other lessons.

Loại có sẵn gồm **Theo bài**, **JLPT N5–N1**, **Theo chủ đề** và **Chưa phân loại**. Chọn **+ Tạo loại mới** để nhập loại riêng (tối đa 50 ký tự); loại mới sẽ dùng lại được ở lần nhập sau. Các bài tích hợp thuộc **Theo bài**; danh sách CSV cũ chưa có loại sẽ thuộc **Chưa phân loại** và giữ nguyên từ vựng, tiến độ.

Available types include lesson-based lists, JLPT N5–N1, topics, and uncategorized lists. Choose **+ Tạo loại mới** to create a reusable custom type (up to 50 characters). Built-in lessons use **Theo bài**; older CSV lists use **Chưa phân loại**, preserving their words and progress.

Tên danh sách có thể trùng giữa các loại, nhưng phải khác nhau trong cùng một loại. / List names may repeat across types but must be unique within each type.

Dùng **Lọc theo loại** phía trên danh sách bài để xem từng nhóm và số danh sách trong nhóm. Bộ lọc chỉ đổi phần hiển thị, giữ nguyên các bài trong bộ ôn; thông báo sẽ cho biết nếu có bài đang chọn nằm ngoài bộ lọc. Chọn **Tất cả loại** để xem lại toàn bộ. Khi nhập danh sách khác loại đang lọc, bộ lọc chuyển sang loại mới để bạn thấy ngay danh sách vừa thêm.

Use **Lọc theo loại** above the lesson grid to filter by type and see list counts. Filtering preserves the current study selection and reports selected lists outside the filter. Choose **Tất cả loại** to show all lists. Importing into a different type switches an active filter to that type so the new list stays visible.

File phải dùng UTF-8, tối đa 2 MB / 5.000 từ, **không có dòng tiêu đề**, gồm 2 cột: cách đọc và `Hán tự | Hán-Việt | nghĩa tiếng Việt`. Nội dung có dấu phẩy phải được đặt trong dấu ngoặc kép. Phần Hán tự/Hán-Việt có thể để trống hoặc dùng `—`; các chế độ cần đáp án này sẽ bỏ qua từ thiếu dữ liệu.

Use UTF-8, at most 2 MB / 5,000 words, **no header row**, and two columns: reading and `written form | Sino-Vietnamese | Vietnamese meaning`. Quote fields containing commas. Written forms and Sino-Vietnamese readings may be empty or `—`; modes requiring these answers skip missing entries.

```csv
みます,"見ます | KIẾN | xem, nhìn"
みます,"診ます | CHẨN | chẩn đoán, khám bệnh"
ごみ,— | — | rác
```

Mỗi dòng được giữ riêng, kể cả các từ cùng cách đọc. File sai định dạng sẽ được báo dòng lỗi để sửa trước khi nhập. Khi chạy `server.py`, nút **Thêm danh sách** chỉ báo thành công sau khi đã lưu CSV gốc vào `imported-lists/<id>/vocabulary.csv` và tên, loại, từ vựng vào `list.json`. Đóng app, khởi động lại server, đổi trình duyệt hoặc xóa dữ liệu website đều không xóa các file này. Các list cũ chỉ có từ vựng sẽ được tạo lại file CSV, giữ nguyên ID để tiến độ học vẫn khớp.

Each row is retained, including words with identical readings. Invalid files report the affected line before import. With `server.py`, **Thêm danh sách** confirms success only after the original CSV is saved to `imported-lists/<id>/vocabulary.csv` and metadata to `list.json`. These files survive app/server restarts, browser changes, and cleared site data. Legacy lists receive regenerated CSV files while retaining their IDs and progress associations.

Thư mục `imported-lists/` được bỏ qua bởi Git. Sao lưu cả thư mục này nếu chuyển dự án sang máy khác. Server chỉ phục vụ trên máy hiện tại; tiến độ học vẫn lưu riêng trong từng trình duyệt.

Git ignores `imported-lists/`. Back up the entire folder when moving to another computer. The server listens on the local machine only; study progress remains browser-specific.

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

Kiểm thử nhập CSV và lưu file (Node.js, Python; Deno để kiểm tra JavaScript) / Test CSV import and file storage (Node.js, Python; Deno for JavaScript checks):

```sh
node --test tests/vocabulary-csv.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
deno check app.js
```

Kiểm thử Python mặc định không cần mở cổng mạng. Để chạy thêm kiểm thử HTTP qua localhost: `NIHONGO_HTTP_TESTS=1 python3 -m unittest discover -s tests -p 'test_*.py'`.

The default Python tests do not open network ports. Enable loopback HTTP integration tests with `NIHONGO_HTTP_TESTS=1 python3 -m unittest discover -s tests -p 'test_*.py'`.

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
- Danh sách CSV cá nhân khi chạy `server.py`: thư mục `imported-lists/`; `localStorage` key `kotoba-dojo-imported-lists-v1` giữ bản nhớ đệm và tương thích hosting tĩnh.
- Tiến độ chỉ nằm trong trình duyệt hiện tại; xóa dữ liệu website sẽ xóa tiến độ, nhưng không xóa CSV đã lưu vào dự án.

- Quiz progress: `localStorage` key `kotoba-dojo-progress`.
- Flashcard progress: `localStorage` key `kotoba-dojo-flashcard-progress`.
- Personal CSV lists with `server.py`: `imported-lists/`; `localStorage` key `kotoba-dojo-imported-lists-v1` retains a cache and supports static hosting.
- Progress remains in the current browser; clearing site data removes progress but preserves CSV files saved to the project.

## Bản quyền / Content rights

Mã nguồn được cấp phép theo [MIT License](LICENSE). Dữ liệu từ vựng có thể có quyền riêng; không mặc định được cấp phép cùng mã nguồn. Mỗi gói phải ghi rõ nguồn và giấy phép trong `manifest.json`.

The source code is licensed under the [MIT License](LICENSE). Vocabulary content may have separate rights and is not automatically licensed with the code. Every pack must declare its source and license in `manifest.json`.
