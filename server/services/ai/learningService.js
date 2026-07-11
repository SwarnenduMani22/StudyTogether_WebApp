import { searchSimilarity } from "./vectorSearch.js";
import { generateLLMResponse } from "./index.js";
import Paper from "../../models/Paper.js";

// 1. Study Notes Generator
export const generateStudyNotes = async (paperId, topic) => {
  console.log(`[AI Learning Log] Generating study notes for paper: ${paperId}, topic: ${topic}`);
  const chunks = await searchSimilarity(topic, { paperId }, 3);
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
  const context = chunks.map(c => c.chunkText).join("\n");

  const prompt = `You are an examiner. Generate exactly ${count} ${type} questions from the context below. 
If type is "mcq", include 4 options and mark the correct answer.
If type is "viva" or "short", include the answer key.

Context:
${context}

Questions:`;

  const fallback = `### Practice Questions (${type.toUpperCase()})\n\n1. What is the primary concept outlined in this paper?\n   *Answer*: ${context.substring(0, 100)}...`;
  return await generateLLMResponse(prompt, fallback);
};

// 3. Flashcards Generator
export const generateFlashcards = async (paperId) => {
  console.log(`[AI Learning Log] Generating flashcards for paper: ${paperId}`);
  const chunks = await searchSimilarity("definitions formulas key terms vocabulary", { paperId }, 3);
  const context = chunks.map(c => c.chunkText).join("\n");

  const prompt = `You are a study helper. Extract the most important definitions, formulas, and key terms from this context and format them as Q&A Flashcard pairs.

Context:
${context}

Flashcards (Question | Answer format):`;

  const fallback = `Flashcards:\n\n* **Q**: What is the core subject of this paper?\n* **A**: ${context.substring(0, 80)}`;
  return await generateLLMResponse(prompt, fallback);
};

// 4. Exam Planner
export const generateExamPlan = async (paperId, timeAvailable = "2 hours") => {
  console.log(`[AI Learning Log] Generating study plan for paper: ${paperId}, time available: ${timeAvailable}`);
  const chunks = await searchSimilarity("syllabus topics modules chapters", { paperId }, 2);
  const context = chunks.map(c => c.chunkText).join("\n");

  const prompt = `You are an academic coach. Build a strategic study plan for a student who has an exam coming up and has only "${timeAvailable}" left. Prioritize what sections to read from this paper context.

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
  const context = chunks.map(c => c.chunkText).join("\n");

  const prompt = `You are an educational psychologist. Categorize the topics found in this context into Easy, Medium, and Difficult levels. Highlight the most repeated and important exam questions.

Context:
${context}

Analysis:`;

  const fallback = `### Topic Analysis\n\n* **Easy**: Fundamentals\n* **Medium**: Detailed derivations\n* **Difficult**: System integrations\n* **Repeated Questions**: Core concepts from context.`;
  return await generateLLMResponse(prompt, fallback);
};
