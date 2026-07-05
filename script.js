const STORAGE_KEYS = {
  profile: "babyCoach.profile",
  history: "babyCoach.history",
  favorites: "babyCoach.favorites"
};

const LEGACY_KEYS = {
  profile: "babyCare.profile",
  history: "babyCare.history",
  favorites: "babyCare.favorites"
};

const profileForm = document.querySelector("#profileForm");
const childNameInput = document.querySelector("#childName");
const childMonthsInput = document.querySelector("#childMonths");
const childGenderInput = document.querySelector("#childGender");
const feedingTypeInput = document.querySelector("#feedingType");
const solidFoodStageInput = document.querySelector("#solidFoodStage");
const allergiesInput = document.querySelector("#allergies");
const sleepPatternInput = document.querySelector("#sleepPattern");
const notesInput = document.querySelector("#notes");
const profileStatus = document.querySelector("#profileStatus");
const clearProfileButton = document.querySelector("#clearProfileButton");

const searchForm = document.querySelector("#searchForm");
const questionInput = document.querySelector("#questionInput");
const resultPanel = document.querySelector("#resultPanel");
const searchButton = document.querySelector("#searchButton");
const quickQuestionButtons = document.querySelectorAll("[data-question]");

const historyList = document.querySelector("#historyList");
const favoritesList = document.querySelector("#favoritesList");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const clearFavoritesButton = document.querySelector("#clearFavoritesButton");

function migrateLegacyStorage() {
  Object.keys(STORAGE_KEYS).forEach((name) => {
    if (!localStorage.getItem(STORAGE_KEYS[name]) && localStorage.getItem(LEGACY_KEYS[name])) {
      localStorage.setItem(STORAGE_KEYS[name], localStorage.getItem(LEGACY_KEYS[name]));
    }
  });
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Failed to read ${key} from localStorage:`, error);
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getProfile() {
  const profile = readJson(STORAGE_KEYS.profile, {
    childName: "",
    childMonths: "",
    childGender: "",
    feedingType: "",
    solidFoodStage: "",
    allergies: "",
    sleepPattern: "",
    notes: ""
  });

  return {
    childName: profile.childName || "",
    childMonths: profile.childMonths || "",
    childGender: profile.childGender || "",
    feedingType: profile.feedingType || "",
    solidFoodStage: profile.solidFoodStage || "",
    allergies: profile.allergies || "",
    sleepPattern: profile.sleepPattern || "",
    notes: profile.notes || ""
  };
}

function setProfile(profile) {
  writeJson(STORAGE_KEYS.profile, profile);
}

function getHistory() {
  return readJson(STORAGE_KEYS.history, []);
}

function setHistory(items) {
  writeJson(STORAGE_KEYS.history, items);
}

function getFavorites() {
  return readJson(STORAGE_KEYS.favorites, []);
}

function setFavorites(items) {
  writeJson(STORAGE_KEYS.favorites, items);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeYoutubeUrl(question) {
  const searchText = `${question} 육아 방법`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(searchText)}`;
}

function profileToSummary(profile) {
  const parts = [];

  if (profile.childName) {
    parts.push(`${profile.childName}`);
  }

  if (profile.childMonths !== "" && profile.childMonths !== null) {
    parts.push(`${profile.childMonths}개월`);
  }

  if (profile.childGender) {
    parts.push(profile.childGender);
  }

  if (profile.feedingType) {
    parts.push(profile.feedingType);
  }

  if (profile.solidFoodStage) {
    parts.push(`이유식 ${profile.solidFoodStage}`);
  }

  if (profile.allergies) {
    parts.push(profile.allergies);
  }

  if (profile.sleepPattern) {
    parts.push(profile.sleepPattern);
  }

  if (profile.notes) {
    parts.push(profile.notes);
  }

  return parts.length ? parts.join(" · ") : "아이 프로필을 저장하면 답변이 더 정교해집니다.";
}

function loadProfileForm() {
  const profile = getProfile();

  childNameInput.value = profile.childName || "";
  childMonthsInput.value = profile.childMonths || "";
  childGenderInput.value = profile.childGender || "";
  feedingTypeInput.value = profile.feedingType || "";
  solidFoodStageInput.value = profile.solidFoodStage || "";
  allergiesInput.value = profile.allergies || "";
  sleepPatternInput.value = profile.sleepPattern || "";
  notesInput.value = profile.notes || "";

  const hasProfile = Boolean(
    profile.childName ||
    profile.childMonths ||
    profile.childGender ||
    profile.feedingType ||
    profile.solidFoodStage ||
    profile.allergies ||
    profile.sleepPattern ||
    profile.notes
  );
  profileStatus.textContent = hasProfile ? "맞춤 상담 준비됨" : "미저장";
}

function collectProfileForm() {
  return {
    childName: childNameInput.value.trim(),
    childMonths: childMonthsInput.value.trim(),
    childGender: childGenderInput.value,
    feedingType: feedingTypeInput.value,
    solidFoodStage: solidFoodStageInput.value,
    allergies: allergiesInput.value.trim(),
    sleepPattern: sleepPatternInput.value.trim(),
    notes: notesInput.value.trim()
  };
}

function splitAnswer(answer) {
  const normalized = answer.trim();
  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  if (lines.length > 1) {
    return {
      highlight: lines[0].replace(/^[-*•]\s*/, ""),
      body: lines.slice(1).join("\n")
    };
  }

  const sentenceMatch = normalized.match(/^(.+?[.!?。]|.+?(?:요|다|세요|습니다)\.)\s*/);
  const highlight = sentenceMatch ? sentenceMatch[0].trim() : normalized;
  const body = normalized.slice(highlight.length).trim();

  return {
    highlight,
    body: body || normalized
  };
}

function setLoading(question) {
  resultPanel.innerHTML = "";

  const loading = document.createElement("div");
  loading.className = "loading-state";

  const icon = document.createElement("span");
  icon.className = "empty-icon loading-dot";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "AI";

  const title = document.createElement("h2");
  title.textContent = "육아코치가 답변을 준비하고 있어요";

  const message = document.createElement("p");
  message.textContent = `"${question}"에 대해 아이 프로필을 참고해 정리하는 중입니다.`;

  loading.append(icon, title, message);
  resultPanel.append(loading);
}

function renderAnswer(item, options = {}) {
  resultPanel.innerHTML = "";

  const answerParts = splitAnswer(item.answer);

  const header = document.createElement("div");
  header.className = "result-header";

  const headerText = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = item.question;
  const subtitle = document.createElement("p");
  subtitle.textContent = item.profileSummary || "육아코치가 아이 상황을 고려해 답변했습니다.";
  headerText.append(title, subtitle);

  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = "AI 상담";
  header.append(headerText, tag);

  const card = document.createElement("article");
  card.className = "answer-card";

  const aiIcon = document.createElement("span");
  aiIcon.className = "ai-icon";
  aiIcon.setAttribute("aria-hidden", "true");
  aiIcon.textContent = "AI";

  const content = document.createElement("div");
  content.className = "answer-content";

  const cardTitle = document.createElement("h3");
  cardTitle.textContent = "육아코치 답변";

  const highlight = document.createElement("p");
  highlight.className = "answer-highlight";
  highlight.textContent = answerParts.highlight;

  const answerText = document.createElement("p");
  answerText.className = "answer-text";
  answerText.textContent = answerParts.body;

  const actionRow = document.createElement("div");
  actionRow.className = "answer-actions";

  const youtubeLink = document.createElement("a");
  youtubeLink.className = "youtube-link";
  youtubeLink.href = makeYoutubeUrl(item.question);
  youtubeLink.target = "_blank";
  youtubeLink.rel = "noopener noreferrer";
  youtubeLink.textContent = "YouTube로 더 보기";

  const favoriteButton = document.createElement("button");
  favoriteButton.className = "secondary-button";
  favoriteButton.type = "button";
  favoriteButton.textContent = isFavorite(item.id) ? "저장됨" : "즐겨찾기 저장";
  favoriteButton.addEventListener("click", () => {
    addFavorite(item);
    favoriteButton.textContent = "저장됨";
  });

  actionRow.append(youtubeLink, favoriteButton);
  content.append(cardTitle, highlight, answerText, actionRow);
  card.append(aiIcon, content);

  const notice = document.createElement("p");
  notice.className = "notice";
  notice.textContent = options.truncated
    ? "주의: Gemini 응답이 길이 제한에 도달해 일부가 잘렸을 수 있습니다. 질문을 더 구체적으로 줄여 다시 시도해보세요."
    : "주의: 육아코치의 답변은 일반적인 육아 정보입니다. 고열, 호흡 문제, 탈수, 심한 통증, 평소와 다른 처짐이 있으면 의료 전문가에게 상담하세요.";

  resultPanel.append(header, card, notice);
}

function renderError(message, details = "") {
  resultPanel.innerHTML = "";

  const errorBox = document.createElement("div");
  errorBox.className = "error-box";

  const title = document.createElement("strong");
  title.textContent = "오류가 발생했습니다";

  const summary = document.createElement("p");
  summary.textContent = message;

  errorBox.append(title, summary);

  if (details) {
    const detailBlock = document.createElement("pre");
    detailBlock.className = "error-details";
    detailBlock.textContent = details;
    errorBox.append(detailBlock);
  }

  resultPanel.append(errorBox);
}

function createEmptyMessage(text) {
  const empty = document.createElement("p");
  empty.className = "empty-list";
  empty.textContent = text;
  return empty;
}

function createSavedItem(item, source) {
  const article = document.createElement("article");
  article.className = source === "history" ? "saved-item timeline-item" : "saved-item favorite-item";

  const title = document.createElement("button");
  title.className = "saved-title";
  title.type = "button";
  title.textContent = source === "favorites" ? `★ ${item.question}` : item.question;
  title.addEventListener("click", () => renderAnswer(item));

  const meta = document.createElement("p");
  meta.className = "saved-meta";
  meta.textContent = source === "history"
    ? `상담 시간 · ${formatDateTime(item.createdAt)}`
    : `즐겨찾기 · ${formatDateTime(item.createdAt)}`;

  const preview = document.createElement("p");
  preview.className = "saved-preview";
  preview.textContent = item.answer;

  const actions = document.createElement("div");
  actions.className = "saved-actions";

  const favoriteButton = document.createElement("button");
  favoriteButton.className = "text-button";
  favoriteButton.type = "button";
  favoriteButton.textContent = isFavorite(item.id) ? "저장됨" : "즐겨찾기";
  favoriteButton.addEventListener("click", () => addFavorite(item));

  const removeButton = document.createElement("button");
  removeButton.className = "text-button danger-text";
  removeButton.type = "button";
  removeButton.textContent = "삭제";
  removeButton.addEventListener("click", () => {
    if (source === "history") {
      removeHistory(item.id);
    } else {
      removeFavorite(item.id);
    }
  });

  if (source === "history") {
    actions.append(favoriteButton, removeButton);
  } else {
    actions.append(removeButton);
  }

  article.append(title, meta, preview, actions);
  return article;
}

function renderHistory() {
  const history = getHistory();
  historyList.innerHTML = "";

  if (!history.length) {
    historyList.append(createEmptyMessage("아직 질문 기록이 없습니다."));
    return;
  }

  history.forEach((item) => {
    historyList.append(createSavedItem(item, "history"));
  });
}

function renderFavorites() {
  const favorites = getFavorites();
  favoritesList.innerHTML = "";

  if (!favorites.length) {
    favoritesList.append(createEmptyMessage("저장한 즐겨찾기가 없습니다."));
    return;
  }

  favorites.forEach((item) => {
    favoritesList.append(createSavedItem(item, "favorites"));
  });
}

function addHistory(item) {
  const nextHistory = [item, ...getHistory()].slice(0, 40);
  setHistory(nextHistory);
  renderHistory();
}

function removeHistory(id) {
  setHistory(getHistory().filter((item) => item.id !== id));
  renderHistory();
}

function isFavorite(id) {
  return getFavorites().some((item) => item.id === id);
}

function addFavorite(item) {
  const favorites = getFavorites();

  if (!favorites.some((favorite) => favorite.id === item.id)) {
    setFavorites([item, ...favorites]);
    renderFavorites();
  }
}

function removeFavorite(id) {
  setFavorites(getFavorites().filter((item) => item.id !== id));
  renderFavorites();
}

async function askQuestion(question) {
  const profile = getProfile();
  const profileSummary = profileToSummary(profile);

  setLoading(question);
  searchButton.disabled = true;
  searchButton.textContent = "상담 중";

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question,
        childProfile: profile
      })
    });

    const rawBody = await response.text();
    let data;

    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseError) {
      throw new Error(`서버 응답을 해석하지 못했습니다.\n\n원본 응답:\n${rawBody}`);
    }

    if (!response.ok) {
      const details = data.details ? `\n\n상세 정보:\n${data.details}` : "";
      throw new Error(`${data.error || "답변을 가져오지 못했습니다."}${details}`);
    }

    const item = {
      id: createId(),
      question,
      answer: data.answer,
      createdAt: new Date().toISOString(),
      profile,
      profileSummary
    };

    addHistory(item);
    renderAnswer(item, {
      truncated: data.truncated,
      finishReason: data.finishReason
    });
  } catch (error) {
    console.error("Failed to ask Gemini:", error);
    renderError(error.message || "잠시 후 다시 시도해주세요.", error.stack || "");
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = "질문하기";
  }
}

function observeRevealElements() {
  const elements = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12
  });

  elements.forEach((element) => observer.observe(element));
}

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setProfile(collectProfileForm());
  loadProfileForm();
});

clearProfileButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEYS.profile);
  loadProfileForm();
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();

  if (!question) {
    questionInput.focus();
    return;
  }

  askQuestion(question);
});

quickQuestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const question = button.dataset.question;
    questionInput.value = question;
    askQuestion(question);
  });
});

clearHistoryButton.addEventListener("click", () => {
  setHistory([]);
  renderHistory();
});

clearFavoritesButton.addEventListener("click", () => {
  setFavorites([]);
  renderFavorites();
});

migrateLegacyStorage();
loadProfileForm();
renderHistory();
renderFavorites();
observeRevealElements();
