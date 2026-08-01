# Kotoba Dojo

Web tĩnh để luyện từ vựng Minna no Nihongo theo từng bài.

## Chạy ứng dụng

Tại thư mục dự án, chạy:

```powershell
python -m http.server 4173
```

Sau đó mở `http://127.0.0.1:4173` trên trình duyệt. Cần chạy qua local server để trang có thể đọc tệp CSV.

## Chế độ luyện

- Hiragana: nhìn nghĩa tiếng Việt và nhập cách đọc.
- Hán tự: nhìn nghĩa cùng cách đọc và nhập chữ Hán.
- Hán - Việt: nhìn chữ Hán và nhập âm Hán - Việt.

Từ không có đáp án cho chế độ đang chọn sẽ tự động không xuất hiện trong phiên luyện. Tiến độ được lưu trong `localStorage` của trình duyệt.
