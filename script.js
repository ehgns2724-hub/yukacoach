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
const photoInput = document.querySelector("#photoInput");
const photoPreview = document.querySelector("#photoPreview");
const photoPreviewImage = document.querySelector("#photoPreviewImage");
const photoPreviewName = document.querySelector("#photoPreviewName");
const removePhotoButton = document.querySelector("#removePhotoButton");
const resultPanel = document.querySelector("#resultPanel");
const searchButton = document.querySelector("#searchButton");
const quickQuestionButtons = document.querySelectorAll("[data-question]");

const historyList = document.querySelector("#historyList");
const favoritesList = document.querySelector("#favoritesList");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const clearFavoritesButton = document.querySelector("#clearFavoritesButton");
const loginButton = document.querySelector("#loginButton");
const logoutButton = document.querySelector("#logoutButton");
const authStatus = document.querySelector("#authStatus");
const toast = document.querySelector("#toast");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
let selectedPhoto = null;
let firebaseState = {
  enabled: false,
  auth: null,
  db: null,
  user: null,
  modules: null,
  syncing: false,
  cloudAvailable: false
};
let requestedLogout = false;

const FIRESTORE_TIMEOUT_MS = 8000;
const DAILY_TEXT_LIMIT = 10;
const DAILY_IMAGE_LIMIT = 2;

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

function getCloudDocRef() {
  if (!firebaseState.user || !firebaseState.db || !firebaseState.modules) {
    return null;
  }

  return firebaseState.modules.doc(firebaseState.db, "users", firebaseState.user.uid);
}

function getCloudDocPath() {
  return firebaseState.user ? `users/${firebaseState.user.uid}` : "";
}

function getProfileDocRef() {
  if (!firebaseState.user || !firebaseState.db || !firebaseState.modules) {
    return null;
  }

  return firebaseState.modules.doc(firebaseState.db, "users", firebaseState.user.uid, "profile", "profile");
}

function getProfileDocPath() {
  return firebaseState.user ? `users/${firebaseState.user.uid}/profile/profile` : "";
}

function getHistoryCollectionRef() {
  if (!firebaseState.user || !firebaseState.db || !firebaseState.modules) {
    return null;
  }

  return firebaseState.modules.collection(firebaseState.db, "users", firebaseState.user.uid, "history");
}

function getHistoryDocRef(id) {
  if (!firebaseState.user || !firebaseState.db || !firebaseState.modules) {
    return null;
  }

  return firebaseState.modules.doc(firebaseState.db, "users", firebaseState.user.uid, "history", id);
}

function getHistoryCollectionPath() {
  return firebaseState.user ? `users/${firebaseState.user.uid}/history` : "";
}

function getUsageDocRef(dateKey = getTodayKey()) {
  if (!firebaseState.user || !firebaseState.db || !firebaseState.modules) {
    return null;
  }

  return firebaseState.modules.doc(firebaseState.db, "users", firebaseState.user.uid, "usage", dateKey);
}

function getUsageDocPath(dateKey = getTodayKey()) {
  return firebaseState.user ? `users/${firebaseState.user.uid}/usage/${dateKey}` : "";
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("is-visible");

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.hidden = true;
  }, 2600);
}

function withTimeout(promise, label, timeoutMs = FIRESTORE_TIMEOUT_MS) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function getLocalSnapshot() {
  return {
    profile: getProfile(),
    history: getHistory(),
    favorites: getFavorites(),
    updatedAt: new Date().toISOString()
  };
}

function applySnapshot(snapshot) {
  if (snapshot.profile) {
    setProfile(snapshot.profile);
  }

  if (Array.isArray(snapshot.history)) {
    setHistory(snapshot.history);
  }

  if (Array.isArray(snapshot.favorites)) {
    setFavorites(snapshot.favorites);
  }

  loadProfileForm();
  renderHistory();
  renderFavorites();
}

function mergeItems(localItems, cloudItems) {
  const itemMap = new Map();

  [...cloudItems, ...localItems].forEach((item) => {
    if (item?.id) {
      itemMap.set(item.id, item);
    }
  });

  return [...itemMap.values()]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 40);
}

function hasProfileData(profile) {
  return Boolean(
    profile.childName ||
    profile.childMonths ||
    profile.childGender ||
    profile.feedingType ||
    profile.solidFoodStage ||
    profile.allergies ||
    profile.sleepPattern ||
    profile.notes
  );
}

async function saveSnapshotToCloud(snapshot = getLocalSnapshot()) {
  const userDoc = getCloudDocRef();

  if (!userDoc || (!firebaseState.cloudAvailable && !firebaseState.syncing)) {
    return;
  }

  const docPath = getCloudDocPath();
  console.log("Firestore save start:", {
    path: docPath,
    historyCount: snapshot.history?.length || 0,
    favoritesCount: snapshot.favorites?.length || 0,
    hasProfile: hasProfileData(snapshot.profile || {})
  });

  try {
    await withTimeout(firebaseState.modules.setDoc(userDoc, snapshot, { merge: true }), "Firestore setDoc");
    console.log("Firestore save success:", { path: docPath });

    if (firebaseState.user && !firebaseState.syncing) {
      authStatus.textContent = `${firebaseState.user.displayName || firebaseState.user.email || "Google 계정"} · 클라우드 저장 완료`;
    }
  } catch (error) {
    console.error("Firestore save failed:", {
      path: docPath,
      error
    });
    firebaseState.cloudAvailable = false;
    authStatus.textContent = "클라우드 저장 실패 - 로컬 저장으로 전환";
    throw error;
  } finally {
    console.log("Firestore save finished:", { path: docPath });
  }
}

async function loadProfileFromCloud() {
  const profileDoc = getProfileDocRef();

  if (!profileDoc) {
    return null;
  }

  const path = getProfileDocPath();
  console.log("Firestore profile getDoc start:", { path });

  try {
    const docSnapshot = await withTimeout(firebaseState.modules.getDoc(profileDoc), "Firestore profile getDoc");
    console.log("Firestore profile getDoc success:", {
      path,
      exists: docSnapshot.exists()
    });

    return docSnapshot.exists() ? docSnapshot.data() : null;
  } catch (error) {
    console.error("Firestore profile getDoc failed:", {
      path,
      error
    });
    throw error;
  } finally {
    console.log("Firestore profile getDoc finished:", { path });
  }
}

function toHistoryDoc(item) {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    hasImage: Boolean(item.hasImage),
    createdAt: item.createdAt || new Date().toISOString(),
    profileSummary: item.profileSummary || "",
    imageName: item.imageName || ""
  };
}

async function saveHistoryItemToCloud(item) {
  const historyDoc = getHistoryDocRef(item.id);

  if (!historyDoc || !firebaseState.cloudAvailable) {
    return;
  }

  const path = `${getHistoryCollectionPath()}/${item.id}`;
  const payload = toHistoryDoc(item);

  console.log("Firestore history setDoc start:", { path, payload });

  try {
    await withTimeout(firebaseState.modules.setDoc(historyDoc, payload, { merge: true }), "Firestore history setDoc");
    console.log("Firestore history setDoc success:", { path });
  } catch (error) {
    console.error("Firestore history setDoc failed:", { path, error });
    throw error;
  } finally {
    console.log("Firestore history setDoc finished:", { path });
  }
}

async function loadHistoryFromCloud() {
  const historyCollection = getHistoryCollectionRef();

  if (!historyCollection) {
    return [];
  }

  const path = getHistoryCollectionPath();
  console.log("Firestore history query start:", { path });

  try {
    const queryRef = firebaseState.modules.query(
      historyCollection,
      firebaseState.modules.orderBy("createdAt", "desc"),
      firebaseState.modules.limit(20)
    );
    const snapshot = await withTimeout(firebaseState.modules.getDocs(queryRef), "Firestore history getDocs");
    const items = snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data()
    }));

    console.log("Firestore history query success:", {
      path,
      count: items.length
    });

    return items;
  } catch (error) {
    console.error("Firestore history query failed:", { path, error });
    throw error;
  } finally {
    console.log("Firestore history query finished:", { path });
  }
}

async function migrateLocalHistoryToCloud(localHistory) {
  if (!firebaseState.cloudAvailable || !localHistory.length) {
    return;
  }

  console.log("Firestore history migration start:", {
    path: getHistoryCollectionPath(),
    count: localHistory.length
  });

  try {
    await Promise.all(localHistory.slice(0, 40).map((item) => saveHistoryItemToCloud(item)));
    console.log("Firestore history migration success");
  } catch (error) {
    console.error("Firestore history migration failed:", error);
    throw error;
  } finally {
    console.log("Firestore history migration finished");
  }
}

async function reserveDailyUsage(hasPhoto) {
  if (!firebaseState.user || !firebaseState.db || !firebaseState.modules) {
    return { allowed: true, mode: "local" };
  }

  const dateKey = getTodayKey();
  const usageDoc = getUsageDocRef(dateKey);
  const path = getUsageDocPath(dateKey);
  const field = hasPhoto ? "imageCount" : "textCount";
  const limit = hasPhoto ? DAILY_IMAGE_LIMIT : DAILY_TEXT_LIMIT;

  console.log("Firestore usage check start:", {
    path,
    field,
    limit
  });

  try {
    const result = await withTimeout(firebaseState.modules.runTransaction(firebaseState.db, async (transaction) => {
      const snapshot = await transaction.get(usageDoc);
      const currentData = snapshot.exists() ? snapshot.data() : {};
      const currentCount = Number(currentData[field] || 0);

      if (currentCount >= limit) {
        return {
          allowed: false,
          errorCode: hasPhoto ? "DAILY_IMAGE_LIMIT" : "DAILY_TEXT_LIMIT",
          currentCount,
          limit
        };
      }

      const nextData = {
        date: dateKey,
        textCount: Number(currentData.textCount || 0),
        imageCount: Number(currentData.imageCount || 0),
        updatedAt: new Date().toISOString()
      };

      nextData[field] = currentCount + 1;
      transaction.set(usageDoc, nextData, { merge: true });

      return {
        allowed: true,
        currentCount: currentCount + 1,
        limit
      };
    }), "Firestore usage transaction");

    console.log("Firestore usage check success:", {
      path,
      result
    });

    return result;
  } catch (error) {
    console.error("Firestore usage check failed:", {
      path,
      error
    });

    return {
      allowed: false,
      errorCode: "USAGE_CHECK_FAILED",
      error
    };
  } finally {
    console.log("Firestore usage check finished:", { path });
  }
}

async function saveProfileToCloud(profile, options = {}) {
  const profileDoc = getProfileDocRef();

  if (!profileDoc || !firebaseState.cloudAvailable) {
    return;
  }

  const path = getProfileDocPath();
  const payload = {
    ...profile,
    updatedAt: new Date().toISOString()
  };

  console.log("Firestore profile setDoc start:", { path, payload });

  try {
    await withTimeout(firebaseState.modules.setDoc(profileDoc, payload, { merge: true }), "Firestore profile setDoc");
    console.log("Firestore profile setDoc success:", { path });
    authStatus.textContent = `${firebaseState.user.displayName || firebaseState.user.email || "Google 계정"} · 클라우드 저장 완료`;

    if (options.showToast) {
      showToast("프로필 저장 완료");
    }
  } catch (error) {
    console.error("Firestore profile setDoc failed:", {
      path,
      error
    });
    firebaseState.cloudAvailable = false;
    authStatus.textContent = "클라우드 저장 실패 - 로컬 저장으로 전환";
    renderError("프로필을 Firestore에 저장하지 못했습니다. 로컬 저장은 유지됩니다.", error.code || "firestore/profile-save-failed");
  } finally {
    console.log("Firestore profile setDoc finished:", { path });
  }
}

function handleCloudSaveError(context, error) {
  console.error(context, error);
  firebaseState.cloudAvailable = false;
  authStatus.textContent = "클라우드 저장 실패 - 로컬 저장으로 전환";
  renderError("Firestore 저장 중 문제가 발생했습니다. 콘솔의 오류 코드와 Firestore 보안 규칙을 확인해주세요.", error?.code || "firestore/save-failed");
}

async function syncCloudToLocal() {
  const userDoc = getCloudDocRef();

  if (!userDoc) {
    return;
  }

  const docPath = getCloudDocPath();
  firebaseState.syncing = true;
  firebaseState.cloudAvailable = true;
  authStatus.textContent = `${firebaseState.user.displayName || firebaseState.user.email || "Google 계정"} · 클라우드 저장 중`;

  console.log("Firestore sync start:", { path: docPath });

  try {
    const localSnapshot = getLocalSnapshot();

    console.log("Firestore load start:", { path: docPath });
    const cloudDoc = await withTimeout(firebaseState.modules.getDoc(userDoc), "Firestore getDoc");
    console.log("Firestore load success:", {
      path: docPath,
      exists: cloudDoc.exists()
    });

    const cloudSnapshot = cloudDoc.exists() ? cloudDoc.data() : {};
    const cloudProfile = await loadProfileFromCloud();
    await migrateLocalHistoryToCloud(localSnapshot.history);
    const cloudHistory = await loadHistoryFromCloud();
    const mergedSnapshot = {
      profile: cloudProfile || (hasProfileData(localSnapshot.profile) ? localSnapshot.profile : (cloudSnapshot.profile || localSnapshot.profile)),
      history: cloudHistory.length ? cloudHistory : mergeItems(localSnapshot.history, cloudSnapshot.history || []).slice(0, 20),
      favorites: mergeItems(localSnapshot.favorites, cloudSnapshot.favorites || []),
      updatedAt: new Date().toISOString()
    };

    await saveSnapshotToCloud(mergedSnapshot);
    if (!cloudProfile) {
      await saveProfileToCloud(mergedSnapshot.profile);
    }
    applySnapshot(mergedSnapshot);

    authStatus.textContent = `${firebaseState.user.displayName || firebaseState.user.email || "Google 계정"} · 클라우드 저장 완료`;
    firebaseState.cloudAvailable = true;
    console.log("Firestore sync complete:", { path: docPath });
  } catch (error) {
    console.error("Firestore sync failed:", {
      path: docPath,
      error
    });
    firebaseState.cloudAvailable = false;
    authStatus.textContent = "클라우드 저장 실패 - 로컬 저장으로 전환";
    renderError("Firestore 저장 중 문제가 발생했습니다. 콘솔의 오류 코드와 Firestore 보안 규칙을 확인해주세요.", error.code || "firestore/sync-failed");
  } finally {
    firebaseState.syncing = false;
    console.log("Firestore sync finished:", { path: docPath });
  }
}

function updateAuthUI(user) {
  if (user) {
    authStatus.textContent = `${user.displayName || user.email || "Google 계정"} · 클라우드 저장 중`;
    loginButton.hidden = true;
    loginButton.disabled = false;
    logoutButton.hidden = false;
    return;
  }

  if (requestedLogout) {
    localStorage.removeItem(STORAGE_KEYS.profile);
    loadProfileForm();
    historyList.innerHTML = "";
    historyList.append(createEmptyMessage("로그아웃했습니다. 질문 기록은 로그인 전 로컬 모드에서 새로 표시됩니다."));
    requestedLogout = false;
  }

  authStatus.textContent = firebaseState.enabled
    ? "로그인 전에는 이 기기에만 저장됩니다."
    : "Firebase 설정 후 구글 로그인을 사용할 수 있습니다.";
  loginButton.hidden = false;
  loginButton.disabled = !firebaseState.enabled;
  logoutButton.hidden = true;
}

async function initializeFirebase() {
  try {
    const response = await fetch("/api/firebase-config");
    const data = await response.json();

    if (!response.ok || !data.enabled) {
      console.warn("Firebase is not enabled:", data);
      firebaseState.enabled = false;
      updateAuthUI(null);
      return;
    }

    console.info("Firebase config loaded:", {
      authDomain: data.config.authDomain,
      projectId: data.config.projectId,
      hasApiKey: Boolean(data.config.apiKey),
      apiKeyPreview: data.config.apiKey ? `${data.config.apiKey.slice(0, 4)}...${data.config.apiKey.slice(-4)}` : "",
      appIdPreview: data.config.appId ? `${data.config.appId.slice(0, 4)}...${data.config.appId.slice(-4)}` : ""
    });

    const [{ initializeApp }, authModule, firestoreModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
    ]);

    const app = initializeApp(data.config);
    firebaseState = {
      enabled: true,
      auth: authModule.getAuth(app),
      db: firestoreModule.getFirestore(app),
      user: null,
      modules: {
        GoogleAuthProvider: authModule.GoogleAuthProvider,
        signInWithPopup: authModule.signInWithPopup,
        signOut: authModule.signOut,
        onAuthStateChanged: authModule.onAuthStateChanged,
        doc: firestoreModule.doc,
        collection: firestoreModule.collection,
        getDoc: firestoreModule.getDoc,
        getDocs: firestoreModule.getDocs,
        setDoc: firestoreModule.setDoc,
        runTransaction: firestoreModule.runTransaction,
        query: firestoreModule.query,
        orderBy: firestoreModule.orderBy,
        limit: firestoreModule.limit
      }
    };

    firebaseState.modules.onAuthStateChanged(firebaseState.auth, async (user) => {
      firebaseState.user = user;
      updateAuthUI(user);

      if (user) {
        try {
          await syncCloudToLocal();
        } catch (error) {
          console.error("Unexpected Firestore sync error:", error);
          firebaseState.cloudAvailable = false;
          authStatus.textContent = "클라우드 저장 실패 - 로컬 저장으로 전환";
        }
      }
    });
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    firebaseState.enabled = false;
    updateAuthUI(null);
  }
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

function setLoading(question, hasPhoto = false) {
  resultPanel.innerHTML = "";

  const loading = document.createElement("div");
  loading.className = "loading-state";

  const icon = document.createElement("span");
  icon.className = "empty-icon loading-dot";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "AI";

  const title = document.createElement("h2");
  title.textContent = hasPhoto ? "분석중..." : "육아코치가 답변을 준비하고 있어요";

  const message = document.createElement("p");
  message.textContent = hasPhoto
    ? "사진을 먼저 살펴본 뒤 아이 프로필과 질문을 함께 참고해 답변합니다."
    : `"${question}"에 대해 아이 프로필을 참고해 정리하는 중입니다.`;

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
  title.textContent = item.hasImage ? `사진 분석 · ${item.question}` : item.question;
  const subtitle = document.createElement("p");
  subtitle.textContent = item.profileSummary || "육아코치가 아이 상황을 고려해 답변했습니다.";
  headerText.append(title, subtitle);

  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = item.hasImage ? "AI 사진 분석" : "AI 상담";
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
  cardTitle.textContent = item.hasImage ? "사진 분석 결과" : "육아코치 답변";

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

const USER_ERROR_MESSAGES = {
  INVALID_REQUEST: "질문을 입력해주세요.",
  MISSING_API_KEY: "AI 서버 설정이 아직 완료되지 않았습니다.",
  QUOTA_EXCEEDED: "현재 AI 사용량이 많아 답변이 지연되고 있어요. 잠시 후 다시 시도해주세요.",
  NETWORK_ERROR: "인터넷 연결을 확인해주세요.",
  API_ERROR: "AI 서버에 일시적인 문제가 발생했습니다.",
  INVALID_IMAGE: "jpg, jpeg, png, webp 형식의 사진만 업로드할 수 있습니다.",
  IMAGE_TOO_LARGE: "사진 용량이 너무 큽니다. 5MB 이하의 사진을 선택해주세요.",
  DAILY_TEXT_LIMIT: "오늘의 텍스트 질문 10회를 모두 사용했습니다. 내일 다시 이용해주세요.",
  DAILY_IMAGE_LIMIT: "오늘의 사진 분석 2회를 모두 사용했습니다. 내일 다시 이용해주세요.",
  USAGE_CHECK_FAILED: "사용량 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
};

function getFriendlyErrorMessage(errorCode, fallbackMessage) {
  return USER_ERROR_MESSAGES[errorCode] || fallbackMessage || USER_ERROR_MESSAGES.API_ERROR;
}

function renderError(message, errorCode = "") {
  resultPanel.innerHTML = "";

  const errorBox = document.createElement("div");
  errorBox.className = "error-box";

  const icon = document.createElement("span");
  icon.className = "error-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "!";

  const content = document.createElement("div");
  content.className = "error-content";

  const title = document.createElement("strong");
  title.textContent = "잠시 문제가 생겼어요";

  const summary = document.createElement("p");
  summary.textContent = message;

  content.append(title, summary);

  if (errorCode) {
    const code = document.createElement("code");
    code.className = "error-code";
    code.textContent = `오류 코드: ${errorCode}`;
    content.append(code);
  }

  errorBox.append(icon, content);

  resultPanel.append(errorBox);
}

function getFirebaseAuthErrorMessage(error) {
  const code = error?.code || "auth/unknown";
  const messages = {
    "auth/unauthorized-domain": "현재 도메인이 Firebase Auth 승인 도메인에 등록되어 있지 않습니다. Firebase 콘솔의 Authentication > Settings > Authorized domains에 이 사이트 도메인을 추가해주세요.",
    "auth/popup-closed-by-user": "로그인 팝업이 닫혔습니다. 다시 Google로 로그인을 눌러주세요.",
    "auth/operation-not-allowed": "Firebase 콘솔에서 Google 로그인 제공업체가 활성화되어 있지 않습니다. Authentication > Sign-in method에서 Google을 사용 설정해주세요.",
    "auth/popup-blocked": "브라우저가 로그인 팝업을 차단했습니다. 팝업 허용 후 다시 시도해주세요.",
    "auth/cancelled-popup-request": "이전 로그인 팝업 요청이 취소되었습니다. 잠시 후 다시 시도해주세요.",
    "auth/network-request-failed": "네트워크 연결 문제로 로그인하지 못했습니다. 인터넷 연결을 확인해주세요."
  };

  return {
    code,
    message: messages[code] || "Google 로그인 중 문제가 발생했습니다. 아래 오류 코드를 확인해주세요."
  };
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
  const savedTitle = item.hasImage ? `사진 분석 · ${item.question}` : item.question;
  title.textContent = source === "favorites" ? `★ ${savedTitle}` : savedTitle;
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
  saveHistoryItemToCloud(item).catch((error) => handleCloudSaveError("Failed to save history item to Firestore:", error));
  saveSnapshotToCloud().catch((error) => handleCloudSaveError("Failed to save history to Firestore:", error));
}

function removeHistory(id) {
  setHistory(getHistory().filter((item) => item.id !== id));
  renderHistory();
  saveSnapshotToCloud().catch((error) => handleCloudSaveError("Failed to remove history from Firestore:", error));
}

function isFavorite(id) {
  return getFavorites().some((item) => item.id === id);
}

function addFavorite(item) {
  const favorites = getFavorites();

  if (!favorites.some((favorite) => favorite.id === item.id)) {
    setFavorites([item, ...favorites]);
    renderFavorites();
    saveSnapshotToCloud().catch((error) => handleCloudSaveError("Failed to save favorite to Firestore:", error));
  }
}

function removeFavorite(id) {
  setFavorites(getFavorites().filter((item) => item.id !== id));
  renderFavorites();
  saveSnapshotToCloud().catch((error) => handleCloudSaveError("Failed to remove favorite from Firestore:", error));
}

function clearSelectedPhoto() {
  selectedPhoto = null;
  photoInput.value = "";
  photoPreview.hidden = true;
  photoPreviewImage.removeAttribute("src");
  photoPreviewName.textContent = "선택한 사진";
}

function readPhotoFile(file) {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      reject({ userMessage: USER_ERROR_MESSAGES.INVALID_IMAGE });
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      reject({ userMessage: USER_ERROR_MESSAGES.IMAGE_TOO_LARGE });
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = String(reader.result);
      const [, base64Data = ""] = dataUrl.split(",");

      resolve({
        name: file.name,
        mimeType: file.type,
        dataUrl,
        data: base64Data
      });
    };

    reader.onerror = () => {
      reject({ userMessage: "사진을 불러오지 못했습니다. 다른 사진을 선택해주세요." });
    };

    reader.readAsDataURL(file);
  });
}

async function handlePhotoChange(event) {
  const [file] = event.target.files;

  if (!file) {
    clearSelectedPhoto();
    return;
  }

  try {
    selectedPhoto = await readPhotoFile(file);
    photoPreviewImage.src = selectedPhoto.dataUrl;
    photoPreviewName.textContent = selectedPhoto.name;
    photoPreview.hidden = false;
  } catch (error) {
    console.error("Failed to read uploaded photo:", error);
    clearSelectedPhoto();
    renderError(error.userMessage || USER_ERROR_MESSAGES.INVALID_IMAGE);
  }
}

async function askQuestion(question) {
  const profile = getProfile();
  const profileSummary = profileToSummary(profile);
  const imagePayload = selectedPhoto
    ? {
        mimeType: selectedPhoto.mimeType,
        data: selectedPhoto.data
      }
    : null;
  const hasPhoto = Boolean(imagePayload);
  const finalQuestion = question || "이 사진을 분석해 주세요.";

  console.info("Sending child profile with Gemini request:", {
    hasProfile: hasProfileData(profile),
    profile
  });

  setLoading(finalQuestion, hasPhoto);
  searchButton.disabled = true;
  searchButton.textContent = hasPhoto ? "분석중..." : "상담 중";

  try {
    const usageResult = await reserveDailyUsage(hasPhoto);

    if (!usageResult.allowed) {
      throw {
        errorCode: usageResult.errorCode,
        userMessage: USER_ERROR_MESSAGES[usageResult.errorCode] || USER_ERROR_MESSAGES.USAGE_CHECK_FAILED
      };
    }

    const response = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: finalQuestion,
        childProfile: profile,
        image: imagePayload
      })
    });

    const rawBody = await response.text();
    let data;

    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseError) {
      console.error("Failed to parse server response:", {
        rawBody,
        parseError
      });

      throw {
        userMessage: USER_ERROR_MESSAGES.API_ERROR,
        cause: parseError
      };
    }

    if (!response.ok) {
      console.error("Server returned an AI error:", {
        status: response.status,
        response: data
      });

      throw {
        errorCode: data.errorCode,
        userMessage: getFriendlyErrorMessage(data.errorCode, data.error),
        serverResponse: data
      };
    }

    const item = {
      id: createId(),
      question: finalQuestion,
      answer: data.answer,
      createdAt: new Date().toISOString(),
      profile,
      profileSummary,
      hasImage: hasPhoto,
      imageName: selectedPhoto?.name || ""
    };

    addHistory(item);
    renderAnswer(item, {
      truncated: data.truncated,
      finishReason: data.finishReason
    });
  } catch (error) {
    console.error("Failed to ask Gemini:", error);

    if (error instanceof TypeError) {
      renderError(USER_ERROR_MESSAGES.NETWORK_ERROR);
    } else {
      renderError(error.userMessage || USER_ERROR_MESSAGES.API_ERROR);
    }
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
  const profile = collectProfileForm();
  setProfile(profile);
  loadProfileForm();
  saveProfileToCloud(profile, { showToast: true }).catch((error) => handleCloudSaveError("Failed to save profile document to Firestore:", error));
  saveSnapshotToCloud().catch((error) => handleCloudSaveError("Failed to save profile snapshot to Firestore:", error));
});

clearProfileButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEYS.profile);
  loadProfileForm();
  saveSnapshotToCloud().catch((error) => handleCloudSaveError("Failed to clear profile in Firestore:", error));
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();

  if (!question && !selectedPhoto) {
    questionInput.focus();
    return;
  }

  askQuestion(question);
});

photoInput.addEventListener("change", handlePhotoChange);
removePhotoButton.addEventListener("click", clearSelectedPhoto);

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
  saveSnapshotToCloud().catch((error) => handleCloudSaveError("Failed to clear history in Firestore:", error));
});

clearFavoritesButton.addEventListener("click", () => {
  setFavorites([]);
  renderFavorites();
  saveSnapshotToCloud().catch((error) => handleCloudSaveError("Failed to clear favorites in Firestore:", error));
});

loginButton.addEventListener("click", async () => {
  if (!firebaseState.enabled || !firebaseState.auth || !firebaseState.modules) {
    renderError("Firebase 설정이 아직 완료되지 않았습니다.");
    return;
  }

  try {
    const provider = new firebaseState.modules.GoogleAuthProvider();
    await firebaseState.modules.signInWithPopup(firebaseState.auth, provider);
  } catch (error) {
    console.error("Failed to sign in with Google:", error);
    const authError = getFirebaseAuthErrorMessage(error);
    renderError(authError.message, authError.code);
  }
});

logoutButton.addEventListener("click", async () => {
  if (!firebaseState.auth || !firebaseState.modules) {
    return;
  }

  try {
    requestedLogout = true;
    await firebaseState.modules.signOut(firebaseState.auth);
  } catch (error) {
    requestedLogout = false;
    console.error("Failed to sign out:", error);
    renderError("로그아웃에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
});

migrateLegacyStorage();
loadProfileForm();
renderHistory();
renderFavorites();
observeRevealElements();
initializeFirebase();
