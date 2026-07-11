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

    // Validate inputs
    if (!query) throw new Error("query variable is required");

    const formattedBody = template.format(query, context, history, userContext);
    prompt = `System: ${template.system}\n\n${formattedBody}`;
  } else if (templateType === "general") {
    const { query, history = "" } = variables;
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
