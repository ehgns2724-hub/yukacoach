const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const PUBLIC_DIR = __dirname;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC_DIR, {
  extensions: ["html"],
  index: false,
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

app.post("/api/ask", async (req, res) => {
  const question = typeof req.body.question === "string" ? req.body.question.trim() : "";
  const childProfile = typeof req.body.childProfile === "object" && req.body.childProfile !== null
    ? req.body.childProfile
    : {};

  if (!question) {
    console.error("Invalid /api/ask request: missing question body.");

    return res.status(400).json({
      error: "질문을 입력해주세요.",
      details: "POST /api/ask 요청 본문에 question 문자열이 필요합니다."
    });
  }

  if (!GEMINI_API_KEY) {
    console.error("Server configuration error: GEMINI_API_KEY is missing from .env.");

    return res.status(500).json({
      error: ".env 파일에 GEMINI_API_KEY를 설정해주세요.",
      details: "프로젝트 폴더의 .env 파일에 GEMINI_API_KEY=실제_API_키 형식으로 값을 넣은 뒤 서버를 다시 시작해주세요."
    });
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

  const prompt = [
    "당신은 보호자를 돕는 한국어 AI 맞춤 육아 코치입니다.",
    "의학적 확정 진단을 하지 말고, 안전하고 일반적인 육아 정보를 제공합니다.",
    "응급 증상이나 위험 신호가 있으면 의료 전문가 상담을 권합니다.",
    "아이 프로필이 있으면 모든 답변에서 반드시 그 정보를 참고해 개인화된 답변을 제공합니다.",
    "아이의 개월 수, 성별, 수유 방식, 이유식 단계, 알레르기, 수면 패턴, 특이사항을 질문보다 우선 맥락으로 반영하세요.",
    "답변은 한국어로 작성하고, 핵심 요약과 바로 해볼 수 있는 방법을 포함하세요.",
    "답변은 8문장 이내 또는 짧은 bullet 형태로 간결하게 작성하세요.",
    hasProfile
      ? "답변 마지막에는 자연스럽게 반드시 다음 문장을 포함하세요: \"이 답변은 저장된 아이 프로필을 참고해 작성되었습니다.\""
      : "저장된 아이 프로필이 없으므로 일반 육아 답변을 하고, 답변 마지막에는 반드시 다음 문장을 포함하세요: \"더 정확한 답변을 위해 아이 프로필을 입력해 주세요.\"",
    "",
    "아이 프로필:",
    profileLines.length ? profileLines.join("\n") : "- 저장된 프로필 없음",
    profileSummary ? `요약 문장: ${profileSummary}.` : "",
    "",
    `질문: ${question}`
  ].join("\n");

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
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

      return res.status(502).json({
        error: "Gemini API 응답을 해석하지 못했습니다.",
        details: rawBody || geminiResponse.statusText
      });
    }

    if (!geminiResponse.ok) {
      const message = data.error?.message || "Gemini API 요청에 실패했습니다.";
      const details = {
        status: geminiResponse.status,
        statusText: geminiResponse.statusText,
        geminiError: data.error || data
      };

      console.error("Gemini API request failed:", details);

      return res.status(geminiResponse.status).json({
        error: message,
        details: JSON.stringify(details, null, 2)
      });
    }

    const candidate = data.candidates?.[0];
    const answer = candidate?.content?.parts
      ?.map((part) => part.text || "")
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!answer) {
      console.error("Gemini response did not include answer text:", {
        question,
        response: data
      });

      return res.status(502).json({
        error: "Gemini가 답변 텍스트를 반환하지 않았습니다.",
        details: JSON.stringify(data, null, 2)
      });
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

    return res.status(500).json({
      error: "서버에서 Gemini API를 호출하는 중 문제가 발생했습니다.",
      details: error.stack || error.message || String(error)
    });
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
