import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";
import AIChatSession from "../models/AIChatSession.js";
import {
  queryPlatformAssistant,
  queryStudyAssistant,
  detectIntent,
} from "../services/index.js";
import {
  searchSimilarity,
  rebuildVectorIndex,
} from "../services/vectorSearch.js";
import { getPlatformResponse } from "../services/promptTemplates.js";
import {
  getConversationHistory,
  enrichQueryWithContext,
  getUserPreferences,
} from "../services/memoryService.js";
import {
  generateStudyNotes,
  generateQuiz,
  generateFlashcards,
  generateExamPlan,
  analyzeTopics,
} from "../services/learningService.js";
import AICopilotProfile from "../models/AICopilotProfile.js";
import Paper from "../models/Paper.js";
import AIFeedback from "../models/AIFeedback.js";
import AIChatChunk from "../models/AIChatChunk.js";
import {
  switchModel,
  getCurrentModel,
  checkOllamaHealth,
  checkModelAvailability,
} from "../services/modelManager.js";
import { queryOllamaStream } from "../services/ollamaService.js";
import { getAIProvider } from "../services/providers.js";
import { detectPromptInjection } from "../services/promptManager.js";

const router = express.Router();

// Middleware to check if AI features are enabled. Excludes /status and /health.
router.use((req, res, next) => {
  if (req.path === "/status" || req.path === "/health") {
    return next();
  }
  if (process.env.AI_PROVIDER === "disabled") {
    return res.status(403).json({
      success: false,
      error: "AI Features are currently disabled",
    });
  }
  next();
});

/* =================================================
CONVERSATION INITIALIZATION
================================================= */

// Shared handler for initializing a conversation session
const handleConversationInit = async (req, res) => {
  try {
    const { domain, paperId } = req.body;

    if (!domain || !["platform", "study"].includes(domain)) {
      return res.status(400).json({
        success: false,
        error: "Valid domain is required",
      });
    }

    const session = await AIChatSession.create({
      user: req.user._id,
      domain,
      paper: paperId || null,
      title:
        domain === "platform" ? "Platform Help Chat" : "Study Paper Assistant",
    });

    res.status(201).json({
      success: true,
      conversationId: session._id,
      title: session.title,
    });
  } catch (error) {
    console.error("❌ AI Conversation init error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to initialize conversation" });
  }
};

// Mount on both /conversation (singular) and /conversations (plural) for API consistency
router.post("/conversation", verifyToken, handleConversationInit);
router.post("/conversations", verifyToken, handleConversationInit);

/* =================================================
CHAT MESSAGE HANDLER
================================================= */
router.post("/chat", verifyToken, async (req, res) => {
  try {
    const { conversationId, message, paperId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message content required",
      });
    }

    let session;
    if (conversationId) {
      session = await AIChatSession.findOne({
        _id: conversationId,
        user: req.user._id,
      });
    }

    // Fallback: create session if not specified
    if (!session) {
      session = await AIChatSession.create({
        user: req.user._id,
        domain: paperId ? "study" : "platform",
        paper: paperId || null,
        title: paperId ? "Study Paper Assistant" : "Platform Help Chat",
      });
    }

    const history = session._id
      ? await getConversationHistory(session._id)
      : [];
    const enrichedQuery = enrichQueryWithContext(message, history);
    const userPref = await getUserPreferences(req.user._id);

    const userMessage = {
      sender: "user",
      content: message.trim(),
      citations: [],
    };
    session.messages.push(userMessage);

    const provider = getAIProvider();
    const aiResponse = await provider.chat(enrichedQuery, session, {
      history,
      userPref,
      paperId,
    });

    const assistantMessage = {
      sender: "assistant",
      content: aiResponse.answer,
      citations: aiResponse.citations || [],
    };
    session.messages.push(assistantMessage);

    // Keep message history within reasonable bounds to prevent indefinite DB growth
    const MAX_SESSION_MESSAGES = parseInt(
      process.env.MAX_SESSION_MESSAGES || "50",
      10,
    );
    if (session.messages.length > MAX_SESSION_MESSAGES) {
      session.messages = session.messages.slice(-MAX_SESSION_MESSAGES);
    }

    await session.save();

    res.json({
      success: true,
      conversationId: session._id,
      answer: aiResponse.answer,
      confidence: aiResponse.confidence,
      citations: aiResponse.citations,
      sources: aiResponse.sources,
      suggestedQuestions: aiResponse.suggestedQuestions,
      relatedTopics: aiResponse.relatedTopics,
      relatedPapers: aiResponse.relatedPapers || [],
    });
  } catch (error) {
    console.error("❌ AI Chat error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to process chat message" });
  }
});

/* =================================================
AI STREAM CHAT HANDLER (SSE)
================================================= */
router.post("/chat/stream", verifyToken, async (req, res) => {
  try {
    const { conversationId, message, paperId } = req.body;

    if (!message || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Message content required" });
    }

    if (detectPromptInjection(message)) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Security Policy Violation: Prompt injection detected.",
        });
    }

    let session;
    if (conversationId) {
      session = await AIChatSession.findOne({
        _id: conversationId,
        user: req.user._id,
      });
    }
    if (!session) {
      session = await AIChatSession.create({
        user: req.user._id,
        domain: paperId ? "study" : "platform",
        paper: paperId || null,
        title: paperId ? "Study Paper Assistant" : "Platform Help Chat",
      });
    }

    const history = session._id
      ? await getConversationHistory(session._id)
      : [];
    const enrichedQuery = enrichQueryWithContext(message, history);
    const userPref = await getUserPreferences(req.user._id);

    // Save User message
    session.messages.push({ sender: "user", content: message.trim() });

    // Retrieve context and build prompt
    let prompt = "";
    let matchText = "";
    let citations = [];
    let sources = [];
    let confidence = 1.0;

    const targetDomain =
      paperId || session.paper ? "study" : detectIntent(message);
    if (targetDomain === "study") {
      const chunks = await searchSimilarity(
        enrichedQuery,
        { paperId: session.paper || paperId },
        2,
      );
      if (chunks.length > 0) {
        matchText = chunks
          .map((c) => `[Page ${c.pageNumber}] ${c.chunkText}`)
          .join("\n\n");
        citations = chunks.map((c) => ({
          chunkId: c.chunkId,
          pageNumber: c.pageNumber,
          textSnippet: c.chunkText,
        }));
        sources = [
          {
            fileName: "Document.pdf",
            pages: [...new Set(chunks.map((c) => c.pageNumber))],
          },
        ];
        confidence = chunks[0].score || 0.85;
      }
      const userContext = userPref.rank
        ? `User Rank: ${userPref.rank}, Streak: ${userPref.streak} days.`
        : "";
      const historyText = history
        .map(
          (h) => `${h.sender === "user" ? "User" : "Assistant"}: ${h.content}`,
        )
        .join("\n");

      prompt = `You are a Study Assistant. Answer the question based on the provided document context excerpt below. Cite page numbers using [Page X] where appropriate.
      
User Context:
${userContext}

Conversation History:
${historyText}

Context:
${matchText}

Question: ${message}
Answer:`;
    } else {
      const match = getPlatformResponse(enrichedQuery);
      matchText = match.answer;
      confidence = match.confidence;
      const historyText = history
        .map(
          (h) => `${h.sender === "user" ? "User" : "Assistant"}: ${h.content}`,
        )
        .join("\n");
      const userContext = userPref.rank
        ? `User Rank: ${userPref.rank}, Streak: ${userPref.streak} days.`
        : "";

      prompt = `You are the Platform Helpdesk Assistant for StudyTogether. Explain the following feature based on this description:
      
User Context:
${userContext}

Conversation History:
${historyText}

Feature description:
${matchText}

User Question: ${message}
Answer:`;
    }

    // Set SSE Headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const providerType = process.env.AI_PROVIDER || "ollama";
    if (providerType === "disabled") {
      res.write(
        `data: ${JSON.stringify({ token: "The AI Copilot service is currently offline or disabled by the system administrator." })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({ done: true, conversationId: session._id, citations: [], sources: [], confidence: 0.0 })}\n\n`,
      );
      res.end();
      return;
    }

    // Client abort connection handling
    const controller = new AbortController();
    req.on("close", () => {
      console.log("[AI Stream] Connection closed by user client.");
      controller.abort();
    });

    let completeAnswer = "";

    // Stream Ollama response
    await queryOllamaStream(
      prompt,
      (chunk) => {
        completeAnswer += chunk;
        res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
      },
      {
        signal: controller.signal,
      },
    );

    // Save Assistant message
    session.messages.push({
      sender: "assistant",
      content: completeAnswer,
      citations,
    });

    // Keep message history within reasonable bounds to prevent indefinite DB growth
    const MAX_SESSION_MESSAGES = parseInt(
      process.env.MAX_SESSION_MESSAGES || "50",
      10,
    );
    if (session.messages.length > MAX_SESSION_MESSAGES) {
      session.messages = session.messages.slice(-MAX_SESSION_MESSAGES);
    }

    await session.save();

    // Send final event packet
    res.write(
      `data: ${JSON.stringify({
        done: true,
        conversationId: session._id,
        citations,
        sources,
        confidence,
      })}\n\n`,
    );
    res.end();
  } catch (error) {
    console.error("❌ AI Streaming error:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ success: false, error: "Streaming processing failed" });
    } else {
      res.write(
        `data: ${JSON.stringify({ error: "Streaming interrupted" })}\n\n`,
      );
      res.end();
    }
  }
});

/* =================================================
HISTORY LIST & CONVERSATIONS
================================================= */
router.get("/history", verifyToken, async (req, res) => {
  try {
    const conversations = await AIChatSession.find({ user: req.user._id })
      .select("_id title domain paper updatedAt")
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("❌ AI History fetch error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to load chat history" });
  }
});

// GET /conversations is the canonical endpoint; GET /history is kept as alias for backward compatibility

/* =================================================
GET SINGLE CONVERSATION BY ID
================================================= */
router.get("/conversations/:id", verifyToken, async (req, res) => {
  try {
    const session = await AIChatSession.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Conversation not found" });
    }
    res.json({ success: true, conversation: session });
  } catch (error) {
    console.error("❌ AI Get Conversation error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch conversation" });
  }
});

/* =================================================
DELETE & CLEAR CONVERSATIONS
================================================= */
router.delete("/history/:id", verifyToken, async (req, res) => {
  try {
    const result = await AIChatSession.deleteOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Conversation not found" });
    }
    res.json({ success: true, message: "Conversation deleted successfully" });
  } catch (error) {
    console.error("❌ AI History delete error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete conversation" });
  }
});

// DELETE /conversations/:id is the canonical endpoint; DELETE /history/:id is kept as alias for backward compatibility

router.delete("/conversations", verifyToken, async (req, res) => {
  try {
    const result = await AIChatSession.deleteMany({ user: req.user._id });
    res.json({
      success: true,
      message: "All conversations cleared successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ AI Clear Conversations error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to clear conversations" });
  }
});

/* =================================================
ADMIN VECTOR REBUILD INDEX
================================================= */
router.post("/reindex", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const status = await rebuildVectorIndex();
    res.json({
      success: true,
      message: "Vector index rebuild completed successfully",
      status,
    });
  } catch (error) {
    console.error("❌ AI Reindex error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to rebuild vector index" });
  }
});

/* =================================================
AI STUDY NOTES GENERATOR
================================================= */
router.post("/study-notes", verifyToken, async (req, res) => {
  try {
    const { paperId, topic } = req.body;
    if (!paperId || !topic)
      return res
        .status(400)
        .json({ success: false, error: "paperId and topic required" });
    const notes = await generateStudyNotes(paperId, topic);
    res.json({ success: true, notes });
  } catch (error) {
    console.error("❌ AI Study Notes error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to generate study notes" });
  }
});

/* =================================================
AI QUIZ GENERATOR
================================================= */
router.post("/quiz", verifyToken, async (req, res) => {
  try {
    const { paperId, type, count } = req.body;
    if (!paperId)
      return res
        .status(400)
        .json({ success: false, error: "paperId required" });
    const quiz = await generateQuiz(paperId, type || "mcq", count || 5);
    res.json({ success: true, quiz });
  } catch (error) {
    console.error("❌ AI Quiz error:", error);
    res.status(500).json({ success: false, error: "Failed to generate quiz" });
  }
});

/* =================================================
AI FLASHCARDS GENERATOR
================================================= */
router.post("/flashcards", verifyToken, async (req, res) => {
  try {
    const { paperId } = req.body;
    if (!paperId)
      return res
        .status(400)
        .json({ success: false, error: "paperId required" });
    const flashcards = await generateFlashcards(paperId);
    res.json({ success: true, flashcards });
  } catch (error) {
    console.error("❌ AI Flashcards error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to generate flashcards" });
  }
});

/* =================================================
AI EXAM PLANNER
================================================= */
router.post("/exam-plan", verifyToken, async (req, res) => {
  try {
    const { paperId, timeAvailable } = req.body;
    if (!paperId)
      return res
        .status(400)
        .json({ success: false, error: "paperId required" });
    const plan = await generateExamPlan(
      paperId,
      timeAvailable || "2 hours",
      req.user._id,
    );
    res.json({ success: true, plan });
  } catch (error) {
    console.error("❌ AI Exam Plan error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to generate exam plan" });
  }
});

/* =================================================
AI TOPIC ANALYSIS
================================================= */
router.post("/topic-analysis", verifyToken, async (req, res) => {
  try {
    const { paperId } = req.body;
    if (!paperId)
      return res
        .status(400)
        .json({ success: false, error: "paperId required" });
    const analysis = await analyzeTopics(paperId);
    res.json({ success: true, analysis });
  } catch (error) {
    console.error("❌ AI Topic Analysis error:", error);
    res.status(500).json({ success: false, error: "Failed to analyze topics" });
  }
});

/* =================================================
AI COPILOT: GET PROFILE
================================================= */
router.get("/copilot/profile", verifyToken, async (req, res) => {
  try {
    let profile = await AICopilotProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = await AICopilotProfile.create({
        user: req.user._id,
        studiedPapers: [],
        completedTopics: [],
        quizHistory: [],
      });
    }
    res.json({ success: true, profile });
  } catch (error) {
    console.error("❌ AI Copilot Profile error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to load copilot profile" });
  }
});

/* =================================================
AI COPILOT: TRACK PROGRESS
================================================= */
router.post("/copilot/track-progress", verifyToken, async (req, res) => {
  try {
    const { paperId, topic } = req.body;
    let profile = await AICopilotProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = await AICopilotProfile.create({
        user: req.user._id,
        studiedPapers: [],
        completedTopics: [],
        quizHistory: [],
      });
    }

    if (paperId && !profile.studiedPapers.includes(paperId)) {
      profile.studiedPapers.push(paperId);
    }
    if (topic && !profile.completedTopics.includes(topic)) {
      profile.completedTopics.push(topic);
    }
    await profile.save();

    res.json({
      success: true,
      message: "Progress tracked successfully",
      profile,
    });
  } catch (error) {
    console.error("❌ AI Copilot Track Progress error:", error);
    res.status(500).json({ success: false, error: "Failed to save progress" });
  }
});

/* =================================================
AI COPILOT: LOG QUIZ SCORE
================================================= */
router.post("/copilot/quiz-score", verifyToken, async (req, res) => {
  try {
    const { paperId, score, totalQuestions } = req.body;
    if (!paperId || score === undefined || !totalQuestions) {
      return res
        .status(400)
        .json({
          success: false,
          error: "paperId, score, and totalQuestions are required",
        });
    }

    let profile = await AICopilotProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = await AICopilotProfile.create({
        user: req.user._id,
        studiedPapers: [],
        completedTopics: [],
        quizHistory: [],
      });
    }

    profile.quizHistory.push({ paperId, score, totalQuestions });
    await profile.save();

    res.json({ success: true, message: "Quiz performance saved", profile });
  } catch (error) {
    console.error("❌ AI Copilot Quiz Score log error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to save quiz score" });
  }
});

/* =================================================
AI COPILOT: GET RECOMMENDATIONS
================================================= */
router.get("/copilot/recommendations", verifyToken, async (req, res) => {
  try {
    const profile = await AICopilotProfile.findOne({ user: req.user._id });

    // Find papers in the subjects/semesters the user has studied or general recommended approved papers
    const studiedPaperIds = profile ? profile.studiedPapers : [];

    // Default subject suggestion fallback
    let favoriteSubject = "Data Structure";
    if (studiedPaperIds.length > 0) {
      const samplePaper = await Paper.findById(studiedPaperIds[0]).lean();
      if (samplePaper) favoriteSubject = samplePaper.subject;
    }

    const recommendations = await Paper.find({
      status: "approved",
      isActive: true,
      _id: { $nin: studiedPaperIds },
      subject: favoriteSubject,
    })
      .limit(4)
      .select("_id title subject semester")
      .lean();

    res.json({
      success: true,
      recommendations,
      nextSuggestedTopic: `Review advanced chapters in ${favoriteSubject}`,
    });
  } catch (error) {
    console.error("❌ AI Copilot Recommendations error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to generate recommendations" });
  }
});

/* =================================================
AI COPILOT: ANALYTICS DASHBOARD
================================================= */
router.get("/copilot/dashboard", verifyToken, async (req, res) => {
  try {
    const profile = await AICopilotProfile.findOne({
      user: req.user._id,
    }).lean();

    const studiedCount = profile ? profile.studiedPapers.length : 0;
    const completedCount = profile ? profile.completedTopics.length : 0;
    const quizCount = profile ? profile.quizHistory.length : 0;

    let averageQuizScore = 0;
    if (quizCount > 0) {
      const sum = profile.quizHistory.reduce(
        (acc, q) => acc + q.score / q.totalQuestions,
        0,
      );
      averageQuizScore = Math.round((sum / quizCount) * 100);
    }

    res.json({
      success: true,
      analytics: {
        papersStudied: studiedCount,
        topicsCompleted: completedCount,
        quizzesTaken: quizCount,
        averageQuizScore: `${averageQuizScore}%`,
        studyStreak: profile ? profile.studyStreak : 0,
        subjectWiseProgress: {
          "Data Structure": Math.min(completedCount * 10, 100),
          "Operating System": Math.min(studiedCount * 15, 100),
        },
      },
    });
  } catch (error) {
    console.error("❌ AI Copilot Dashboard error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to build analytics dashboard" });
  }
});

/* =================================================
AI FEEDBACK COLLECTION
================================================= */
router.post("/feedback", verifyToken, async (req, res) => {
  try {
    const { conversationId, score, comment } = req.body;
    if (score === undefined)
      return res.status(400).json({ success: false, error: "score required" });

    const feedback = await AIFeedback.create({
      user: req.user._id,
      conversationId: conversationId || null,
      score,
      comment,
    });

    res.json({
      success: true,
      message: "Feedback submitted successfully",
      feedback,
    });
  } catch (error) {
    console.error("❌ AI Feedback error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to submit feedback" });
  }
});

/* =================================================
AI HEALTH CHECK
================================================= */
router.get("/health", async (req, res) => {
  const providerType = process.env.AI_PROVIDER || "ollama";
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const currentModel = getCurrentModel();

  let ollamaReachable = false;
  if (providerType === "ollama") {
    try {
      const health = await checkOllamaHealth();
      ollamaReachable = health?.status === "healthy";
    } catch {
      ollamaReachable = false;
    }
  }

  res.json({
    success: true,
    status:
      providerType === "disabled"
        ? "disabled"
        : ollamaReachable
          ? "ok"
          : "degraded",
    timestamp: Date.now(),
    provider: providerType,
    model: currentModel,
    ollamaUrl,
    ollamaReachable,
  });
});

/* =================================================
AI STUDY KNOWLEDGE METADATA API
================================================= */

// Get All Study Knowledge Chunks
router.get("/study-knowledge", verifyToken, async (req, res) => {
  try {
    const { subject, semester, university } = req.query;
    const filter = {};
    if (subject) filter.subject = subject;
    if (semester) filter.semester = Number(semester);
    if (university) filter.university = university;

    const chunks = await AIChatChunk.find(filter)
      .limit(50)
      .select("-embedding");
    res.json({ success: true, count: chunks.length, chunks });
  } catch (error) {
    console.error("❌ AI Study Knowledge fetch error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch study knowledge" });
  }
});

// Search Study Knowledge Chunks
router.get("/study-knowledge/search", verifyToken, async (req, res) => {
  try {
    const { q, subject, semester, university } = req.query;
    const filter = {};
    if (subject) filter.subject = subject;
    if (semester) filter.semester = Number(semester);
    if (university) filter.university = university;
    if (q) {
      filter.chunkText = { $regex: q.trim(), $options: "i" };
    }

    const chunks = await AIChatChunk.find(filter)
      .limit(30)
      .select("-embedding");
    res.json({ success: true, count: chunks.length, chunks });
  } catch (error) {
    console.error("❌ AI Study Knowledge search error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to search study knowledge" });
  }
});

// Rebuild Study Knowledge Chunks Index
router.post(
  "/study-knowledge/rebuild",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const status = await rebuildVectorIndex();
      res.json({
        success: true,
        message: "Study knowledge index rebuild completed successfully",
        status,
      });
    } catch (error) {
      console.error("❌ AI Study Knowledge rebuild error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to rebuild study knowledge" });
    }
  },
);

// Get Single Study Knowledge Chunk by ID
router.get("/study-knowledge/:id", verifyToken, async (req, res) => {
  try {
    const chunk = await AIChatChunk.findById(req.params.id).select(
      "-embedding",
    );
    if (!chunk)
      return res
        .status(404)
        .json({ success: false, error: "Study knowledge chunk not found" });
    res.json({ success: true, chunk });
  } catch (error) {
    console.error("❌ AI Study Knowledge get error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch study knowledge chunk" });
  }
});

/* =================================================
AI STATUS ENDPOINT (P2-008)
================================================= */
router.get("/status", async (req, res) => {
  try {
    const provider = process.env.AI_PROVIDER || "ollama";
    const embeddingModel = process.env.EMBEDDING_MODEL || "nomic-embed-text";
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

    // 1. Check Ollama Health
    let ollamaReachable = false;
    let ollamaStatus = "offline";
    let ollamaError = null;

    if (provider === "ollama") {
      try {
        const health = await checkOllamaHealth();
        ollamaReachable = health?.success && health?.status === "healthy";
        ollamaStatus = ollamaReachable ? "online" : "unreachable";
      } catch (err) {
        ollamaStatus = "unreachable";
        ollamaError = err.message;
      }
    } else {
      ollamaStatus = "disabled";
    }

    // 2. Counts
    const documentCount = await Paper.countDocuments({ status: "approved" });
    const chunkCount = await AIChatChunk.countDocuments();

    // 3. Retrieval Status
    const retrievalStatus =
      provider === "ollama" && ollamaReachable ? "active" : "disabled";

    // 4. BM25 Status
    const bm25Status = "active";

    // 5. Vector Index Status
    let vectorIndexStatus = "empty";
    if (chunkCount > 0) {
      vectorIndexStatus = "healthy";
    } else if (documentCount > 0) {
      vectorIndexStatus = "stale (needs rebuild)";
    }

    // 6. AI Readiness
    let aiReadiness = "not_ready";
    if (provider === "ollama") {
      if (ollamaReachable) {
        if (chunkCount > 0) {
          aiReadiness = "ready";
        } else {
          aiReadiness = "ready (no documents indexed)";
        }
      } else {
        aiReadiness = "degraded (ollama unreachable)";
      }
    } else {
      aiReadiness = "disabled";
    }

    res.json({
      success: true,
      active: provider !== "disabled",
      provider,
      model: getCurrentModel(),
      embeddingModel,
      ollamaUrl,
      ollamaStatus,
      ollamaError,
      retrievalStatus,
      bm25Status,
      vectorIndexStatus,
      documentCount,
      chunkCount,
      aiReadiness,
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("❌ AI Status endpoint error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to query AI status",
      message: error.message,
    });
  }
});

/* =================================================
AI MODEL MANAGEMENT ENDPOINTS
================================================= */

// Get Model Manager status & list of tags
router.get("/models", verifyToken, async (req, res) => {
  try {
    const health = await checkOllamaHealth();
    const current = getCurrentModel();
    const mistralAvail = await checkModelAvailability("mistral");
    const llamaAvail = await checkModelAvailability("llama3");
    const phiAvail = await checkModelAvailability("phi3");

    res.json({
      success: true,
      currentModel: current,
      ollamaHealth: health,
      modelAvailability: {
        mistral: mistralAvail.isAvailable,
        llama3: llamaAvail.isAvailable,
        phi3: phiAvail.isAvailable,
      },
    });
  } catch (error) {
    console.error("❌ AI Models fetch error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch model manager status" });
  }
});

// Switch active model (Admin action or user-authorized)
router.post("/models/switch", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { model } = req.body;
    if (!model)
      return res
        .status(400)
        .json({ success: false, error: "model name required" });

    const result = switchModel(model);
    res.json({
      success: true,
      message: `Active model switched to ${model}`,
      currentModel: result.currentModel,
    });
  } catch (error) {
    console.error("❌ AI Model switch error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
