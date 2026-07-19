import TopBar from "../components/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { useNotifications } from "../notifications/useNotifications";
import { formatReadableDateTime } from "../lib/dateTime";

const CATEGORY_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Messages", value: "message" },
  { label: "Attendance", value: "attendance" },
  { label: "Marksheets", value: "marksheet" },
  { label: "Fees", value: "fee" },
  { label: "Account", value: "account" },
  { label: "System", value: "system" },
];

function getCategory(item) {
  return String(item.category || "system").toLowerCase();
}

function NotificationRow({ item, onRead }) {
  const actionHref = item.action_url || item.actionUrl || null;
  return (
    <div
      className={`rounded-xl border p-4 transition ${
        item.is_read ? "bg-background/60" : "border-primary/30 bg-primary/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{item.title}</p>
            <Badge variant="outline" className="capitalize">{getCategory(item)}</Badge>
            {!item.is_read ? <Badge variant="secondary">New</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatReadableDateTime(item.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {actionHref ? (
            <Button size="sm" variant="outline" asChild>
              <a href={actionHref}>Open</a>
            </Button>
          ) : null}
          {!item.is_read ? (
            <Button size="sm" variant="outline" onClick={() => onRead(item.id)}>
              Mark Read
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const {
    notifications,
    unread,
    loading,
    canViewNotifications,
    markRead,
    markAllRead,
  } = useNotifications();
  const [category, setCategory] = useState("all");

  const filteredNotifications = useMemo(
    () => notifications.filter((item) => category === "all" || getCategory(item) === category),
    [category, notifications]
  );
  const unreadItems = filteredNotifications.filter((item) => !item.is_read);

  if (!canViewNotifications) {
    return (
      <>
        <TopBar title="Notifications" subTitle="Notification access depends on your assigned permissions" />
        <Card>
          <CardHeader>
            <CardTitle>Notifications Unavailable</CardTitle>
            <CardDescription>
              Your account does not currently have the `notifications.view` permission.
            </CardDescription>
          </CardHeader>
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <TopBar title="Notifications" subTitle="Action-focused feed for messages, attendance, marksheets, fees, account, and system alerts" />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total Feed</CardDescription>
            <CardTitle className="text-3xl">{filteredNotifications.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Unread</CardDescription>
            <CardTitle className="text-3xl">{unreadItems.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Actions</CardDescription>
            <CardTitle className="text-base font-medium">Keep your feed clean</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={markAllRead} disabled={!unread}>
              Mark All Read
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>All Notifications</CardTitle>
            <CardDescription>Latest 50 notifications delivered to this account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={category === option.value ? "default" : "outline"}
                  onClick={() => setCategory(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading notifications...</p>
            ) : filteredNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications found.</p>
            ) : (
              filteredNotifications.map((item) => (
                <NotificationRow key={item.id} item={item} onRead={markRead} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unread Queue</CardTitle>
            <CardDescription>Items still waiting for acknowledgement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {unreadItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everything is read.</p>
            ) : (
              unreadItems.map((item) => (
                <NotificationRow key={`unread-${item.id}`} item={item} onRead={markRead} />
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
