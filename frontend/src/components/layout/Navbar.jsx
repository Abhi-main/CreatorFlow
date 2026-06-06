import { Bell, ChevronRight, CheckCheck, LogOut, UserCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import { notificationsApi } from "../../api/services";
import { useAuth } from "../../context/AuthContext";
import { useSocketEvent } from "../../hooks/useSocket";
import { EVENTS } from "../../socket/events";

const titleMap = {
  "/": "Dashboard",
  "/calendar": "Content Calendar",
  "/schedule": "Schedule Post",
  "/posts": "Post History",
  "/analytics": "Analytics",
  "/campaigns": "Campaigns",
  "/hashtags": "Hashtags",
  "/admin": "Admin Panel",
  "/settings": "Settings"
};

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    notificationsApi
      .list({ pageSize: 8 })
      .then((payload) => setNotifications(payload.items || payload.data || (Array.isArray(payload) ? payload : [])))
      .catch(() => {});
  }, [location.pathname]);

  const handleNewNotification = useCallback((data) => {
    const notification = data?.notification;
    if (!notification) return;

    setNotifications((current) => [
      {
        ...notification,
        id: notification.id || notification.notification_id || notification.reference_id || Date.now()
      },
      ...current
    ].slice(0, 10));

    toast.custom(
      () => (
        <div className="flex max-w-sm items-start gap-3 rounded-2xl border-l-4 border-brand-orange bg-white p-4 shadow-card">
          <Bell className="mt-0.5 h-5 w-5 text-brand-orange" />
          <div>
            <p className="text-sm font-bold text-slate-900">{notification.title}</p>
            <p className="mt-1 text-xs text-slate-500">{notification.body}</p>
          </div>
        </div>
      ),
      { duration: 4000, position: "top-right" }
    );
  }, []);

  useSocketEvent(EVENTS.NOTIFICATION_NEW, handleNewNotification);
  useSocketEvent(
    EVENTS.NOTIFICATION_READ,
    useCallback((data) => {
      setNotifications((current) =>
        current.map((item) => (String(item.id || item.notification_id) === String(data.notificationId) ? { ...item, is_read: true } : item))
      );
    }, [])
  );
  useSocketEvent(
    EVENTS.NOTIFICATION_READ_ALL,
    useCallback(() => {
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    }, [])
  );

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  async function markAsRead(id) {
    try {
      await notificationsApi.markRead(id);
      setNotifications((current) => current.map((item) => (String(item.id || item.notification_id) === String(id) ? { ...item, is_read: true } : item)));
    } catch {
      toast.error("Unable to update notification.");
    }
  }

  async function markAll() {
    try {
      await notificationsApi.markAllRead();
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch {
      toast.error("Unable to mark notifications as read.");
    }
  }

  const pageTitle = titleMap[location.pathname] || "Smart Social";

  return (
    <header className="app-surface sticky top-4 z-30 mb-6 px-4 py-4 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Smart Social</span>
            <ChevronRight className="h-4 w-4" />
            <span>{pageTitle}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen((current) => !current);
                setAccountMenuOpen(false);
              }}
              className="relative rounded-2xl border border-slate-200 bg-white p-3 text-slate-600"
            >
              <Bell className="h-5 w-5" />
              {unreadCount ? (
                <span className="absolute right-2 top-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </button>

            {dropdownOpen ? (
              <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Notifications</p>
                  <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-purple">
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all
                  </button>
                </div>
                <div className="space-y-3">
                  {notifications.length ? notifications.map((item) => (
                    <button
                      key={item.id || item.notification_id}
                      type="button"
                      onClick={() => markAsRead(item.id || item.notification_id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left ${item.is_read ? "border-slate-200 bg-white" : "border-orange-200 bg-orange-50/60"}`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.body}</p>
                      <p className="mt-2 text-[11px] font-medium text-slate-400">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </p>
                    </button>
                  )) : <p className="text-sm text-slate-500">No notifications yet.</p>}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen((current) => !current);
                setDropdownOpen(false);
              }}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="grid h-10 w-10 place-items-center rounded-full bg-violet-100 text-brand-purple">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold text-slate-900">{user?.full_name}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
            </button>

            {accountMenuOpen ? (
              <div className="absolute right-0 mt-3 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
                <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  <UserCircle2 className="h-4 w-4" />
                  My Profile
                </button>
                <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-500 hover:bg-rose-50">
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
