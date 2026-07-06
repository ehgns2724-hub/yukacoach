const STORAGE_KEYS = {
  profile: "babyCoach.profile",
  history: "babyCoach.history",
  favorites: "babyCoach.favorites",
  growth: "babyCoach.growth",
  vaccinations: "babyCoach.vaccinations",
  diary: "babyCoach.diary"
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
const authAvatar = document.querySelector("#authAvatar");
const adminBadge = document.querySelector("#adminBadge");
const toast = document.querySelector("#toast");
const featureTabs = document.querySelectorAll("[data-view-target]");
const featureViews = document.querySelectorAll("[data-view]");

const growthForm = document.querySelector("#growthForm");
const growthDateInput = document.querySelector("#growthDate");
const growthHeightInput = document.querySelector("#growthHeight");
const growthWeightInput = document.querySelector("#growthWeight");
const growthMemoInput = document.querySelector("#growthMemo");
const growthList = document.querySelector("#growthList");
const growthChart = document.querySelector("#growthChart");

const vaccineList = document.querySelector("#vaccineList");

const diaryForm = document.querySelector("#diaryForm");
const diaryDateInput = document.querySelector("#diaryDate");
const diarySleepInput = document.querySelector("#diarySleep");
const diaryFeedingInput = document.querySelector("#diaryFeeding");
const diaryDiapersInput = document.querySelector("#diaryDiapers");
const diaryMoodInput = document.querySelector("#diaryMood");
const diaryMemoInput = document.querySelector("#diaryMemo");
const diaryList = document.querySelector("#diaryList");

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
  cloudAvailable: false,
  adminEmailHash: "",
  isAdmin: false
};
let requestedLogout = false;

const FIRESTORE_TIMEOUT_MS = 8000;
const DAILY_TEXT_LIMIT = 10;
const DAILY_IMAGE_LIMIT = 2;
const ADMIN_DAILY_LIMIT = 100;
const VACCINE_DEFAULTS = [
  ["BCG", "생후 4주 이내"],
  ["B형간염", "출생 직후, 1개월, 6개월"],
  ["DTaP", "2, 4, 6개월 및 추가 접종"],
  ["IPV", "2, 4, 6개월 및 추가 접종"],
  ["Hib", "2, 4, 6개월 및 추가 접종"],
  ["폐렴구균", "2, 4, 6개월 및 추가 접종"],
  ["로타바이러스", "2, 4개월 또는 2, 4, 6개월"],
  ["MMR", "12~15개월, 4~6세"],
  ["수두", "12~15개월"],
  ["일본뇌염", "12개월 이후"],
  ["인플루엔자", "매년 접종 권장"]
].map(([name, timing]) => ({ id: name, name, timing, done: false, memo: "" }));

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

function getGrowthRecords() {
  return readJson(STORAGE_KEYS.growth, []);
}

function setGrowthRecords(items) {
  writeJson(STORAGE_KEYS.growth, items);
}

function getVaccinations() {
  const saved = readJson(STORAGE_KEYS.vaccinations, []);
  return VACCINE_DEFAULTS.map((item) => ({
    ...item,
    ...(saved.find((savedItem) => savedItem.id === item.id) || {})
  }));
}

function setVaccinations(items) {
  writeJson(STORAGE_KEYS.vaccinations, items);
}

function getDiaryEntries() {
  return readJson(STORAGE_KEYS.diary, []);
}

function setDiaryEntries(items) {
  writeJson(STORAGE_KEYS.diary, items);
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

function getUserCollectionRef(name) {
  if (!firebaseState.user || !firebaseState.db || !firebaseState.modules) {
    return null;
  }

  return firebaseState.modules.collection(firebaseState.db, "users", firebaseState.user.uid, name);
}

function getUserDocRef(collectionName, id) {
  if (!firebaseState.user || !firebaseState.db || !firebaseState.modules) {
    return null;
  }

  return firebaseState.modules.doc(firebaseState.db, "users", firebaseState.user.uid, collectionName, id);
}

function getUserCollectionPath(name) {
  return firebaseState.user ? `users/${firebaseState.user.uid}/${name}` : "";
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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function hashEmail(email) {
  const normalized = normalizeEmail(email);

  if (!normalized || !window.crypto?.subtle) {
    return "";
  }

  const bytes = new TextEncoder().encode(normalized);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function resolveAdminState(user) {
  const email = normalizeEmail(user?.email);

  if (!email) {
    return false;
  }

  try {
    const response = await fetch("/api/admin-role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });
    const data = await response.json();

    if (!response.ok) {
      console.error("Admin role check failed:", data);
      return false;
    }

    return Boolean(data.isAdmin);
  } catch (error) {
    console.error("Admin role check failed:", error);
    return false;
  }
}

function getUserDisplayName(user = firebaseState.user) {
  return user?.displayName || user?.email || "Google 계정";
}

function getAuthStatusText(suffix = "클라우드 저장 완료") {
  const roleText = firebaseState.isAdmin ? "관리자 100회" : "일반 10회";
  return `${getUserDisplayName()} · ${roleText} · ${suffix}`;
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
      authStatus.textContent = getAuthStatusText("클라우드 저장 완료");
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

async function saveBetaItem(collectionName, item) {
  if (!firebaseState.user || !firebaseState.cloudAvailable) {
    return;
  }

  const docRef = getUserDocRef(collectionName, item.id);
  const path = `${getUserCollectionPath(collectionName)}/${item.id}`;
  const payload = collectionName === "vaccinations" && !item.date
    ? { ...item, date: item.id }
    : item;

  if (!docRef) {
    return;
  }

  console.log(`Firestore ${collectionName} setDoc start:`, { path, item: payload });

  try {
    await withTimeout(firebaseState.modules.setDoc(docRef, payload, { merge: true }), `Firestore ${collectionName} setDoc`);
    console.log(`Firestore ${collectionName} setDoc success:`, { path });
  } catch (error) {
    console.error(`Firestore ${collectionName} setDoc failed:`, { path, error });
    showToast("클라우드 저장 실패 - 로컬에 저장했어요");
  }
}

async function deleteBetaItem(collectionName, id) {
  if (!firebaseState.user || !firebaseState.cloudAvailable) {
    return;
  }

  const docRef = getUserDocRef(collectionName, id);
  const path = `${getUserCollectionPath(collectionName)}/${id}`;

  if (!docRef) {
    return;
  }

  console.log(`Firestore ${collectionName} deleteDoc start:`, { path });

  try {
    await withTimeout(firebaseState.modules.deleteDoc(docRef), `Firestore ${collectionName} deleteDoc`);
    console.log(`Firestore ${collectionName} deleteDoc success:`, { path });
  } catch (error) {
    console.error(`Firestore ${collectionName} deleteDoc failed:`, { path, error });
    showToast("클라우드 삭제 실패 - 로컬에서만 삭제했어요");
  }
}

async function loadBetaCollection(collectionName, fallbackItems = []) {
  const collectionRef = getUserCollectionRef(collectionName);

  if (!collectionRef) {
    return fallbackItems;
  }

  const path = getUserCollectionPath(collectionName);
  console.log(`Firestore ${collectionName} query start:`, { path });

  try {
    const queryRef = firebaseState.modules.query(
      collectionRef,
      firebaseState.modules.orderBy("date", "desc"),
      firebaseState.modules.limit(30)
    );
    const snapshot = await withTimeout(firebaseState.modules.getDocs(queryRef), `Firestore ${collectionName} getDocs`);
    const items = snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data()
    }));
    console.log(`Firestore ${collectionName} query success:`, { path, count: items.length });
    return items.length ? items : fallbackItems;
  } catch (error) {
    console.error(`Firestore ${collectionName} query failed:`, { path, error });
    showToast("클라우드 데이터를 불러오지 못해 로컬 데이터를 표시합니다");
    return fallbackItems;
  }
}

async function migrateBetaCollection(collectionName, items) {
  if (!firebaseState.user || !firebaseState.cloudAvailable || !items.length) {
    return;
  }

  await Promise.all(items.map((item) => saveBetaItem(collectionName, item)));
}

async function reserveDailyUsage(hasPhoto) {
  if (!firebaseState.user || !firebaseState.db || !firebaseState.modules) {
    return { allowed: true, mode: "local" };
  }

  const dateKey = getTodayKey();
  const usageDoc = getUsageDocRef(dateKey);
  const path = getUsageDocPath(dateKey);
  const field = firebaseState.isAdmin ? "totalCount" : (hasPhoto ? "imageCount" : "textCount");
  const limit = firebaseState.isAdmin ? ADMIN_DAILY_LIMIT : (hasPhoto ? DAILY_IMAGE_LIMIT : DAILY_TEXT_LIMIT);
  const role = firebaseState.isAdmin ? "admin" : "user";

  console.log("Firestore usage check start:", {
    path,
    field,
    limit,
    role
  });

  try {
    const result = await withTimeout(firebaseState.modules.runTransaction(firebaseState.db, async (transaction) => {
      const snapshot = await transaction.get(usageDoc);
      const currentData = snapshot.exists() ? snapshot.data() : {};
      const currentCount = Number(currentData[field] || 0);

      if (currentCount >= limit) {
        return {
          allowed: false,
          errorCode: firebaseState.isAdmin ? "DAILY_ADMIN_LIMIT" : (hasPhoto ? "DAILY_IMAGE_LIMIT" : "DAILY_TEXT_LIMIT"),
          currentCount,
          limit,
          role
        };
      }

      const nextData = {
        date: dateKey,
        textCount: Number(currentData.textCount || 0),
        imageCount: Number(currentData.imageCount || 0),
        totalCount: Number(currentData.totalCount || 0),
        role,
        limit,
        isAdmin: firebaseState.isAdmin,
        updatedAt: new Date().toISOString()
      };

      if (firebaseState.isAdmin) {
        nextData.totalCount = currentCount + 1;
        nextData[hasPhoto ? "imageCount" : "textCount"] += 1;
      } else {
        nextData[field] = currentCount + 1;
        nextData.totalCount += 1;
      }

      transaction.set(usageDoc, nextData, { merge: true });

      return {
        allowed: true,
        currentCount: currentCount + 1,
        limit,
        role
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
    authStatus.textContent = getAuthStatusText("클라우드 저장 완료");

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
  authStatus.textContent = getAuthStatusText("클라우드 저장 중");

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

    authStatus.textContent = getAuthStatusText("클라우드 저장 완료");
    firebaseState.cloudAvailable = true;
    await loadBetaFeaturesFromCloud();
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
    authStatus.textContent = getAuthStatusText("클라우드 저장 중");
    loginButton.hidden = true;
    loginButton.disabled = false;
    logoutButton.hidden = false;

    if (authAvatar) {
      authAvatar.hidden = !user.photoURL;
      authAvatar.src = user.photoURL || "";
    }

    if (adminBadge) {
      adminBadge.hidden = !firebaseState.isAdmin;
    }

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

  if (authAvatar) {
    authAvatar.hidden = true;
    authAvatar.removeAttribute("src");
  }

  if (adminBadge) {
    adminBadge.hidden = true;
  }
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
      appIdPreview: data.config.appId ? `${data.config.appId.slice(0, 4)}...${data.config.appId.slice(-4)}` : "",
      hasAdminEmailHash: Boolean(data.adminEmailHash)
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
      syncing: false,
      cloudAvailable: false,
      adminEmailHash: data.adminEmailHash || "",
      isAdmin: false,
      modules: {
        GoogleAuthProvider: authModule.GoogleAuthProvider,
        signInWithPopup: authModule.signInWithPopup,
        setPersistence: authModule.setPersistence,
        browserSessionPersistence: authModule.browserSessionPersistence,
        signOut: authModule.signOut,
        onAuthStateChanged: authModule.onAuthStateChanged,
        doc: firestoreModule.doc,
        collection: firestoreModule.collection,
        getDoc: firestoreModule.getDoc,
        getDocs: firestoreModule.getDocs,
        setDoc: firestoreModule.setDoc,
        deleteDoc: firestoreModule.deleteDoc,
        runTransaction: firestoreModule.runTransaction,
        query: firestoreModule.query,
        orderBy: firestoreModule.orderBy,
        limit: firestoreModule.limit
      }
    };

    await firebaseState.modules.setPersistence(firebaseState.auth, firebaseState.modules.browserSessionPersistence);

    firebaseState.modules.onAuthStateChanged(firebaseState.auth, async (user) => {
      firebaseState.user = user;
      firebaseState.isAdmin = await resolveAdminState(user);
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
  DAILY_ADMIN_LIMIT: "관리자 하루 질문 100회를 모두 사용했습니다. 내일 다시 이용해주세요.",
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

function sortByDateDesc(items) {
  return [...items].sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function renderGrowth() {
  const records = sortByDateDesc(getGrowthRecords());
  growthList.innerHTML = "";

  if (!records.length) {
    growthList.append(createEmptyMessage("성장 기록을 추가해보세요."));
    growthChart.innerHTML = "<p class=\"empty-list\">성장 기록을 추가해보세요.</p>";
    return;
  }

  records.slice(0, 8).forEach((record) => {
    const item = document.createElement("article");
    item.className = "saved-item";
    item.innerHTML = `
      <strong>${escapeHtml(record.date)}</strong>
      <p class="saved-meta">키 ${escapeHtml(record.height)}cm · 몸무게 ${escapeHtml(record.weight)}kg</p>
      <p class="saved-preview">${escapeHtml(record.memo || "메모 없음")}</p>
    `;
    growthList.append(item);
  });

  renderGrowthChart(records.slice().reverse());
}

function renderGrowthChart(records) {
  const width = 640;
  const height = 240;
  const padding = 34;
  const recent = records.slice(-8);

  if (recent.length < 2) {
    growthChart.innerHTML = "<p class=\"empty-list\">그래프를 보려면 성장 기록을 2개 이상 추가해주세요.</p>";
    return;
  }

  const heights = recent.map((item) => Number(item.height));
  const weights = recent.map((item) => Number(item.weight));
  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const xFor = (index) => padding + (index * (width - padding * 2)) / (recent.length - 1);
  const yFor = (value, min, max) => height - padding - ((value - min) * (height - padding * 2)) / Math.max(max - min, 1);
  const heightPoints = recent.map((item, index) => `${xFor(index)},${yFor(Number(item.height), minHeight, maxHeight)}`).join(" ");
  const weightPoints = recent.map((item, index) => `${xFor(index)},${yFor(Number(item.weight), minWeight, maxWeight)}`).join(" ");

  growthChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="키와 몸무게 변화 그래프">
      <rect x="0" y="0" width="${width}" height="${height}" rx="24" fill="#fbfdff"></rect>
      <polyline points="${heightPoints}" fill="none" stroke="#5B8DEF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <polyline points="${weightPoints}" fill="none" stroke="#FFB86B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
    <div class="chart-legend"><span class="height-dot"></span>키 <span class="weight-dot"></span>몸무게</div>
  `;
}

function renderVaccinations() {
  const items = getVaccinations();
  vaccineList.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = "vaccine-item";
    row.innerHTML = `
      <label>
        <input type="checkbox" ${item.done ? "checked" : ""} data-vaccine-check="${item.id}">
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <em>${escapeHtml(item.timing)}</em>
        </span>
      </label>
      <input type="text" value="${escapeHtml(item.memo || "")}" placeholder="메모" data-vaccine-memo="${item.id}">
    `;
    vaccineList.append(row);
  });
}

function saveVaccinationsFromUI() {
  const nextItems = getVaccinations().map((item) => {
    const checkbox = vaccineList.querySelector(`[data-vaccine-check="${CSS.escape(item.id)}"]`);
    const memo = vaccineList.querySelector(`[data-vaccine-memo="${CSS.escape(item.id)}"]`);
    return {
      ...item,
      done: Boolean(checkbox?.checked),
      memo: memo?.value.trim() || "",
      date: item.id
    };
  });

  setVaccinations(nextItems);
  nextItems.forEach((item) => saveBetaItem("vaccinations", item));
  showToast("예방접종 체크리스트 저장 완료");
}

function renderDiary() {
  const entries = sortByDateDesc(getDiaryEntries());
  diaryList.innerHTML = "";

  if (!entries.length) {
    diaryList.append(createEmptyMessage("아직 작성한 육아일기가 없습니다."));
    return;
  }

  entries.slice(0, 10).forEach((entry) => {
    const item = document.createElement("article");
    item.className = "saved-item";
    item.innerHTML = `
      <button class="saved-title" type="button">${escapeHtml(entry.date)} · ${escapeHtml(entry.mood || "기록")}</button>
      <p class="saved-meta">수면 ${escapeHtml(entry.sleep || "-")} · 기저귀 ${escapeHtml(entry.diapers || 0)}회</p>
      <p class="saved-preview">${escapeHtml(entry.feeding || "")} ${escapeHtml(entry.memo || "")}</p>
      <button class="text-button danger-text" type="button" data-diary-delete="${entry.id}">삭제</button>
    `;
    diaryList.append(item);
  });
}

function setDefaultDates() {
  const today = getTodayKey();
  growthDateInput.value = today;
  diaryDateInput.value = today;
}

async function loadBetaFeaturesFromCloud() {
  if (!firebaseState.user || !firebaseState.cloudAvailable) {
    return;
  }

  await migrateBetaCollection("growth", getGrowthRecords());
  await migrateBetaCollection("vaccinations", getVaccinations());
  await migrateBetaCollection("diary", getDiaryEntries());

  setGrowthRecords(await loadBetaCollection("growth", getGrowthRecords()));
  setVaccinations(await loadBetaCollection("vaccinations", getVaccinations()));
  setDiaryEntries(await loadBetaCollection("diary", getDiaryEntries()));

  renderGrowth();
  renderVaccinations();
  renderDiary();
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

featureTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.viewTarget;

    featureTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    featureViews.forEach((view) => view.classList.toggle("is-active", view.dataset.view === target));
  });
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
  saveSnapshotToCloud().catch((error) => handleCloudSaveError("Failed to clear history in Firestore:", error));
});

clearFavoritesButton.addEventListener("click", () => {
  setFavorites([]);
  renderFavorites();
  saveSnapshotToCloud().catch((error) => handleCloudSaveError("Failed to clear favorites in Firestore:", error));
});

growthForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const record = {
    id: createId(),
    date: growthDateInput.value,
    height: growthHeightInput.value,
    weight: growthWeightInput.value,
    memo: growthMemoInput.value.trim(),
    createdAt: new Date().toISOString()
  };
  const nextRecords = sortByDateDesc([record, ...getGrowthRecords()]);
  setGrowthRecords(nextRecords);
  renderGrowth();
  saveBetaItem("growth", record);
  showToast("성장 기록 저장 완료");
  growthForm.reset();
  growthDateInput.value = getTodayKey();
});

vaccineList.addEventListener("change", saveVaccinationsFromUI);
vaccineList.addEventListener("input", (event) => {
  if (event.target.matches("[data-vaccine-memo]")) {
    window.clearTimeout(vaccineList.saveTimeoutId);
    vaccineList.saveTimeoutId = window.setTimeout(saveVaccinationsFromUI, 500);
  }
});

diaryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const entry = {
    id: createId(),
    date: diaryDateInput.value,
    sleep: diarySleepInput.value.trim(),
    feeding: diaryFeedingInput.value.trim(),
    diapers: diaryDiapersInput.value || "0",
    mood: diaryMoodInput.value.trim(),
    memo: diaryMemoInput.value.trim(),
    createdAt: new Date().toISOString()
  };
  const nextEntries = sortByDateDesc([entry, ...getDiaryEntries()]);
  setDiaryEntries(nextEntries);
  renderDiary();
  saveBetaItem("diary", entry);
  showToast("육아일기 저장 완료");
  diaryForm.reset();
  diaryDateInput.value = getTodayKey();
});

diaryList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-diary-delete]");

  if (!deleteButton) {
    return;
  }

  const nextEntries = getDiaryEntries().filter((entry) => entry.id !== deleteButton.dataset.diaryDelete);
  setDiaryEntries(nextEntries);
  renderDiary();
  deleteBetaItem("diary", deleteButton.dataset.diaryDelete);
  showToast("육아일기를 삭제했어요");
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
setDefaultDates();
renderGrowth();
renderVaccinations();
renderDiary();
observeRevealElements();
initializeFirebase();
