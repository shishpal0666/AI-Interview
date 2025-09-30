import { broadcastMessage as _broadcastMessage } from "./broadcast";

void _broadcastMessage;

async function callGemini(prompt, options = {}) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY environment variable");
  const model = options.model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = { contents: [{ parts: [{ text: prompt }] }] };
  if (options.temperature !== undefined)
    body.generationConfig = { ...(body.generationConfig || {}), temperature: options.temperature };
  if (options.maxOutputTokens !== undefined)
    body.generationConfig = { ...(body.generationConfig || {}), maxOutputTokens: options.maxOutputTokens };
  if (options.thinkingBudget !== undefined)
    body.generationConfig = { ...(body.generationConfig || {}), thinkingConfig: { thinkingBudget: options.thinkingBudget } };
  if (options.responseMimeType !== undefined)
    body.generationConfig = { ...(body.generationConfig || {}), responseMimeType: options.responseMimeType };
  if (options.responseSchema !== undefined)
    body.generationConfig = { ...(body.generationConfig || {}), responseSchema: options.responseSchema };

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const err = new Error((networkErr && networkErr.message) || "Network request failed");
    err.isNetworkError = true;
    throw err;
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    let parsedBody = errText;
    try {
      parsedBody = JSON.parse(errText);
  } catch { void 0 }
    const err = new Error(`Gemini request failed: ${resp.status} ${resp.statusText} - ${typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody)}`);
    err.status = resp.status;
    err.responseBody = parsedBody;
    err.isNetworkError = false;
    throw err;
  }

  const data = await resp.json();
  const candidate = data?.candidates?.[0];
  if (candidate?.content?.parts) return candidate.content.parts.map((p) => p.text || "").join("").trim();
  return JSON.stringify(data);
}

async function callGeminiInternal(prompt, options = {}) {
  const maxRetries = typeof options.retries === "number" ? options.retries : 3;
  const baseDelay = typeof options.baseDelay === "number" ? options.baseDelay : 1000;
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  let attempts = 0;
  let lastErr = null;
  while (attempts <= maxRetries) {
    try {
      return await callGemini(prompt, options);
    } catch (err) {
      lastErr = err;
      const status = err && err.status;
      const isServerErr = typeof status === "number" && status >= 500 && status < 600;
      const isNetworkErr = Boolean(err && err.isNetworkError);
      attempts += 1;
      if ((isServerErr || isNetworkErr) && attempts <= maxRetries) {
        const delay = baseDelay * Math.pow(2, attempts - 1);
        try {
          console.warn(`Gemini request failed (attempt ${attempts}/${maxRetries}). Retrying in ${delay}ms...`, err);
        } catch (e) {
          void e;
        }
  await sleep(delay);
        continue;
      }
      break;
    }
  }

  const msg = (lastErr && lastErr.message) || String(lastErr) || "Gemini request failed";
  const error = new Error(msg);
  error.isGeminiError = true;
  
  const lastStatus = lastErr && lastErr.status;
  const lastIsNetwork = Boolean(lastErr && lastErr.isNetworkError);
  error.isRetryable = lastIsNetwork || (typeof lastStatus === "number" && (lastStatus >= 500 || lastStatus === 429));
  error.originalError = lastErr;
  throw error;
}

function parseJsonFromText(text) {
  const jsonMatch = text && text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

export async function generateQuestions(difficulties = ["Easy", "Easy", "Medium", "Medium", "Hard", "Hard"], options = {}) {
  const topic = options.topic || "full stack (React/Node)";
  const diffs = (Array.isArray(difficulties) ? difficulties : []).map((d) => String(d || "Easy").trim());
  const userPrompt = `Generate 2 easy, 2 medium, and 2 hard questions about "${topic}".`;
  const schema = {
    type: "OBJECT",
    properties: {
      easy: { type: "ARRAY", description: "Two easy difficulty questions about the topic.", items: { type: "STRING" } },
      medium: { type: "ARRAY", description: "Two medium difficulty questions about the topic.", items: { type: "STRING" } },
      hard: { type: "ARRAY", description: "Two hard difficulty questions about the topic.", items: { type: "STRING" } },
    },
    required: ["easy", "medium", "hard"],
  };
  let raw = null;
  try {
    raw = await callGeminiInternal(userPrompt, {
      temperature: 0.2,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
      responseSchema: schema,
      ...options,
    });
  } catch (err) {
    const e = new Error(`Question generation failed: ${(err && err.message) || String(err)}`);
    e.isGeminiError = true;
    throw e;
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = parseJsonFromText(raw);
  }
  if (!parsed || typeof parsed !== "object") {
    const e = new Error("Could not parse questions JSON from AI response");
    e.isGeminiError = true;
    throw e;
  }
  const easyArr = Array.isArray(parsed.easy) ? parsed.easy : [];
  const mediumArr = Array.isArray(parsed.medium) ? parsed.medium : [];
  const hardArr = Array.isArray(parsed.hard) ? parsed.hard : [];
  const all = [...easyArr, ...mediumArr, ...hardArr];
  if (all.length !== diffs.length) console.warn("API did not return exactly expected number of questions. Received:", all.length);
  const generated = all.map((text, idx) => ({ id: idx + 1, text: String(text || "").trim(), difficulty: diffs[idx] || (idx < 2 ? "Easy" : idx < 4 ? "Medium" : "Hard") }));
  console.log("generateQuestions :", generated);
  return generated;
}

export async function evaluateAnswers(questions = [], answers = [], options = {}) {
  const qs = Array.isArray(questions) ? questions : [];
  const ans = Array.isArray(answers) ? answers : [];
  const qaPairs = qs.map((q, i) => `Question ${i + 1}: ${String(q)}\nAnswer ${i + 1}: ${String(ans[i] || "")}`).join("\n\n");
  const userPrompt = `Please evaluate the following answers for the given questions. For each answer, provide a score out of 10 and brief feedback. Also provide a total score and an overall summary of the performance.\n\n${qaPairs}`;
  const schema = {
    type: "OBJECT",
    properties: {
      evaluations: { type: "ARRAY", description: "An array of evaluations, one for each question-answer pair.", items: { type: "OBJECT", properties: { score: { type: "NUMBER", description: "A numerical score for the answer, out of 10." }, feedback: { type: "STRING", description: "Brief feedback on the answer's correctness." }, }, required: ["score", "feedback"], }, },
      overallSummary: { type: "STRING", description: "A detailed summary of the user's overall performance." },
      totalScore: { type: "NUMBER", description: "The sum of all individual scores." },
    },
    required: ["evaluations", "overallSummary", "totalScore"],
  };
  try {
    const raw = await callGeminiInternal(userPrompt, { temperature: 0.0, maxOutputTokens: 512, responseMimeType: "application/json", responseSchema: schema, ...options });
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = parseJsonFromText(raw);
    }
    if (!parsed || typeof parsed !== "object") {
      const e = new Error("Could not parse evaluation JSON from AI response");
      e.isGeminiError = true;
      throw e;
    }
    console.log("evaluateAnswers:", parsed);
    return parsed;
  } catch (err) {
    console.warn("evaluateAnswers failed", err);
    // Surface a clearer, user-friendly error for transient AI failures
    if (err && err.isGeminiError && err.isRetryable) {
      const e = new Error("AI is not responding right now. Please try again in a moment.");
      e.isGeminiError = true;
      e.isRetryable = true;
      e.originalError = err;
      throw e;
    }
    const e = new Error((err && err.message) || "Evaluation request failed");
    e.isGeminiError = true;
    e.originalError = err;
    throw e;
  }
}

export async function fetchQuestion(difficulty = "Easy", options = {}) {
  const topic = options.topic || "full stack (React/Node)";
  const diff = String(difficulty || "Easy");
  const prompt = `Generate one ${diff} difficulty interview question about "${topic}". Return only the question text.`;
  try {
    const raw = await callGeminiInternal(prompt, { temperature: 0.3, maxOutputTokens: 200, ...options });
    if (!raw) return "";
    const parsed = parseJsonFromText(raw);
    if (parsed && typeof parsed === "object") {
      console.log("fetchQuestion parsed:", parsed);
      return String(parsed.question || JSON.stringify(parsed));
    }
    return String(raw).trim();
  } catch (err) {
    const e = new Error((err && err.message) || "fetchQuestion failed");
    e.isGeminiError = true;
    throw e;
  }
}

