export default function ChatList({
  conversations,
  activeChatId,
  onSelect,
  onNewChat
}) {
  return (
    <div className="w-80 border-r flex flex-col">
      
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="font-semibold">Chats</h2>
        <button
          onClick={onNewChat}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          New
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map(conv => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`
              p-4 cursor-pointer border-b hover:bg-gray-50
              ${activeChatId === conv.id ? "bg-gray-100" : ""}
            `}
          >
            <p className="font-medium text-sm">{conv.name || `${conv.type} #${conv.id}`}</p>
            <p className="text-xs text-gray-500 truncate">
              {conv.last_message || "No messages yet"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
