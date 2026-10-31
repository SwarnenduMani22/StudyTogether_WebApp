import test, { describe, it } from "node:test";
import assert from "node:assert";
import { getAiStreamUrl, getAiBaseUrl } from "../../client/src/api/aiAxios.js";

// Helper simulating AIAssistant streaming reader
async function simulateStream({ chunks, onChunk, onError, onDone }) {
  const encoder = new TextEncoder();
  const byteChunks = chunks.map((c) =>
    typeof c === "string" ? encoder.encode(c) : c
  );
  let chunkIdx = 0;

  const mockReader = {
    read: async () => {
      if (chunkIdx < byteChunks.length) {
        return { value: byteChunks[chunkIdx++], done: false };
      }
      return { value: undefined, done: true };
    },
  };

  const decoder = new TextDecoder();
  let finished = false;
  let buffer = "";

  const processLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) return;
    const jsonStr = trimmed.slice(6).trim();
    if (!jsonStr) return;

    try {
      const payload = JSON.parse(jsonStr);
      if (payload.error) {
        if (onError) onError(payload.error);
      } else if (payload.token) {
        if (onChunk) onChunk(payload.token);
      } else if (payload.done) {
        if (onDone) onDone(payload.conversationId);
      }
    } catch {
      // Ignore malformed JSON
    }
  };

  while (!finished) {
    const { value, done } = await mockReader.read();
    finished = done;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        processLine(line);
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const remainingLines = buffer.split("\n");
    for (const line of remainingLines) {
      processLine(line);
    }
  }
}

describe("P1-6 SUITE: AI Assistant Integration & Streaming (INT-02)", () => {
  // 1. URL Normalization
  it("1.1 Default / undefined URL resolves to /api/v1/ai/chat/stream", () => {
    const url = getAiStreamUrl(undefined);
    assert.strictEqual(url, "http://localhost:5001/api/v1/ai/chat/stream");
  });

  it("1.2 Empty string URL resolves to /api/v1/ai/chat/stream", () => {
    const url = getAiStreamUrl("");
    assert.strictEqual(url, "http://localhost:5001/api/v1/ai/chat/stream");
  });

  it("1.3 Host-only URL (no path) resolves without duplicate slash", () => {
    const url1 = getAiStreamUrl("http://localhost:5001");
    const url2 = getAiStreamUrl("http://localhost:5001/");
    assert.strictEqual(url1, "http://localhost:5001/api/v1/ai/chat/stream");
    assert.strictEqual(url2, "http://localhost:5001/api/v1/ai/chat/stream");
  });

  it("1.4 Standard /api/v1 URL appends /ai/chat/stream without double /api/v1", () => {
    const url1 = getAiStreamUrl("http://localhost:5001/api/v1");
    const url2 = getAiStreamUrl("http://localhost:5001/api/v1/");
    assert.strictEqual(url1, "http://localhost:5001/api/v1/ai/chat/stream");
    assert.strictEqual(url2, "http://localhost:5001/api/v1/ai/chat/stream");
  });

  it("1.5 URL already ending with /ai avoids duplicate /ai segment", () => {
    const url1 = getAiStreamUrl("http://localhost:5001/api/v1/ai");
    const url2 = getAiStreamUrl("http://localhost:5001/api/v1/ai/");
    assert.strictEqual(url1, "http://localhost:5001/api/v1/ai/chat/stream");
    assert.strictEqual(url2, "http://localhost:5001/api/v1/ai/chat/stream");
  });

  it("1.6 Custom remote domain URL normalizes correctly", () => {
    const url = getAiStreamUrl("https://ai.studytogether.edu/api/v1");
    assert.strictEqual(url, "https://ai.studytogether.edu/api/v1/ai/chat/stream");
  });

  it("1.7 getAiBaseUrl strips trailing /ai for axios consistency", () => {
    assert.strictEqual(getAiBaseUrl("http://localhost:5001/api/v1"), "http://localhost:5001/api/v1");
    assert.strictEqual(getAiBaseUrl("http://localhost:5001/api/v1/ai"), "http://localhost:5001/api/v1");
    assert.strictEqual(getAiBaseUrl("http://localhost:5001/api/v1/ai/"), "http://localhost:5001/api/v1");
  });

  // 2. Successful Streaming
  it("2. Successful streaming accumulates tokens and captures conversationId", async () => {
    let streamedText = "";
    let capturedConvId = null;

    await simulateStream({
      chunks: [
        'data: {"token": "Hello "}\n\n',
        'data: {"token": "World! How can "}\n\n',
        'data: {"token": "I assist you?"}\n\n',
        'data: {"done": true, "conversationId": "session_abc_123"}\n\n',
      ],
      onChunk: (tok) => {
        streamedText += tok;
      },
      onDone: (convId) => {
        capturedConvId = convId;
      },
    });

    assert.strictEqual(streamedText, "Hello World! How can I assist you?");
    assert.strictEqual(capturedConvId, "session_abc_123");
  });

  // 3. Multi-byte UTF-8 split chunk decoding
  it("3. Multi-byte UTF-8 character split across chunks decodes cleanly without corruption", async () => {
    const encoder = new TextEncoder();
    // 💡 Emoji '💡' is 4 bytes: 0xF0, 0x9F, 0x92, 0xA1
    const emojiBytes = encoder.encode('data: {"token": "💡 Tips"}\n\n');

    // Split the 4-byte sequence in half across two stream chunks
    const splitIndex = 20; // in the middle of emoji bytes
    const chunk1 = emojiBytes.slice(0, splitIndex);
    const chunk2 = emojiBytes.slice(splitIndex);

    let decodedText = "";
    await simulateStream({
      chunks: [chunk1, chunk2],
      onChunk: (tok) => {
        decodedText += tok;
      },
    });

    assert.strictEqual(decodedText, "💡 Tips");
  });

  // 4. Error Payload Handling
  it("4. Stream error payload triggers onError callback", async () => {
    let receivedError = null;

    await simulateStream({
      chunks: [
        'data: {"token": "Processing..."}\n\n',
        'data: {"error": "Ollama service connection timeout"}\n\n',
      ],
      onError: (err) => {
        receivedError = err;
      },
    });

    assert.strictEqual(receivedError, "Ollama service connection timeout");
  });

  // 5. Keepalive and empty lines
  it("5. Empty keepalive lines are safely ignored", async () => {
    let streamedText = "";

    await simulateStream({
      chunks: [
        ": keep-alive\n\n",
        "\n\n",
        'data: {"token": "OK"}\n\n',
        ": ping\n\n",
      ],
      onChunk: (tok) => {
        streamedText += tok;
      },
    });

    assert.strictEqual(streamedText, "OK");
  });
});
