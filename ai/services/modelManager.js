let currentModel = process.env.OLLAMA_MODEL || "mistral";
const SUPPORTED_MODELS = ["mistral", "phi3", "llama3"];

// Fetch with Timeout and Retry Capabilities
export const fetchWithRetry = async (url, options, retries = 3, timeoutMs = 5000) => {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) return response;
      throw new Error(`HTTP Error: ${response.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[AI Model Manager Warning] Fetch failed (Attempt ${i + 1}/${retries}): ${err.message}`);
      if (i === retries - 1) throw err;
      // Exponential backoff
      await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
    }
  }
};

export const getCurrentModel = () => currentModel;

export const switchModel = (modelName) => {
  if (!SUPPORTED_MODELS.includes(modelName)) {
    throw new Error(`Unsupported model: ${modelName}. Supported: ${SUPPORTED_MODELS.join(", ")}`);
  }
  currentModel = modelName;
  console.log(`[AI Model Manager Log] Switched active model to: ${currentModel}`);
  return { success: true, currentModel };
};

const getBaseOllamaUrl = () => {
  const rawUrl = process.env.OLLAMA_URL || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  return rawUrl.replace(/\/+$/, "").replace(/\/api\/generate$/, "");
};

// Check if model is downloaded/installed locally in Ollama
export const checkModelAvailability = async (modelName) => {
  const ollamaUrl = getBaseOllamaUrl();
  try {
    const res = await fetchWithRetry(`${ollamaUrl}/api/tags`, { method: "GET" }, 2, 3000);
    const data = await res.json();
    const installedModels = data.models || [];
    const isAvailable = installedModels.some(m => m.name.startsWith(modelName));
    return { success: true, isAvailable, installedModels };
  } catch (err) {
    console.error("[AI Model Manager Error] Failed to query model list from Ollama:", err.message);
    return { success: false, isAvailable: false, error: err.message };
  }
};

// Validate Ollama local instance connection
export const checkOllamaHealth = async () => {
  const ollamaUrl = getBaseOllamaUrl();
  try {
    const res = await fetchWithRetry(ollamaUrl, { method: "GET" }, 2, 2000);
    return { success: true, status: "healthy", url: ollamaUrl };
  } catch (err) {
    return { success: false, status: "unreachable", url: ollamaUrl, error: err.message };
  }
};
