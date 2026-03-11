import { useState } from "react";

export default function ChatWindow({ chat, messages = [], currentUserId, onSendMessage }) {
  const [input, setInput] = useState("");

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Select a conversation
      </div>
    );
  }

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex-1 flex flex-col">

      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-semibold">{chat.name}</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              Number(msg.sender_id) === Number(currentUserId) ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`
                px-4 py-2 rounded-2xl max-w-xs text-sm
                ${
                  Number(msg.sender_id) === Number(currentUserId)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }
              `}
            >
              <div>{msg.message}</div>
              <div className="text-[10px] mt-1 opacity-70">
                {new Date(msg.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none"
          placeholder="Type a message..."
        />
        <button
          onClick={handleSend}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Send
        </button>
      </div>
    </div>
  );
}
