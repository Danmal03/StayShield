'use client';

import { ReactNode } from 'react';
import { isAdmin, roleLabel } from '../lib/roles';
import { Account, Workspace } from '../lib/types';

type NavItem = { href: string; label: string; show: boolean };

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
  const links: NavItem[] = [
    { href: '/app/dashboard', label: 'Overview', show: true },
    { href: '/app/admin', label: 'Administration', show: admin },
    { href: '/app/activity', label: 'Network activity', show: admin },
    { href: '/app/events', label: 'Security events', show: Boolean(workspace && workspace.events) },
    { href: '/app/policies', label: 'Policies', show: Boolean(workspace && workspace.policies) },
    { href: '/app/incidents', label: 'Incidents', show: Boolean(workspace && workspace.incidents) },
    { href: '/app/audit', label: 'Audit trail', show: Boolean(workspace && workspace.audit) },
  ];

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand" href="/">StayShield</a>
        <p className="nav-caption">WORKSPACE</p>
        {links.filter((link) => link.show).map((link) => (
          <a key={link.href} className={link.href === active ? 'nav-link active' : 'nav-link'} href={link.href}>
            {link.label}
          </a>
        ))}
        <div className="sidebar-foot">Authorised monitoring · Privacy-aware</div>
      </aside>
      <section className="dashboard-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <div className="account">
            {user && (
              <span>
                {user.displayName}
                <small>{user.roles.map(roleLabel).join(', ')}</small>
              </span>
            )}
            <button className="button secondary" onClick={onLogout} type="button">Sign out</button>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
