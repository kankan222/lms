import { useState, useEffect } from "react";
import ChatList from "../components/Chats/ChatList";
import ChatWindow from "../components/Chats/ChatWindow";

import {
  sendMessage,
  getConversations,
  getMessages,
  markAsRead
} from "../api/messaging.api";

const Messaging = () => {

  const [conversations, setConversations] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);

  const activeChat = conversations.find(c => c.id === activeChatId);

  /*
  LOAD CONVERSATIONS
  */

  async function loadConversations() {
    try {
      const res = await getConversations();
      setConversations(res.json || res);
    } catch (err) {
      console.error(err);
    }
  }

  /*
  LOAD MESSAGES
  */

  async function loadMessages(conversationId) {
    try {
      const res = await getMessages(conversationId);
      setMessages(res.json || res);

      await markAsRead({ conversation_id: conversationId });

    } catch (err) {
      console.error(err);
    }
  }

  /*
  SEND MESSAGE
  */

  async function handleSendMessage(text) {

    if (!activeChatId || !text.trim()) return;

    try {

      await sendMessage({
        conversation_id: activeChatId,
        message: text
      });

      await loadMessages(activeChatId);
      await loadConversations();

    } catch (err) {
      console.error(err);
    }
  }

  /*
  INITIAL LOAD
  */

  useEffect(() => {
    loadConversations();
  }, []);


  useEffect(() => {

    if (activeChatId) {
      loadMessages(activeChatId);
    }

  }, [activeChatId]);

  return (
    <div className="flex h-[calc(100vh-60px)] bg-secondary border">

      <ChatList
        conversations={conversations}
        activeChatId={activeChatId}
        onSelect={setActiveChatId}
      />

      <ChatWindow
        chat={activeChat}
        messages={messages}
        onSendMessage={handleSendMessage}
      />

    </div>
  );
};

export default Messaging;