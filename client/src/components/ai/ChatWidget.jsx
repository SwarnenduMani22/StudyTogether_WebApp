import { useState, useEffect, useRef } from "react";
import api from "../../api/axios";
import toast from "react-hot-toast";

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  const messagesEndRef = useRef(null);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (text) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    if (!text) setInput("");

    // Append user message
    setMessages((prev) => [...prev, { sender: "user", content: messageText }]);
    setLoading(true);

    const token = localStorage.getItem("accessToken");
    const streamUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1") + "/ai/chat/stream";

    try {
      // Create empty assistant bubble to stream into
      setMessages((prev) => [...prev, { sender: "assistant", content: "" }]);

      const response = await fetch(streamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId,
          message: messageText,
          paperId: null
        })
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
          const lines = chunkText.split("\n").filter(l => l.startsWith("data: "));
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
                      content: streamedResponse
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
        await api.delete(`/ai/history/${conversationId}`);
      } catch (err) {
        console.error(err);
      }
    }
    setMessages([]);
    setConversationId(null);
    toast.success("Chat history cleared");
  };

  // Token read is safe here — after all hooks have been declared
  if (!localStorage.getItem("accessToken")) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-2xl flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
      >
        {isOpen ? (
          <span className="text-xl font-bold">✕</span>
        ) : (
          <span className="text-xl">💬</span>
        )}
      </button>

      {/* Expanded Chat Box */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 sm:w-96 h-[480px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform scale-100 origin-bottom-right">
          {/* Header */}
          <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">Platform Assistant</h3>
              <p className="text-xs text-indigo-200">StudyTogether Help Desk</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-xs bg-indigo-700 hover:bg-indigo-800 px-2 py-1 rounded transition"
              >
                Clear
              </button>
            )}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50 dark:bg-gray-900">
            {messages.length === 0 && (
              <div className="space-y-4 text-center mt-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Hi! How can I help you use StudyTogether today?
                </p>
                <div className="flex flex-col gap-2 px-4">
                  {[
                    "How does the coin economy work?",
                    "How can I save drafts?",
                    "What are the file upload limits?",
                  ].map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestClick(q)}
                      className="text-xs text-left bg-white dark:bg-gray-850 hover:bg-indigo-50 dark:hover:bg-gray-750 text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-gray-750 p-2.5 rounded-xl transition shadow-sm"
                    >
                      💡 {q}
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
                  className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm shadow-sm ${
                    msg.sender === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-bl-none border border-gray-150 dark:border-gray-750"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 text-gray-400 px-4 py-2 rounded-2xl text-xs rounded-bl-none border border-gray-150 dark:border-gray-750 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Panel */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 flex gap-2 items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 input bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-750 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
