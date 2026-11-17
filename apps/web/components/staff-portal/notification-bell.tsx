'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson, apiRequest } from '../../lib/operations-api';
import { StaffNotification } from '../../lib/types';

type Announcement = { id: string; title: string; body: string; createdAt: string };

export function NotificationBell() {
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [nextNotifications, nextAnnouncements] = await Promise.all([
        apiJson<StaffNotification[]>('/staff-portal/notifications'),
        apiJson<Announcement[]>('/staff-portal/announcements'),
      ]);
      setNotifications(nextNotifications);
      setAnnouncements(nextAnnouncements);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const items = useMemo(() => {
    const announcementNotifications = new Set(
      notifications.filter((notification) => notification.category === 'security_announcement')
        .map((notification) => notification.id),
    );
    const announcementItems = announcements.map((announcement) => {
      const notification = notifications.find((item) =>
        announcementNotifications.has(item.id) &&
        item.title === announcement.title &&
        item.body === announcement.body,
      );
      if (notification) announcementNotifications.delete(notification.id);
      return {
        key: notification?.id ?? announcement.id,
        ...(notification ? { notificationId: notification.id } : {}),
        title: announcement.title,
        body: announcement.body,
        category: 'Announcement',
        createdAt: announcement.createdAt,
        readAt: notification?.readAt ?? null,
      };
    });
    const otherNotifications = notifications
      .filter((notification) =>
        notification.category !== 'security_announcement' || announcementNotifications.has(notification.id),
      )
      .map((notification) => ({
        key: notification.id,
        notificationId: notification.id,
        title: notification.title,
        body: notification.body,
        category: notification.category,
        createdAt: notification.createdAt,
        readAt: notification.readAt,
      }));
    return [...announcementItems, ...otherNotifications]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 10);
  }, [announcements, notifications]);

  async function markAsRead(notificationId: string) {
    setSavingId(notificationId);
    setError('');
    try {
      await apiRequest(`/staff-portal/notifications/${notificationId}/read`, { method: 'PATCH' });
      setNotifications((current) => current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, readAt: new Date().toISOString() }
          : notification,
      ));
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Unable to mark this notification as read.');
    } finally {
      setSavingId('');
    }
  }

  function toggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) void load();
  }

  return (
    <div className="notification-bell">
      <button
        className="notification-bell-button"
        onClick={toggle}
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls="notification-bell-panel"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 && <span className="notification-bell-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-bell-panel" id="notification-bell-panel" aria-label="Notifications">
          <div className="notification-bell-heading">
            <strong>Notifications</strong>
            <span>{unreadCount} unread</span>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {loading ? <p className="muted">Loading notifications…</p> : items.length ? (
            <ul className="notification-bell-list">
              {items.map((item) => {
                const notificationId = item.notificationId;
                return (
                  <li className={item.readAt ? '' : 'notification-bell-unread'} key={item.key}>
                    <strong>{item.title}</strong>
                    <span className="status-badge">{item.category.replaceAll('_', ' ')}</span>
                    <p>{item.body}</p>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                    {notificationId && !item.readAt && (
                      <button
                        className="text-button"
                        disabled={savingId === notificationId}
                        onClick={() => void markAsRead(notificationId)}
                        type="button"
                      >
                        {savingId === notificationId ? 'Saving…' : 'Mark as read'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <p className="empty-state">You are all caught up. New notifications and announcements will appear here.</p>}
          <Link className="notification-bell-view-all" href="/app/notifications" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </section>
      )}
    </div>
  );
}
