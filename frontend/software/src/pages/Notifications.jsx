import TopBar from "../components/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "../notifications/useNotifications";
import { formatReadableDateTime } from "../lib/dateTime";

function NotificationRow({ item, onRead }) {
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
            {!item.is_read ? <Badge variant="secondary">New</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatReadableDateTime(item.created_at)}
          </p>
        </div>
        {!item.is_read ? (
          <Button size="sm" variant="outline" onClick={() => onRead(item.id)}>
            Mark Read
          </Button>
        ) : null}
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

  const unreadItems = notifications.filter((item) => !item.is_read);

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
      <TopBar title="Notifications" subTitle="Software notification feed shared with future mobile delivery" />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total Feed</CardDescription>
            <CardTitle className="text-3xl">{notifications.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Unread</CardDescription>
            <CardTitle className="text-3xl">{unread}</CardTitle>
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
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading notifications...</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications found.</p>
            ) : (
              notifications.map((item) => (
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
