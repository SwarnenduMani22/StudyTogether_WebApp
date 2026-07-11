import { useNavigate, useLocation } from "react-router-dom";

const ChatWidget = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Do not show the floating widget if user is not logged in or is already on the assistant page
  if (!localStorage.getItem("accessToken") || location.pathname === "/assistant") {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={() => navigate("/assistant")}
        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-2xl flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
        title="Open AI Assistant"
      >
        <span className="text-xl">💬</span>
      </button>
    </div>
  );
};

export default ChatWidget;
