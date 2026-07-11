import AIChatChunk from "../../models/AIChatChunk.js";
import Paper from "../../models/Paper.js";

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

// Embedding Generation Service
export const generateEmbedding = async (text) => {
  const dimensions = 1536;
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

// Vector Similarity Search with Metadata Filtering
export const searchSimilarity = async (queryText, filters = {}, topK = 3) => {
  const startTime = Date.now();
  console.log(`[AI Search Log] Executing hybrid search for query: "${queryText}"`);

  try {
    const queryVector = await generateEmbedding(queryText);
    const queryWords = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // Build DB Query from filters
    const dbQuery = {};
    if (filters.paperId) dbQuery.paperId = filters.paperId;
    if (filters.subject) dbQuery.subject = filters.subject;
    if (filters.semester) dbQuery.semester = Number(filters.semester);
    if (filters.university) dbQuery.university = filters.university;

    // Fetch chunks matching filters
    const chunks = await AIChatChunk.find(dbQuery).lean();
    console.log(`[AI Search Log] Filtered down to ${chunks.length} candidate chunks in DB`);

    // Compute scores
    const scoredChunks = chunks.map((chunk) => {
      // 1. Semantic Cosine Similarity
      const chunkVector = chunk.embedding && chunk.embedding.length === 1536
        ? chunk.embedding
        : new Array(1536).fill(0.0);

      const semanticScore = cosineSimilarity(queryVector, chunkVector);

      // 2. Keyword Matching Score
      let keywordHits = 0;
      const chunkTextLower = chunk.chunkText.toLowerCase();
      queryWords.forEach((word) => {
        if (chunkTextLower.includes(word)) {
          keywordHits++;
        }
      });
      const keywordScore = queryWords.length > 0 ? (keywordHits / queryWords.length) : 0;

      // 3. Combined Fusion Score
      const score = (semanticScore * 0.6) + (keywordScore * 0.4);

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

    let totalChunks = 0;
    for (const paper of approvedPapers) {
      // Trigger processing
      const rawText = `Study Together paper content for subject "${paper.subject}", semester ${paper.semester}. This paper covers core syllabus concepts. Page 1 content covers fundamentals. Page 2 content covers advanced theories and practice questions.`;

      const pages = [
        { page: 1, text: `Fundamentals of ${paper.subject}. Important Semester ${paper.semester} topics are detailed here.` },
        { page: 2, text: `Practice questions and theories regarding ${paper.subject}. Exam preparation guide.` }
      ];

      const chunksToSave = [];
      let chunkPosition = 0;

      for (const p of pages) {
        const words = p.text.split(" ");
        const wordsPerChunk = 15;

        for (let i = 0; i < words.length; i += wordsPerChunk) {
          const chunkText = words.slice(i, i + wordsPerChunk).join(" ");
          const chunkId = `${paper._id}_p${p.page}_c${chunkPosition}`;
          const embedding = await generateEmbedding(chunkText);

          chunksToSave.push({
            paperId: paper._id,
            chunkId,
            pageNumber: p.page,
            subject: paper.subject,
            semester: paper.semester,
            university: "State Tech University",
            chunkText,
            position: chunkPosition,
            embedding,
            embeddingVersion: "v1",
            metadata: {
              title: paper.title,
              length: String(chunkText.length),
            }
          });
          chunkPosition++;
        }
      }

      await AIChatChunk.deleteMany({ paperId: paper._id });
      if (chunksToSave.length > 0) {
        await AIChatChunk.insertMany(chunksToSave);
        totalChunks += chunksToSave.length;
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
