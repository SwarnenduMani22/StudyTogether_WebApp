import AIChatSession from "../models/AIChatSession.js";
import User from "../models/User.js";

// Retrieve the last N messages as active session memory
export const getConversationHistory = async (conversationId, limit = 6) => {
  try {
    const session = await AIChatSession.findById(conversationId).lean();
    if (!session || !session.messages) return [];

    // Get last N messages
    return session.messages.slice(-limit);
  } catch (error) {
    console.error("[AI Memory Error] Failed to retrieve conversation history:", error);
    return [];
  }
};

// Intelligently reformulates follow-up queries using conversation history keywords
export const enrichQueryWithContext = (query, history) => {
  if (!history || history.length === 0) return query;

  const q = query.toLowerCase();

  // Check if query is a follow-up indicator
  const followUpIndicators = ["another", "again", "only", "more", "explain", "what about", "example", "this", "that"];
  const isFollowUp = followUpIndicators.some(indicator => q.includes(indicator));

  if (!isFollowUp) return query;

  // Extract key topic nouns from previous assistant/user messages
  // We scan historical user messages to find search terms (like "dijkstra", "deadlock", "dbms", etc.)
  const keywords = [];
  const stopWords = new Set(["the", "a", "an", "explain", "what", "is", "how", "to", "show", "give", "me", "another", "example", "again", "only"]);

  // Find the last user message that contained noun keywords
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.sender === "user") {
      const terms = msg.content.toLowerCase().split(/\s+/);
      const filtered = terms.filter(t => t.length > 3 && !stopWords.has(t));
      if (filtered.length > 0) {
        keywords.push(...filtered);
        break; // take the most recent topic context
      }
    }
  }

  if (keywords.length > 0) {
    const contextPrefix = [...new Set(keywords)].join(" ");
    console.log(`[AI Memory Log] Enriched follow-up query "${query}" with topic context: "${contextPrefix}"`);
    return `${contextPrefix} ${query}`;
  }

  return query;
};

// Retrieve User Profile personalization state
export const getUserPreferences = async (userId) => {
  try {
    const user = await User.findById(userId).lean();
    if (!user) return {};

    return {
      rank: user.rank || "Beginner",
      badges: user.badges || [],
      coins: user.coins || 0,
      streak: user.dailyStreak || 0,
      lastActive: user.lastActiveDate || "",
    };
  } catch (error) {
    console.error("[AI Memory Error] Failed to fetch user preferences:", error);
    return {};
  }
};
