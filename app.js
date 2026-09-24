import { IMPORTED_LISTS_STORAGE_KEY, MAX_CSV_BYTES, BUILTIN_LIST_TYPE, PRESET_LIST_TYPES, normalizeListType, listTypeKey, parseVocabularyCsv, suggestListName, decodeImportedLists, importedListWords } from "./vocabulary-csv.mjs";

const PACK_REGISTRY_URL = "packs/registry.json";
const FLASHCARD_STORAGE_KEY = "kotoba-dojo-flashcard-progress";
const FLAGGED_WORDS_STORAGE_KEY = "kotoba-dojo-flagged-words-v1";
const FLAGGED_WORDS_STORAGE_VERSION = 1;
const IMPORTED_LISTS_API = "/api/imported-lists";

const modes = {
  hiragana: {
    label: "HIRAGANA",
    description: "Nhìn nghĩa tiếng Việt và viết bằng Hiragana.",
    promptLabel: "NGHĨA TIẾNG VIỆT",
    answerLabel: "Hiragana",
    answer: (word) => word.hiragana,
    prompt: (word) => word.meaning,
    support: (word) => word.kanji ? `Han tu: ${word.kanji}` : "",
  },
  kanji: {
    label: "HAN TU",
    description: "Nhìn nghĩa và cách đọc, chạm các mảnh chữ để ghép đáp án.",
    promptLabel: "NGHĨA TIẾNG VIỆT",
    answerLabel: "Hán tự",
    answer: (word) => word.kanji,
    prompt: (word) => word.meaning,
    support: (word) => word.hiragana ? `Hiragana: ${word.hiragana}` : "",
  },
  hanviet: {
    label: "HÁN - VIỆT",
    description: "Nhìn Hán tự và viết âm Hán - Việt.",
    promptLabel: "HÁN TỰ",
    answerLabel: "Âm Hán - Việt",
    answer: (word) => word.hanViet,
    prompt: (word) => word.kanji,
    support: (word) => word.hanVietCharacter
      ? ""
      : `Nghĩa: ${word.meaning}${word.hiragana ? `  ·  ${word.hiragana}` : ""}`,
  },
};

const state = {
  words: [],
  importedLists: [],
  csvStorage: "browser",
  lessonTypeFilter: "",
  pack: null,
  registry: null,
  selectedUnit: "",
  studyUnits: new Set(),
  isSelectingStudyScope: false,
  shuffleStudyScope: true,
  selectedMode: "hiragana",
  hanVietPracticeScope: "word",
  queue: [],
  index: 0,
  score: 0,
  answered: false,
  incorrect: [],
  kanjiChoices: [],
  selectedKanjiChoiceIds: [],
  flaggedWords: new Map(),
};

const flashcardState = {
  deck: [],
  index: 0,
  isFlipped: false,
  knownIds: new Set(),
  reviewIds: new Set(),
  label: "",
};

const $ = (selector) => document.querySelector(selector);
const lessonGrid = $("#lesson-grid");
const dialog = $("#practice-dialog");
const flashcardDialog = $("#flashcard-dialog");
const flaggedWordsDialog = $("#flagged-words-dialog");
const importDialog = $("#import-csv-dialog");
let importWords = [];
let importCsvSource = null;
let importSaving = false;
let importedListsVersion = 0;
let importReadVersion = 0;
const flashcardCard = $("#flashcard-card");
let flashcardPointerStart = null;
let ignoreFlashcardClick = false;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) rows.push([...row, field.trim()]);
  return rows;
}

function toWords(csv, pack) {
  const [header, ...rows] = parseCsv(csv);
  header[0] = header[0].replace(/^\uFEFF/, "");
  const column = Object.fromEntries(header.map((name, index) => [name, index]));
  const columns = pack.content.columns;
  const read = (row, field) => {
    const columnName = columns[field];
    return typeof columnName === "string" ? row[column[columnName]] || "" : "";
  };

  return rows.map((row, index) => {
    const unit = read(row, "unit");
    const order = Number(read(row, "order")) || index + 1;
    const sourceId = read(row, "id") || `${unit}-${order}`;
    return {
      id: pack.legacyProgressIds ? sourceId : `${pack.id}:${sourceId}`,
      sourceId,
      packId: pack.id,
      unit,
      order,
      meaning: read(row, "meaning"),
      hiragana: read(row, "reading"),
      kanji: read(row, "written"),
      hanViet: read(row, "sinoVietnamese"),
    };
  }).filter((word) => word.unit && word.meaning);
}

function showImportError(message) {
  $("#import-csv-error").textContent = message;
}

function renderImportPreview() {
  $("#import-csv-preview").hidden = !importWords.length;
  $("#import-csv-submit").disabled = !importWords.length;
  $("#import-csv-count").textContent = `${importWords.length} từ vựng · xem trước ${Math.min(5, importWords.length)} từ đầu tiên`;
  const body = $("#import-csv-rows");
  body.textContent = "";
  importWords.slice(0, 5).forEach((word) => {
    const row = document.createElement("tr");
    [word.hiragana, word.kanji || "—", word.hanViet || "—", word.meaning].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
}

function openCsvImport() {
  if (importSaving) return;
  importReadVersion += 1;
  importWords = [];
  importCsvSource = null;
  $("#import-csv-form").reset();
  renderImportTypes();
  $("#import-csv-file-status").textContent = "";
  showImportError("");
  renderImportPreview();
  importDialog.showModal();
}

function listTypes() {
  const types = new Map();
  [...PRESET_LIST_TYPES, ...state.importedLists.map((list) => normalizeListType(list.type))].forEach((type) => {
    const key = listTypeKey(type);
    if (!types.has(key)) types.set(key, type);
  });
  return types;
}

function appendTypeOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function renderImportTypes() {
  const select = $("#import-csv-type");
  select.textContent = "";
  listTypes().forEach((type, key) => appendTypeOption(select, key, type));
  appendTypeOption(select, "new", "+ Tạo loại mới");
  select.value = state.lessonTypeFilter || listTypeKey(BUILTIN_LIST_TYPE);
  toggleCustomListType();
}

function toggleCustomListType() {
  const custom = $("#import-csv-type").value === "new";
  $("#import-csv-new-type-field").hidden = !custom;
  $("#import-csv-new-type").required = custom;
  $("#import-csv-new-type").disabled = !custom;
}

async function readCsvImport() {
  if (importSaving) return;
  const readVersion = ++importReadVersion;
  const file = $("#import-csv-file").files[0];
  importWords = [];
  importCsvSource = null;
  showImportError("");
  renderImportPreview();
  $("#import-csv-file-status").textContent = "";
  if (!file) return;
  try {
    if (file.size > MAX_CSV_BYTES) throw new Error("File CSV quá lớn. Vui lòng chọn file tối đa 2 MB.");
    $("#import-csv-file-status").textContent = "Đang đọc file...";
    const buffer = await file.arrayBuffer();
    if (readVersion !== importReadVersion) return;
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer);
    } catch {
      throw new Error("Không đọc được tiếng Nhật/tiếng Việt. Hãy lưu file CSV với mã hóa UTF-8.");
    }
    importWords = parseVocabularyCsv(text);
    importCsvSource = { filename: file.name, text };
    if (!$("#import-csv-name").value.trim()) $("#import-csv-name").value = suggestListName(file.name);
    $("#import-csv-file-status").textContent = `Đã đọc ${file.name}.`;
    renderImportPreview();
  } catch (error) {
    if (readVersion !== importReadVersion) return;
    $("#import-csv-file-status").textContent = "";
    showImportError(error.message || "Không thể đọc file CSV. Vui lòng chọn lại file.");
  }
}

function applyImportedLists(lists) {
  importedListsVersion += 1;
  const oldPackIds = new Set(state.importedLists.map((list) => list.id));
  state.words = state.words.filter((word) => !oldPackIds.has(word.packId));
  state.importedLists = lists;
  state.words.push(...lists.flatMap(importedListWords));
  $("#lesson-total").textContent = new Set(state.words.map((word) => word.unit)).size;
}

async function serverImportedLists(options = {}) {
  const response = await fetch(IMPORTED_LISTS_API, { cache: "no-store", ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Không thể lưu hoặc đọc file CSV trong thư mục dự án.");
  return decodeImportedLists(JSON.stringify(payload));
}

async function persistServerList(list) {
  const lists = await serverImportedLists({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(list),
  });
  const saved = lists.find((entry) => entry.id === list.id);
  if (!saved || saved.name !== list.name || saved.type !== normalizeListType(list.type)
    || saved.words.length !== list.words.length
    || saved.words.some((word, index) => ["hiragana", "kanji", "hanViet", "meaning"].some((key) => word[key] !== list.words[index][key]))) {
    throw new Error("Server chưa xác nhận lưu đầy đủ danh sách.");
  }
  return lists;
}

function mergeImportedLists(serverLists, browserLists) {
  const lists = new Map(browserLists.map((list) => [list.id, list]));
  serverLists.forEach((list) => lists.set(list.id, list));
  return [...lists.values()];
}

async function loadImportedLists() {
  let browserLists = [];
  let browserError = false;
  try {
    browserLists = decodeImportedLists(localStorage.getItem(IMPORTED_LISTS_STORAGE_KEY));
  } catch {
    browserError = true;
  }
  let serverLists;
  try {
    const response = await fetch(IMPORTED_LISTS_API, { cache: "no-store" });
    if (response.status === 404 || response.status === 405 || !response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Static server");
    }
    state.csvStorage = "unavailable";
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Không thể đọc file CSV đã lưu trong dự án.");
    serverLists = decodeImportedLists(JSON.stringify(payload));
    state.csvStorage = "server";
  } catch (error) {
    $("#import-csv-status").textContent = state.csvStorage === "unavailable"
      ? `${error.message} Hãy kiểm tra server rồi tải lại trang trước khi thêm danh sách.`
      : browserError ? "Không thể đọc danh sách CSV đã lưu trong trình duyệt."
        : "Đang lưu trong trình duyệt. Chạy python3 server.py để tự lưu file CSV vào thư mục dự án.";
    return browserLists;
  }

  // Move legacy lists to disk with their original IDs so study progress still matches.
  let migrationFailed = false;
  for (const list of browserLists) {
    if (serverLists.some((saved) => saved.id === list.id)) continue;
    try {
      serverLists = await persistServerList(list);
    } catch {
      migrationFailed = true;
    }
  }
  $("#import-csv-status").textContent = migrationFailed
    ? "Một số danh sách cũ vẫn chỉ nằm trong trình duyệt vì chưa lưu được vào dự án. Hãy kiểm tra server và tên danh sách rồi tải lại trang."
    : browserError ? "Đã nạp danh sách từ thư mục dự án; chưa đọc được các danh sách cũ trong trình duyệt."
      : `Tự lưu CSV vào thư mục imported-lists/.${serverLists.length ? ` Đã nạp ${serverLists.length} danh sách đã lưu.` : ""}`;
  return mergeImportedLists(serverLists, browserLists);
}

function setImportSaving(saving) {
  importSaving = saving;
  $("#import-csv-submit").disabled = saving || !importWords.length;
  $("#import-csv-submit").textContent = saving ? "Đang lưu..." : "Thêm danh sách";
  ["#import-csv-file", "#import-csv-name", "#import-csv-type", "#close-csv-import", "#cancel-csv-import"].forEach((selector) => {
    $(selector).disabled = saving;
  });
  $("#import-csv-new-type").disabled = saving || $("#import-csv-type").value !== "new";
}

async function saveCsvImport(event) {
  event.preventDefault();
  if (importSaving || !importWords.length) return;
  showImportError("");
  if (state.csvStorage === "unavailable") {
    showImportError("Chưa thể đọc danh sách trong dự án. Hãy kiểm tra server rồi tải lại trang trước khi thêm danh sách.");
    return;
  }
  const name = $("#import-csv-name").value.trim();
  if (!name || name.length > 80) {
    showImportError("Hãy nhập tên danh sách từ 1 đến 80 ký tự.");
    $("#import-csv-name").focus();
    return;
  }
  let type;
  try {
    const selectedType = $("#import-csv-type").value;
    if (selectedType === "new") type = normalizeListType($("#import-csv-new-type").value);
    else {
      type = listTypes().get(selectedType);
      if (!type) throw new Error("Hãy chọn loại danh sách.");
    }
  } catch (error) {
    showImportError(error.message);
    return;
  }
  let lists;
  try {
    lists = state.csvStorage === "server" ? state.importedLists : decodeImportedLists(localStorage.getItem(IMPORTED_LISTS_STORAGE_KEY));
  } catch {
    showImportError("Không thể đọc danh sách đã lưu. Hãy kiểm tra quyền lưu dữ liệu của trình duyệt; dữ liệu hiện có chưa bị thay đổi.");
    return;
  }
  if (lists.some((list) => normalize(list.name) === normalize(name) && listTypeKey(list.type) === listTypeKey(type))) {
    showImportError("Tên danh sách đã tồn tại trong loại này. Hãy chọn tên khác để dễ phân biệt.");
    return;
  }
  type = listTypes().get(listTypeKey(type))
    || lists.find((list) => listTypeKey(list.type) === listTypeKey(type))?.type || type;
  const randomId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const list = { id: `csv-${randomId}`, name, type, words: importWords, ...(importCsvSource ? { csv: importCsvSource } : {}) };
  let updated = [...lists, list];
  setImportSaving(true);
  try {
    if (state.csvStorage === "server") {
      const serverLists = await persistServerList(list);
      updated = mergeImportedLists(serverLists, lists);
      try {
        // Disk is authoritative; the browser cache need not duplicate the original files.
        const savedIds = new Set(serverLists.map((saved) => saved.id));
        const cached = updated.map(({ csv, ...saved }) => savedIds.has(saved.id) ? saved : { ...saved, ...(csv ? { csv } : {}) });
        localStorage.setItem(IMPORTED_LISTS_STORAGE_KEY, JSON.stringify({ version: 1, lists: cached }));
      } catch { /* The CSV and list have already been saved to disk. */ }
    } else {
      localStorage.setItem(IMPORTED_LISTS_STORAGE_KEY, JSON.stringify({ version: 1, lists: updated }));
    }
  } catch (error) {
    showImportError(state.csvStorage === "server"
      ? `Chưa thể lưu file CSV vào dự án: ${error.message} Hãy thử lại.`
      : "Chưa thể lưu danh sách: bộ nhớ trình duyệt đã đầy hoặc bị chặn. Hãy giải phóng dung lượng hoặc cho phép lưu dữ liệu rồi thử lại.");
    return;
  } finally {
    setImportSaving(false);
  }
  applyImportedLists(updated);
  if (state.lessonTypeFilter) state.lessonTypeFilter = listTypeKey(type);
  setUnit(list.id);
  renderFlaggedWords();
  importDialog.close();
  $("#import-csv-status").textContent = `Đã thêm “${name}” (${type}) với ${list.words.length} từ vựng. `
    + (state.csvStorage === "server" ? "Đã lưu file CSV vào dự án; lần sau mở app sẽ tự nạp lại." : "Đã lưu trong trình duyệt này; mở lại cùng địa chỉ để tiếp tục học.");
  focusLessonCard(list.id);
}

function getProgress() {
  try {
    return JSON.parse(localStorage.getItem("kotoba-dojo-progress")) || {};
  } catch {
    return {};
  }
}

function saveProgress(id, result) {
  const progress = getProgress();
  const record = progress[id] || { attempts: 0, correct: 0 };
  record.attempts += 1;
  record.correct += Number(result);
  progress[id] = record;
  localStorage.setItem("kotoba-dojo-progress", JSON.stringify(progress));
}

function getFlashcardProgress() {
  try {
    return JSON.parse(localStorage.getItem(FLASHCARD_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveFlashcardProgress(id, outcome) {
  const progress = getFlashcardProgress();
  const record = progress[id] || { known: 0, review: 0, lastSeen: "" };
  record[outcome] += 1;
  record.lastSeen = new Date().toISOString();
  progress[id] = record;
  localStorage.setItem(FLASHCARD_STORAGE_KEY, JSON.stringify(progress));
}

function flaggedWordKey(word) {
  return `${word.packId}\u0000${word.sourceId}`;
}

function readFlaggedWords() {
  const flaggedWords = new Map();
  try {
    const saved = JSON.parse(localStorage.getItem(FLAGGED_WORDS_STORAGE_KEY));
    if (saved?.version === FLAGGED_WORDS_STORAGE_VERSION && Array.isArray(saved.items)) {
      saved.items.forEach((item) => {
        if (!item || typeof item.packId !== "string" || typeof item.sourceId !== "string") return;
        const record = {
          packId: item.packId,
          sourceId: item.sourceId,
          flaggedAt: typeof item.flaggedAt === "string" ? item.flaggedAt : "",
        };
        flaggedWords.set(`${record.packId}\u0000${record.sourceId}`, record);
      });
    }
  } catch {
    // Ignore invalid or unavailable browser storage.
    return null;
  }
  return flaggedWords;
}

function loadFlaggedWords() {
  const flaggedWords = readFlaggedWords();
  if (flaggedWords) state.flaggedWords = flaggedWords;
}

function saveFlaggedWords() {
  const items = [...state.flaggedWords.values()];
  try {
    localStorage.setItem(FLAGGED_WORDS_STORAGE_KEY, JSON.stringify({ version: FLAGGED_WORDS_STORAGE_VERSION, items }));
  } catch {
    // Keep the current session usable when browser storage is unavailable.
  }
}

function flagTarget(word) {
  return word?.hanVietCharacter ? word.sourceWord : word;
}

function isWordFlagged(word) {
  const target = flagTarget(word);
  return Boolean(target && state.flaggedWords.has(flaggedWordKey(target)));
}

function getFlaggedWords() {
  return state.words
    .filter((word) => isWordFlagged(word))
    .sort((left, right) => {
      const leftRecord = state.flaggedWords.get(flaggedWordKey(left));
      const rightRecord = state.flaggedWords.get(flaggedWordKey(right));
      const dateOrder = (rightRecord?.flaggedAt || "").localeCompare(leftRecord?.flaggedAt || "");
      return dateOrder || left.unit.localeCompare(right.unit, "vi", { numeric: true }) || left.order - right.order;
    });
}

function renderFlagToggle(button, word) {
  const target = flagTarget(word);
  const flagged = isWordFlagged(word);
  button.disabled = !target;
  button.classList.toggle("is-flagged", flagged);
  button.setAttribute("aria-pressed", String(flagged));
  button.textContent = word?.hanVietCharacter
    ? (flagged ? "Bỏ cờ từ gốc" : "Gắn cờ từ gốc")
    : (flagged ? "Bỏ gắn cờ" : "Gắn cờ từ này");
}

function renderFlagToggles() {
  renderFlagToggle($("#toggle-practice-flag"), state.queue[state.index]);
  renderFlagToggle($("#toggle-flashcard-flag"), flashcardState.deck[flashcardState.index]);
}

function renderFlaggedWords() {
  const words = getFlaggedWords();
  const count = words.length;
  const list = $("#flagged-words-list");
  const startButton = $("#start-flagged-flashcards");
  const canStartFlashcards = words.some((word) => word.kanji || word.hiragana);

  $("#flagged-words-count").textContent = count;
  $("#flagged-words-dialog-count").textContent = count;
  $("#open-flagged-words").setAttribute("aria-label", count
    ? `Mở danh sách ${count} từ đã gắn cờ`
    : "Mở danh sách từ đã gắn cờ");
  $("#flagged-words-copy").textContent = count
    ? `${count} từ được lưu để bạn quay lại đúng lúc cần ôn.`
    : "Chưa có từ nào được gắn cờ. Khi học, hãy lưu từ muốn quay lại ôn sau.";
  startButton.disabled = !canStartFlashcards;
  list.textContent = "";

  if (!count) {
    const empty = document.createElement("p");
    empty.className = "flagged-words-empty";
    empty.textContent = "Danh sách này sẽ hiện các từ bạn đã gắn cờ.";
    list.append(empty);
    return;
  }

  const entries = document.createElement("ul");
  entries.className = "flagged-word-items";
  words.forEach((word, index) => {
    const item = document.createElement("li");
    item.className = "flagged-word-item";
    const content = document.createElement("div");
    content.className = "flagged-word-content";
    const japanese = document.createElement("strong");
    japanese.className = "flagged-word-japanese";
    japanese.textContent = flashcardFrontText(word);
    const reading = document.createElement("span");
    reading.className = "flagged-word-reading";
    reading.textContent = word.kanji && word.hiragana ? word.hiragana : "";
    reading.hidden = !reading.textContent;
    const meaning = document.createElement("span");
    meaning.className = "flagged-word-meaning";
    meaning.textContent = word.meaning;
    content.append(japanese, reading, meaning);

    const actions = document.createElement("div");
    actions.className = "flagged-word-actions";
    const lesson = document.createElement("span");
    lesson.className = "flagged-word-lesson";
    lesson.textContent = displayUnit(word.unit);
    const remove = document.createElement("button");
    remove.className = "flagged-word-remove";
    remove.type = "button";
    remove.textContent = "Bỏ cờ";
    remove.setAttribute("aria-label", `Bỏ gắn cờ từ: ${word.meaning}`);
    remove.addEventListener("click", () => toggleWordFlag(word, () => focusFlaggedWordAction(index)));
    actions.append(lesson, remove);
    item.append(content, actions);
    entries.append(item);
  });
  list.append(entries);
}

function focusFlaggedWordAction(index) {
  const buttons = [...$("#flagged-words-list").querySelectorAll(".flagged-word-remove")];
  const fallback = $("#start-flagged-flashcards").disabled ? $("#close-flagged-words") : $("#start-flagged-flashcards");
  (buttons[Math.min(index, buttons.length - 1)] || fallback).focus();
}

function toggleWordFlag(word, afterRender = null) {
  const target = flagTarget(word);
  if (!target) return;
  // Refresh first so another tab's latest saved flags are not overwritten.
  loadFlaggedWords();
  const key = flaggedWordKey(target);
  if (state.flaggedWords.has(key)) {
    state.flaggedWords.delete(key);
  } else {
    state.flaggedWords.set(key, {
      packId: target.packId,
      sourceId: target.sourceId,
      flaggedAt: new Date().toISOString(),
    });
  }
  saveFlaggedWords();
  renderFlaggedWords();
  renderFlagToggles();
  afterRender?.();
}

function openFlaggedWords() {
  renderFlaggedWords();
  if (!flaggedWordsDialog.open) flaggedWordsDialog.showModal();
}

function closeFlaggedWords() {
  flaggedWordsDialog.close();
}

function startFlaggedFlashcards() {
  const words = getFlaggedWords().filter((word) => word.kanji || word.hiragana);
  if (!words.length) return;
  closeFlaggedWords();
  startFlashcards(words, "Từ đã gắn cờ");
}

function unitLabel() {
  return state.pack?.units?.label?.vi || "Bài";
}

function displayUnit(unit) {
  const importedList = state.importedLists.find((list) => list.id === unit);
  if (importedList) return importedList.name;
  const value = String(unit);
  const formatted = /^\d+$/.test(value) ? value.padStart(2, "0") : value;
  return `${unitLabel()} ${formatted}`;
}

function sortUnits(units) {
  const importedIds = new Set(state.importedLists.map((list) => list.id));
  return [...units].sort((left, right) => Number(importedIds.has(left)) - Number(importedIds.has(right))
    || (importedIds.has(left) ? displayUnit(left).localeCompare(displayUnit(right), "vi", { numeric: true })
      : left.localeCompare(right, "vi", { numeric: true })));
}

function getStudyUnits() {
  const availableUnits = new Set(state.words.map((word) => word.unit));
  return sortUnits([...state.studyUnits].filter((unit) => availableUnits.has(unit)));
}

function studyScopeLabel() {
  const units = getStudyUnits();
  if (units.length === 1) return displayUnit(units[0]);
  return `${units.length} bài đã chọn`;
}

function studyWords() {
  const orderedUnits = getStudyUnits();
  const units = new Set(orderedUnits);
  return state.words
    .filter((word) => units.has(word.unit))
    .sort((left, right) => orderedUnits.indexOf(left.unit) - orderedUnits.indexOf(right.unit) || left.order - right.order);
}

function orderForStudy(words) {
  return state.shuffleStudyScope ? shuffled(words) : [...words];
}

function focusLessonCard(unit) {
  [...lessonGrid.querySelectorAll(".lesson-card")]
    .find((card) => card.dataset.unit === String(unit))
    ?.focus({ preventScroll: true });
}

function renderStudyScope() {
  const units = getStudyUnits();
  const wordCount = studyWords().length;
  const label = studyScopeLabel();
  const isMultiple = units.length > 1;
  const detail = isMultiple
    ? `${wordCount} từ vựng từ ${units.length} bài${state.shuffleStudyScope ? " · sẽ được trộn khi bắt đầu." : " · giữ theo thứ tự bài học."}`
    : `${wordCount} từ vựng${state.shuffleStudyScope ? " · sẽ được trộn khi bắt đầu." : " · giữ theo thứ tự bài học."}`;
  const toggle = $("#toggle-study-scope");

  $("#study-scope-title").textContent = label;
  $("#study-scope-detail").textContent = detail;
  $("#study-scope-toolbar").setAttribute("aria-label", `Bộ ôn ${label}: ${detail}`);
  $("#study-scope-instruction").hidden = !state.isSelectingStudyScope;
  $("#shuffle-study-scope").checked = state.shuffleStudyScope;
  $("#toggle-study-scope-label").textContent = state.isSelectingStudyScope ? "Xong chọn" : "Chọn nhiều bài";
  $("#toggle-study-scope-icon").textContent = state.isSelectingStudyScope ? "✓" : "＋";
  toggle.classList.toggle("is-selecting", state.isSelectingStudyScope);
  toggle.setAttribute("aria-pressed", String(state.isSelectingStudyScope));
  $(".selected-lesson-label").textContent = label;
  $("#all-questions-option").textContent = isMultiple ? "Toàn bộ bộ ôn" : "Toàn bộ bài";
  $("#continue-button").setAttribute("aria-label", `Luyện ${label}`);
  $("#start-button").setAttribute("aria-label", `Bắt đầu luyện ${label}`);
  $("#start-flashcards").setAttribute("aria-label", `Học flashcard ${label}`);
}

function refreshStudyScope() {
  renderStudyScope();
  renderLessons();
  updateFlashcardCTA();
  renderHanVietGranularity();
}

function progressForUnit(unit) {
  const words = state.words.filter((word) => word.unit === unit);
  const progress = getProgress();
  const mastered = words.filter((word) => {
    const record = progress[word.id];
    return record && record.attempts >= 2 && record.correct / record.attempts >= 0.8;
  }).length;
  return { mastered, total: words.length };
}

function updateOverview() {
  const progress = getProgress();
  const records = Object.values(progress);
  const mastered = records.filter((record) => record.attempts >= 2 && record.correct / record.attempts >= 0.8).length;
  const studied = records.length;
  $("#mastered-total").textContent = mastered;
  $("#studied-total").textContent = studied;
}

function renderLessons() {
  const template = $("#lesson-template");
  lessonGrid.textContent = "";
  renderLessonTypeFilter();
  const units = visibleLessonUnits();
  const studyUnits = new Set(getStudyUnits());
  lessonGrid.classList.toggle("is-empty", !units.length);
  if (!units.length) {
    const empty = document.createElement("p");
    empty.className = "loading";
    empty.textContent = "Chưa có danh sách thuộc loại này. Hãy nhập CSV hoặc chọn Tất cả loại.";
    lessonGrid.append(empty);
  }

  units.forEach((unit) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".lesson-card");
    const stats = progressForUnit(unit);
    const selected = studyUnits.has(unit);
    const type = unitType(unit);
    card.dataset.unit = unit;
    card.title = `${displayUnit(unit)} · ${type}`;
    card.classList.toggle("imported-lesson", state.importedLists.some((list) => list.id === unit));
    card.classList.toggle("selected", selected);
    card.classList.toggle("selection-mode", state.isSelectingStudyScope);
    card.setAttribute("aria-pressed", String(selected));
    card.setAttribute("aria-label", state.isSelectingStudyScope
      ? `${selected ? "Bỏ" : "Thêm"} ${displayUnit(unit)} (${type}) ${selected ? "khỏi" : "vào"} bộ ôn`
      : `Chọn ${displayUnit(unit)} (${type}) để ôn riêng`);
    fragment.querySelector(".lesson-number").textContent = displayUnit(unit);
    fragment.querySelector(".lesson-type").textContent = type;
    fragment.querySelector(".lesson-meta strong").textContent = `${stats.total} từ vựng`;
    fragment.querySelector(".lesson-meta small").textContent = stats.mastered ? `${stats.mastered} đã thuộc` : "Sẵn sàng luyện";
    fragment.querySelector(".lesson-progress i").style.width = `${stats.total ? (stats.mastered / stats.total) * 100 : 0}%`;
    lessonGrid.append(fragment);
  });
}

function unitType(unit) {
  const list = state.importedLists.find((entry) => entry.id === unit);
  return list ? normalizeListType(list.type) : BUILTIN_LIST_TYPE;
}

function visibleLessonUnits() {
  return sortUnits(new Set(state.words.map((word) => word.unit)))
    .filter((unit) => !state.lessonTypeFilter || listTypeKey(unitType(unit)) === state.lessonTypeFilter);
}

function renderLessonTypeFilter() {
  const select = $("#lesson-type-filter");
  const types = listTypes();
  if (state.lessonTypeFilter && !types.has(state.lessonTypeFilter)) state.lessonTypeFilter = "";
  const units = new Set(state.words.map((word) => word.unit));
  const counts = new Map();
  units.forEach((unit) => {
    const key = listTypeKey(unitType(unit));
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  select.textContent = "";
  appendTypeOption(select, "", `Tất cả loại (${units.size})`);
  types.forEach((type, key) => appendTypeOption(select, key, `${type} (${counts.get(key) || 0})`));
  select.value = state.lessonTypeFilter;
  const visible = new Set(visibleLessonUnits());
  const hiddenSelected = getStudyUnits().filter((unit) => !visible.has(unit)).length;
  $("#lesson-filter-summary").textContent = `Hiển thị ${visible.size}/${units.size} danh sách.`
    + (hiddenSelected ? ` Bộ ôn vẫn gồm ${hiddenSelected} danh sách ngoài bộ lọc.` : "");
}

function setLessonTypeFilter(type) {
  state.lessonTypeFilter = listTypes().has(type) ? type : "";
  renderLessons();
  lessonGrid.scrollLeft = 0;
}

function setUnit(unit) {
  state.selectedUnit = String(unit);
  state.studyUnits = new Set([state.selectedUnit]);
  state.isSelectingStudyScope = false;
  refreshStudyScope();
}

function toggleStudyUnit(unit) {
  const normalizedUnit = String(unit);
  const selected = new Set(getStudyUnits());
  if (selected.has(normalizedUnit)) {
    if (selected.size === 1) return;
    selected.delete(normalizedUnit);
  } else {
    selected.add(normalizedUnit);
  }
  state.studyUnits = selected;
  state.selectedUnit = getStudyUnits()[0] || "";
  refreshStudyScope();
  focusLessonCard(normalizedUnit);
}

function toggleStudyScopeSelection() {
  state.isSelectingStudyScope = !state.isSelectingStudyScope;
  refreshStudyScope();
}

function setMode(mode) {
  state.selectedMode = mode;
  document.querySelectorAll(".mode-card").forEach((card) => {
    const active = card.dataset.mode === mode;
    card.classList.toggle("active", active);
    card.setAttribute("aria-pressed", active);
  });
  renderHanVietGranularity();
}

function normalize(value) {
  return (value || "")
    .normalize("NFKC")
    .replace(/[\s\-・.]/g, "")
    .toLocaleLowerCase("vi-VN");
}

function isHanVietCharacterPractice() {
  return state.selectedMode === "hanviet" && state.hanVietPracticeScope === "character";
}

function hanCharacters(value) {
  return (value || "").match(/\p{Unified_Ideograph}/gu) || [];
}

function hasAmbiguousHanVietNotation(value) {
  return ["[", "]", "［", "］", "/", "／", "|", ";", "(", ")", "（", "）"].some((marker) => (value || "").includes(marker));
}

function hanVietReadingTokens(value) {
  const trimmed = (value || "").trim();
  if (!/^\p{L}+(?:\s+\p{L}+)*$/u.test(trimmed)) return [];
  return trimmed.split(/\s+/).map((reading) => reading.toLocaleUpperCase("vi-VN"));
}

function hanVietCharacterPairs(word) {
  if (hasAmbiguousHanVietNotation(word.kanji) || hasAmbiguousHanVietNotation(word.hanViet)) return [];
  const characters = hanCharacters(word.kanji);
  const readings = hanVietReadingTokens(word.hanViet);
  if (!characters.length || characters.length !== readings.length) return [];
  return characters.map((character, index) => ({ character, reading: readings[index], index }));
}

function hanVietCharacterCatalog() {
  const readingsByCharacter = new Map();

  state.words.forEach((word) => {
    hanVietCharacterPairs(word).forEach(({ character, reading, index }) => {
      const readingKey = normalize(reading);
      if (!readingKey) return;
      const readings = readingsByCharacter.get(character) || new Map();
      if (!readings.has(readingKey)) readings.set(readingKey, { reading, word, index });
      readingsByCharacter.set(character, readings);
    });
  });

  return new Map([...readingsByCharacter.entries()]
    .filter(([, readings]) => readings.size === 1)
    .map(([character, readings]) => [character, readings.values().next().value]));
}

function hanVietCharacterWords() {
  const catalog = hanVietCharacterCatalog();
  const itemsByCharacter = new Map();

  studyWords().forEach((word) => {
    hanVietCharacterPairs(word).forEach(({ character, reading, index }) => {
      const entry = catalog.get(character);
      if (!entry || normalize(entry.reading) !== normalize(reading) || itemsByCharacter.has(character)) return;
      itemsByCharacter.set(character, { word, reading: entry.reading, index });
    });
  });

  return [...itemsByCharacter.entries()]
    .map(([character, { word, reading, index }]) => {
      const packId = word.packId || state.pack?.id || "pack";
      return {
        id: `${packId}:hanviet-character:${character}`,
        sourceId: `hanviet-character:${character}`,
        packId,
        unit: word.unit,
        order: word.order + (index + 1) / 100,
        meaning: word.meaning,
        hiragana: "",
        kanji: character,
        hanViet: reading,
        hanVietCharacter: true,
        sourceWord: word,
      };
    })
    .sort((left, right) => left.unit.localeCompare(right.unit, "vi", { numeric: true }) || left.order - right.order);
}

function updatePracticeDescription() {
  $("#practice-description").textContent = isHanVietCharacterPractice()
    ? "Nhìn từng Hán tự và gõ âm Hán - Việt riêng của chữ đó."
    : modes[state.selectedMode].description;
}

function renderHanVietGranularity() {
  const settings = $("#hanviet-granularity");
  const enabled = state.selectedMode === "hanviet";
  settings.hidden = !enabled;
  if (!enabled) {
    updatePracticeDescription();
    return;
  }

  const characterCount = hanVietCharacterWords().length;
  if (!characterCount && state.hanVietPracticeScope === "character") state.hanVietPracticeScope = "word";
  $("#hanviet-word-mode").checked = state.hanVietPracticeScope === "word";
  $("#hanviet-character-mode").checked = state.hanVietPracticeScope === "character";
  $("#hanviet-character-mode").disabled = !characterCount;
  document.querySelectorAll("[data-hanviet-granularity-option]").forEach((option) => {
    option.classList.toggle("active", option.dataset.hanvietGranularityOption === state.hanVietPracticeScope);
  });
  $("#hanviet-granularity-copy").textContent = state.hanVietPracticeScope === "character"
    ? `${characterCount} Hán tự có âm Hán - Việt thống nhất trong bộ ôn này. Mỗi chữ chỉ xuất hiện một lần.`
    : "Nhìn cả từ Hán tự và gõ âm Hán - Việt của từ.";
  updatePracticeDescription();
}

function setHanVietPracticeScope(scope) {
  if (scope !== "word" && scope !== "character") return;
  state.hanVietPracticeScope = scope;
  renderHanVietGranularity();
}

function eligibleWords() {
  if (isHanVietCharacterPractice()) return hanVietCharacterWords();
  const mode = modes[state.selectedMode];
  return studyWords().filter((word) => mode.answer(word) && mode.prompt(word));
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function kanjiTokens(value) {
  if (typeof Intl.Segmenter === "function") {
    return [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(value || "")]
      .map((segment) => segment.segment);
  }
  return Array.from(value || "");
}

function displayChoiceToken(token) {
  return token === " " ? "␠" : token;
}

function isKanjiMode() {
  return state.selectedMode === "kanji";
}

function buildKanjiChoices(word) {
  const answerTokens = kanjiTokens(word.kanji);
  const usedTokens = new Set(answerTokens);
  const lessonTokens = studyWords()
    .filter((item) => item.kanji)
    .flatMap((item) => kanjiTokens(item.kanji))
    .filter((token) => /^\p{Script=Han}$/u.test(token) && !usedTokens.has(token));
  const distractorCount = answerTokens.length > 10 ? 2 : 4;
  const distractors = shuffled([...new Set(lessonTokens)]).slice(0, distractorCount);
  const choices = [...answerTokens, ...distractors].map((token, index) => ({
    id: `kanji-choice-${index}`,
    token,
  }));
  state.kanjiChoices = shuffled(choices);
  state.selectedKanjiChoiceIds = [];
}

function selectedKanjiAnswer() {
  return state.selectedKanjiChoiceIds
    .map((id) => state.kanjiChoices.find((choice) => choice.id === id)?.token || "")
    .join("");
}

function renderKanjiBuilder() {
  const answer = $("#kanji-answer");
  const grid = $("#kanji-choice-grid");
  const selectedIds = new Set(state.selectedKanjiChoiceIds);
  const expectedLength = kanjiTokens(state.queue[state.index]?.kanji).length;
  answer.textContent = "";
  grid.textContent = "";

  state.selectedKanjiChoiceIds.forEach((id, selectionIndex) => {
    const choice = state.kanjiChoices.find((item) => item.id === id);
    if (!choice) return;
    const token = document.createElement("button");
    token.className = "kanji-answer-token";
    token.type = "button";
    token.textContent = displayChoiceToken(choice.token);
    token.setAttribute("aria-label", `Bỏ ký tự ${choice.token || "khoảng trắng"} khỏi đáp án`);
    token.disabled = state.answered;
    token.addEventListener("click", () => {
      state.selectedKanjiChoiceIds.splice(selectionIndex, 1);
      renderKanjiBuilder();
    });
    answer.append(token);
  });

  state.kanjiChoices.forEach((choice) => {
    const button = document.createElement("button");
    button.className = "kanji-choice";
    button.type = "button";
    button.textContent = displayChoiceToken(choice.token);
    button.setAttribute("aria-label", `Chọn ký tự ${choice.token || "khoảng trắng"}`);
    button.disabled = state.answered || selectedIds.has(choice.id) || state.selectedKanjiChoiceIds.length >= expectedLength;
    button.addEventListener("click", () => {
      if (state.selectedKanjiChoiceIds.length >= expectedLength) return;
      state.selectedKanjiChoiceIds.push(choice.id);
      renderKanjiBuilder();
    });
    grid.append(button);
  });

  $("#kanji-check-button").disabled = state.answered || state.selectedKanjiChoiceIds.length !== expectedLength;
  $("#kanji-clear-button").disabled = state.answered || state.selectedKanjiChoiceIds.length === 0;
}

function clearKanjiAnswer() {
  if (state.answered) return;
  state.selectedKanjiChoiceIds = [];
  renderKanjiBuilder();
}

function flashcardWords() {
  return studyWords().filter((word) => word.kanji || word.hiragana);
}

function updateFlashcardCTA() {
  const count = flashcardWords().length;
  const label = studyScopeLabel();
  $("#flashcard-lesson-label").textContent = label;
  $("#flashcard-count").textContent = count
    ? `${count} thẻ từ vựng. Chạm để lật, rồi tự đánh giá mức độ ghi nhớ.`
    : "Danh sách đã chọn chưa có thẻ từ vựng để hiển thị.";
}

function flashcardFrontText(word) {
  return word.kanji || word.hiragana || "—";
}

function renderFlashcard() {
  const word = flashcardState.deck[flashcardState.index];
  if (!word) return;
  const primary = flashcardFrontText(word);
  const reading = word.kanji && word.hiragana ? word.hiragana : "";
  const detail = [word.kanji, word.hiragana].filter(Boolean).join("  ·  ");
  const hanViet = $("#flashcard-hanviet");

  $("#flashcard-progress-text").textContent = `${flashcardState.label || studyScopeLabel()} · Thẻ ${flashcardState.index + 1} / ${flashcardState.deck.length}`;
  $("#flashcard-progress-bar").style.width = `${((flashcardState.index + 1) / flashcardState.deck.length) * 100}%`;
  $("#flashcard-primary").textContent = primary;
  $("#flashcard-reading").textContent = reading;
  $("#flashcard-reading").hidden = !reading;
  $("#flashcard-meaning").textContent = word.meaning;
  $("#flashcard-detail").textContent = detail || "Từ vựng tiếng Nhật";
  hanViet.textContent = word.hanViet ? `Hán - Việt: ${word.hanViet}` : "";
  hanViet.hidden = !word.hanViet;
  $("#flashcard-card-inner").classList.toggle("is-flipped", flashcardState.isFlipped);
  flashcardCard.setAttribute("aria-pressed", flashcardState.isFlipped);
  flashcardCard.setAttribute("aria-label", flashcardState.isFlipped ? "Đang hiển thị đáp án. Chạm để lật lại." : "Chạm để lật thẻ và xem nghĩa.");
  $("#flashcard-previous").disabled = flashcardState.index === 0;
  renderFlagToggle($("#toggle-flashcard-flag"), word);
}

function startFlashcards(words = null, label = null) {
  const candidates = words || flashcardWords();
  if (!candidates.length) {
    alert("Danh sách đã chọn chưa có dữ liệu phù hợp để tạo flashcard.");
    return;
  }
  flashcardState.deck = orderForStudy(candidates);
  flashcardState.index = 0;
  flashcardState.isFlipped = false;
  flashcardState.knownIds = new Set();
  flashcardState.reviewIds = new Set();
  flashcardState.label = label || studyScopeLabel();
  $("#flashcard-panel").hidden = false;
  $("#flashcard-result").hidden = true;
  if (!flashcardDialog.open) flashcardDialog.showModal();
  renderFlashcard();
}

function toggleFlashcard() {
  if (!flashcardState.deck.length) return;
  flashcardState.isFlipped = !flashcardState.isFlipped;
  renderFlashcard();
}

function moveFlashcard(delta) {
  const nextIndex = flashcardState.index + delta;
  if (nextIndex < 0 || nextIndex >= flashcardState.deck.length) return;
  flashcardState.index = nextIndex;
  flashcardState.isFlipped = false;
  renderFlashcard();
}

function markFlashcard(outcome) {
  const word = flashcardState.deck[flashcardState.index];
  if (!word) return;
  saveFlashcardProgress(word.id, outcome);
  if (outcome === "known") {
    flashcardState.knownIds.add(word.id);
    flashcardState.reviewIds.delete(word.id);
  } else {
    flashcardState.reviewIds.add(word.id);
    flashcardState.knownIds.delete(word.id);
  }

  if (flashcardState.index + 1 < flashcardState.deck.length) {
    flashcardState.index += 1;
    flashcardState.isFlipped = false;
    renderFlashcard();
  } else {
    showFlashcardResult();
  }
}

function shuffleFlashcards() {
  if (flashcardState.deck.length < 2) return;
  flashcardState.deck = shuffled(flashcardState.deck);
  flashcardState.index = 0;
  flashcardState.isFlipped = false;
  flashcardState.knownIds = new Set();
  flashcardState.reviewIds = new Set();
  renderFlashcard();
}

function showFlashcardResult() {
  const known = flashcardState.knownIds.size;
  const review = flashcardState.reviewIds.size;
  $("#flashcard-panel").hidden = true;
  $("#flashcard-result").hidden = false;
  $("#flashcard-progress-bar").style.width = "100%";
  $("#flashcard-known-total").textContent = known;
  $("#flashcard-total").textContent = flashcardState.deck.length;
  $("#flashcard-title").textContent = review ? "Bạn đã hoàn thành bộ thẻ." : "Tất cả thẻ đều đã nhớ!";
  $("#flashcard-result-copy").textContent = review
    ? `${review} từ được đánh dấu cần ôn. Hãy xem lại ngay một lượt ngắn.`
    : "Nhịp học rất tốt. Chuyển sang bài khác hoặc tự kiểm tra bằng chế độ luyện tập.";
  $("#retry-flashcards").innerHTML = review ? "Ôn lại từ cần ôn <span>↻</span>" : "Xem lại bộ thẻ <span>↻</span>";
}

function closeFlashcards() {
  flashcardDialog.close();
  updateFlashcardCTA();
}

function startPractice(words = null) {
  const candidates = words || eligibleWords();
  if (!candidates.length) {
    alert("Danh sách đã chọn chưa có dữ liệu phù hợp với chế độ đã chọn.");
    return;
  }
  const countValue = $("#question-count").value;
  const count = countValue === "all" ? candidates.length : Math.min(Number(countValue), candidates.length);
  state.queue = orderForStudy(candidates).slice(0, count);
  state.index = 0;
  state.score = 0;
  state.answered = false;
  state.incorrect = [];
  $("#quiz-panel").hidden = false;
  $("#result-panel").hidden = true;
  dialog.showModal();
  renderQuestion();
}

function renderQuestion() {
  const word = state.queue[state.index];
  const mode = modes[state.selectedMode];
  const usesKanjiBuilder = isKanjiMode();
  const isHanVietCharacter = Boolean(word.hanVietCharacter);
  state.answered = false;
  $("#progress-text").textContent = `Câu ${state.index + 1} / ${state.queue.length}`;
  $("#progress-bar").style.width = `${(state.index / state.queue.length) * 100}%`;
  $("#score-value").textContent = state.score;
  $("#quiz-mode-label").textContent = isHanVietCharacter ? `${mode.label} · TÁCH CHỮ` : mode.label;
  $("#prompt-label").textContent = isHanVietCharacter ? "HÁN TỰ RIÊNG" : mode.promptLabel;
  $("#practice-title").textContent = mode.prompt(word);
  $("#question-support").textContent = mode.support(word);
  $("#question-support").hidden = !$("#question-support").textContent;
  $("#answer-form").hidden = usesKanjiBuilder;
  $("#kanji-builder").hidden = !usesKanjiBuilder;
  $("#answer-input").value = "";
  $("#answer-input").placeholder = `Nhập ${mode.answerLabel.toLocaleLowerCase("vi-VN")}...`;
  $("#answer-input").disabled = false;
  $("#check-button").hidden = false;
  $("#feedback").hidden = true;
  $("#hint-button").hidden = false;
  renderFlagToggle($("#toggle-practice-flag"), word);
  if (usesKanjiBuilder) {
    buildKanjiChoices(word);
    renderKanjiBuilder();
  }
  requestAnimationFrame(() => {
    const focusTarget = usesKanjiBuilder ? $("#kanji-choice-grid button") : $("#answer-input");
    focusTarget?.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 760px)").matches) {
      (usesKanjiBuilder ? $("#kanji-builder") : $("#answer-input")).scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

function answerRevealText(word, mode) {
  if (!word.hanVietCharacter) return `${mode.answerLabel}: ${mode.answer(word)}  ·  Nghĩa: ${word.meaning}`;
  return `${mode.answerLabel}: ${mode.answer(word)}`;
}

function revealAnswer() {
  if (state.answered) return;
  const word = state.queue[state.index];
  const mode = modes[state.selectedMode];
  state.answered = true;
  state.incorrect.push(word);
  saveProgress(word.id, false);
  if (isKanjiMode()) {
    // Rebuild in exact order, including duplicate characters.
    const remaining = [...state.kanjiChoices];
    state.selectedKanjiChoiceIds = kanjiTokens(word.kanji).map((token) => {
      const foundIndex = remaining.findIndex((choice) => choice.token === token);
      return remaining.splice(foundIndex, 1)[0].id;
    });
    renderKanjiBuilder();
  } else {
    $("#answer-input").value = mode.answer(word);
    $("#answer-input").disabled = true;
    $("#check-button").hidden = true;
  }
  $("#hint-button").hidden = true;
  const feedback = $("#feedback");
  feedback.hidden = false;
  feedback.className = "feedback incorrect";
  $("#feedback-title").textContent = "Đáp án đã hiện. Hãy quay lại ôn từ này nhé.";
  $("#answer-reveal").textContent = answerRevealText(word, mode);
  $("#next-button").focus();
}

function checkAnswer(answer = $("#answer-input").value) {
  if (state.answered) return;
  const word = state.queue[state.index];
  const mode = modes[state.selectedMode];
  const correct = isKanjiMode()
    ? answer === mode.answer(word)
    : normalize(answer) === normalize(mode.answer(word));
  state.answered = true;
  saveProgress(word.id, correct);
  if (correct) state.score += 1;
  else state.incorrect.push(word);

  if (isKanjiMode()) {
    renderKanjiBuilder();
  } else {
    $("#answer-input").disabled = true;
    $("#check-button").hidden = true;
  }
  const feedback = $("#feedback");
  feedback.hidden = false;
  feedback.className = `feedback ${correct ? "correct" : "incorrect"}`;
  $("#feedback-title").textContent = correct ? "Chính xác. Nhịp này rất tốt!" : "Chưa đúng, hãy ghi nhớ từ này nhé.";
  $("#answer-reveal").textContent = answerRevealText(word, mode);
  $("#next-button").focus();
}

function nextQuestion() {
  if (state.index + 1 < state.queue.length) {
    state.index += 1;
    renderQuestion();
  } else {
    showResults();
  }
}

function showResults() {
  $("#quiz-panel").hidden = true;
  $("#result-panel").hidden = false;
  $("#progress-bar").style.width = "100%";
  $("#result-score").textContent = state.score;
  $("#result-total").textContent = state.queue.length;
  const ratio = state.score / state.queue.length;
  $("#result-title").textContent = ratio === 1 ? "Hoàn hảo!" : ratio >= 0.7 ? "Bạn đang làm rất tốt." : "Một bước nữa là sẽ nhớ.";
  const usesHanVietCharacters = state.queue.some((word) => word.hanVietCharacter);
  $("#result-copy").textContent = state.incorrect.length
    ? `Đánh dấu ${state.incorrect.length} ${usesHanVietCharacters ? "chữ Hán" : "từ"} bên dưới để quay lại ôn ngay lúc còn nhớ.`
    : "Bạn đã trả lời đúng tất cả. Thử một bài khác để giữ nhịp!";
  const review = $("#review-list");
  review.textContent = "";
  state.incorrect.slice(0, 5).forEach((word) => {
    const item = document.createElement("div");
    item.className = "review-item";
    const meaning = document.createElement("span");
    const answer = document.createElement("strong");
    meaning.textContent = word.hanVietCharacter
      ? `${word.kanji} trong ${word.sourceWord.kanji} · ${word.sourceWord.meaning}`
      : word.meaning;
    answer.textContent = modes[state.selectedMode].answer(word);
    item.append(meaning, answer);
    review.append(item);
  });
  updateOverview();
  renderLessons();
}

function closePractice() {
  dialog.close();
  updateOverview();
  renderLessons();
}

async function initialize() {
  try {
    const registryResponse = await fetch(PACK_REGISTRY_URL);
    if (!registryResponse.ok) throw new Error("Không thể nạp danh sách gói dữ liệu");
    state.registry = await registryResponse.json();
    const packEntry = state.registry.packs.find((pack) => pack.id === state.registry.defaultPackId);
    if (!packEntry) throw new Error("Không tìm thấy gói dữ liệu mặc định");
    const manifestResponse = await fetch(packEntry.manifest);
    if (!manifestResponse.ok) throw new Error("Không thể nạp thông tin gói dữ liệu");
    state.pack = await manifestResponse.json();
    const dataResponse = await fetch(new URL(state.pack.content.path, manifestResponse.url));
    if (!dataResponse.ok) throw new Error("Không thể nạp dữ liệu từ vựng");
    state.words = toWords(await dataResponse.text(), state.pack);
    if (!state.words.length) throw new Error("Du lieu tu vung trong");
  } catch (error) {
    console.error(error);
  }
  try {
    applyImportedLists(await loadImportedLists());
  } catch {
    $("#import-csv-status").textContent = "Không thể đọc danh sách CSV đã lưu trong trình duyệt.";
  }
  loadFlaggedWords();
  $("#lesson-total").textContent = new Set(state.words.map((word) => word.unit)).size;
  if (state.words.length) {
    setUnit(sortUnits(new Set(state.words.map((word) => word.unit)))[0]);
  } else {
    renderLessonTypeFilter();
    lessonGrid.innerHTML = `<p class="loading">Không thể nạp dữ liệu. Hãy chạy <code>python3 server.py</code> rồi mở app, hoặc nhập danh sách CSV của bạn.</p>`;
  }
  updateOverview();
  renderFlaggedWords();
  $("#open-csv-import").disabled = false;
  $("#import-csv-storage-help").textContent = state.csvStorage === "server"
    ? "Khi thêm danh sách, file CSV và thông tin danh sách được tự lưu vào thư mục imported-lists/ trong dự án. Mở app lần sau sẽ tự nạp lại, kể cả khi đổi trình duyệt."
    : state.csvStorage === "unavailable"
      ? "Chưa đọc được nơi lưu CSV trong dự án. Hãy kiểm tra server rồi tải lại trang."
      : "Danh sách và nội dung CSV chỉ được lưu trong trình duyệt này. Để tự lưu file vào dự án, hãy chạy python3 server.py rồi mở địa chỉ server hiển thị.";
}

$("#open-csv-import").addEventListener("click", openCsvImport);
$("#close-csv-import").addEventListener("click", () => importDialog.close());
$("#cancel-csv-import").addEventListener("click", () => importDialog.close());
$("#import-csv-file").addEventListener("change", readCsvImport);
$("#import-csv-type").addEventListener("change", toggleCustomListType);
$("#import-csv-form").addEventListener("submit", saveCsvImport);
$("#lesson-type-filter").addEventListener("change", (event) => setLessonTypeFilter(event.target.value));
importDialog.addEventListener("close", () => { importReadVersion += 1; });
importDialog.addEventListener("cancel", (event) => { if (importSaving) event.preventDefault(); });
importDialog.addEventListener("click", (event) => { if (event.target === importDialog && !importSaving) importDialog.close(); });

lessonGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".lesson-card");
  if (!card) return;
  if (state.isSelectingStudyScope) toggleStudyUnit(card.dataset.unit);
  else setUnit(card.dataset.unit);
});
$("#toggle-study-scope").addEventListener("click", toggleStudyScopeSelection);
$("#shuffle-study-scope").addEventListener("change", (event) => {
  state.shuffleStudyScope = event.target.checked;
  renderStudyScope();
});
$("#mode-grid").addEventListener("click", (event) => {
  const card = event.target.closest(".mode-card");
  if (card) setMode(card.dataset.mode);
});
document.querySelectorAll('input[name="hanviet-granularity"]').forEach((input) => {
  input.addEventListener("change", () => {
    if (input.checked) setHanVietPracticeScope(input.value);
  });
});
$("#start-button").addEventListener("click", () => startPractice());
$("#continue-button").addEventListener("click", () => startPractice());
$("#start-flashcards").addEventListener("click", () => startFlashcards());
$("#open-flagged-words").addEventListener("click", openFlaggedWords);
$("#close-flagged-words").addEventListener("click", closeFlaggedWords);
$("#start-flagged-flashcards").addEventListener("click", startFlaggedFlashcards);
flaggedWordsDialog.addEventListener("click", (event) => { if (event.target === flaggedWordsDialog) closeFlaggedWords(); });
$("#answer-form").addEventListener("submit", (event) => { event.preventDefault(); checkAnswer(); });
$("#kanji-check-button").addEventListener("click", () => checkAnswer(selectedKanjiAnswer()));
$("#kanji-clear-button").addEventListener("click", clearKanjiAnswer);
$("#hint-button").addEventListener("click", revealAnswer);
$("#toggle-practice-flag").addEventListener("click", () => toggleWordFlag(state.queue[state.index]));
$("#next-button").addEventListener("click", nextQuestion);
$("#close-practice").addEventListener("click", closePractice);
$("#finish-button").addEventListener("click", closePractice);
$("#retry-button").addEventListener("click", () => startPractice(state.incorrect.length ? state.incorrect : state.queue));
dialog.addEventListener("click", (event) => { if (event.target === dialog) closePractice(); });

flashcardCard.addEventListener("click", () => {
  if (ignoreFlashcardClick) {
    ignoreFlashcardClick = false;
    return;
  }
  toggleFlashcard();
});
flashcardCard.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") return;
  flashcardPointerStart = { x: event.clientX, y: event.clientY };
});
flashcardCard.addEventListener("pointerup", (event) => {
  if (!flashcardPointerStart) return;
  const deltaX = event.clientX - flashcardPointerStart.x;
  const deltaY = event.clientY - flashcardPointerStart.y;
  flashcardPointerStart = null;
  if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
  ignoreFlashcardClick = true;
  if (deltaX < 0 && flashcardState.isFlipped) moveFlashcard(1);
  if (deltaX > 0) moveFlashcard(-1);
});
flashcardCard.addEventListener("pointercancel", () => { flashcardPointerStart = null; });
$("#flashcard-previous").addEventListener("click", () => moveFlashcard(-1));
$("#flashcard-review").addEventListener("click", () => markFlashcard("review"));
$("#flashcard-known").addEventListener("click", () => markFlashcard("known"));
$("#toggle-flashcard-flag").addEventListener("click", () => toggleWordFlag(flashcardState.deck[flashcardState.index]));
$("#shuffle-flashcards").addEventListener("click", shuffleFlashcards);
$("#close-flashcards").addEventListener("click", closeFlashcards);
$("#finish-flashcards").addEventListener("click", closeFlashcards);
$("#retry-flashcards").addEventListener("click", () => {
  const reviewWords = flashcardState.deck.filter((word) => flashcardState.reviewIds.has(word.id));
  startFlashcards(reviewWords.length ? reviewWords : flashcardState.deck, flashcardState.label);
});
flashcardDialog.addEventListener("click", (event) => { if (event.target === flashcardDialog) closeFlashcards(); });

window.addEventListener("storage", async (event) => {
  if (event.key === IMPORTED_LISTS_STORAGE_KEY || event.key === null) {
    try {
      const version = importedListsVersion;
      const browserLists = decodeImportedLists(localStorage.getItem(IMPORTED_LISTS_STORAGE_KEY));
      const lists = state.csvStorage === "server" ? mergeImportedLists(await serverImportedLists(), browserLists) : browserLists;
      if (version !== importedListsVersion) return;
      applyImportedLists(lists);
      state.studyUnits = new Set(getStudyUnits());
      if (!state.studyUnits.size && state.words.length) state.studyUnits.add(sortUnits(new Set(state.words.map((word) => word.unit)))[0]);
      state.selectedUnit = getStudyUnits()[0] || "";
      refreshStudyScope();
      renderFlaggedWords();
    } catch {
      $("#import-csv-status").textContent = "Không thể đồng bộ danh sách CSV đã lưu từ tab khác.";
    }
  }
  if (event.key !== FLAGGED_WORDS_STORAGE_KEY && event.key !== null) return;
  loadFlaggedWords();
  renderFlaggedWords();
  renderFlagToggles();
});

initialize();
