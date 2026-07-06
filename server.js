const express = require("express");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || process.env.MODEL_NAME || "gemini-2.5-flash-lite";
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || GEMINI_MODEL;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const PUBLIC_DIR = __dirname;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};
const PROFILE_USED_NOTE = "이 답변은 저장된 아이 프로필을 참고해 작성되었습니다.";

function maskConfigValue(value) {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function hashEmail(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function getFirebaseConfigDiagnostics() {
  return {
    hasApiKey: Boolean(FIREBASE_CONFIG.apiKey),
    apiKeyPreview: maskConfigValue(FIREBASE_CONFIG.apiKey),
    authDomain: FIREBASE_CONFIG.authDomain || "",
    projectId: FIREBASE_CONFIG.projectId || "",
    storageBucket: FIREBASE_CONFIG.storageBucket || "",
    messagingSenderId: maskConfigValue(FIREBASE_CONFIG.messagingSenderId),
    appIdPreview: maskConfigValue(FIREBASE_CONFIG.appId),
    hasAdminEmail: Boolean(ADMIN_EMAIL)
  };
}

const CLIENT_ERROR_MESSAGES = {
  INVALID_REQUEST: "질문을 입력해주세요.",
  MISSING_API_KEY: "AI 서버 설정이 아직 완료되지 않았습니다.",
  QUOTA_EXCEEDED: "현재 AI 사용량이 많아 답변이 지연되고 있어요. 잠시 후 다시 시도해주세요.",
  NETWORK_ERROR: "인터넷 연결을 확인해주세요.",
  API_ERROR: "AI 서버에 일시적인 문제가 발생했습니다.",
  INVALID_IMAGE: "jpg, jpeg, png, webp 형식의 사진만 업로드할 수 있습니다."
};

function sendClientError(res, status, errorCode) {
  return res.status(status).json({
    errorCode,
    error: CLIENT_ERROR_MESSAGES[errorCode] || CLIENT_ERROR_MESSAGES.API_ERROR
  });
}

function isGeminiFallbackError(status, data = {}, message = "") {
  const errorStatus = data.error?.status || "";
  const errorMessage = data.error?.message || message || "";

  return (
    status === 429 ||
    status === 503 ||
    errorStatus === "RESOURCE_EXHAUSTED" ||
    errorStatus === "UNAVAILABLE" ||
    errorMessage.includes("RESOURCE_EXHAUSTED") ||
    errorMessage.includes("QUOTA_EXCEEDED") ||
    errorMessage.includes("quota") ||
    errorMessage.includes("overloaded")
  );
}

async function callGroqFallback(prompt) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  console.warn("Falling back to Groq API:", { model: GROQ_MODEL });

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a careful Korean parenting coach. Answer in Korean and follow the user's safety instructions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 1200
    })
  });

  const rawBody = await groqResponse.text();
  let data;

  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch (parseError) {
    console.error("Groq API returned a non-JSON response:", {
      status: groqResponse.status,
      statusText: groqResponse.statusText,
      body: rawBody,
      parseError
    });
    throw new Error("Groq API response parse failed.");
  }

  if (!groqResponse.ok) {
    console.error("Groq API request failed:", {
      status: groqResponse.status,
      statusText: groqResponse.statusText,
      error: data.error || data
    });
    throw new Error(data.error?.message || "Groq API request failed.");
  }

  const answer = data.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    console.error("Groq response did not include answer text:", data);
    throw new Error("Groq API returned empty answer.");
  }

  return {
    answer,
    finishReason: data.choices?.[0]?.finish_reason || "groq_fallback",
    truncated: false
  };
}

app.use(express.json({ limit: "12mb" }));
app.use(express.static(PUBLIC_DIR, {
  extensions: ["html"],
  index: false,
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

app.get("/api/firebase-config", (req, res) => {
  console.info("Firebase config diagnostics:", getFirebaseConfigDiagnostics());

  const missingKeys = Object.entries(FIREBASE_CONFIG)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length) {
    console.warn("Firebase config is incomplete:", missingKeys);

    return res.status(503).json({
      enabled: false,
      error: "Firebase 설정이 아직 완료되지 않았습니다."
    });
  }

  return res.json({
    enabled: true,
    config: FIREBASE_CONFIG,
    adminEmailHash: hashEmail(ADMIN_EMAIL)
  });
});

app.post("/api/ask", async (req, res) => {
  const question = typeof req.body.question === "string" ? req.body.question.trim() : "";
  const childProfile = typeof req.body.childProfile === "object" && req.body.childProfile !== null
    ? req.body.childProfile
    : {};
  const image = typeof req.body.image === "object" && req.body.image !== null ? req.body.image : null;
  const hasImage = Boolean(image?.data && image?.mimeType);

  if (!question) {
    console.error("Invalid /api/ask request: missing question body.");

    return sendClientError(res, 400, "INVALID_REQUEST");
  }

  if (hasImage && !ALLOWED_IMAGE_TYPES.has(image.mimeType)) {
    console.error("Invalid image upload type:", image.mimeType);

    return sendClientError(res, 400, "INVALID_IMAGE");
  }

  if (!GEMINI_API_KEY) {
    console.error("Server configuration error: GEMINI_API_KEY is missing from .env.");

    return sendClientError(res, 500, "MISSING_API_KEY");
  }

  const profileFields = {
    childName: childProfile.childName ? String(childProfile.childName).trim() : "",
    childMonths: childProfile.childMonths ? String(childProfile.childMonths).trim() : "",
    childGender: childProfile.childGender ? String(childProfile.childGender).trim() : "",
    feedingType: childProfile.feedingType ? String(childProfile.feedingType).trim() : "",
    solidFoodStage: childProfile.solidFoodStage ? String(childProfile.solidFoodStage).trim() : "",
    allergies: childProfile.allergies ? String(childProfile.allergies).trim() : "",
    sleepPattern: childProfile.sleepPattern ? String(childProfile.sleepPattern).trim() : "",
    notes: childProfile.notes ? String(childProfile.notes).trim() : ""
  };

  const profileLines = [
    profileFields.childName ? `- 아이 이름: ${profileFields.childName}` : "",
    profileFields.childMonths ? `- 개월 수: ${profileFields.childMonths}개월` : "",
    profileFields.childGender ? `- 성별: ${profileFields.childGender}` : "",
    profileFields.feedingType ? `- 수유 방식: ${profileFields.feedingType}` : "",
    profileFields.solidFoodStage ? `- 이유식 단계: ${profileFields.solidFoodStage}` : "",
    profileFields.allergies ? `- 알레르기: ${profileFields.allergies}` : "",
    profileFields.sleepPattern ? `- 수면 패턴: ${profileFields.sleepPattern}` : "",
    profileFields.notes ? `- 특이사항: ${profileFields.notes}` : ""
  ].filter(Boolean);

  const hasProfile = profileLines.length > 0;
  const profileSummary = hasProfile
    ? [
        profileFields.childName ? `아이 이름은 ${profileFields.childName}` : "",
        profileFields.childMonths || profileFields.childGender
          ? `${profileFields.childMonths ? `${profileFields.childMonths}개월` : ""}${profileFields.childGender ? ` ${profileFields.childGender}` : ""}`.trim()
          : "",
        profileFields.feedingType,
        profileFields.solidFoodStage ? `이유식 ${profileFields.solidFoodStage}` : "",
        profileFields.allergies,
        profileFields.sleepPattern,
        profileFields.notes
      ].filter(Boolean).join(", ")
    : "";
  const personalizationInstruction = hasProfile
    ? [
        "저장된 아이 프로필을 반드시 답변에 반영하세요.",
        "프로필 정보 중 질문과 직접 관련 있는 항목을 자연스럽게 언급하세요.",
        `답변 마지막에는 반드시 다음 문장을 그대로 포함하세요: "${PROFILE_USED_NOTE}"`
      ].join(" ")
    : "저장된 아이 프로필이 없으므로 일반 육아 답변을 제공합니다. 프로필이 없다는 이유만으로 답변을 거절하지 마세요.";

  console.info("Gemini request child profile context:", {
    hasProfile,
    profileSummary: profileSummary || "empty",
    fields: profileLines
  });

  const basePrompt = [
    "당신은 보호자를 돕는 한국어 AI 맞춤 육아 코치입니다.",
    "의학적 확정 진단을 하지 말고, 안전하고 일반적인 육아 정보를 제공합니다.",
    "응급 증상이나 위험 신호가 있으면 의료 전문가 상담을 권합니다.",
    "아이 프로필이 있으면 모든 답변에서 반드시 그 정보를 참고해 개인화된 답변을 제공합니다.",
    "아이의 개월 수, 성별, 수유 방식, 이유식 단계, 알레르기, 수면 패턴, 특이사항을 질문보다 우선 맥락으로 반영하세요.",
    "답변은 한국어로 작성하고, 핵심 요약과 바로 해볼 수 있는 방법을 포함하세요.",
    "답변은 8문장 이내 또는 짧은 bullet 형태로 간결하게 작성하세요.",
    personalizationInstruction,
    "",
    "아이 프로필:",
    profileLines.length ? profileLines.join("\n") : "- 저장된 프로필 없음",
    profileSummary ? `요약 문장: ${profileSummary}.` : "",
    "",
    `질문: ${question}`
  ].join("\n");

  const visionPrompt = [
    "당신은 소아과 전문의와 육아 전문가입니다.",
    "",
    "이미지를 먼저 분석한 후",
    "",
    "1. 보이는 내용",
    "2. 가능한 원인",
    "3. 집에서 관리하는 방법",
    "4. 병원에 가야 하는 경우",
    "5. 응급 여부",
    "",
    "를 부모도 이해하기 쉽게 설명해주세요.",
    "",
    "확실하지 않은 내용은 추측하지 말고",
    "'정확한 진단은 의료기관에서 받아야 합니다.'",
    "를 반드시 포함해주세요.",
    "",
    "아이 프로필이 있으면 이미지 분석과 답변에 반드시 함께 반영하세요.",
    personalizationInstruction,
    "",
    "아이 프로필:",
    profileLines.length ? profileLines.join("\n") : "- 저장된 프로필 없음",
    profileSummary ? `요약 문장: ${profileSummary}.` : "",
    "",
    `질문: ${question}`
  ].join("\n");

  const prompt = hasImage ? visionPrompt : basePrompt;
  const parts = [{ text: prompt }];

  if (hasImage) {
    parts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.data
      }
    });
  }

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${hasImage ? GEMINI_VISION_MODEL : GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const rawBody = await geminiResponse.text();
    let data;

    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseError) {
      console.error("Gemini API returned a non-JSON response:", {
        status: geminiResponse.status,
        statusText: geminiResponse.statusText,
        body: rawBody,
        parseError
      });

      if (isGeminiFallbackError(geminiResponse.status, {}, rawBody)) {
        try {
          const fallbackResult = await callGroqFallback(prompt);
          let fallbackAnswer = fallbackResult.answer;

          if (hasProfile && !fallbackAnswer.includes(PROFILE_USED_NOTE)) {
            fallbackAnswer = `${fallbackAnswer}\n\n${PROFILE_USED_NOTE}`;
          }

          return res.json({
            answer: fallbackAnswer,
            finishReason: fallbackResult.finishReason,
            truncated: fallbackResult.truncated,
            provider: "groq"
          });
        } catch (fallbackError) {
          console.error("Groq fallback failed after Gemini parse error:", fallbackError);
        }
      }

      return sendClientError(res, 502, "API_ERROR");
    }

    if (!geminiResponse.ok) {
      const details = {
        status: geminiResponse.status,
        statusText: geminiResponse.statusText,
        geminiError: data.error || data
      };

      console.error("Gemini API request failed:", details);

      if (isGeminiFallbackError(geminiResponse.status, data)) {
        try {
          const fallbackResult = await callGroqFallback(prompt);
          let fallbackAnswer = fallbackResult.answer;

          if (hasProfile && !fallbackAnswer.includes(PROFILE_USED_NOTE)) {
            fallbackAnswer = `${fallbackAnswer}\n\n${PROFILE_USED_NOTE}`;
          }

          return res.json({
            answer: fallbackAnswer,
            finishReason: fallbackResult.finishReason,
            truncated: fallbackResult.truncated,
            provider: "groq"
          });
        } catch (fallbackError) {
          console.error("Groq fallback failed after Gemini API error:", fallbackError);
        }

        return sendClientError(res, geminiResponse.status === 429 ? 429 : 503, "QUOTA_EXCEEDED");
      }

      return sendClientError(res, geminiResponse.status, "API_ERROR");
    }

    const candidate = data.candidates?.[0];
    let answer = candidate?.content?.parts
      ?.map((part) => part.text || "")
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!answer) {
      console.error("Gemini response did not include answer text:", {
        question,
        response: data
      });

      return sendClientError(res, 502, "API_ERROR");
    }

    if (hasProfile && !answer.includes(PROFILE_USED_NOTE)) {
      answer = `${answer}\n\n${PROFILE_USED_NOTE}`;
    }

    const wasTruncated = candidate?.finishReason === "MAX_TOKENS";

    if (wasTruncated) {
      console.warn("Gemini response may be truncated because it reached MAX_TOKENS:", {
        finishReason: candidate.finishReason,
        usageMetadata: data.usageMetadata
      });
    }

    return res.json({
      answer,
      finishReason: candidate?.finishReason || null,
      truncated: wasTruncated
    });
  } catch (error) {
    console.error("Server error while calling Gemini API:", error);

    if (isGeminiFallbackError(error.status || 503, {}, error.message || "")) {
      try {
        const fallbackResult = await callGroqFallback(prompt);
        let fallbackAnswer = fallbackResult.answer;

        if (hasProfile && !fallbackAnswer.includes(PROFILE_USED_NOTE)) {
          fallbackAnswer = `${fallbackAnswer}\n\n${PROFILE_USED_NOTE}`;
        }

        return res.json({
          answer: fallbackAnswer,
          finishReason: fallbackResult.finishReason,
          truncated: fallbackResult.truncated,
          provider: "groq"
        });
      } catch (fallbackError) {
        console.error("Groq fallback failed after Gemini exception:", fallbackError);
      }
    }

    const networkErrorCodes = new Set(["ENOTFOUND", "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN"]);
    const isNetworkError =
      networkErrorCodes.has(error.code) ||
      networkErrorCodes.has(error.cause?.code) ||
      (error.name === "TypeError" && /fetch|network|failed/i.test(error.message || ""));

    return sendClientError(res, isNetworkError ? 503 : 500, isNetworkError ? "NETWORK_ERROR" : "API_ERROR");
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

function listenWithFallback(port, attemptsLeft = 5) {
  const server = app.listen(port, () => {
    console.log(`육아코치 서버가 http://localhost:${port} 에서 실행 중입니다.`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      const nextPort = Number(port) + 1;
      console.warn(`포트 ${port}가 사용 중입니다. ${nextPort}번 포트로 다시 시도합니다.`);
      listenWithFallback(nextPort, attemptsLeft - 1);
      return;
    }

    console.error("육아코치 서버를 시작하지 못했습니다:", error);
    process.exit(1);
  });
}

module.exports = app;

if (!process.env.VERCEL) {
  listenWithFallback(Number(PORT));
}
