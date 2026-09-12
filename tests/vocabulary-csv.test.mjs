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

// Exercise the application state and event handlers without a browser dependency.
// Rendering is stubbed; these checks cover import, persistence and study integration.
function application(savedStorage = new Map()) {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      value: "", textContent: "", files: [], disabled: false,
      addEventListener() {}, focus() {}, close() {}, setAttribute() {},
    });
    return elements.get(selector);
  };
  const storage = {
    getItem: (key) => savedStorage.get(key) ?? null,
    setItem: (key, value) => { savedStorage.set(key, value); },
  };
  const context = vm.createContext({
    ...vocabularyCsv, console, URL, TextEncoder, TextDecoder, Uint8Array,
    crypto: webcrypto, localStorage: storage,
    document: { querySelector: element, querySelectorAll: () => [] },
    window: { addEventListener() {} },
  });
  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8")
    .replace(/^import .*;\n/, "")
    .replace(/\ninitialize\(\);\s*$/, "");
  vm.runInContext(`${source}\n
    refreshStudyScope = () => {};
    renderFlaggedWords = () => {};
    focusLessonCard = () => {};
    renderImportPreview = () => {};
    updateOverview = () => {};
    globalThis.app = {
      state, initialize, readCsvImport, saveCsvImport, applyImportedLists, eligibleWords, studyWords, displayUnit,
      setImportWords: (words) => { importWords = words; },
    };`, context);
  return { app: context.app, element, storage, savedStorage, context };
}

test("imports a list without replacing built-in words or progress, and restores its study data", () => {
  const fixture = application(new Map([["kotoba-dojo-progress", '{"1-1":{"attempts":2,"correct":2}}']]));
  const { app, element, savedStorage } = fixture;
  const original = { id: "1-1", packId: "minna", unit: "1", order: 1, hiragana: "もと", meaning: "gốc" };
  app.state.words = [original];
  element("#import-csv-name").value = "Bài 26";
  app.setImportWords(words);
  app.saveCsvImport({ preventDefault() {} });
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

test("failed storage and duplicate names leave the existing list untouched", () => {
  const { app, element, storage } = application();
  app.setImportWords(words);
  element("#import-csv-name").value = "Bài 26";
  app.saveCsvImport({ preventDefault() {} });
  app.saveCsvImport({ preventDefault() {} });
  assert.match(element("#import-csv-error").textContent, /đã tồn tại/);
  assert.equal(app.state.words.length, 46);
  element("#import-csv-name").value = "Bài 27";
  const before = storage.getItem(IMPORTED_LISTS_STORAGE_KEY);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  app.saveCsvImport({ preventDefault() {} });
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
  app.saveCsvImport({ preventDefault() {} });
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
