export const IMPORTED_LISTS_STORAGE_KEY = "kotoba-dojo-imported-lists-v1";
export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_WORDS = 5000;

function csvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let startLine = 1;
  const fail = () => { throw new Error(`Dòng ${line}: dấu ngoặc kép không hợp lệ.`); };
  const endField = () => {
    row.push(field.trim());
    field = "";
    closedQuote = false;
  };
  const endRow = () => {
    endField();
    if (row.some(Boolean)) rows.push({ cells: row, line: startLine });
    row = [];
  };

  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        if (char === "\r" || char === "\n") {
          if (char === "\r" && source[index + 1] === "\n") index += 1;
          field += "\n";
          line += 1;
        } else field += char;
      }
    } else if (char === ",") {
      endField();
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      endRow();
      line += 1;
      startLine = line;
    } else if (char === '"') {
      if (closedQuote || field.trim()) fail();
      field = "";
      quoted = true;
    } else {
      if (closedQuote && char.trim()) fail();
      field += char;
    }
  }
  if (quoted) throw new Error(`Dòng ${startLine}: chưa đóng dấu ngoặc kép.`);
  endRow();
  return rows;
}

export function parseVocabularyCsv(text) {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) {
    throw new Error("File CSV quá lớn. Vui lòng chọn file tối đa 2 MB.");
  }
  const rows = csvRows(text);
  if (!rows.length) throw new Error("File CSV chưa có từ vựng.");
  if (rows.length > MAX_CSV_WORDS) throw new Error("Mỗi danh sách hỗ trợ tối đa 5.000 từ vựng.");
  const optional = (value) => /^[-–—]+$/.test(value) ? "" : value;
  return rows.map(({ cells, line }) => {
    if (cells.length !== 2) {
      throw new Error(`Dòng ${line}: cần đúng 2 cột. Nếu nội dung có dấu phẩy, hãy đặt cả cột trong dấu ngoặc kép.`);
    }
    const parts = cells[1].split("|").map((part) => part.trim());
    if (parts.length !== 3) {
      throw new Error(`Dòng ${line}: cột 2 phải có dạng Hán tự | Hán-Việt | nghĩa.`);
    }
    if (!cells[0] || !parts[2]) throw new Error(`Dòng ${line}: thiếu cách đọc hoặc nghĩa tiếng Việt.`);
    return { hiragana: cells[0], kanji: optional(parts[0]), hanViet: optional(parts[1]), meaning: parts[2] };
  });
}

export function suggestListName(filename) {
  const stem = filename.replace(/\.csv$/i, "");
  const lesson = stem.match(/b[aà]i[\s_-]*(\d+)/i);
  return (lesson ? `Bài ${Number(lesson[1])}` : stem.replace(/[_-]+/g, " ")).slice(0, 80);
}

export function decodeImportedLists(raw) {
  if (raw === null) return [];
  const saved = JSON.parse(raw);
  const ids = new Set();
  if (saved?.version !== 1 || !Array.isArray(saved.lists)) throw new Error("Dữ liệu danh sách đã lưu không hợp lệ.");
  for (const list of saved.lists) {
    if (!list || typeof list.id !== "string" || !/^csv-[a-z0-9-]+$/.test(list.id) || ids.has(list.id)
      || typeof list.name !== "string" || !list.name.trim() || list.name.length > 80
      || !Array.isArray(list.words) || !list.words.length || list.words.length > MAX_CSV_WORDS
      || list.words.some((word) => !word || !["hiragana", "kanji", "hanViet", "meaning"].every((key) => typeof word[key] === "string")
        || !word.hiragana.trim() || !word.meaning.trim())) {
      throw new Error("Dữ liệu danh sách đã lưu không hợp lệ.");
    }
    ids.add(list.id);
  }
  return saved.lists;
}

export function importedListWords(list) {
  return list.words.map((word, index) => ({
    hiragana: word.hiragana,
    kanji: word.kanji,
    hanViet: word.hanViet,
    meaning: word.meaning,
    id: `${list.id}:${index + 1}`,
    sourceId: String(index + 1),
    packId: list.id,
    unit: list.id,
    order: index + 1,
  }));
}
