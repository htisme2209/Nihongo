const ANSWER_DATA_FILE = "minna_bai1_25_nghia_dap_an_kanji_hanviet.csv";
const FLASHCARD_STORAGE_KEY = "kotoba-dojo-flashcard-progress";

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
    support: (word) => `Nghĩa: ${word.meaning}${word.hiragana ? `  ·  ${word.hiragana}` : ""}`,
  },
};

const state = {
  words: [],
  selectedLesson: 1,
  selectedMode: "hiragana",
  queue: [],
  index: 0,
  score: 0,
  answered: false,
  incorrect: [],
  kanjiChoices: [],
  selectedKanjiChoiceIds: [],
};

const flashcardState = {
  deck: [],
  index: 0,
  isFlipped: false,
  knownIds: new Set(),
  reviewIds: new Set(),
};

const $ = (selector) => document.querySelector(selector);
const lessonGrid = $("#lesson-grid");
const dialog = $("#practice-dialog");
const flashcardDialog = $("#flashcard-dialog");
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

function toWords(csv) {
  const [header, ...rows] = parseCsv(csv);
  header[0] = header[0].replace(/^\uFEFF/, "");
  const column = Object.fromEntries(header.map((name, index) => [name, index]));
  return rows.map((row) => ({
    id: `${row[column.Bai]}-${row[column.STT]}`,
    lesson: Number(row[column.Bai]),
    order: Number(row[column.STT]),
    meaning: row[column.Nghia_Tieng_Viet] || "",
    hiragana: row[column.Dap_An_Tieng_Nhat] || "",
    kanji: row[column.Han_Tu] || "",
    hanViet: row[column.Han_Viet] || "",
  })).filter((word) => word.lesson && word.meaning);
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

function progressForLesson(lesson) {
  const words = state.words.filter((word) => word.lesson === lesson);
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
  const lessonNumbers = [...new Set(state.words.map((word) => word.lesson))].sort((a, b) => a - b);

  lessonNumbers.forEach((lesson) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".lesson-card");
    const stats = progressForLesson(lesson);
    card.dataset.lesson = lesson;
    card.classList.toggle("selected", lesson === state.selectedLesson);
    card.setAttribute("aria-pressed", lesson === state.selectedLesson);
    fragment.querySelector(".lesson-number").textContent = `Bài ${String(lesson).padStart(2, "0")}`;
    fragment.querySelector(".lesson-meta strong").textContent = `${stats.total} từ vựng`;
    fragment.querySelector(".lesson-meta small").textContent = stats.mastered ? `${stats.mastered} đã thuộc` : "Sẵn sàng luyện";
    fragment.querySelector(".lesson-progress i").style.width = `${stats.total ? (stats.mastered / stats.total) * 100 : 0}%`;
    lessonGrid.append(fragment);
  });
}

function setLesson(lesson) {
  state.selectedLesson = Number(lesson);
  $(".selected-lesson-label").textContent = `Bài ${state.selectedLesson}`;
  renderLessons();
  updateFlashcardCTA();
}

function setMode(mode) {
  state.selectedMode = mode;
  document.querySelectorAll(".mode-card").forEach((card) => {
    const active = card.dataset.mode === mode;
    card.classList.toggle("active", active);
    card.setAttribute("aria-pressed", active);
  });
  $("#practice-description").textContent = modes[mode].description;
}

function normalize(value) {
  return (value || "")
    .normalize("NFKC")
    .replace(/[\s\-・.]/g, "")
    .toLocaleLowerCase("vi-VN");
}

function eligibleWords() {
  const mode = modes[state.selectedMode];
  return state.words.filter((word) => word.lesson === state.selectedLesson && mode.answer(word) && mode.prompt(word));
}

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5);
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
  const lessonTokens = state.words
    .filter((item) => item.lesson === state.selectedLesson && item.kanji)
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
  return state.words.filter((word) => word.lesson === state.selectedLesson && (word.kanji || word.hiragana));
}

function updateFlashcardCTA() {
  const count = flashcardWords().length;
  $("#flashcard-lesson-label").textContent = `Bài ${state.selectedLesson}`;
  $("#flashcard-count").textContent = count
    ? `${count} thẻ từ vựng. Chạm để lật, rồi tự đánh giá mức độ ghi nhớ.`
    : "Bài này chưa có thẻ từ vựng để hiển thị.";
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

  $("#flashcard-progress-text").textContent = `Bài ${state.selectedLesson} · Thẻ ${flashcardState.index + 1} / ${flashcardState.deck.length}`;
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
}

function startFlashcards(words = null) {
  const candidates = words || flashcardWords();
  if (!candidates.length) {
    alert("Bài này chưa có dữ liệu phù hợp để tạo flashcard.");
    return;
  }
  flashcardState.deck = shuffled(candidates);
  flashcardState.index = 0;
  flashcardState.isFlipped = false;
  flashcardState.knownIds = new Set();
  flashcardState.reviewIds = new Set();
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
    alert("Bài này chưa có dữ liệu phù hợp với chế độ đã chọn.");
    return;
  }
  const countValue = $("#question-count").value;
  const count = countValue === "all" ? candidates.length : Math.min(Number(countValue), candidates.length);
  state.queue = shuffled(candidates).slice(0, count);
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
  state.answered = false;
  $("#progress-text").textContent = `Câu ${state.index + 1} / ${state.queue.length}`;
  $("#progress-bar").style.width = `${(state.index / state.queue.length) * 100}%`;
  $("#score-value").textContent = state.score;
  $("#quiz-mode-label").textContent = mode.label;
  $("#prompt-label").textContent = mode.promptLabel;
  $("#practice-title").textContent = mode.prompt(word);
  $("#question-support").textContent = mode.support(word);
  $("#answer-form").hidden = usesKanjiBuilder;
  $("#kanji-builder").hidden = !usesKanjiBuilder;
  $("#answer-input").value = "";
  $("#answer-input").placeholder = `Nhập ${mode.answerLabel.toLocaleLowerCase("vi-VN")}...`;
  $("#answer-input").disabled = false;
  $("#check-button").hidden = false;
  $("#feedback").hidden = true;
  $("#hint-button").hidden = false;
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
  $("#answer-reveal").textContent = `${mode.answerLabel}: ${mode.answer(word)}  ·  Nghĩa: ${word.meaning}`;
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
  $("#answer-reveal").textContent = `${mode.answerLabel}: ${mode.answer(word)}  ·  Nghĩa: ${word.meaning}`;
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
  $("#result-copy").textContent = state.incorrect.length
    ? `Đánh dấu ${state.incorrect.length} từ bên dưới để quay lại ôn ngay lúc còn nhớ.`
    : "Bạn đã trả lời đúng tất cả. Thử một bài khác để giữ nhịp!";
  const review = $("#review-list");
  review.textContent = "";
  state.incorrect.slice(0, 5).forEach((word) => {
    const item = document.createElement("div");
    item.className = "review-item";
    const meaning = document.createElement("span");
    const answer = document.createElement("strong");
    meaning.textContent = word.meaning;
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
    const response = await fetch(ANSWER_DATA_FILE);
    if (!response.ok) throw new Error("Không thể nạp tệp dữ liệu");
    state.words = toWords(await response.text());
    if (!state.words.length) throw new Error("Du lieu tu vung trong");
    $("#lesson-total").textContent = new Set(state.words.map((word) => word.lesson)).size;
    renderLessons();
    updateFlashcardCTA();
    updateOverview();
  } catch (error) {
    lessonGrid.innerHTML = `<p class="loading">Không thể nạp dữ liệu. Hãy mở trang qua một local server (ví dụ: <code>python -m http.server</code>).</p>`;
    console.error(error);
  }
}

lessonGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".lesson-card");
  if (card) setLesson(card.dataset.lesson);
});
$("#mode-grid").addEventListener("click", (event) => {
  const card = event.target.closest(".mode-card");
  if (card) setMode(card.dataset.mode);
});
$("#start-button").addEventListener("click", () => startPractice());
$("#continue-button").addEventListener("click", () => startPractice());
$("#start-flashcards").addEventListener("click", () => startFlashcards());
$("#answer-form").addEventListener("submit", (event) => { event.preventDefault(); checkAnswer(); });
$("#kanji-check-button").addEventListener("click", () => checkAnswer(selectedKanjiAnswer()));
$("#kanji-clear-button").addEventListener("click", clearKanjiAnswer);
$("#hint-button").addEventListener("click", revealAnswer);
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
$("#shuffle-flashcards").addEventListener("click", shuffleFlashcards);
$("#close-flashcards").addEventListener("click", closeFlashcards);
$("#finish-flashcards").addEventListener("click", closeFlashcards);
$("#retry-flashcards").addEventListener("click", () => {
  const reviewWords = flashcardState.deck.filter((word) => flashcardState.reviewIds.has(word.id));
  startFlashcards(reviewWords.length ? reviewWords : flashcardState.deck);
});
flashcardDialog.addEventListener("click", (event) => { if (event.target === flashcardDialog) closeFlashcards(); });

initialize();
