import { searchSimilarity } from "./vectorSearch.js";
import { generateLLMResponse } from "./index.js";
import Paper from "../../models/Paper.js";
import { getUserPreferences } from "./memoryService.js";

// 1. Study Notes Generator
export const generateStudyNotes = async (paperId, topic) => {
  console.log(`[AI Learning Log] Generating study notes for paper: ${paperId}, topic: ${topic}`);
  const chunks = await searchSimilarity(topic, { paperId }, 3);
  
  if (!chunks || chunks.length === 0) {
    return "No relevant context was found in the document to generate study notes for this topic. Please ensure the paper has been approved and indexed.";
  }

  const context = chunks.map(c => c.chunkText).join("\n");

  const prompt = `You are an expert tutor. Generate detailed, structured study notes in markdown format for the topic "${topic}" based on this context. Include definitions, key points, and explanations.

Context:
${context}

Notes:`;
  const fallback = `### Study Notes: ${topic}\n\n* **Summary**: Concept extracted from study materials.\n* **Detail**: ${context || "Study notes details are being processed."}`;
  return await generateLLMResponse(prompt, fallback);
};

// 2. Quiz Generator
export const generateQuiz = async (paperId, type = "mcq", count = 5) => {
  console.log(`[AI Learning Log] Generating ${count} ${type} questions for paper: ${paperId}`);
  const chunks = await searchSimilarity("questions exam test formulas", { paperId }, 3);

  if (!chunks || chunks.length === 0) {
    return "No relevant study material was found in the document to generate a quiz. Please ensure the paper is approved and indexed.";
  }

  const context = chunks.map(c => c.chunkText).join("\n");

  const prompt = `You are an examiner. Generate exactly ${count} ${type} questions based ONLY on the context provided below.
For each question:
1. Provide 4 options (A, B, C, D).
2. Clearly state the correct answer.
3. Provide a brief explanation of why the correct answer is correct based on the context.

Context:
${context}

Questions and Explanations:`;

  const fallback = `### Practice Questions (${type.toUpperCase()})\n\n1. What is the primary concept outlined in this paper?\n   *Answer*: ${context.substring(0, 100)}...\n   *Explanation*: Derived from document introduction.`;
  return await generateLLMResponse(prompt, fallback);
};

// 3. Flashcards Generator
export const generateFlashcards = async (paperId) => {
  console.log(`[AI Learning Log] Generating flashcards for paper: ${paperId}`);
  const chunks = await searchSimilarity("definitions formulas key terms vocabulary", { paperId }, 3);

  if (!chunks || chunks.length === 0) {
    return "No relevant study material was found in the document to generate flashcards. Please ensure the paper is approved and indexed.";
  }

  const context = chunks.map(c => c.chunkText).join("\n");

  const prompt = `You are a study helper. Extract the most important definitions, formulas, and key terms from this context and format them as Q&A Flashcard pairs.
For each flashcard:
- Front: A question, definition prompt, or concept name.
- Back: The corresponding answer, definition, or explanation based strictly on the context.

Context:
${context}

Flashcards (Front | Back format):`;

  const fallback = `Flashcards:\n\n* **Front**: What is the core subject of this paper?\n* **Back**: ${context.substring(0, 80)}`;
  return await generateLLMResponse(prompt, fallback);
};

// 4. Exam Planner
export const generateExamPlan = async (paperId, timeAvailable = "2 hours", userId = null) => {
  console.log(`[AI Learning Log] Generating study plan for paper: ${paperId}, time available: ${timeAvailable}, user: ${userId}`);
  const chunks = await searchSimilarity("syllabus topics modules chapters", { paperId }, 2);

  if (!chunks || chunks.length === 0) {
    return "No relevant study material was found in the document to generate a study plan. Please ensure the paper is approved and indexed.";
  }

  const context = chunks.map(c => c.chunkText).join("\n");

  let userContext = "";
  if (userId) {
    try {
      const prefs = await getUserPreferences(userId);
      if (prefs && prefs.rank) {
        userContext = `User Rank: ${prefs.rank}, Streak: ${prefs.streak} days. Adjust the plan difficulty and style to suit this user.`;
      }
    } catch (err) {
      console.warn("[AI Learning Warning] Failed to retrieve user preferences for personalization:", err.message);
    }
  }

  const prompt = `You are an academic coach. Build a personalized strategic study plan for a student who has an exam coming up and has only "${timeAvailable}" left. Prioritize what sections to read from this paper context.

User Context:
${userContext || "Standard Student Mode"}

Context:
${context}

Study Plan:`;

  const fallback = `### ${timeAvailable} Study Plan\n\n* **0-30 Mins**: Skim paper overview.\n* **30-90 Mins**: Focus on: ${context.substring(0, 100)}`;
  return await generateLLMResponse(prompt, fallback);
};

// 5. Topic Analysis & Difficulty Detection
export const analyzeTopics = async (paperId) => {
  console.log(`[AI Learning Log] Analyzing topic frequency and difficulty for paper: ${paperId}`);
  const chunks = await searchSimilarity("syllabus exam topics concepts questions", { paperId }, 3);

  if (!chunks || chunks.length === 0) {
    console.warn(`[AI Learning] No document chunks found for paper ${paperId}. Cannot analyze topics without source material.`);
    return "⚠️ No study material found for this paper. Please ensure the document has been processed before requesting topic analysis.";
  }

  const context = chunks.map(c => c.chunkText).join("\n");

  const prompt = `You are an educational psychologist. Categorize the topics found in this context into Easy, Medium, and Difficult levels. Highlight the most repeated and important exam questions.

Context:
${context}

Analysis:`;

  const fallback = `### Topic Analysis\n\n* **Easy**: Fundamentals\n* **Medium**: Detailed derivations\n* **Difficult**: System integrations\n* **Repeated Questions**: Core concepts from context.`;
  return await generateLLMResponse(prompt, fallback);
};
