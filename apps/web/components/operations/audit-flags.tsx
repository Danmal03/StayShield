'use client';

import { AuditFlag } from '../../lib/types';

const signalLabels: Record<AuditFlag['signals'][number]['type'], string> = {
  failed_sign_ins: 'failed sign-ins',
  denied_requests: 'permission-denied requests',
  record_changes: 'record changes',
};

export function AuditFlagsPanel({ flags }: { flags: AuditFlag[] }) {
  return (
    <section className="content-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">SECURITY FOLLOW-UP</p><h2>Accounts flagged for review</h2></div>
        <span className="muted">{flags.length} flagged</span>
      </div>
      <p className="muted">Automated signals are prompts for human review, not proof of wrongdoing.</p>
      {flags.length ? (
        <div className="table-scroll">
          <table className="operations-table">
            <thead><tr><th>Account</th><th>Activity signals</th><th>Most recent</th></tr></thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.userId}>
                  <td><strong>{flag.displayName}</strong><small>{flag.userId}</small></td>
                  <td>{flag.signals.map((signal) => (
                    <small key={signal.type}>
                      {signal.count} {signalLabels[signal.type]} in {signal.windowMinutes} minutes
                    </small>
                  ))}</td>
                  <td>{new Date(Math.max(...flag.signals.map((signal) => new Date(signal.lastOccurredAt).getTime()))).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-state">No accounts currently meet the review thresholds.</p>}
    </section>
  );
}
