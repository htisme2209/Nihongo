import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import * as vocabularyCsv from "../vocabulary-csv.mjs";

const { parseVocabularyCsv, suggestListName, decodeImportedLists, importedListWords, IMPORTED_LISTS_STORAGE_KEY } = vocabularyCsv;
const sample = readFileSync(new URL("../tuvungbai26.csv", import.meta.url), "utf8");
const words = parseVocabularyCsv(sample);

test("imports all 46 sample rows, preserving homophones, punctuation and missing answers", () => {
  assert.equal(words.length, 46);
  assert.deepEqual(words[0], { hiragana: "みます", kanji: "見ます", hanViet: "KIẾN", meaning: "xem, nhìn" });
  assert.equal(words[1].hiragana, words[0].hiragana);
  assert.equal(words[1].kanji, "診ます");
  assert.equal(words[4].kanji, "[時間に～]遅れます");
  assert.equal(words.filter((word) => !word.kanji && !word.hanViet).length, 12);
  assert.equal(words.at(-1).meaning, "nhà du hành vũ trụ");
});

test("handles BOM, CRLF, blank lines, quoted commas, escaped quotes and multiline fields", () => {
  const result = parseVocabularyCsv('\uFEFF\r\n"かな","字 | ÂM | một, ""hai""\r\nba"\r\n\r\nごみ, | — | rác\r\n');
  assert.equal(result.length, 2);
  assert.equal(result[0].meaning, 'một, "hai"\nba');
  assert.equal(result[1].kanji, "");
  assert.equal(result[1].hanViet, "");
});

test("rejects invalid files with useful line numbers before returning partial data", () => {
  for (const [csv, error] of [
    ["\uFEFF\r\n  ", /chưa có từ/],
    ['かな,"字 | ÂM | chưa đóng', /Dòng 1.*chưa đóng/],
    ['かな,字 | ÂM | một, hai', /Dòng 1.*2 cột/],
    ['かな,"字 | ÂM | nghĩa"x', /Dòng 1.*ngoặc kép/],
    ['か"な,字 | ÂM | nghĩa', /Dòng 1.*ngoặc kép/],
    ['かな,字 | nghĩa', /Dòng 1.*cột 2/],
    ['かな,字 | ÂM | nghĩa | thừa', /Dòng 1.*cột 2/],
    ['かな,字 | ÂM | ', /Dòng 1.*thiếu/],
    [' ,字 | ÂM | nghĩa', /Dòng 1.*thiếu/],
    ['かな,"字 | ÂM | nhiều\ndòng"\n\ninvalid', /Dòng 4.*2 cột/],
  ]) assert.throws(() => parseVocabularyCsv(csv), error);
});

test("enforces file and word limits", () => {
  assert.throws(() => parseVocabularyCsv("a".repeat(vocabularyCsv.MAX_CSV_BYTES + 1)), /2 MB/);
  assert.throws(() => parseVocabularyCsv("かな, | | nghĩa\n".repeat(5001)), /5.000/);
  assert.equal(parseVocabularyCsv("かな, | | nghĩa\n".repeat(5000)).length, 5000);
});

test("suggests names and preserves stable, isolated word IDs across storage round trips", () => {
  assert.equal(suggestListName("tuvungbai26.csv"), "Bài 26");
  assert.equal(suggestListName("từ_vựng_bài_027.CSV"), "Bài 27");
  assert.equal(suggestListName("my-list.csv"), "my list");
  const list = { id: "csv-test-26", name: "Bài 26", words };
  const restored = decodeImportedLists(JSON.stringify({ version: 1, lists: [list] }));
  assert.deepEqual(importedListWords(restored[0]), importedListWords(list));
  const records = importedListWords(list);
  assert.equal(new Set(records.map((word) => word.id)).size, 46);
  assert.equal(records[0].unit, "csv-test-26");
  assert.equal(records[0].sourceId, "1");
  assert.notEqual(importedListWords({ ...list, id: "csv-another" })[0].id, records[0].id);
});

test("rejects malformed saved lists and duplicate IDs", () => {
  assert.deepEqual(decodeImportedLists(null), []);
  const list = { id: "csv-test", name: "Bài 26", words };
  for (const value of ["{}", "invalid", '{"version":2,"lists":[]}',
    JSON.stringify({ version: 1, lists: [list, list] }),
    JSON.stringify({ version: 1, lists: [{ ...list, words: [{}] }] }),
    JSON.stringify({ version: 1, lists: [{ ...list, id: "1" }] }),
  ]) assert.throws(() => decodeImportedLists(value));
});

// Minimal DOM for checking rendered lesson cards and filter options without a browser.
function domElement() {
  const queries = new Map();
  const classes = new Set();
  let text = "";
  return {
    value: "", files: [], disabled: false, hidden: false, required: false,
    children: [], dataset: {}, style: {}, attributes: {},
    get textContent() { return text; },
    set textContent(value) { text = value; this.children = []; },
    append(child) { this.children.push(child); },
    addEventListener() {}, focus() {}, close() {},
    setAttribute(key, value) { this.attributes[key] = value; },
    querySelector(selector) {
      if (!queries.has(selector)) queries.set(selector, domElement());
      return queries.get(selector);
    },
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains: (name) => classes.has(name),
    },
  };
}

function application(savedStorage = new Map()) {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, domElement());
    return elements.get(selector);
  };
  element("#lesson-template").content = { cloneNode: domElement };
  element("#import-csv-type").value = vocabularyCsv.listTypeKey(vocabularyCsv.BUILTIN_LIST_TYPE);
  const windowListeners = new Map();
  const storage = {
    getItem: (key) => savedStorage.get(key) ?? null,
    setItem: (key, value) => { savedStorage.set(key, value); },
  };
  const context = vm.createContext({
    ...vocabularyCsv, console, URL, TextEncoder, TextDecoder, Uint8Array,
    crypto: webcrypto, localStorage: storage,
    document: { querySelector: element, querySelectorAll: () => [], createElement: domElement },
    window: { addEventListener: (type, callback) => windowListeners.set(type, callback) },
  });
  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8")
    .replace(/^import .*;\n/, "")
    .replace(/\ninitialize\(\);\s*$/, "");
  vm.runInContext(`${source}\n
    refreshStudyScope = () => renderLessons();
    renderFlaggedWords = () => {};
    focusLessonCard = () => {};
    renderImportPreview = () => {};
    updateOverview = () => {};
    globalThis.app = {
      state, initialize, readCsvImport, saveCsvImport, applyImportedLists, eligibleWords, studyWords, displayUnit,
      setUnit, setLessonTypeFilter, visibleLessonUnits, renderImportTypes, toggleCustomListType,
      setImportWords: (words) => { importWords = words; },
    };`, context);
  return { app: context.app, element, storage, savedStorage, context, windowListeners };
}

test("imports a list without replacing built-in words or progress, and restores its study data", async () => {
  const fixture = application(new Map([["kotoba-dojo-progress", '{"1-1":{"attempts":2,"correct":2}}']]));
  const { app, element, savedStorage } = fixture;
  const original = { id: "1-1", packId: "minna", unit: "1", order: 1, hiragana: "もと", meaning: "gốc" };
  app.state.words = [original];
  element("#import-csv-name").value = "Bài 26";
  app.setImportWords(words);
  await app.saveCsvImport({ preventDefault() {} });
  assert.equal(app.state.words.length, 47);
  assert.equal(app.state.words[0], original);
  assert.equal(app.studyWords().length, 46);
  assert.equal(app.displayUnit(app.state.selectedUnit), "Bài 26");
  assert.equal(savedStorage.get("kotoba-dojo-progress"), '{"1-1":{"attempts":2,"correct":2}}');
  assert.match(element("#import-csv-status").textContent, /46 từ/);
  app.state.selectedMode = "kanji";
  assert.equal(app.eligibleWords().length, 34);
  app.state.selectedMode = "hanviet";
  assert.equal(app.eligibleWords().length, 34);
  app.state.studyUnits.add("1");
  assert.equal(app.studyWords().length, 47);
  assert.equal(app.studyWords()[0], original);
  const restored = application(savedStorage);
  restored.app.applyImportedLists(decodeImportedLists(savedStorage.get(IMPORTED_LISTS_STORAGE_KEY)));
  assert.deepEqual(Array.from(restored.app.state.words, (word) => word.id), Array.from(app.state.words.slice(1), (word) => word.id));
});

test("failed storage and duplicate names leave the existing list untouched", async () => {
  const { app, element, storage } = application();
  app.setImportWords(words);
  element("#import-csv-name").value = "Bài 26";
  await app.saveCsvImport({ preventDefault() {} });
  await app.saveCsvImport({ preventDefault() {} });
  assert.match(element("#import-csv-error").textContent, /đã tồn tại/);
  assert.equal(app.state.words.length, 46);
  element("#import-csv-name").value = "Bài 27";
  const before = storage.getItem(IMPORTED_LISTS_STORAGE_KEY);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  await app.saveCsvImport({ preventDefault() {} });
  assert.match(element("#import-csv-error").textContent, /Chưa thể lưu/);
  assert.equal(app.state.words.length, 46);
  assert.equal(storage.getItem(IMPORTED_LISTS_STORAGE_KEY), before);
});

test("reads UTF-8 files, rejects invalid encoding and discards stale file reads", async () => {
  const { app, element } = application();
  const fileInput = element("#import-csv-file");
  let finishFirst;
  fileInput.files = [{ name: "old.csv", size: 10, arrayBuffer: () => new Promise((resolve) => { finishFirst = resolve; }) }];
  const first = app.readCsvImport();
  const bytes = new TextEncoder().encode(sample);
  fileInput.files = [{ name: "tuvungbai26.csv", size: bytes.length, arrayBuffer: async () => bytes.buffer }];
  await app.readCsvImport();
  finishFirst(new TextEncoder().encode("invalid").buffer);
  await first;
  assert.equal(element("#import-csv-name").value, "Bài 26");
  await app.saveCsvImport({ preventDefault() {} });
  assert.equal(app.state.words.length, 46);
  fileInput.files = [{ name: "invalid.csv", size: 1, arrayBuffer: async () => new Uint8Array([0xff]).buffer }];
  await app.readCsvImport();
  assert.match(element("#import-csv-error").textContent, /UTF-8/);
});

test("restores personal lists even when the community pack cannot load", async () => {
  const saved = new Map([[IMPORTED_LISTS_STORAGE_KEY, JSON.stringify({ version: 1, lists: [{ id: "csv-offline", name: "Bài 26", words }] })]]);
  const { app, context, element } = application(saved);
  context.fetch = async () => { throw new Error("offline"); };
  context.console = { error() {} };
  await app.initialize();
  assert.equal(app.state.words.length, 46);
  assert.equal(app.state.selectedUnit, "csv-offline");
  assert.equal(element("#open-csv-import").disabled, false);
});

test("migrates old list types without changing words or IDs and validates saved types", () => {
  const oldList = { id: "csv-old", name: "Bài 26", words };
  const encode = (list) => JSON.stringify({ version: 1, lists: [list] });
  const migrated = decodeImportedLists(encode(oldList))[0];
  assert.equal(migrated.type, vocabularyCsv.DEFAULT_LIST_TYPE);
  assert.deepEqual(importedListWords(migrated), importedListWords(oldList));
  assert.equal(decodeImportedLists(encode({ ...oldList, type: "  JLPT   N5  " }))[0].type, "JLPT N5");
  for (const type of [null, 42, {}, "  ", "a".repeat(51)]) {
    assert.throws(() => decodeImportedLists(encode({ ...oldList, type })));
  }
});

test("filters built-in, legacy and typed lists while preserving study selection and counts", () => {
  const { app, element } = application();
  app.state.words = [{ id: "1-1", packId: "minna", unit: "1", order: 1, hiragana: "もと", meaning: "gốc" }];
  app.applyImportedLists(decodeImportedLists(JSON.stringify({ version: 1, lists: [
    { id: "csv-old", name: "Cũ", words },
    { id: "csv-new", name: "N5", type: "JLPT N5", words },
  ] })));
  app.setUnit("1");
  app.state.studyUnits.add("csv-new");
  const selectedWordIds = Array.from(app.studyWords(), (word) => word.id);
  app.setLessonTypeFilter(vocabularyCsv.listTypeKey("JLPT N5"));
  assert.deepEqual(Array.from(app.visibleLessonUnits()), ["csv-new"]);
  assert.deepEqual(Array.from(app.studyWords(), (word) => word.id), selectedWordIds);
  const grid = element("#lesson-grid");
  assert.equal(grid.children.length, 1);
  assert.equal(grid.children[0].querySelector(".lesson-card").dataset.unit, "csv-new");
  assert.equal(grid.children[0].querySelector(".lesson-type").textContent, "JLPT N5");
  assert.equal(grid.children[0].querySelector(".lesson-card").attributes["aria-pressed"], "true");
  assert.match(element("#lesson-filter-summary").textContent, /1\/3.*1 danh sách ngoài bộ lọc/);
  assert.ok(element("#lesson-type-filter").children.some((option) => option.textContent === "JLPT N5 (1)"));
  app.setLessonTypeFilter(vocabularyCsv.listTypeKey(vocabularyCsv.DEFAULT_LIST_TYPE));
  assert.deepEqual(Array.from(app.visibleLessonUnits()), ["csv-old"]);
  app.setLessonTypeFilter(vocabularyCsv.listTypeKey("JLPT N1"));
  assert.equal(app.visibleLessonUnits().length, 0);
  assert.equal(grid.classList.contains("is-empty"), true);
  assert.match(grid.children[0].textContent, /Chưa có danh sách/);
  app.setLessonTypeFilter("");
  assert.equal(grid.children.length, 3);
  assert.equal(grid.classList.contains("is-empty"), false);
});

test("saves custom types, makes imports visible under an active filter, and reuses types after reload", async () => {
  const { app, element, savedStorage } = application();
  app.setLessonTypeFilter(vocabularyCsv.listTypeKey("JLPT N5"));
  app.setImportWords(words);
  element("#import-csv-name").value = "Công việc";
  element("#import-csv-type").value = "new";
  element("#import-csv-new-type").value = "  Giao tiếp   công việc ";
  app.toggleCustomListType();
  assert.equal(element("#import-csv-new-type-field").hidden, false);
  assert.equal(element("#import-csv-new-type").required, true);
  await app.saveCsvImport({ preventDefault() {} });
  const key = vocabularyCsv.listTypeKey("Giao tiếp công việc");
  assert.equal(app.state.lessonTypeFilter, key);
  assert.equal(app.visibleLessonUnits()[0], app.state.selectedUnit);
  const saved = decodeImportedLists(savedStorage.get(IMPORTED_LISTS_STORAGE_KEY));
  assert.equal(saved[0].type, "Giao tiếp công việc");
  const restored = application(savedStorage);
  restored.app.applyImportedLists(saved);
  restored.app.renderImportTypes();
  assert.ok(restored.element("#import-csv-type").children.some((option) => option.value === key && option.textContent === "Giao tiếp công việc"));
  restored.app.setImportWords(words);
  restored.element("#import-csv-name").value = "Công việc 2";
  restored.element("#import-csv-type").value = "new";
  restored.element("#import-csv-new-type").value = "giao TIẾP công việc";
  await restored.app.saveCsvImport({ preventDefault() {} });
  assert.equal(restored.app.state.importedLists[1].type, saved[0].type);
  restored.app.renderImportTypes();
  assert.equal(restored.element("#import-csv-type").children.filter((option) => option.value === key).length, 1);
  assert.equal(restored.element("#import-csv-new-type-field").hidden, true);
  assert.equal(restored.element("#import-csv-new-type").disabled, true);
});

test("rejects an empty custom type or invalid selection before saving", async () => {
  const { app, element, savedStorage } = application();
  app.setImportWords(words);
  element("#import-csv-name").value = "Bài 26";
  element("#import-csv-type").value = "new";
  element("#import-csv-new-type").value = "   ";
  await app.saveCsvImport({ preventDefault() {} });
  assert.match(element("#import-csv-error").textContent, /1 đến 50/);
  assert.equal(savedStorage.has(IMPORTED_LISTS_STORAGE_KEY), false);
  element("#import-csv-type").value = "invalid";
  await app.saveCsvImport({ preventDefault() {} });
  assert.match(element("#import-csv-error").textContent, /chọn loại/);
  assert.equal(app.state.words.length, 0);
});

test("allows the same list name across types but rejects duplicates within a type", async () => {
  const { app, element } = application();
  app.setImportWords(words);
  element("#import-csv-name").value = "Bài 01";
  for (const type of ["JLPT N5", "JLPT N4"]) {
    element("#import-csv-type").value = vocabularyCsv.listTypeKey(type);
    await app.saveCsvImport({ preventDefault() {} });
  }
  assert.equal(app.state.importedLists.length, 2);
  assert.notEqual(app.state.importedLists[0].id, app.state.importedLists[1].id);
  await app.saveCsvImport({ preventDefault() {} });
  assert.equal(app.state.importedLists.length, 2);
  assert.match(element("#import-csv-error").textContent, /đã tồn tại trong loại này/);
});

test("synchronizes imported types from another tab and clears a removed custom filter", () => {
  const { app, element, storage, windowListeners } = application();
  const list = { id: "csv-synced", name: "Du lịch", type: "Du lịch", words };
  storage.setItem(IMPORTED_LISTS_STORAGE_KEY, JSON.stringify({ version: 1, lists: [list] }));
  windowListeners.get("storage")({ key: IMPORTED_LISTS_STORAGE_KEY });
  app.setLessonTypeFilter(vocabularyCsv.listTypeKey("Du lịch"));
  assert.equal(app.visibleLessonUnits().length, 1);
  assert.ok(element("#lesson-type-filter").children.some((option) => option.textContent === "Du lịch (1)"));
  storage.setItem(IMPORTED_LISTS_STORAGE_KEY, JSON.stringify({ version: 1, lists: [] }));
  windowListeners.get("storage")({ key: IMPORTED_LISTS_STORAGE_KEY });
  assert.equal(app.state.lessonTypeFilter, "");
  assert.equal(element("#lesson-type-filter").value, "");
});

function apiResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300, status,
    headers: { get: () => "application/json" },
    json: async () => value,
    text: async () => JSON.stringify(value),
  };
}

function connectListServer(fixture, lists = [], onPost) {
  fixture.context.console = { error() {} };
  fixture.context.fetch = async (url, options = {}) => {
    if (String(url) !== "/api/imported-lists") throw new Error("Community pack unavailable");
    if (options.method === "POST") {
      const list = JSON.parse(options.body);
      if (onPost) return onPost(list);
      lists.push(list);
      return apiResponse({ version: 1, lists }, 201);
    }
    return apiResponse({ version: 1, lists });
  };
}

async function selectCsv(fixture, text = sample, filename = "tuvungbai26.csv") {
  const bytes = new TextEncoder().encode(text);
  fixture.element("#import-csv-file").files = [{
    name: filename, size: bytes.length, arrayBuffer: async () => bytes.buffer,
  }];
  await fixture.app.readCsvImport();
}

test("saves the original CSV to the server and restores IDs and types in a fresh browser", async () => {
  const lists = [];
  const fixture = application();
  connectListServer(fixture, lists);
  await fixture.app.initialize();
  assert.equal(fixture.app.state.csvStorage, "server");
  const text = "\uFEFF" + sample.replace(/\r?\n/g, "\r\n");
  await selectCsv(fixture, text, "từ-vựng.csv");
  fixture.element("#import-csv-name").value = "Bài mới";
  fixture.element("#import-csv-type").value = "new";
  fixture.element("#import-csv-new-type").value = "JLPT N5";
  await fixture.app.saveCsvImport({ preventDefault() {} });
  assert.equal(lists.length, 1);
  assert.deepEqual(lists[0].csv, { filename: "từ-vựng.csv", text });
  assert.equal(lists[0].type, "JLPT N5");
  const fresh = application();
  connectListServer(fresh, lists);
  await fresh.app.initialize();
  assert.equal(fresh.app.state.importedLists[0].id, lists[0].id);
  assert.equal(fresh.app.state.importedLists[0].type, "JLPT N5");
  assert.deepEqual(Array.from(fresh.app.state.words, (word) => word.id), Array.from(fixture.app.state.words, (word) => word.id));
});

test("server write failures preserve existing lists and do not report successful import", async () => {
  const existing = { id: "csv-existing", name: "Đã lưu", type: "JLPT N5", words };
  const fixture = application();
  connectListServer(fixture, [existing], () => apiResponse({ error: "Disk is full" }, 500));
  await fixture.app.initialize();
  await selectCsv(fixture);
  const previousStatus = fixture.element("#import-csv-status").textContent;
  await fixture.app.saveCsvImport({ preventDefault() {} });
  assert.equal(fixture.app.state.importedLists.length, 1);
  assert.equal(fixture.app.state.importedLists[0].id, existing.id);
  assert.equal(fixture.element("#import-csv-status").textContent, previousStatus);
  assert.ok(fixture.element("#import-csv-error").textContent);
});

test("submitting again while the server saves writes only once", async () => {
  const fixture = application();
  let finish;
  let writes = 0;
  connectListServer(fixture, [], (list) => {
    writes += 1;
    return new Promise((resolve) => { finish = () => resolve(apiResponse({ version: 1, lists: [list] }, 201)); });
  });
  await fixture.app.initialize();
  await selectCsv(fixture);
  const first = fixture.app.saveCsvImport({ preventDefault() {} });
  const second = fixture.app.saveCsvImport({ preventDefault() {} });
  assert.equal(writes, 1);
  finish();
  await Promise.all([first, second]);
  assert.equal(fixture.app.state.importedLists.length, 1);
});

test("migrates browser lists to disk while preserving IDs, custom types and progress", async () => {
  const legacy = { id: "csv-legacy", name: "Cũ", type: "Tự học", words };
  const progress = '{"csv-legacy-1":{"attempts":3,"correct":2}}';
  const saved = new Map([
    [IMPORTED_LISTS_STORAGE_KEY, JSON.stringify({ version: 1, lists: [legacy] })],
    ["kotoba-dojo-progress", progress],
  ]);
  const fixture = application(saved);
  const serverLists = [];
  connectListServer(fixture, serverLists);
  await fixture.app.initialize();
  assert.equal(serverLists.length, 1);
  assert.equal(serverLists[0].id, legacy.id);
  assert.equal(serverLists[0].type, legacy.type);
  assert.deepEqual(serverLists[0].words, words);
  assert.equal(saved.get("kotoba-dojo-progress"), progress);
  assert.equal(fixture.app.state.words.length, words.length);
});

test("server lists load even when browser storage is blocked", async () => {
  const fixture = application();
  fixture.storage.getItem = () => { throw new Error("Storage blocked"); };
  fixture.storage.setItem = () => { throw new Error("Storage blocked"); };
  connectListServer(fixture, [{ id: "csv-disk", name: "Trên máy", type: "JLPT N5", words }]);
  await fixture.app.initialize();
  assert.equal(fixture.app.state.csvStorage, "server");
  assert.equal(fixture.app.state.importedLists[0].id, "csv-disk");
  assert.equal(fixture.app.state.words.length, words.length);
});

test("a failed migration keeps browser-only lists visible alongside server lists", async () => {
  const local = { id: "csv-local", name: "Trong trình duyệt", type: "Tự học", words };
  const remote = { id: "csv-remote", name: "Trên máy", type: "JLPT N5", words };
  const fixture = application(new Map([[IMPORTED_LISTS_STORAGE_KEY, JSON.stringify({ version: 1, lists: [local] })]]));
  connectListServer(fixture, [remote], () => apiResponse({ error: "Disk is full" }, 500));
  await fixture.app.initialize();
  assert.deepEqual(Array.from(fixture.app.state.importedLists, (list) => list.id).sort(), [local.id, remote.id].sort());
  assert.ok(fixture.element("#import-csv-status").textContent);
  assert.equal(decodeImportedLists(fixture.savedStorage.get(IMPORTED_LISTS_STORAGE_KEY))[0].id, local.id);
});

test("a genuine API error prevents an import from claiming disk persistence", async () => {
  const fixture = application();
  fixture.context.console = { error() {} };
  fixture.context.fetch = async (url) => {
    if (String(url) === "/api/imported-lists") return apiResponse({ error: "Cannot read saved lists" }, 500);
    throw new Error("Community pack unavailable");
  };
  await fixture.app.initialize();
  assert.equal(fixture.app.state.csvStorage, "unavailable");
  await selectCsv(fixture);
  await fixture.app.saveCsvImport({ preventDefault() {} });
  assert.equal(fixture.app.state.importedLists.length, 0);
  assert.equal(fixture.savedStorage.has(IMPORTED_LISTS_STORAGE_KEY), false);
  assert.ok(fixture.element("#import-csv-error").textContent);
});

test("an ordinary static server retains browser persistence", async () => {
  const fixture = application();
  fixture.context.console = { error() {} };
  fixture.context.fetch = async () => ({ ok: false, status: 404, json: async () => { throw new Error("HTML response"); } });
  await fixture.app.initialize();
  assert.equal(fixture.app.state.csvStorage, "browser");
  await selectCsv(fixture);
  await fixture.app.saveCsvImport({ preventDefault() {} });
  assert.equal(decodeImportedLists(fixture.savedStorage.get(IMPORTED_LISTS_STORAGE_KEY)).length, 1);
});

test("rejects successful POST responses that omit or alter the submitted list", async () => {
  for (const responseLists of [() => [], (list) => [{ ...list, words: [{ ...list.words[0], meaning: "changed" }] }]]) {
    const fixture = application();
    connectListServer(fixture, [], (list) => apiResponse({ version: 1, lists: responseLists(list) }));
    await fixture.app.initialize();
    await selectCsv(fixture);
    const status = fixture.element("#import-csv-status").textContent;
    await fixture.app.saveCsvImport({ preventDefault() {} });
    assert.equal(fixture.app.state.importedLists.length, 0);
    assert.equal(fixture.element("#import-csv-status").textContent, status);
    assert.ok(fixture.element("#import-csv-error").textContent);
    assert.equal(fixture.savedStorage.has(IMPORTED_LISTS_STORAGE_KEY), false);
  }
});

test("a delayed storage refresh cannot replace a newly imported list", async () => {
  const fixture = application();
  connectListServer(fixture);
  await fixture.app.initialize();
  let finishRefresh;
  fixture.context.fetch = async (_url, options = {}) => {
    if (options.method === "POST") return apiResponse({ version: 1, lists: [JSON.parse(options.body)] }, 201);
    return new Promise((resolve) => { finishRefresh = () => resolve(apiResponse({ version: 1, lists: [] })); });
  };
  const refresh = fixture.windowListeners.get("storage")({ key: IMPORTED_LISTS_STORAGE_KEY });
  await selectCsv(fixture);
  await fixture.app.saveCsvImport({ preventDefault() {} });
  const savedId = fixture.app.state.selectedUnit;
  finishRefresh();
  await refresh;
  assert.equal(fixture.app.state.importedLists.length, 1);
  assert.equal(fixture.app.state.importedLists[0].id, savedId);
  assert.equal(fixture.app.state.selectedUnit, savedId);
});

test("saving a new list preserves original CSV for lists whose migration failed", async () => {
  const local = { id: "csv-local-source", name: "Legacy", type: "Tự học", words, csv: { filename: "original.csv", text: "\uFEFF" + sample } };
  const fixture = application(new Map([[IMPORTED_LISTS_STORAGE_KEY, JSON.stringify({ version: 1, lists: [local] })]]));
  connectListServer(fixture, [], (list) => list.id === local.id
    ? apiResponse({ error: "Cannot migrate" }, 500)
    : apiResponse({ version: 1, lists: [list] }, 201));
  await fixture.app.initialize();
  await selectCsv(fixture);
  await fixture.app.saveCsvImport({ preventDefault() {} });
  const cached = decodeImportedLists(fixture.savedStorage.get(IMPORTED_LISTS_STORAGE_KEY));
  assert.equal(cached.length, 2);
  assert.deepEqual(cached.find((list) => list.id === local.id).csv, local.csv);
  assert.equal(cached.find((list) => list.id !== local.id).csv, undefined);
});

test("stale and invalid file reads cannot attach old CSV source to a later import", async () => {
  const fixture = application();
  const saved = [];
  connectListServer(fixture, saved);
  await fixture.app.initialize();
  let finishOld;
  fixture.element("#import-csv-file").files = [{ name: "old.csv", size: 10, arrayBuffer: () => new Promise((resolve) => { finishOld = resolve; }) }];
  const oldRead = fixture.app.readCsvImport();
  await selectCsv(fixture, sample, "current.csv");
  finishOld(new TextEncoder().encode("かな, | | old").buffer);
  await oldRead;
  await fixture.app.saveCsvImport({ preventDefault() {} });
  assert.deepEqual(saved[0].csv, { filename: "current.csv", text: sample });

  await selectCsv(fixture, "invalid", "invalid.csv");
  await fixture.app.saveCsvImport({ preventDefault() {} });
  assert.equal(saved.length, 1);
  fixture.app.setImportWords(words);
  fixture.element("#import-csv-name").value = "Without a file";
  await fixture.app.saveCsvImport({ preventDefault() {} });
  assert.equal(saved.length, 2);
  assert.equal(saved[1].csv, undefined);
});
