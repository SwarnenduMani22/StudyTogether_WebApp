import { createRequire } from "module";
import AIChatChunk from "../models/AIChatChunk.js";
import Paper from "../models/Paper.js";
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

// ─── Lazy-load OCR dependencies ───────────────────────────────────────────────
// Both packages loaded lazily — missing packages degrade gracefully without
// crashing the server at startup.

let _pdfImgConvert = null;
const getPdfImgConvert = () => {
  if (!_pdfImgConvert) {
    try {
      const require = createRequire(import.meta.url);
      _pdfImgConvert = require("pdf-img-convert");
    } catch (err) {
      throw new Error(
        "pdf-img-convert is not installed. Run `npm install pdf-img-convert` inside server/. " +
        err.message
      );
    }
  }
  return _pdfImgConvert;
};

let _tesseract = null;
const getTesseract = () => {
  if (!_tesseract) {
    try {
      const require = createRequire(import.meta.url);
      _tesseract = require("tesseract.js");
    } catch (err) {
      throw new Error(
        "tesseract.js is not installed. Run `npm install tesseract.js` inside server/. " +
        err.message
      );
    }
  }
  return _tesseract;
};

/**
 * OCR Fallback — uses tesseract.js + pdf-img-convert to extract text from
 * scanned / image-based PDFs that yield no text via pdf-parse.
 *
 * Pipeline:
 *  1. Convert each PDF page to a PNG Uint8Array via pdf-img-convert
 *  2. Create a single Tesseract worker (English) for the whole document
 *  3. Run worker.recognize() on each page image
 *  4. Concatenate all page texts and return as an array of { page, text }
 *
 * @param {Buffer} pdfBuffer - Raw PDF bytes
 * @param {Object} paper     - Paper document (for logging)
 * @returns {Promise<Array<{page: number, text: string}>>}
 */
const runOcrOnBuffer = async (pdfBuffer, paper) => {
  console.log(
    `[AI Ingestor] Starting OCR for scanned PDF: "${paper.title}" (ID: ${paper._id})`
  );

  const pdfImgConvert = getPdfImgConvert();
  const { createWorker } = getTesseract();

  // Step 1: Convert PDF pages to PNG image buffers
  // pdf-img-convert accepts a Buffer and returns an array of Uint8Array (one per page)
  let pageImages;
  try {
    pageImages = await pdfImgConvert.convert(pdfBuffer, {
      width: 1700,       // High resolution for better OCR accuracy
      height: 2200,
      page_numbers: null, // null = all pages
      base64: false,      // Return Uint8Array, not base64 string
    });
  } catch (convertErr) {
    console.error(
      `[AI Ingestor] PDF→image conversion failed for "${paper.title}":`,
      convertErr.message
    );
    return [];
  }

  if (!pageImages || pageImages.length === 0) {
    console.warn(`[AI Ingestor] No page images produced for "${paper.title}".`);
    return [];
  }

  console.log(
    `[AI Ingestor] Converted ${pageImages.length} page(s) to images — running OCR...`
  );

  // Step 2: Create a single Tesseract worker for all pages (more efficient)
  const worker = await createWorker("eng", 1, {
    // Suppress verbose Tesseract logging in production
    logger: process.env.NODE_ENV === "development"
      ? (m) => console.log(`[Tesseract] ${m.status} ${Math.round((m.progress || 0) * 100)}%`)
      : () => {},
  });

  const pages = [];
  try {
    // Step 3: OCR each page image
    for (let i = 0; i < pageImages.length; i++) {
      const imageBuffer = Buffer.from(pageImages[i]);
      const { data } = await worker.recognize(imageBuffer);
      const text = cleanText(data.text || "");
      if (text.length > 0) {
        pages.push({ page: i + 1, text });
      }
    }
  } finally {
    // Step 4: Always terminate the worker to free native resources
    await worker.terminate();
  }

  console.log(
    `[AI Ingestor] OCR complete — extracted text from ${pages.length}/${pageImages.length} page(s) ` +
    `for "${paper.title}".`
  );

  return pages;
};

// ─── Main Processing Engine ───────────────────────────────────────────────────

/**
 * Ingests a paper into the vector knowledge base.
 *
 * Steps:
 *  1. Download PDF buffer from paper.pdfLink (Cloudinary URL)
 *  2. Extract text with pdf-parse (real content, page-by-page)
 *  3. If text is too short, fall back to tesseract.js OCR (P2-002)
 *  4. Split into overlapping word-level chunks
 *  5. Generate embeddings and store in AIChatChunk (idempotent — deletes old chunks first)
 */
export const processPaper = async (paper) => {
  console.log(`[AI Ingestor] Processing paper: "${paper.title}" (ID: ${paper._id})`);

  try {
    // Set status to processing
    await Paper.findByIdAndUpdate(paper._id, { aiStatus: "processing" });

    let pages = []; // Array of { page: number, text: string }

    // ── Step 1 & 2: Download and parse PDF ────────────────────────────────
    if (!paper.pdfLink) {
      throw new Error("Paper has no pdfLink — cannot extract text.");
    }

    let pdfBuffer = null;
    try {
      pdfBuffer = await downloadPdf(paper.pdfLink);
      pages = await extractPagesFromBuffer(pdfBuffer);
    } catch (parseErr) {
      console.error(
        `[AI Ingestor] PDF extraction failed for "${paper.title}":`,
        parseErr.message
      );
    }

    // ── Step 3: OCR fallback if no usable text extracted ──────────────────
    const totalExtracted = pages.reduce((sum, p) => sum + p.text.length, 0);
    if (totalExtracted < MIN_TEXT_LENGTH) {
      if (pdfBuffer) {
        try {
          const ocrPages = await runOcrOnBuffer(pdfBuffer, paper);
          if (ocrPages.length > 0) {
            pages = ocrPages;
          }
        } catch (ocrErr) {
          // OCR packages may not be installed yet — log and continue
          console.error(
            `[AI Ingestor] OCR failed for "${paper.title}" (is tesseract.js installed?):`,
            ocrErr.message
          );
        }
      }

      // Last resort: if OCR also failed or produced nothing, store a minimal metadata chunk
      // so the paper has at least one searchable entry
      if (pages.length === 0 || pages.reduce((s, p) => s + p.text.length, 0) < MIN_TEXT_LENGTH) {
        console.warn(
          `[AI Ingestor] No text extractable for "${paper.title}" — storing metadata-only chunk.`
        );
        pages = [{
          page: 1,
          text: cleanText(
            `"${paper.title}" — subject: ${paper.subject}, semester: ${paper.semester}.`
          ),
        }];
      }
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

    // Set status to completed
    await Paper.findByIdAndUpdate(paper._id, {
      aiStatus: "completed",
      chunkCount: chunksToSave.length,
      indexedAt: new Date(),
      embeddingVersion: "v1",
    });

    return { success: true, chunkCount: chunksToSave.length };
  } catch (error) {
    // Set status to failed
    await Paper.findByIdAndUpdate(paper._id, { aiStatus: "failed" }).catch(e => console.error("Failed to update status to failed:", e));
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
