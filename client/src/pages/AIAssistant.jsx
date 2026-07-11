import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import aiApi from "../api/aiAxios";
import toast from "react-hot-toast";

const AIAssistant = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [aiActive, setAiActive] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const checkAiStatus = async () => {
      try {
        const res = await aiApi.get("/ai/status");
        if (res.data && res.data.active === false) {
          setAiActive(false);
        }
      } catch (err) {
        setAiActive(false);
      } finally {
        setIsChecking(false);
      }
    };
    if (localStorage.getItem("accessToken")) {
      checkAiStatus();
    } else {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (text) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    if (!text) setInput("");

    // Append user message
    setMessages((prev) => [...prev, { sender: "user", content: messageText }]);
    setLoading(true);

    const token = localStorage.getItem("accessToken");
    const streamUrl =
      (import.meta.env.VITE_AI_API_URL || "http://localhost:5001/api/v1") +
      "/chat/stream";

    try {
      // Create empty assistant bubble to stream into
      setMessages((prev) => [...prev, { sender: "assistant", content: "" }]);

      const response = await fetch(streamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          message: messageText,
          paperId: null,
        }),
      });

      if (!response.ok) throw new Error("Failed to initialize stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finished = false;
      let streamedResponse = "";

      while (!finished) {
        const { value, done } = await reader.read();
        finished = done;
        if (value) {
          const chunkText = decoder.decode(value);
          const lines = chunkText
            .split("\n")
            .filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            try {
              const payload = JSON.parse(line.replace("data: ", ""));
              if (payload.token) {
                streamedResponse += payload.token;
                setMessages((prev) => {
                  const updated = [...prev];
                  if (updated.length > 0) {
                    updated[updated.length - 1] = {
                      sender: "assistant",
                      content: streamedResponse,
                    };
                  }
                  return updated;
                });
              } else if (payload.done) {
                setConversationId(payload.conversationId);
              }
            } catch (e) {
              // ignore partial payload chunks
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to stream response from assistant");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestClick = (q) => {
    handleSendMessage(q);
  };

  const clearChat = async () => {
    if (conversationId) {
      try {
        await aiApi.delete(`/history/${conversationId}`);
      } catch (err) {
        console.error(err);
      }
    }
    setMessages([]);
    setConversationId(null);
    toast.success("Chat history cleared");
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  // --- DISABLED STATE ---
  if (!aiActive) {
    return (
      <div className="max-w-4xl mx-auto h-[80vh] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 p-4 sm:p-6 text-white flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-indigo-700 hover:bg-indigo-800 rounded-xl transition"
          >
            ← Back
          </button>
          <div>
            <h1 className="font-bold text-xl sm:text-2xl">
              Platform Assistant
            </h1>
            <p className="text-sm text-indigo-200">StudyTogether Help Desk</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-900">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md w-full">
            <div className="text-4xl mb-4">🤖</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              AI Study Assistant is currently unavailable.
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You can continue using all StudyTogether features.
            </p>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              AI functionality will be available soon.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- ENABLED STATE ---
  return (
    <div className="max-w-4xl mx-auto h-[85vh] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-600 p-4 sm:p-6 text-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-indigo-700 hover:bg-indigo-800 rounded-xl transition font-medium"
          >
            ← Back
          </button>
          <div>
            <h1 className="font-bold text-xl sm:text-2xl">
              Platform Assistant
            </h1>
            <p className="text-sm text-indigo-200">StudyTogether Help Desk</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-sm font-medium bg-indigo-700 hover:bg-indigo-800 px-4 py-2 rounded-xl transition"
          >
            Clear Chat
          </button>
        )}
      </div>

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-gray-50 dark:bg-gray-900 flex flex-col">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full text-center mt-8 mb-8">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-sm">
              🤖
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              How can I help you today?
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md">
              Ask me anything about StudyTogether, paper approvals, or the coin
              economy.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {[
                "How does the coin economy work?",
                "How do I upload a paper?",
                "How do drafts work?",
                "How does approval work?",
              ].map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestClick(q)}
                  className="text-sm text-left bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-gray-750 text-indigo-700 dark:text-indigo-300 border border-gray-200 dark:border-gray-700 p-4 rounded-xl transition shadow-sm"
                >
                  <div className="font-medium mb-1">Example</div>
                  <div className="text-gray-600 dark:text-gray-400">{q}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] px-5 py-3 rounded-2xl text-base shadow-sm ${
                msg.sender === "user"
                  ? "bg-indigo-600 text-white rounded-br-none"
                  : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-none border border-gray-150 dark:border-gray-700 leading-relaxed"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 px-5 py-4 rounded-2xl rounded-bl-none border border-gray-150 dark:border-gray-700 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Message Input Panel */}
      <div className="shrink-0 p-4 sm:p-6 bg-white dark:bg-gray-850 border-t border-gray-200 dark:border-gray-700">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="max-w-4xl mx-auto relative flex items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 rounded-2xl pl-5 pr-24 py-4 text-base shadow-sm transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 font-semibold transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 flex items-center justify-center shadow-sm"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant;
