import { useEffect, useEffectEvent, useState } from "react";
import { NotificationContext } from "./NotificationContext";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications.api";
import { useAuth } from "../hooks/useAuth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

export default function NotificationProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const canViewNotifications = Boolean(user?.permissions?.includes("notifications.view"));

  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  async function fetchNotifications() {
    if (!canViewNotifications) {
      setNotifications([]);
      setUnread(0);
      return;
    }

    setLoading(true);
    try {
      const res = await getMyNotifications({ limit: 50 });
      setNotifications(Array.isArray(res?.data?.list) ? res.data.list : []);
      setUnread(Number(res?.data?.unread || 0));
    } catch {
      // Keep the header stable even if notifications fail temporarily.
    } finally {
      setLoading(false);
    }
  }

  const refreshNotificationsEvent = useEffectEvent(() => {
    fetchNotifications();
  });

  async function refreshNotifications() {
    await fetchNotifications();
  }

  useEffect(() => {
    if (authLoading) return;
    refreshNotificationsEvent();
  }, [authLoading, user?.id, canViewNotifications]);

  useEffect(() => {
    if (!canViewNotifications) return undefined;

    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) return undefined;

    const stream = new EventSource(
      `${API_URL}/notifications/stream?access_token=${encodeURIComponent(accessToken)}`
    );

    const handleUpdate = () => {
      refreshNotificationsEvent();
    };

    stream.addEventListener("notification:new", handleUpdate);
    stream.addEventListener("notification:read", handleUpdate);
    stream.addEventListener("notification:read-all", handleUpdate);
    stream.onerror = () => {
      stream.close();
    };

    return () => {
      stream.removeEventListener("notification:new", handleUpdate);
      stream.removeEventListener("notification:read", handleUpdate);
      stream.removeEventListener("notification:read-all", handleUpdate);
      stream.close();
    };
  }, [canViewNotifications, user?.id]);

  async function handleMarkRead(notificationId) {
    await markNotificationRead(notificationId);
    setNotifications((prev) =>
      prev.map((item) =>
        Number(item.id) === Number(notificationId)
          ? { ...item, is_read: true, read_at: new Date().toISOString() }
          : item
      )
    );
    setUnread((prev) => Math.max(0, prev - 1));
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        is_read: true,
        read_at: item.read_at || new Date().toISOString(),
      }))
    );
    setUnread(0);
  }

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unread,
        loading,
        canViewNotifications,
        refreshNotifications,
        markRead: handleMarkRead,
        markAllRead: handleMarkAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
