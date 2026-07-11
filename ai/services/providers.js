import { queryOllama } from "./ollamaService.js";
import { getPlatformResponse } from "./promptTemplates.js";
import { searchSimilarity } from "./vectorSearch.js";
import Paper from "../models/Paper.js";
import { buildPrompt } from "./promptManager.js";

// AI Provider Interface
class AIProvider {
  async chat(query, session, options = {}) {
    throw new Error("chat() method not implemented");
  }
}

// 1. Disabled AI Provider
class DisabledAIProvider extends AIProvider {
  async chat(query, session, options = {}) {
    return {
      answer: "The AI Copilot service is currently offline or disabled by the system administrator. Please try again later or contact support.",
      confidence: 0.0,
      citations: [],
      sources: [],
      suggestedQuestions: [],
      relatedTopics: [],
    };
  }
}

// 2. Ollama AI Provider
class OllamaAIProvider extends AIProvider {
  async chat(query, session, options = {}) {
    const { history = [], userPref = {}, paperId } = options;

    let prompt = "";
    let matchText = "";
    let citations = [];
    let sources = [];
    let confidence = 1.0;

    // Check if it's study or platform domain
    const isStudy = paperId || session.domain === "study";
    const historyText = history.map((h) => `${h.sender === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n");
    const userContext = userPref.rank ? `User Rank: ${userPref.rank}, Streak: ${userPref.streak} days.` : "";

    if (isStudy) {
      const chunks = await searchSimilarity(query, { paperId: session.paper || paperId }, 2);
      if (chunks.length > 0) {
        matchText = chunks.map((c) => `[Page ${c.pageNumber}] ${c.chunkText}`).join("\n\n");
        citations = chunks.map((c) => ({ chunkId: c.chunkId, pageNumber: c.pageNumber, textSnippet: c.chunkText }));
        sources = [{ fileName: "Document.pdf", pages: [...new Set(chunks.map((c) => c.pageNumber))] }];
        confidence = chunks[0].score || 0.85;
      }

      const promptResult = buildPrompt("study", {
        query,
        context: matchText,
        history: historyText,
        userContext,
      });
      prompt = promptResult.prompt;
    } else {
      const match = getPlatformResponse(query);
      matchText = match.answer;
      confidence = match.confidence;

      const promptResult = buildPrompt("platform", {
        query,
        context: matchText,
        history: historyText,
        userContext,
      });
      prompt = promptResult.prompt;
    }

    const fallbackAnswer = isStudy
      ? matchText
        ? `Based on the paper: "${matchText.substring(0, 150)}..."`
        : "No specific context available."
      : matchText;

    try {
      // If platform query with high confidence matching, return answer directly without Ollama call!
      if (!isStudy && confidence > 0.6) {
        console.log(`[AI Provider Log] High-confidence platform match (${confidence}). Bypassing LLM.`);
        return {
          answer: fallbackAnswer,
          confidence,
          citations: [],
          sources: [],
          suggestedQuestions: ["How do I earn coins?", "What is a draft?"],
          relatedTopics: ["Platform Guide"],
          relatedPapers: []
        };
      }

      const host = process.env.OLLAMA_HOST || "http://localhost:11434";
      const model = process.env.OLLAMA_MODEL || "mistral";

      // Query local Ollama service using fetchWithRetry from modelManager
      const answer = await queryOllama(prompt, {
        model,
        temperature: 0.7,
        maxTokens: 500,
        stream: false,
      });

      let relatedPapers = [];
      if (isStudy && (session.paper || paperId)) {
        const paper = await Paper.findById(session.paper || paperId).lean();
        if (paper) {
          relatedPapers = await Paper.find({
            _id: { $ne: paper._id },
            status: "approved",
            isActive: true,
            $or: [{ subject: paper.subject }, { semester: paper.semester }],
          })
            .limit(2)
            .select("_id title subject semester")
            .lean();
        }
      }

      return {
        answer: answer || fallbackAnswer,
        confidence,
        citations,
        sources,
        suggestedQuestions: isStudy
          ? ["Explain this in detail.", "Compare with other topics."]
          : ["How do I earn coins?", "What is a draft?"],
        relatedTopics: isStudy ? ["Academic Study"] : ["Platform Guide"],
        relatedPapers,
      };
    } catch (err) {
      console.error("[Ollama Provider Error] Failed to generate response:", err.message);
      return {
        answer: fallbackAnswer,
        confidence: 0.2,
        citations,
        sources,
        suggestedQuestions: [],
        relatedTopics: [],
      };
    }
  }
}

// 3. AI Provider Factory
export const getAIProvider = () => {
  const providerType = process.env.AI_PROVIDER || "ollama";
  console.log(`[AI Initialization Log] Loading AI Provider: ${providerType}`);

  if (providerType === "disabled") {
    return new DisabledAIProvider();
  }
  return new OllamaAIProvider();
};
