import { getCurrentModel, fetchWithRetry } from "./modelManager.js";

const getOllamaGenerateUrl = () => {
  const rawUrl = process.env.OLLAMA_URL || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const cleanBase = rawUrl.replace(/\/+$/, "");
  return cleanBase.endsWith("/api/generate") ? cleanBase : `${cleanBase}/api/generate`;
};

export const queryOllama = async (prompt, options = {}) => {
  const ollamaUrl = getOllamaGenerateUrl();
  const model = options.model || getCurrentModel();
  const temperature = options.temperature !== undefined ? options.temperature : 0.7;
  const maxTokens = options.maxTokens || 500;
  const stream = options.stream || false;
  const timeoutMs = options.timeoutMs || 10000;
  const retries = options.retries || 3;

  console.log(`[Ollama Service] Querying model: ${model}, stream: ${stream}`);

  try {
    const response = await fetchWithRetry(
      ollamaUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
      },
      retries,
      timeoutMs
    );

    if (!response.ok) {
      throw new Error(`Ollama API returned status ${response.status}`);
    }

    const data = await response.json();
    return data.response ? data.response.trim() : "";
  } catch (error) {
    console.error("[Ollama Service Error] Query execution failed:", error.message);
    throw error;
  }
};

// Progressive Token Streaming Service
export const queryOllamaStream = async (prompt, onChunk, options = {}) => {
  const ollamaUrl = getOllamaGenerateUrl();
  const model = options.model || getCurrentModel();
  const temperature = options.temperature !== undefined ? options.temperature : 0.7;
  const maxTokens = options.maxTokens || 500;
  const signal = options.signal;

  try {
    const res = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        options: {
          temperature,
          num_predict: maxTokens
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama returned status ${res.status}`);
    }

    const reader = res.body;
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of reader) {
      buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Retain incomplete line
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            onChunk(parsed.response);
          }
        } catch (err) {
          // ignore parsing partial chunk lines
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        if (parsed.response) {
          onChunk(parsed.response);
        }
      } catch (err) {
        // ignore
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("[Ollama Stream Log] Stream request was aborted by client close signal.");
    } else {
      console.error("[Ollama Stream Error] Streaming execution failed:", error.message);
      throw error;
    }
  }
};
