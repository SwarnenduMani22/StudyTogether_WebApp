export const PROMPT_TEMPLATES = {
  v1: {
    general: {
      system: "You are a helpful academic copilot for StudyTogether.",
      format: (query, history = "") => `${history}\nUser: ${query}\nAssistant:`,
    },
    platform: {
      system: "You are the Platform Helpdesk Assistant for StudyTogether. Explain feature details clearly.",
      format: (query, context, history = "", userContext = "") => {
        return `User Context:\n${userContext}\n\nConversation History:\n${history}\n\nFeature Context:\n${context}\n\nQuestion: ${query}\nAnswer:`;
      },
    },
    study: {
      system: "You are a Study Assistant. Answer questions based on the provided document context excerpt below. Cite page numbers using [Page X] where appropriate.",
      format: (query, context, history = "", userContext = "") => {
        return `User Context:\n${userContext}\n\nConversation History:\n${history}\n\nContext:\n${context}\n\nQuestion: ${query}\nAnswer:`;
      },
    },
    follow_up: {
      system: "Identify if query refers to the previous topic and reformulate keywords.",
      format: (query, history) => `Query: ${query}\nHistory: ${history}\nEnriched Query:`,
    },
    unknown: {
      system: "Provide a friendly fallback when no context matches.",
      format: (query) => `I am sorry, I do not have enough context to answer: "${query}".`,
    },
    error: {
      system: "Handle backend API execution errors gracefully.",
      format: (errorMsg) => `An error occurred: "${errorMsg}". Please retry.`,
    },
  },
};

// Security checks for Prompt Injection Detection
export const detectPromptInjection = (text) => {
  if (!text || typeof text !== "string") return false;
  const lowerText = text.toLowerCase();
  const attackPatterns = [
    "ignore previous instructions",
    "ignore all previous",
    "system instruction",
    "system override",
    "developer mode",
    "bypass limit",
    "you are no longer a",
    "prompt injection"
  ];
  return attackPatterns.some(pattern => lowerText.includes(pattern));
};

// Output sanitization to prevent XSS / HTML / Script injection from LLM output
export const sanitizeOutput = (text) => {
  if (!text) return "";
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // remove scripts
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "") // remove iframes
    .replace(/<(object|embed)\b[^<]*(?:(?!<\/(object|embed)>)<[^<]*)*<\/(object|embed)>/gi, "") // remove objects
    .replace(/javascript:/gi, "") // remove javascript schema execution
    .replace(/data:/gi, "") // remove data URIs
    .replace(/\bon[a-z]+\s*=/gi, "") // remove inline event handlers (onerror, onload, etc)
    .trim();
};

export const buildPrompt = (templateType, variables, options = {}) => {
  const version = options.version || "v1";
  const maxPromptLength = options.maxPromptLength || 4000;

  const templateSet = PROMPT_TEMPLATES[version];
  if (!templateSet) {
    throw new Error(`Unsupported prompt version: ${version}`);
  }

  const template = templateSet[templateType];
  if (!template) {
    throw new Error(`Unsupported prompt template: ${templateType}`);
  }

  let prompt = "";
  if (templateType === "platform" || templateType === "study") {
    const { query, context, history = "", userContext = "" } = variables;

    // Validate inputs & prevent Prompt Injection
    if (!query) throw new Error("query variable is required");
    
    // Secure input validation against prompt injection
    if (detectPromptInjection(query)) {
      console.warn(`[AI Security Warning] Suspicious prompt pattern blocked for template: ${templateType}`);
      throw new Error("Prompt rejected: Suspicious command patterns detected.");
    }

    const formattedBody = template.format(query, context, history, userContext);
    prompt = `System: ${template.system}\n\n${formattedBody}`;
  } else if (templateType === "general") {
    const { query, history = "" } = variables;
    
    if (detectPromptInjection(query)) {
      console.warn(`[AI Security Warning] Suspicious prompt pattern blocked for template: general`);
      throw new Error("Prompt rejected: Suspicious command patterns detected.");
    }

    prompt = `System: ${template.system}\n\n${template.format(query, history)}`;
  } else if (templateType === "unknown" || templateType === "error") {
    const { query, errorMsg } = variables;
    prompt = template.format(query || errorMsg);
  }

  // Enforce context / prompt length constraints
  if (prompt.length > maxPromptLength) {
    console.log(`[AI Prompt Manager Log] Truncating prompt to fit max limit: ${maxPromptLength}`);
    prompt = prompt.substring(0, maxPromptLength);
  }

  return {
    prompt,
    systemPrompt: template.system,
    version,
    templateType,
    length: prompt.length,
  };
};
