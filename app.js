const ANSWER_DATA_FILE = "minna_bai1_25_nghia_dap_an_kanji_hanviet.csv";

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
    description: "Nhìn nghĩa và cách đọc, nhớ Hán tự.",
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
};

const $ = (selector) => document.querySelector(selector);
const lessonGrid = $("#lesson-grid");
const dialog = $("#practice-dialog");

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
  state.answered = false;
  $("#progress-text").textContent = `Câu ${state.index + 1} / ${state.queue.length}`;
  $("#progress-bar").style.width = `${(state.index / state.queue.length) * 100}%`;
  $("#score-value").textContent = state.score;
  $("#quiz-mode-label").textContent = mode.label;
  $("#prompt-label").textContent = mode.promptLabel;
  $("#practice-title").textContent = mode.prompt(word);
  $("#question-support").textContent = mode.support(word);
  $("#answer-input").value = "";
  $("#answer-input").placeholder = `Nhập ${mode.answerLabel.toLocaleLowerCase("vi-VN")}...`;
  $("#answer-input").disabled = false;
  $("#check-button").hidden = false;
  $("#feedback").hidden = true;
  $("#hint-button").hidden = false;
  requestAnimationFrame(() => {
    const input = $("#answer-input");
    input.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 760px)").matches) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
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
  $("#answer-input").value = mode.answer(word);
  $("#answer-input").disabled = true;
  $("#check-button").hidden = true;
  $("#hint-button").hidden = true;
  const feedback = $("#feedback");
  feedback.hidden = false;
  feedback.className = "feedback incorrect";
  $("#feedback-title").textContent = "Đáp án đã hiện. Hãy quay lại ôn từ này nhé.";
  $("#answer-reveal").textContent = `${mode.answerLabel}: ${mode.answer(word)}  ·  Nghĩa: ${word.meaning}`;
  $("#next-button").focus();
}

function checkAnswer() {
  if (state.answered) return;
  const word = state.queue[state.index];
  const mode = modes[state.selectedMode];
  const correct = normalize($("#answer-input").value) === normalize(mode.answer(word));
  state.answered = true;
  saveProgress(word.id, correct);
  if (correct) state.score += 1;
  else state.incorrect.push(word);

  $("#answer-input").disabled = true;
  $("#check-button").hidden = true;
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
$("#answer-form").addEventListener("submit", (event) => { event.preventDefault(); checkAnswer(); });
$("#hint-button").addEventListener("click", revealAnswer);
$("#next-button").addEventListener("click", nextQuestion);
$("#close-practice").addEventListener("click", closePractice);
$("#finish-button").addEventListener("click", closePractice);
$("#retry-button").addEventListener("click", () => startPractice(state.incorrect.length ? state.incorrect : state.queue));
dialog.addEventListener("click", (event) => { if (event.target === dialog) closePractice(); });

initialize();
