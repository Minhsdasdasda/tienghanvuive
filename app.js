(function () {
  const bank = window.KOREAN_QUESTION_BANK || [];
  const state = {
    session: [],
    startedAt: 0,
    timerId: null,
    elapsedMs: 0,
    answers: new Map(),
    result: null,
    reviewMode: "wrong"
  };

  const el = {
    bankCount: document.getElementById("bankCount"),
    examSize: document.getElementById("examSize"),
    examLevel: document.getElementById("examLevel"),
    startButton: document.getElementById("startButton"),
    submitButton: document.getElementById("submitButton"),
    retryButton: document.getElementById("retryButton"),
    startPanel: document.getElementById("startPanel"),
    examPanel: document.getElementById("examPanel"),
    resultPanel: document.getElementById("resultPanel"),
    questionForm: document.getElementById("questionForm"),
    timerText: document.getElementById("timerText"),
    progressText: document.getElementById("progressText"),
    progressBar: document.getElementById("progressBar"),
    scoreText: document.getElementById("scoreText"),
    detailText: document.getElementById("detailText"),
    reviewList: document.getElementById("reviewList"),
    wrongOnlyButton: document.getElementById("wrongOnlyButton"),
    allReviewButton: document.getElementById("allReviewButton")
  };

  const skillLabels = {
    listening: "Nghe",
    reading: "Đọc",
    writing: "Viết"
  };

  if (el.bankCount) {
    el.bankCount.textContent = String(bank.length);
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeKorean(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[.,!?'"“”‘’~]/g, "")
      .replace(/\s+/g, "");
  }

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function getQuotas(size) {
    if (size === 104) return { listening: 50, reading: 50, writing: 4 };
    if (size === 30) return { listening: 10, reading: 17, writing: 3 };
    return { listening: 25, reading: 40, writing: 5 };
  }

  function allowedLevels(maxLevel) {
    if (maxLevel === 1) return [1];
    if (maxLevel === 2) return [1, 2];
    return [1, 2, 3];
  }

  function perLevelCounts(total, levels) {
    const shuffledLevels = shuffle(levels);
    const levelBase = Math.floor(total / levels.length);
    const levelRemainder = total % levels.length;
    const counts = { 1: 0, 2: 0, 3: 0 };
    levels.forEach((level) => {
      counts[level] = levelBase;
    });
    for (let i = 0; i < levelRemainder; i += 1) {
      counts[shuffledLevels[i]] += 1;
    }
    return counts;
  }

  function selectBalanced(skill, count, levels) {
    const counts = perLevelCounts(count, levels);
    const selected = [];
    levels.forEach((level) => {
      const pool = shuffle(bank.filter((question) => question.skill === skill && question.level === level));
      selected.push(...pool.slice(0, counts[level]));
    });
    return selected;
  }

  function prepareQuestion(question) {
    const prepared = { ...question };
    if (question.kind === "mc") {
      prepared.shuffledOptions = shuffle(question.options.map((text, index) => ({ text, index })));
    }
    return prepared;
  }

  function buildSession(size, maxLevel) {
    const quotas = getQuotas(size);
    const levels = allowedLevels(maxLevel);
    const picked = [
      ...selectBalanced("listening", quotas.listening, levels),
      ...selectBalanced("reading", quotas.reading, levels),
      ...selectBalanced("writing", quotas.writing, levels)
    ];
    return shuffle(picked).slice(0, size).map(prepareQuestion);
  }

  function renderQuestions() {
    el.questionForm.innerHTML = "";
    state.session.forEach((question, index) => {
      const card = document.createElement("article");
      card.className = "question-card";
      card.dataset.index = String(index);

      const passage = question.passage
        ? `<div class="passage" lang="ko">${escapeHtml(question.passage)}</div>`
        : "";
      const audioButton = question.skill === "listening"
        ? `<button class="audio-button" type="button" data-audio-index="${index}">▶ 듣기</button>`
        : "";

      const answerBlock = question.kind === "mc"
        ? renderOptions(question, index)
        : `<textarea data-writing-index="${index}" spellcheck="false" lang="ko" placeholder="한국어로 쓰세요"></textarea>`;

      card.innerHTML = `
        <div class="question-head">
          <div class="question-number">Câu ${index + 1}</div>
          <div class="tag-row">
            <span class="tag">${skillLabels[question.skill]}</span>
            <span class="tag level">TOPIK ${question.level}</span>
          </div>
        </div>
        ${audioButton}
        ${passage}
        <div class="prompt">${escapeHtml(question.prompt)}</div>
        ${answerBlock}
      `;
      el.questionForm.appendChild(card);
    });
    updateProgress();
  }

  function renderOptions(question, questionIndex) {
    const options = question.shuffledOptions.map((option) => {
      const optionId = `q${questionIndex}_${option.index}`;
      return `
        <label class="option" for="${optionId}">
          <input id="${optionId}" type="radio" name="q${questionIndex}" value="${option.index}" data-question-index="${questionIndex}">
          <span>${escapeHtml(option.text)}</span>
        </label>
      `;
    }).join("");
    return `<div class="options">${options}</div>`;
  }

  function startTimer() {
    clearInterval(state.timerId);
    state.startedAt = Date.now();
    state.elapsedMs = 0;
    el.timerText.textContent = "00:00";
    state.timerId = setInterval(() => {
      state.elapsedMs = Date.now() - state.startedAt;
      el.timerText.textContent = formatTime(state.elapsedMs);
    }, 250);
  }

  function stopTimer() {
    clearInterval(state.timerId);
    state.timerId = null;
    state.elapsedMs = Date.now() - state.startedAt;
    el.timerText.textContent = formatTime(state.elapsedMs);
  }

  function startExam() {
    const size = Number(el.examSize.value);
    const maxLevel = Number(el.examLevel.value);
    state.session = buildSession(size, maxLevel);
    state.answers = new Map();
    state.result = null;
    state.reviewMode = "wrong";
    el.startPanel.classList.add("hidden");
    el.resultPanel.classList.add("hidden");
    el.examPanel.classList.remove("hidden");
    renderQuestions();
    startTimer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function countAnswered() {
    return state.session.reduce((total, question, index) => {
      const answer = state.answers.get(index);
      if (question.kind === "writing") return total + (String(answer || "").trim() ? 1 : 0);
      return total + (answer !== undefined ? 1 : 0);
    }, 0);
  }

  function updateProgress() {
    const answered = countAnswered();
    const total = state.session.length;
    el.progressText.textContent = `Câu ${answered} / ${total}`;
    el.progressBar.style.width = total ? `${Math.round((answered / total) * 100)}%` : "0%";
  }

  function speakKorean(index) {
    const question = state.session[index];
    if (!question || !question.audioText || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question.audioText);
    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("ko"));
    if (koreanVoice) utterance.voice = koreanVoice;
    utterance.lang = "ko-KR";
    utterance.rate = question.level === 1 ? 0.82 : question.level === 2 ? 0.9 : 0.96;
    window.speechSynthesis.speak(utterance);
  }

  function gradeWriting(question, value) {
    const normalized = normalizeKorean(value);
    if (!normalized) return false;
    return question.keywords.every((keyword) => normalized.includes(normalizeKorean(keyword)));
  }

  function isCorrect(question, index) {
    const answer = state.answers.get(index);
    if (question.kind === "writing") return gradeWriting(question, answer);
    return Number(answer) === question.answer;
  }

  function submitExam() {
    const answered = countAnswered();
    if (answered < state.session.length) {
      const shouldSubmit = window.confirm(`Bạn còn ${state.session.length - answered} câu chưa trả lời. Vẫn nộp bài?`);
      if (!shouldSubmit) return;
    }
    stopTimer();
    const items = state.session.map((question, index) => ({
      question,
      index,
      answer: state.answers.get(index),
      correct: isCorrect(question, index)
    }));
    const correctCount = items.filter((item) => item.correct).length;
    const wrongCount = items.length - correctCount;
    state.result = { items, correctCount, wrongCount };

    el.examPanel.classList.add("hidden");
    el.resultPanel.classList.remove("hidden");
    el.scoreText.textContent = `${correctCount} / ${items.length} câu đúng`;
    el.detailText.textContent = `Sai ${wrongCount} câu · Thời gian ${formatTime(state.elapsedMs)} · Đúng ${Math.round((correctCount / items.length) * 100)}%`;
    setReviewMode("wrong");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getUserAnswerText(item) {
    if (item.question.kind === "writing") {
      return String(item.answer || "").trim() || "Chưa trả lời";
    }
    if (item.answer === undefined) return "Chưa trả lời";
    return item.question.options[Number(item.answer)] || "Chưa trả lời";
  }

  function getCorrectAnswerText(question) {
    if (question.kind === "writing") return question.sampleAnswer;
    return question.options[question.answer];
  }

  function renderTranslation(question) {
    if (!question.translation) return "";
    return `<div class="translation"><strong>Dịch tiếng Việt:</strong> ${escapeHtml(question.translation)}</div>`;
  }

  function renderReviewOptions(item) {
    const question = item.question;
    if (question.kind !== "mc") return "";
    const options = (question.shuffledOptions || question.options.map((text, index) => ({ text, index }))).map((option, orderIndex) => {
      const isCorrectOption = option.index === question.answer;
      const isSelectedWrong = item.answer === option.index && !item.correct;
      const marker = isCorrectOption ? "Đáp án đúng" : isSelectedWrong ? "Bạn chọn" : "";
      const classes = [
        "review-option",
        isCorrectOption ? "correct" : "",
        isSelectedWrong ? "selected-wrong" : ""
      ].filter(Boolean).join(" ");
      const optionVi = question.optionsVi && question.optionsVi[option.index]
        ? `<small>${escapeHtml(question.optionsVi[option.index])}</small>`
        : "";
      return `
        <div class="${classes}">
          <span class="review-option-key">${orderIndex + 1}</span>
          <div>
            <p lang="ko">${escapeHtml(option.text)}</p>
            ${optionVi}
          </div>
          ${marker ? `<strong>${marker}</strong>` : ""}
        </div>
      `;
    }).join("");
    return `<div class="review-options">${options}</div>`;
  }

  function renderReview() {
    if (!state.result) return;
    const items = state.reviewMode === "all"
      ? state.result.items
      : state.result.items.filter((item) => !item.correct);

    if (!items.length) {
      el.reviewList.innerHTML = `<article class="review-card"><strong>Không có câu sai trong phiên này.</strong></article>`;
      return;
    }

    el.reviewList.innerHTML = items.map((item) => {
      const question = item.question;
      const audioText = question.audioText
        ? `<p class="answer-line"><strong>Audio:</strong> <span lang="ko">${escapeHtml(question.audioText)}</span></p>`
        : "";
      const passage = question.passage
        ? `<div class="passage" lang="ko">${escapeHtml(question.passage)}</div>`
        : "";
      const userClass = item.correct ? "right-text" : "wrong-text";
      const reviewOptions = renderReviewOptions(item);
      return `
        <article class="review-card ${item.correct ? "" : "wrong"}">
          <div class="review-meta">
            <span class="tag">Câu ${item.index + 1}</span>
            <span class="tag">${skillLabels[question.skill]}</span>
            <span class="tag level">TOPIK ${question.level}</span>
            <span class="tag">${item.correct ? "Đúng" : "Sai"}</span>
          </div>
          ${audioText}
          ${passage}
          ${renderTranslation(question)}
          <p class="prompt">${escapeHtml(question.prompt)}</p>
          ${reviewOptions}
          <p class="answer-line"><strong>Bạn chọn/viết:</strong> <span class="${userClass}" lang="ko">${escapeHtml(getUserAnswerText(item))}</span></p>
          <p class="answer-line"><strong>Đáp án đúng:</strong> <span class="right-text" lang="ko">${escapeHtml(getCorrectAnswerText(question))}</span></p>
          <p class="answer-line"><strong>Giải thích:</strong> ${escapeHtml(question.explanation)}</p>
        </article>
      `;
    }).join("");
  }

  function setReviewMode(mode) {
    state.reviewMode = mode;
    el.wrongOnlyButton.classList.toggle("active", mode === "wrong");
    el.allReviewButton.classList.toggle("active", mode === "all");
    renderReview();
  }

  el.startButton.addEventListener("click", startExam);
  el.retryButton.addEventListener("click", () => {
    el.resultPanel.classList.add("hidden");
    el.startPanel.classList.remove("hidden");
    el.timerText.textContent = "00:00";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  el.submitButton.addEventListener("click", submitExam);
  el.wrongOnlyButton.addEventListener("click", () => setReviewMode("wrong"));
  el.allReviewButton.addEventListener("click", () => setReviewMode("all"));

  el.questionForm.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("input[type='radio'][data-question-index]")) {
      state.answers.set(Number(target.dataset.questionIndex), Number(target.value));
      updateProgress();
    }
  });

  el.questionForm.addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches("textarea[data-writing-index]")) {
      state.answers.set(Number(target.dataset.writingIndex), target.value);
      updateProgress();
    }
  });

  el.questionForm.addEventListener("click", (event) => {
    const button = event.target.closest("[data-audio-index]");
    if (!button) return;
    speakKorean(Number(button.dataset.audioIndex));
  });

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = function () {};
  }
})();
