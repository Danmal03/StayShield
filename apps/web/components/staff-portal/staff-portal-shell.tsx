'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Account } from '../../lib/types';
import { NotificationBell } from './notification-bell';

const navigation = [
  { href: '/app/dashboard', label: 'Dashboard' },
  { href: '/app/devices', label: 'My devices' },
  { href: '/app/activity', label: 'Network activity' },
  { href: '/app/web-access', label: 'My web access' },
  { href: '/app/security-centre', label: 'Security centre' },
  { href: '/app/training', label: 'Security training' },
  { href: '/app/requests', label: 'Requests & support' },
];

function Icon({ name }: { name: 'shield' | 'sun' | 'moon' | 'logout' | 'chevronDown' }) {
  const paths: Record<typeof name, ReactNode> = {
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
    logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
    chevronDown: <path d="m9 18 6-6-6-6" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function StaffPortalShell({
  user,
  active,
  title,
  onLogout,
  children,
}: {
  user: Account;
  active: string;
  title: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [darkMode, setDarkMode] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const initials = user.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  useEffect(() => {
    setDarkMode(window.localStorage.getItem('stayshield-theme') === 'dark');
  }, []);

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
    <div className="staff-shell" data-theme={darkMode ? 'dark' : 'light'}>
      <header className="staff-topbar">
        <Link className="staff-brand" href="/app/dashboard" aria-label="StayShield dashboard">
          <span className="staff-brand-mark"><Icon name="shield" /></span>
          <span className="staff-brand-name">StayShield<small>EMPLOYEE PORTAL</small></span>
        </Link>
        <div className="staff-topbar-heading">
          <p className="staff-breadcrumb"><Link href="/app/dashboard">Home</Link><span aria-hidden="true">/</span>{title}</p>
          <h1>{title}</h1>
        </div>
        <div className="staff-topbar-actions">
          <NotificationBell />
          <div className="staff-profile-dropdown" ref={profileMenuRef}>
            <button
              className="staff-topbar-profile"
              type="button"
              aria-label={`Open profile menu for ${user.displayName}`}
              aria-haspopup="true"
              aria-expanded={profileMenuOpen}
              aria-controls="staff-profile-menu"
              onClick={() => setProfileMenuOpen((open) => !open)}
            >
              <span className="staff-avatar">{initials || 'SS'}</span>
              <span><strong>{user.displayName}</strong><small>My account</small></span>
              <Icon name="chevronDown" />
            </button>
            {profileMenuOpen && (
              <div className="staff-profile-menu" id="staff-profile-menu" aria-label="Profile options">
                <div className="staff-profile-menu-heading">
                  <strong>{user.displayName}</strong>
                  <small>{user.email}</small>
                </div>
                <Link href="/app/account" onClick={() => setProfileMenuOpen(false)}>My account</Link>
                <button type="button" onClick={toggleTheme}>
                  <Icon name={darkMode ? 'sun' : 'moon'} /><span>Switch to {darkMode ? 'light' : 'dark'} mode</span>
                </button>
                <button className="staff-profile-signout" type="button" onClick={() => { setProfileMenuOpen(false); onLogout(); }}>
                  <Icon name="logout" /><span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <nav className="staff-primary-nav" aria-label="Employee portal">
        {navigation.map((item) => (
          <Link key={item.href} href={item.href} aria-current={active === item.href ? 'page' : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="staff-main">
        {children}
      </main>
    </div>
  );
}
