'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { isAdmin, roleLabel } from '../lib/roles';
import { Account, Workspace } from '../lib/types';

type NavItem = { href: string; label: string; show: boolean; icon: string };

function AdminIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    admin: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0m3-13v6m-3-3h6" /></>,
    network: <><circle cx="12" cy="12" r="2" /><path d="M5 9a10 10 0 0 1 14 0M2 6a15 15 0 0 1 20 0m-17 6a10 10 0 0 0 14 0" /></>,
    events: <><path d="M12 3 2.8 19h18.4L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
    policies: <><path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5m-9 4h5m-5 4h5" /></>,
    incidents: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="M12 8v4m0 4h.01" /></>,
    audit: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="7" cy="5" r="1" /><circle cx="7" cy="12" r="1" /><circle cx="7" cy="19" r="1" /></>,
    notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    chevronDown: <path d="m9 18 6-6-6-6" />,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
    account: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function ConsoleShell({
  user,
  workspace,
  active,
  eyebrow,
  title,
  children,
  onLogout,
}: {
  user: Account | null;
  workspace: Workspace | null;
  active: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
  onLogout: () => void;
}) {
  const admin = user ? isAdmin(user.roles) : false;
  const canManageNetwork = Boolean(user?.roles.includes('NETWORK_ADMINISTRATOR'));
  const links: NavItem[] = [
    { href: '/app/dashboard', label: 'Overview', show: true, icon: 'overview' },
    { href: '/app/admin', label: 'Administration', show: admin, icon: 'admin' },
    { href: '/app/network', label: 'Network monitoring', show: admin || canManageNetwork, icon: 'network' },
    { href: '/app/activity', label: 'Network activity', show: admin, icon: 'network' },
    { href: '/app/events', label: 'Security events', show: Boolean(workspace && workspace.events), icon: 'events' },
    { href: '/app/policies', label: 'Policies', show: Boolean(workspace && workspace.policies), icon: 'policies' },
    { href: '/app/incidents', label: 'Incidents', show: Boolean(workspace && workspace.incidents), icon: 'incidents' },
    { href: '/app/audit', label: 'Audit trail', show: Boolean(workspace && workspace.audit), icon: 'audit' },
  ];
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const initials = user?.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SS';

  useEffect(() => {
    setDarkMode(window.localStorage.getItem('stayshield-theme') === 'dark');
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileMenuOpen]);

  function toggleTheme() {
    setDarkMode((current) => {
      const next = !current;
      window.localStorage.setItem('stayshield-theme', next ? 'dark' : 'light');
      return next;
    });
  }

  return (
    <div className={`dashboard-shell admin-console${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`} data-theme={darkMode ? 'dark' : 'light'}>
      {mobileOpen && <button className="admin-drawer-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} type="button" />}
      <aside className="admin-sidebar" id="admin-navigation-panel">
        <div className="admin-brand-row">
          <Link className="admin-brand" href="/app/dashboard" aria-label="StayShield overview">
            <span className="admin-brand-mark"><AdminIcon name="incidents" /></span>
            <span className="admin-brand-name">StayShield<small>SECURITY OPERATIONS</small></span>
          </Link>
          <button className="admin-collapse-button" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
            <AdminIcon name="chevronDown" />
          </button>
        </div>
        <p className="admin-nav-caption">OPERATIONS</p>
        <nav className="admin-navigation" aria-label="Administrator navigation">
          {links.filter((link) => link.show).map((link) => (
            <Link
              key={link.href}
              className="admin-nav-link"
              href={link.href}
              aria-label={link.label}
              aria-current={link.href === active ? 'page' : undefined}
              title={collapsed ? link.label : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <AdminIcon name={link.icon} /><span>{link.label}</span>
              {link.href === active && <i aria-hidden="true" />}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-sidebar-user">
            <span className="admin-avatar" aria-hidden="true">{initials}</span>
            <span className="admin-sidebar-identity"><strong>{user?.displayName ?? 'Administrator'}</strong><small>{user?.roles.map(roleLabel).join(', ')}</small></span>
          </div>
          <p className="admin-privacy-caption"><AdminIcon name="incidents" /> Authorised operations</p>
        </div>
      </aside>
      <section className="dashboard-main admin-console-main">
        <header className="admin-topbar">
          <div className="admin-topbar-heading">
            <button className="admin-mobile-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-controls="admin-navigation-panel" aria-expanded={mobileOpen}><AdminIcon name="menu" /></button>
            <div>
              <p className="admin-breadcrumb"><Link href="/app/dashboard">Overview</Link><span aria-hidden="true">/</span>{eyebrow}</p>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <Link className="admin-topbar-notifications" href="/app/notifications" aria-label="Notifications"><AdminIcon name="notifications" /></Link>
            <div className="admin-profile-dropdown" ref={profileMenuRef}>
              <button
                className="admin-topbar-profile"
                type="button"
                aria-label={`Open profile menu for ${user?.displayName ?? 'Administrator'}`}
                aria-haspopup="true"
                aria-expanded={profileMenuOpen}
                aria-controls="admin-profile-menu"
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <span className="admin-avatar">{initials}</span>
                <span><strong>{user?.displayName ?? 'Administrator'}</strong><small>{user?.roles.map(roleLabel).join(', ') || 'Administrator'}</small></span>
                <AdminIcon name="chevron" />
              </button>
              {profileMenuOpen && (
                <div className="admin-profile-menu" id="admin-profile-menu" aria-label="Profile options">
                  <div className="admin-profile-menu-heading">
                    <strong>{user?.displayName ?? 'Administrator'}</strong>
                    <small>{user?.email}</small>
                  </div>
                  <Link href="/app/account" onClick={() => setProfileMenuOpen(false)}>
                    <AdminIcon name="account" /><span>My account</span>
                  </Link>
                  <button type="button" onClick={toggleTheme}>
                    <AdminIcon name={darkMode ? 'sun' : 'moon'} /><span>Switch to {darkMode ? 'light' : 'dark'} mode</span>
                  </button>
                  <button className="admin-profile-signout" type="button" onClick={() => { setProfileMenuOpen(false); onLogout(); }}>
                    <AdminIcon name="logout" /><span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="admin-console-content">
          {children}
        </main>
      </section>
    </div>
  );
}
