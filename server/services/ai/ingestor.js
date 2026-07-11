import { createRequire } from "module";
import AIChatChunk from "../../models/AIChatChunk.js";
import { generateEmbedding } from "./vectorSearch.js";

// ─── Configuration ────────────────────────────────────────────────────────────
// Chunk size in words (≈ 500 tokens at ~4 chars/word avg)
const CHUNK_SIZE_WORDS = parseInt(process.env.PDF_CHUNK_SIZE_WORDS || "120", 10);
// Overlap in words to preserve cross-chunk context
const CHUNK_OVERLAP_WORDS = parseInt(process.env.PDF_CHUNK_OVERLAP_WORDS || "20", 10);
// Minimum characters of extracted text before falling back to OCR stub
const MIN_TEXT_LENGTH = 100;

// ─── Lazy-load pdf-parse ──────────────────────────────────────────────────────
// Loaded lazily so a missing package does not crash the server at startup.
// pdf-parse is a CommonJS module — createRequire is needed in an ESM context.
let _pdfParse = null;
const getPdfParse = () => {
  if (!_pdfParse) {
    try {
      const require = createRequire(import.meta.url);
      _pdfParse = require("pdf-parse");
    } catch (err) {
      throw new Error(
        "pdf-parse is not installed. Run `npm install pdf-parse` inside the server/ directory. " +
        err.message
      );
    }
  }
  return _pdfParse;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalises extracted text: collapses whitespace, strips non-printable chars.
 */
const cleanText = (text) => {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
};

/**
 * Splits a flat word array into overlapping chunks.
 * Returns an array of strings.
 */
const splitIntoChunks = (words, chunkSize, overlap) => {
  const chunks = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
};

/**
 * Downloads a PDF from the given URL and returns its Buffer.
 * Throws on network errors or non-200 responses.
 */
const downloadPdf = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: HTTP ${response.status} from ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

/**
 * Uses pdf-parse's pagerender hook to collect per-page text in order.
 * The pagerender callback must return a Promise<string>; pdf-parse assembles
 * the strings into pdfData.text. We also capture them individually via closure.
 */
const extractPagesFromBuffer = async (buffer) => {
  const pdfParse = getPdfParse();
  const pageTexts = [];

  const pdfData = await pdfParse(buffer, {
    pagerender: (pageData) => {
      return pageData
        .getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false })
        .then((textContent) => {
          const text = textContent.items.map((item) => item.str).join(" ");
          pageTexts.push(text);
          return text;
        });
    },
  });

  // If pagerender successfully populated per-page arrays, use them.
  if (pageTexts.length > 0) {
    return pageTexts.map((text, i) => ({ page: i + 1, text: cleanText(text) }));
  }

  // Fallback: pdf-parse collected all text in pdfData.text (no per-page split).
  // Treat entire document as a single "page 1".
  if (pdfData.text && pdfData.text.trim().length >= MIN_TEXT_LENGTH) {
    return [{ page: 1, text: cleanText(pdfData.text) }];
  }

  return []; // No extractable text — caller will trigger OCR fallback
};

/**
 * OCR Fallback — placeholder until tesseract.js is integrated (P2-002).
 * Returns a minimal descriptive string so the chunk is not empty.
 */
const runOcrFallback = async (paper) => {
  console.warn(
    `[AI Ingestor] OCR fallback triggered for "${paper.title}" — ` +
    `tesseract.js not yet integrated (P2-002).`
  );
  return (
    `[Scanned PDF] "${paper.title}" — subject: ${paper.subject}, ` +
    `semester: ${paper.semester}. Full text extraction requires OCR (P2-002).`
  );
};

// ─── Main Processing Engine ───────────────────────────────────────────────────

/**
 * Ingests a paper into the vector knowledge base.
 *
 * Steps:
 *  1. Download PDF buffer from paper.pdfLink (Cloudinary URL)
 *  2. Extract text with pdf-parse (real content, page-by-page)
 *  3. If text is too short, fall back to OCR stub
 *  4. Split into overlapping word-level chunks
 *  5. Generate embeddings and store in AIChatChunk (idempotent — deletes old chunks first)
 */
export const processPaper = async (paper) => {
  console.log(`[AI Ingestor] Processing paper: "${paper.title}" (ID: ${paper._id})`);

  try {
    let pages = []; // Array of { page: number, text: string }

    // ── Step 1 & 2: Download and parse PDF ────────────────────────────────
    if (!paper.pdfLink) {
      throw new Error("Paper has no pdfLink — cannot extract text.");
    }

    try {
      const buffer = await downloadPdf(paper.pdfLink);
      pages = await extractPagesFromBuffer(buffer);
    } catch (parseErr) {
      console.error(
        `[AI Ingestor] PDF extraction failed for "${paper.title}":`,
        parseErr.message
      );
    }

    // ── Step 3: OCR fallback if no usable text extracted ──────────────────
    const totalExtracted = pages.reduce((sum, p) => sum + p.text.length, 0);
    if (totalExtracted < MIN_TEXT_LENGTH) {
      const fallbackText = await runOcrFallback(paper);
      pages = [{ page: 1, text: cleanText(fallbackText) }];
    }

    console.log(
      `[AI Ingestor] Extracted text from ${pages.length} page(s) for "${paper.title}".`
    );

    // ── Step 4 & 5: Chunk, embed, and persist ─────────────────────────────
    const chunksToSave = [];
    let chunkPosition = 0;

    for (const p of pages) {
      const words = p.text.split(" ").filter(Boolean);
      const rawChunks = splitIntoChunks(words, CHUNK_SIZE_WORDS, CHUNK_OVERLAP_WORDS);

      for (const chunkText of rawChunks) {
        if (!chunkText.trim()) continue;

        const chunkId = `${paper._id}_p${p.page}_c${chunkPosition}`;
        const embedding = await generateEmbedding(chunkText);

        chunksToSave.push({
          paperId: paper._id,
          chunkId,
          pageNumber: p.page,
          subject: paper.subject,
          semester: paper.semester,
          university: "Unknown", // Paper model has no university field
          chunkText,
          position: chunkPosition,
          embedding,
          embeddingVersion: "v1",
          metadata: {
            title: paper.title,
            length: String(chunkText.length),
          },
        });
        chunkPosition++;
      }
    }

    // Idempotent: remove stale chunks before inserting fresh ones
    await AIChatChunk.deleteMany({ paperId: paper._id });

    if (chunksToSave.length > 0) {
      await AIChatChunk.insertMany(chunksToSave);
      console.log(
        `[AI Ingestor] Stored ${chunksToSave.length} chunks for "${paper.title}".`
      );
    } else {
      console.warn(`[AI Ingestor] No chunks generated for "${paper.title}".`);
    }

    return { success: true, chunkCount: chunksToSave.length };
  } catch (error) {
    console.error(`[AI Ingestor] Failed to ingest paper ${paper._id}:`, error);
    throw error;
  }
};

// ─── Reprocessing Engine ─────────────────────────────────────────────────────

export const reprocessPaper = async (paper) => {
  console.log(`[AI Ingestor] Reprocessing paper: "${paper.title}" (ID: ${paper._id})`);
  await deletePaperKnowledge(paper._id);
  return await processPaper(paper);
};

// ─── Delete Knowledge Engine ─────────────────────────────────────────────────

export const deletePaperKnowledge = async (paperId) => {
  console.log(`[AI Ingestor] Deleting knowledge chunks for paper ID: ${paperId}`);
  const result = await AIChatChunk.deleteMany({ paperId });
  console.log(
    `[AI Ingestor] Deleted ${result.deletedCount} chunks for paper ID: ${paperId}`
  );
  return { success: true, deletedCount: result.deletedCount };
};
