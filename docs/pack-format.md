# Định dạng gói dữ liệu / Data pack format

Mỗi gói là dữ liệu khai báo được đăng ký trong `packs/registry.json`. Ứng dụng không tự quét thư mục khi chạy trên static hosting.

Each pack is declarative data registered in `packs/registry.json`. The app cannot discover folders automatically on static hosting.

## Registry

```json
{
  "schemaVersion": 1,
  "defaultPackId": "your-pack",
  "packs": [
    { "id": "your-pack", "manifest": "packs/your-pack/manifest.json", "status": "stable" }
  ]
}
```

`id` phải trùng `manifest.id`. `manifest` phải là đường dẫn tương đối an toàn trong repository.

`id` must match `manifest.id`. `manifest` must be a safe repository-relative path.

## Manifest v1

Các trường bắt buộc / Required fields:

```json
{
  "schemaVersion": 1,
  "id": "jlpt-n5-demo",
  "version": "1.0.0",
  "title": { "vi": "JLPT N5", "en": "JLPT N5" },
  "description": { "vi": "...", "en": "..." },
  "author": { "name": "Community contributor" },
  "license": "CC0-1.0",
  "source": { "name": "Original community work", "rightsStatus": "verified" },
  "content": {
    "format": "csv",
    "path": "words.csv",
    "encoding": "utf-8",
    "columns": {
      "id": "id",
      "unit": "unit",
      "order": "order",
      "meaning": "meaning_vi",
      "reading": "reading_jp",
      "written": "written_jp",
      "sinoVietnamese": "sino_vietnamese"
    }
  },
  "units": { "kind": "lesson", "label": { "vi": "Bài", "en": "Lesson" } },
  "modes": ["flashcard", "hiragana", "kanji-builder", "hanviet"],
  "legacyProgressIds": false
}
```

- `id`: slug ổn định, chữ thường, số và dấu gạch nối. Không thay đổi sau khi phát hành.
- `version`: [semantic versioning](https://semver.org/) khi có thể.
- `license`: giấy phép nội dung cho phép phân phối lại, ví dụ `CC0-1.0`, `CC-BY-4.0`, hoặc `CC-BY-SA-4.0`.
- `rightsStatus`: dùng `verified` chỉ khi quyền nội dung đã được kiểm tra.
- `modes`: chỉ được dùng các mode tích hợp: `flashcard`, `hiragana`, `kanji-builder`, `hanviet`.
- Không có trường JavaScript/module trong manifest. Mode mới phải được review cùng mã ứng dụng.

- `id`: a stable lowercase, number, and hyphen slug. Do not change it after release.
- `version`: use [semantic versioning](https://semver.org/) where possible.
- `license`: a redistributable content license, for example `CC0-1.0`, `CC-BY-4.0`, or `CC-BY-SA-4.0`.
- Use `rightsStatus: "verified"` only after content rights have been checked.
- `modes` may only use built-in modes: `flashcard`, `hiragana`, `kanji-builder`, `hanviet`.
- Manifests cannot contain JavaScript/modules. New modes require reviewed application code.

## CSV v1

CSV phải dùng UTF-8. Header chuẩn / CSV must use UTF-8. Canonical header:

```csv
id,unit,order,meaning_vi,reading_jp,written_jp,sino_vietnamese
greeting-001,1,1,xin chào,こんにちは,今日は,KIM NHẬT
```

- `id`: bắt buộc, duy nhất trong gói và ổn định.
- `unit`: bắt buộc; có thể là số hoặc chuỗi như `N5-1`.
- `order`: số dùng để sắp xếp trong unit.
- `meaning_vi`: bắt buộc.
- `reading_jp`, `written_jp`, `sino_vietnamese`: có thể trống, nhưng các mode thiếu đáp án sẽ tự bỏ qua dòng đó.

- `id`: required, unique within the pack, and stable.
- `unit`: required; may be a number or a string such as `N5-1`.
- `order`: numeric order inside a unit.
- `meaning_vi`: required.
- `reading_jp`, `written_jp`, and `sino_vietnamese` can be blank, but modes without an answer automatically skip that row.

Sao chép [gói mẫu](../packs/example-open-pack/) để bắt đầu.

Copy the [example pack](../packs/example-open-pack/) to get started.
