'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuditEntry, AuditFlag } from '../../lib/types';
import { apiJson } from '../../lib/operations-api';
import { AuditFlagsPanel } from './audit-flags';

export function AuditDashboardSummary() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [flags, setFlags] = useState<AuditFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiJson<AuditEntry[]>('/operations/audit'),
      apiJson<AuditFlag[]>('/operations/audit/flags'),
    ]).then(([nextEntries, nextFlags]) => {
      if (!active) return;
      setEntries(nextEntries.slice(0, 5));
      setFlags(nextFlags);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load activity.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p className="muted">Loading security activity…</p> : (
        <>
          <AuditFlagsPanel flags={flags} />
          <section className="content-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">LATEST ACTIVITY</p><h2>System activity</h2></div>
              <Link className="text-button" href="/app/audit">View audit trail</Link>
            </div>
            {entries.length ? (
              <div className="table-scroll">
                <table className="operations-table">
                  <thead><tr><th>Time</th><th>Activity</th><th>Account</th><th>Record</th></tr></thead>
                  <tbody>{entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td><span className="status-badge">{entry.action.replaceAll('_', ' ')}</span></td>
                      <td>{entry.actor?.displayName ?? 'System'}</td>
                      <td>{entry.targetType ?? '—'}{entry.targetId ? <small>{entry.targetId}</small> : null}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="empty-state">No activity has been recorded yet.</p>}
          </section>
        </>
      )}
    </>
  );
}
