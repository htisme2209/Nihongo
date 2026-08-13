# Kotoba Dojo

Ứng dụng web tĩnh để học từ vựng Minna no Nihongo theo từng bài, với giao diện tối ưu cho cả máy tính và điện thoại.

> A static web app for learning Minna no Nihongo vocabulary lesson by lesson, optimized for both desktop and mobile devices.

## Chạy ứng dụng / Run the app

Tại thư mục dự án, chạy lệnh sau / From the project directory, run:

```powershell
python -m http.server 4173
```

Sau đó mở `http://127.0.0.1:4173` trên trình duyệt.

Then open `http://127.0.0.1:4173` in your browser.

Trang cần chạy qua local server để đọc dữ liệu CSV. / The app must run through a local server so it can load the CSV data.

## Dữ liệu / Data

- Tệp dữ liệu chính: `minna_bai1_25_nghia_dap_an_kanji_hanviet.csv`.
- Bao gồm 25 bài và 1.064 mục từ vựng Minna no Nihongo.
- Các mục không có đáp án phù hợp sẽ tự động được bỏ qua ở chế độ luyện tương ứng.

- Primary data file: `minna_bai1_25_nghia_dap_an_kanji_hanviet.csv`.
- Includes 25 Minna no Nihongo lessons and 1,064 vocabulary entries.
- Entries without a suitable answer are automatically skipped in the relevant learning mode.

## Chế độ học / Learning modes

- **Flashcard**: Chọn bài, chạm để lật thẻ, vuốt để chuyển thẻ và đánh dấu **Cần ôn** hoặc **Đã nhớ**.
- **Hiragana**: Xem nghĩa tiếng Việt và nhập cách đọc tiếng Nhật.
- **Hán tự / Kanji builder**: Xem nghĩa cùng cách đọc, sau đó chạm các mảnh chữ được xáo trộn để ghép đáp án đúng. Chế độ này hỗ trợ cả kana, dấu câu và ký tự lặp có trong dữ liệu.
- **Hán - Việt**: Xem chữ Hán và nhập âm Hán - Việt.

- **Flashcards**: Select a lesson, tap to flip a card, swipe to move between cards, and mark each word as **Review** or **Known**.
- **Hiragana**: Read the Vietnamese meaning and type the Japanese reading.
- **Kanji builder**: Read the meaning and reading, then tap shuffled character tiles to assemble the exact answer. This mode supports kana, punctuation, and repeated characters from the source data.
- **Sino-Vietnamese**: Read the Japanese text and type its Sino-Vietnamese reading.

## Tiến độ / Progress

- Tiến độ bài luyện được lưu trong `localStorage` với khóa `kotoba-dojo-progress`.
- Tiến độ flashcard được lưu riêng với khóa `kotoba-dojo-flashcard-progress`.
- Dữ liệu chỉ được lưu trên trình duyệt đang dùng; xóa dữ liệu trang web/trình duyệt sẽ xóa tiến độ.

- Quiz progress is stored in `localStorage` under `kotoba-dojo-progress`.
- Flashcard progress is stored separately under `kotoba-dojo-flashcard-progress`.
- Data stays in the current browser; clearing browser or site data will remove the saved progress.

## Trải nghiệm điện thoại / Mobile experience

- Danh sách bài cuộn ngang gọn để chọn bài nhanh.
- Màn luyện tập và flashcard mở toàn màn hình trên điện thoại.
- Các nút và vùng nhập liệu được thiết kế với kích thước chạm thân thiện.

- Lessons use a compact horizontal scroller for quicker selection.
- Practice and flashcard views open full-screen on phones.
- Controls and input areas use touch-friendly sizes.
