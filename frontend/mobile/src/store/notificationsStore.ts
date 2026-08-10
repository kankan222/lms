import { create } from "zustand";

type NotificationsState = {
  unread: number;
  setUnread: (count: number) => void;
};

export const useNotificationsStore = create<NotificationsState>((set) => ({
  unread: 0,
  setUnread: (count) => set({ unread: Math.max(0, Number(count) || 0) }),
}));
