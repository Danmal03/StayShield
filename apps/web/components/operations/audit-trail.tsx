'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuditActor, AuditActorHistory, AuditActors, AuditEntry } from '../../lib/types';
import { apiJson } from '../../lib/operations-api';

type ActorGroup = 'administrators' | 'users';

const groupLabels: Record<ActorGroup, string> = {
  administrators: 'Administrators',
  users: 'Users',
};

export function AuditTrailPage() {
  const [actorGroups, setActorGroups] = useState<AuditActors>({ administrators: [], users: [] });
  const [selectedGroup, setSelectedGroup] = useState<ActorGroup | null>(null);
  const [selectedActor, setSelectedActor] = useState<AuditActor | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const historyRequestId = useRef(0);

  const loadActors = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setActorGroups(await apiJson<AuditActors>('/operations/audit/actors'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load audit actors.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActors();
  }, [loadActors]);

  async function selectActor(actor: AuditActor) {
    const requestId = ++historyRequestId.current;
    setSelectedActor(actor);
    setEntries([]);
    setNextCursor(null);
    setLoadingMore(false);
    setQuery('');
    setActionFilter('all');
    setError('');
    setLoading(true);
    try {
      const history = await apiJson<AuditActorHistory>(`/operations/audit/actors/${actor.id}`);
      if (requestId !== historyRequestId.current) return;
      setEntries(history.entries);
      setNextCursor(history.nextCursor);
    } catch (loadError) {
      if (requestId === historyRequestId.current) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load this actor’s audit history.');
      }
    } finally {
      if (requestId === historyRequestId.current) setLoading(false);
    }
  }

  async function loadMore() {
    if (!selectedActor || !nextCursor || loadingMore) return;
    const requestId = historyRequestId.current;
    setError('');
    setLoadingMore(true);
    try {
      const history = await apiJson<AuditActorHistory>(
        `/operations/audit/actors/${selectedActor.id}?cursor=${encodeURIComponent(nextCursor)}`,
      );
      if (requestId !== historyRequestId.current) return;
      setEntries((current) => [...current, ...history.entries]);
      setNextCursor(history.nextCursor);
    } catch (loadError) {
      if (requestId === historyRequestId.current) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load more activity.');
      }
    } finally {
      if (requestId === historyRequestId.current) setLoadingMore(false);
    }
  }

  function showGroup(group: ActorGroup) {
    historyRequestId.current += 1;
    setSelectedActor(null);
    setSelectedGroup(group);
    setEntries([]);
    setError('');
  }

  function showActorGroups() {
    historyRequestId.current += 1;
    setSelectedActor(null);
    setSelectedGroup(null);
    setEntries([]);
    setLoading(false);
    setLoadingMore(false);
    setError('');
  }

  function showGroupActors() {
    historyRequestId.current += 1;
    setSelectedActor(null);
    setEntries([]);
    setLoading(false);
    setLoadingMore(false);
    setError('');
  }

  const actions = useMemo(() => [...new Set(entries.map((entry) => entry.action))].sort(), [entries]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const values = [
        entry.action,
        entry.targetType ?? '',
        entry.targetId ?? '',
        entry.sourceIp ?? '',
      ];
      return (actionFilter === 'all' || entry.action === actionFilter) &&
        (!needle || values.some((value) => value.toLowerCase().includes(needle)));
    });
  }, [entries, query, actionFilter]);

  const groupActors = selectedGroup ? actorGroups[selectedGroup] : [];
  const actionCount = (actors: AuditActor[]) => actors.reduce((total, actor) => total + actor.actionCount, 0);

  return (
    <section className="content-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ACCOUNTABILITY</p>
          <h2>{selectedActor?.displayName ?? (selectedGroup ? groupLabels[selectedGroup] : 'Audit by actor')}</h2>
        </div>
        <div className="row-actions">
          {selectedActor ? (
            <button className="button secondary" onClick={showGroupActors} type="button">
              Back to {selectedGroup ? groupLabels[selectedGroup] : 'actors'}
            </button>
          ) : selectedGroup ? (
            <button className="button secondary" onClick={showActorGroups} type="button">Actor types</button>
          ) : (
            <button className="button secondary" onClick={() => void loadActors()} disabled={loading} type="button">
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
        </div>
      </div>
      {selectedActor && <p className="muted">{selectedActor.email} · {selectedActor.roles.join(', ') || 'No assigned role'}</p>}
      {!selectedActor && !selectedGroup && (
        <p className="muted">Choose administrators or users to review activity by account.</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && !selectedActor ? <p className="muted">Loading actors…</p> : null}
      {!selectedGroup && !selectedActor && !loading && (
        <div className="area-grid">
          <button className="area-card audit-actor-card" onClick={() => showGroup('administrators')} type="button">
            <strong>Administrators</strong>
            <span>{actorGroups.administrators.length} accounts · {actionCount(actorGroups.administrators)} recorded actions</span>
          </button>
          <button className="area-card audit-actor-card" onClick={() => showGroup('users')} type="button">
            <strong>Users</strong>
            <span>{actorGroups.users.length} accounts · {actionCount(actorGroups.users)} recorded actions</span>
          </button>
        </div>
      )}
      {selectedGroup && !selectedActor && (
        loading ? <p className="muted">Loading accounts…</p> : groupActors.length ? (
          <div className="area-grid">
            {groupActors.map((actor) => (
              <button
                className="area-card audit-actor-card"
                key={actor.id}
                onClick={() => void selectActor(actor)}
                type="button"
              >
                <strong>{actor.displayName}</strong>
                <span>{actor.email}</span>
                <span>{actor.actionCount} recorded actions · {actor.roles.join(', ') || 'No assigned role'}</span>
              </button>
            ))}
          </div>
        ) : <p className="empty-state">No accounts are in this group.</p>
      )}
      {selectedActor && (
        <>
          <div className="operations-toolbar">
            <label className="search-field">
              Search
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Action, record, or IP address"
              />
            </label>
            <label>Action
              <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
                <option value="all">All actions</option>
                {actions.map((action) => <option key={action} value={action}>{action}</option>)}
              </select>
            </label>
          </div>
          {loading ? <p className="muted">Loading activity…</p> : filtered.length ? (
            <div className="table-scroll">
              <table className="operations-table">
                <thead><tr><th>Time</th><th>Action</th><th>Record</th><th>Source IP</th></tr></thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td><span className="status-badge">{entry.action.replaceAll('_', ' ')}</span></td>
                      <td>{entry.targetType ?? '—'}{entry.targetId ? <small>{entry.targetId}</small> : null}</td>
                      <td>{entry.sourceIp ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="empty-state">{query || actionFilter !== 'all' ? 'No loaded entries match these filters.' : 'No activity has been recorded for this account.'}</p>}
          {nextCursor && (
            <div className="form-actions">
              <button className="button secondary" disabled={loadingMore} onClick={() => void loadMore()} type="button">
                {loadingMore ? 'Loading…' : 'Load more activity'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
