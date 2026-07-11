import Paper from "../../models/Paper.js";
import PlatformKnowledge from "../../models/PlatformKnowledge.js";
import { searchSimilarity, generateEmbedding } from "./vectorSearch.js";
import { getPlatformResponse } from "./promptTemplates.js";
import { getCurrentModel, fetchWithRetry } from "./modelManager.js";
import { queryOllama } from "./ollamaService.js";
import { sanitizeOutput } from "./promptManager.js";

// AI Response Caching Layer (TTL = 5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map();

export const getCachedResponse = (key) => {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return cached.data;
};

export const setCachedResponse = (key, data) => {
  responseCache.set(key, {
    timestamp: Date.now(),
    data
  });
};

// Intent Detection
export const detectIntent = (query, paperId) => {
  if (paperId) return "study";

  const q = query.toLowerCase();
  const platformKeywords = ["wallet", "coin", "earn", "spend", "upload", "draft", "register", "login", "auth", "logout", "approvals", "admin", "moderation", "reindex", "rebuild"];

  const hasPlatformKeyword = platformKeywords.some(keyword => q.includes(keyword));
  return hasPlatformKeyword ? "platform" : "study";
};

// LLM Integration Layer (supports Gemini and Ollama providers)
export const generateLLMResponse = async (prompt, fallbackAnswer) => {
  const provider = process.env.LLM_PROVIDER || "ollama";

  // OLLAMA PROVIDER
  if (provider === "ollama") {
    try {
      const answer = await queryOllama(prompt, {
        temperature: 0.7,
        maxTokens: 500,
        stream: false
      });
      return answer ? sanitizeOutput(answer) : fallbackAnswer;
    } catch (err) {
      console.warn("[AI LLM Warning] Ollama query failed, falling back to offline answer.", err.message);
    }
    return fallbackAnswer;
  }

  // GEMINI PROVIDER
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("[AI LLM Log] GEMINI_API_KEY missing. Using fallback response generator.");
    return fallbackAnswer;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500 }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (generatedText) {
      return sanitizeOutput(generatedText);
    }
    return fallbackAnswer;
  } catch (error) {
    console.error("[AI LLM Error] LLM generation failed:", error.message);
    return fallbackAnswer;
  }
};

// Study Assistant (RAG Pipeline)
export const queryStudyAssistant = async (paperId, query, history = [], userPref = {}) => {
  const cacheKey = `study_${paperId || "all"}_${query.trim().toLowerCase()}`;
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    console.log(`[AI Cache Log] Cache hit for Study Assistant: ${cacheKey}`);
    return cached;
  }

  console.log(`[AI Engine Log] Querying Study Assistant for paper ID: ${paperId}`);

  try {
    // 1. Retrieve top-k relevant chunks
    const chunks = await searchSimilarity(query, { paperId }, 2);

    if (chunks.length === 0) {
      return {
        answer: "I couldn't find any relevant study context inside this paper to answer your question.",
        confidence: 0.1,
        citations: [],
        sources: [],
        suggestedQuestions: ["Can you explain the main topics of this paper?", "Show the summary."],
        relatedTopics: ["Study Guide"]
      };
    }

    // 2. Build context & history
    const contextText = chunks.map(c => `[Page ${c.pageNumber}] ${c.chunkText}`).join("\n\n");
    const historyText = history.map(h => `${h.sender === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n");
    const userContext = userPref.rank ? `User Rank: ${userPref.rank}, Streak: ${userPref.streak} days.` : "";

    const prompt = `You are a Study Assistant. Answer the question based on the provided document context excerpt below. Cite page numbers using [Page X] where appropriate.

User Context:
${userContext}

Conversation History:
${historyText}

Context:
${contextText}

Question: ${query}
Answer:`;

    // 3. Fallback answers in case of offline / missing keys
    const fallbackAnswer = `According to page ${chunks[0].pageNumber} of the paper: "${chunks[0].chunkText}"`;

    // 4. Query LLM
    const answer = await generateLLMResponse(prompt, fallbackAnswer);

    // 5. Build citations & sources
    const citations = chunks.map(c => ({
      chunkId: c.chunkId,
      pageNumber: c.pageNumber,
      textSnippet: c.chunkText
    }));

    const paper = await Paper.findById(paperId).populate("uploadedBy", "name").lean();
    const sources = [
      {
        fileName: paper?.title || "Document.pdf",
        pages: [...new Set(chunks.map(c => c.pageNumber))]
      }
    ];

    // Find related papers
    let relatedPapers = [];
    if (paper) {
      relatedPapers = await Paper.find({
        _id: { $ne: paper._id },
        status: "approved",
        isActive: true,
        $or: [{ subject: paper.subject }, { semester: paper.semester }]
      }).limit(2).select("_id title subject semester").lean();
    }

    const result = {
      answer,
      confidence: chunks[0].score || 0.85,
      citations,
      sources,
      suggestedQuestions: [
        `Explain page ${chunks[0].pageNumber} contents.`,
        "Show similar topics.",
        "Generate a practice question."
      ],
      relatedTopics: [paper?.subject || "Academic study", "Notes", "Exam Prep"],
      relatedPapers
    };

    setCachedResponse(cacheKey, result);
    return result;
  } catch (error) {
    console.error("[AI Engine Error] Study Assistant pipeline failed:", error);
    throw error;
  }
};

// Platform Assistant
export const queryPlatformAssistant = async (query, history = [], userPref = {}) => {
  const cacheKey = `platform_${query.trim().toLowerCase()}`;
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    console.log(`[AI Cache Log] Cache hit for Platform Assistant: ${cacheKey}`);
    return cached;
  }

  console.log("[AI Engine Log] Querying Platform Assistant...");

  try {
    // Check DB first for dynamic admin-managed articles
    const dbArticles = await PlatformKnowledge.find({ status: "published" }).lean();
    let bestDbMatch = null;
    let maxDbScore = 0;
    const q = query.toLowerCase();

    for (const art of dbArticles) {
      let score = 0;
      art.keywords.forEach((keyword) => {
        if (q.includes(keyword.toLowerCase())) {
          score += keyword.split(" ").length;
        }
      });
      if (score > maxDbScore) {
        maxDbScore = score;
        bestDbMatch = art;
      }
    }

    let match = getPlatformResponse(query);
    if (bestDbMatch && maxDbScore > 0) {
      match = {
        answer: bestDbMatch.content,
        confidence: Math.min(0.5 + (maxDbScore * 0.1), 1.0),
        title: bestDbMatch.title
      };
    }

    const historyText = history.map(h => `${h.sender === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n");
    const userContext = userPref.rank ? `User Rank: ${userPref.rank}, Streak: ${userPref.streak} days.` : "";

    const prompt = `You are the Platform Helpdesk Assistant for StudyTogether. Explain the following feature based on this description:

User Context:
${userContext}

Conversation History:
${historyText}

Feature description:
${match.answer}

User Question: ${query}
Answer:`;

    const answer = await generateLLMResponse(prompt, match.answer);

    const result = {
      answer,
      confidence: match.confidence,
      citations: [],
      sources: [],
      suggestedQuestions: [
        "How do I upload a paper?",
        "How does the coin economy work?",
        "What are drafts?",
        "How can I buy coins?"
      ],
      relatedTopics: ["Platform Navigation", "User Guide", match.title]
    };

    setCachedResponse(cacheKey, result);
    return result;
  } catch (error) {
    console.error("[AI Engine Error] Platform Assistant pipeline failed:", error);
    throw error;
  }
};
