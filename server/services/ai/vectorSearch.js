import AIChatChunk from "../../models/AIChatChunk.js";
import Paper from "../../models/Paper.js";
import { fetchWithRetry } from "./modelManager.js";

// Helper: Cosine Similarity
export const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

let detectedDimensions = 768; // Default dimension for nomic-embed-text

// Helper: Deterministic fallback embedding generation
const generateFallbackEmbedding = (text, dimensions) => {
  const vector = new Array(dimensions).fill(0.0);
  const clean = text.toLowerCase();

  // Deterministic local vector distribution generator based on char hashes
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const index = (charCode * (i + 1)) % dimensions;
    vector[index] += 1.0;
  }

  // Normalize vector to unit length
  let magnitude = 0;
  for (let val of vector) {
    magnitude += val * val;
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = vector[i] / magnitude;
    }
  }

  return vector;
};

// Embedding Generation Service using Ollama API
export const generateEmbedding = async (text) => {
  if (!text || typeof text !== "string") {
    return new Array(detectedDimensions).fill(0.0);
  }

  const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
  const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";

  console.log(`[AI Embedding Log] Requesting embedding from Ollama for model: ${EMBEDDING_MODEL}`);

  try {
    // 1. Try recommended /api/embed API first
    try {
      const response = await fetchWithRetry(
        `${OLLAMA_URL}/api/embed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: text,
          }),
        },
        2, // retries
        3000 // timeoutMs
      );

      if (response && response.ok) {
        const data = await response.json();
        if (data.embeddings && data.embeddings.length > 0) {
          const emb = data.embeddings[0];
          detectedDimensions = emb.length;
          return emb;
        }
      }
    } catch (err) {
      console.warn(`[AI Embedding Warning] Newer /api/embed endpoint failed, trying legacy endpoint. Reason: ${err.message}`);
    }

    // 2. Fallback to legacy /api/embeddings API
    const responseLegacy = await fetchWithRetry(
      `${OLLAMA_URL}/api/embeddings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          prompt: text,
        }),
      },
      2, // retries
      3000 // timeoutMs
    );

    if (responseLegacy && responseLegacy.ok) {
      const data = await responseLegacy.json();
      if (data.embedding) {
        const emb = data.embedding;
        detectedDimensions = emb.length;
        return emb;
      }
    }

    throw new Error("Ollama returned non-ok status for all embedding endpoints.");
  } catch (error) {
    console.error(
      `[AI Embedding Error] Failed to generate embedding via Ollama (${error.message}). Falling back to local deterministic embedding.`
    );
    return generateFallbackEmbedding(text, detectedDimensions);
  }
};

// Helper: Calculate BM25 scores for keyword matching
export const calculateBM25Scores = (chunks, queryText) => {
  if (!chunks || chunks.length === 0 || !queryText) {
    return new Array(chunks ? chunks.length : 0).fill(0.0);
  }

  const k1 = 1.2;
  const b = 0.75;

  // Tokenize query
  const queryTokens = queryText.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 1);

  if (queryTokens.length === 0) {
    return new Array(chunks.length).fill(0.0);
  }

  const N = chunks.length;

  // Tokenize doc texts and calculate lengths
  const docTokensList = chunks.map(c => {
    return c.chunkText.toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);
  });

  const docLengths = docTokensList.map(tokens => tokens.length);
  const totalLength = docLengths.reduce((sum, len) => sum + len, 0);
  const avgdl = N > 0 ? totalLength / N : 1.0;

  // Calculate Document Frequency (DF)
  const df = {};
  queryTokens.forEach(token => {
    let count = 0;
    docTokensList.forEach(tokens => {
      if (tokens.includes(token)) {
        count++;
      }
    });
    df[token] = count;
  });

  // Calculate IDF
  const idf = {};
  queryTokens.forEach(token => {
    const docFreq = df[token] || 0;
    idf[token] = Math.max(0.0001, Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1));
  });

  // Calculate raw BM25 score
  const scores = docTokensList.map((docTokens, docIdx) => {
    const docLen = docLengths[docIdx];
    let score = 0;

    const tf = {};
    docTokens.forEach(token => {
      tf[token] = (tf[token] || 0) + 1;
    });

    queryTokens.forEach(token => {
      const termFreq = tf[token] || 0;
      if (termFreq > 0) {
        const numerator = termFreq * (k1 + 1);
        const denominator = termFreq + k1 * (1 - b + b * (docLen / (avgdl || 1.0)));
        score += idf[token] * (numerator / denominator);
      }
    });

    return score;
  });

  // Normalize scores to [0, 1] range
  const maxScore = Math.max(...scores);
  if (maxScore > 0) {
    return scores.map(s => s / maxScore);
  }
  return scores;
};

// Vector Similarity Search with Metadata Filtering
export const searchSimilarity = async (queryText, filters = {}, topK = 3) => {
  const startTime = Date.now();
  console.log(`[AI Search Log] Executing hybrid search for query: "${queryText}"`);

  try {
    const queryVector = await generateEmbedding(queryText);

    // Build DB Query from filters
    const dbQuery = {};
    if (filters.paperId) dbQuery.paperId = filters.paperId;
    if (filters.subject) dbQuery.subject = filters.subject;
    if (filters.semester) dbQuery.semester = Number(filters.semester);
    if (filters.university) dbQuery.university = filters.university;

    // Fetch chunks matching filters
    const chunks = await AIChatChunk.find(dbQuery).lean();
    console.log(`[AI Search Log] Filtered down to ${chunks.length} candidate chunks in DB`);

    // Compute BM25 scores for keyword matching
    const bm25Scores = calculateBM25Scores(chunks, queryText);

    // Compute scored chunks
    const scoredChunks = chunks.map((chunk, idx) => {
      // 1. Semantic Cosine Similarity
      const chunkVector = chunk.embedding && chunk.embedding.length === queryVector.length
        ? chunk.embedding
        : new Array(queryVector.length).fill(0.0);

      const semanticScore = cosineSimilarity(queryVector, chunkVector);

      // 2. Keyword Matching Score (BM25)
      const keywordScore = bm25Scores[idx] || 0.0;

      // 3. Combined Fusion Score (Configurable weights)
      const semanticWeight = parseFloat(process.env.SEMANTIC_WEIGHT || "0.6");
      const bm25Weight = parseFloat(process.env.BM25_WEIGHT || "0.4");
      const score = (semanticScore * semanticWeight) + (keywordScore * bm25Weight);

      return {
        ...chunk,
        semanticScore,
        keywordScore,
        score,
      };
    });

    // Sort by combined score descending
    scoredChunks.sort((a, b) => b.score - a.score);

    // Top-K slices
    const results = scoredChunks.slice(0, topK);
    const latency = Date.now() - startTime;
    console.log(`[AI Search Log] Hybrid Search completed in ${latency}ms. Best score: ${results[0]?.score || 0}`);

    return results;
  } catch (error) {
    console.error("[AI Search Error] Hybrid Search failed:", error);
    throw error;
  }
};

// Complete Rebuild Index Service
export const rebuildVectorIndex = async () => {
  console.log("[AI Index Log] Triggering full vector index rebuild...");
  const startTime = Date.now();

  try {
    const approvedPapers = await Paper.find({ status: "approved" });
    console.log(`[AI Index Log] Rebuilding chunks for ${approvedPapers.length} approved papers.`);

    // Dynamically import reprocessPaper to avoid circular dependency
    const { reprocessPaper } = await import("./ingestor.js");

    let totalChunks = 0;
    for (const paper of approvedPapers) {
      try {
        const result = await reprocessPaper(paper);
        if (result && result.chunkCount) {
          totalChunks += result.chunkCount;
        }
      } catch (err) {
        console.error(`[AI Index Error] Failed to reprocess paper "${paper.title}" (ID: ${paper._id}):`, err.message);
      }
    }

    const latency = Date.now() - startTime;
    console.log(`[AI Index Log] Index rebuild complete. Reprocessed ${totalChunks} chunks in ${latency}ms.`);
    return { success: true, processedPapers: approvedPapers.length, totalChunks };
  } catch (error) {
    console.error("[AI Index Error] Rebuild failed:", error);
    throw error;
  }
};
