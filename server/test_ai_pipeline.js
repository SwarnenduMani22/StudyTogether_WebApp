import dotenv from "dotenv";
import AIChatChunk from "./models/AIChatChunk.js";
import Paper from "./models/Paper.js";
import { generateEmbedding, calculateBM25Scores, searchSimilarity } from "./services/ai/vectorSearch.js";
import { queryStudyAssistant } from "./services/ai/index.js";
import { generateStudyNotes, generateQuiz, generateFlashcards, generateExamPlan } from "./services/ai/learningService.js";

dotenv.config();

const runTests = async () => {
  console.log("🧪 Starting AI Pipeline Verification Tests...");
  let passCount = 0;
  let failCount = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failCount++;
    }
  };

  // Mock Mongoose calls
  AIChatChunk.find = (query) => {
    return {
      lean: () => [
        {
          _id: "mock_chunk_1",
          paperId: "mock_paper_1",
          chunkText: "This is a document chunk about database indexing and performance.",
          embedding: new Array(768).fill(0.1),
          pageNumber: 1,
          subject: "DBMS",
          semester: 4,
          chunkId: "mock_paper_1_p1_c0"
        },
        {
          _id: "mock_chunk_2",
          paperId: "mock_paper_1",
          chunkText: "This chunk covers ACID transactions, concurrency, and recovery.",
          embedding: new Array(768).fill(0.2),
          pageNumber: 2,
          subject: "DBMS",
          semester: 4,
          chunkId: "mock_paper_1_p2_c0"
        }
      ],
      limit: () => ({
        select: () => [
          { chunkText: "mock chunk 1", pageNumber: 1 },
          { chunkText: "mock chunk 2", pageNumber: 2 }
        ]
      })
    };
  };

  Paper.findById = (id) => {
    return {
      populate: () => ({
        lean: () => ({
          _id: id,
          title: "Introduction to Database Systems",
          subject: "DBMS",
          semester: 4
        })
      }),
      lean: () => ({
        _id: id,
        title: "Introduction to Database Systems",
        subject: "DBMS",
        semester: 4
      })
    };
  };

  Paper.find = () => {
    return {
      limit: () => ({
        select: () => ({
          lean: () => [
            { _id: "mock_paper_2", title: "Advanced Database Systems", subject: "DBMS", semester: 4 }
          ]
        })
      })
    };
  };

  try {
    // 1. Verify Embeddings (Ollama or local fallback)
    console.log("\n1. Testing Embedding Generation...");
    const emb = await generateEmbedding("database indexing");
    assert(Array.isArray(emb), "Embedding is an array");
    assert(emb.length === 768 || emb.length === 1536, `Embedding has correct dimensions (${emb.length})`);
    assert(emb.every(n => typeof n === "number"), "Embedding contains only numbers");

    // 2. Verify BM25 Retrieval Engine
    console.log("\n2. Testing BM25 Scoring...");
    const mockChunks = [
      { chunkText: "database indexing and performance optimization" },
      { chunkText: "ACID transactions and database recovery procedures" }
    ];
    const bm25Scores = calculateBM25Scores(mockChunks, "database indexing");
    assert(bm25Scores.length === 2, "Returns score for each chunk");
    assert(bm25Scores[0] > bm25Scores[1], "Matching document has higher BM25 score");
    assert(bm25Scores[0] === 1.0, "Best match is normalized to 1.0");

    // 3. Verify Hybrid Retrieval (searchSimilarity)
    console.log("\n3. Testing Hybrid Retrieval...");
    const searchResults = await searchSimilarity("indexing", { paperId: "mock_paper_1" }, 2);
    assert(searchResults.length > 0, "Returns retrieval results");
    assert(searchResults[0].semanticScore !== undefined, "Results include semanticScore");
    assert(searchResults[0].keywordScore !== undefined, "Results include keywordScore (BM25)");
    assert(searchResults[0].score !== undefined, "Results include combined score");

    // 4. Verify RAG (queryStudyAssistant)
    console.log("\n4. Testing RAG Engine...");
    const ragResponse = await queryStudyAssistant("mock_paper_1", "What is indexing?");
    assert(ragResponse.answer !== undefined, "RAG returns an answer");
    assert(Array.isArray(ragResponse.citations), "RAG returns citations");
    assert(ragResponse.confidence !== undefined, "RAG returns confidence score");
    assert(Array.isArray(ragResponse.relatedPapers), "RAG returns related papers");

    // 5. Verify Notes Generator
    console.log("\n5. Testing Notes Generator...");
    const notes = await generateStudyNotes("mock_paper_1", "indexing");
    assert(typeof notes === "string" && notes.length > 0, "Notes generator returns study notes");

    // 6. Verify Quiz Generator
    console.log("\n6. Testing Quiz Generator...");
    const quiz = await generateQuiz("mock_paper_1", "mcq", 2);
    assert(typeof quiz === "string" && quiz.length > 0, "Quiz generator returns questions");

    // 7. Verify Flashcards Generator
    console.log("\n7. Testing Flashcards...");
    const flashcards = await generateFlashcards("mock_paper_1");
    assert(typeof flashcards === "string" && flashcards.length > 0, "Flashcard generator returns flashcards");

    // 8. Verify Study Planner
    console.log("\n8. Testing Study Planner...");
    const plan = await generateExamPlan("mock_paper_1", "3 hours", "mock_user_1");
    assert(typeof plan === "string" && plan.length > 0, "Exam planner returns a strategic study plan");

  } catch (error) {
    console.error("❌ Test script execution error:", error);
    failCount++;
  }

  console.log(`\n📊 Verification Complete. Passed: ${passCount}, Failed: ${failCount}`);
  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log("🎉 All verified AI components are healthy and operational!");
    process.exit(0);
  }
};

runTests();
