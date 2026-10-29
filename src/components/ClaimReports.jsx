import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMyAccess, listClaimableReports, claimReport, requestVolunteerAccess } from '../services/volunteerService';
import { ACCEPT_WITHIN_HOURS, FINISH_WITHIN_HOURS, MAX_OPEN_CLAIMS, claimErrorMessage } from '../utils/volunteer';
import { logger } from '../utils/logger';
import PhotoGallery from './PhotoGallery';

const SEVERITY_CLASS = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};
const title = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '');
const reportedOn = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

const Notice = ({ emoji, heading, children, testId }) => (
  <div className="text-center py-10 px-4" data-testid={testId}>
    <div className="text-4xl mb-3">{emoji}</div>
    <p className="text-lg font-bold text-td-ink mb-1">{heading}</p>
    <div className="text-td-sage text-sm">{children}</div>
  </div>
);

/**
 * Claim tab for volunteer clean-up groups: verified reports nobody has taken
 * yet, in the group's region, with a district filter. A claim puts the report
 * on the group's list under "Claimed", from where the normal assignment steps
 * follow (accept, navigate, complete within 50 m, dispose).
 */
const ClaimReports = ({ onClaimed, showToast, profile = null }) => {
  const [access, setAccess] = useState(null);
  const [reports, setReports] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [district, setDistrict] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const a = await fetchMyAccess();
      setAccess(a);
      if (a?.role !== 'volunteer') {
        setReports([]);
        return;
      }
      setReports(await listClaimableReports());
    } catch (e) {
      logger.error('Could not load reports to claim:', e);
      setError(claimErrorMessage(e));
      setReports([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const districts = useMemo(
    () => [...new Set((reports || []).map(r => r.district).filter(Boolean))].sort(),
    [reports]
  );
  const shown = (reports || []).filter(r => !district || r.district === district);

  const claim = async (report) => {
    setBusyId(report.id);
    try {
      await claimReport(report.id);
      showToast(`Claimed. Accept it within ${ACCEPT_WITHIN_HOURS} hours and finish within ${FINISH_WITHIN_HOURS}.`);
      await onClaimed?.();
    } catch (e) {
      showToast(claimErrorMessage(e), 'error');
    } finally {
      setBusyId(null);
      setConfirmingId(null);
      load();
    }
  };

  // The request is normally sent at sign-up; this resends it if that failed
  const sendRequest = async () => {
    setRequesting(true);
    try {
      await requestVolunteerAccess({ groupName: profile?.first_name || profile?.company_name || 'Volunteer group', region: profile?.region, district: null, details: {} });
      showToast('Request sent to TrashDrop');
      await load();
    } catch (e) {
      showToast(claimErrorMessage(e), 'error');
    } finally {
      setRequesting(false);
    }
  };

  if (reports === null) {
    return <div className="text-center py-10 text-td-sage" data-testid="claim-loading">Loading reports near you...</div>;
  }

  if (access && access.role !== 'volunteer') {
    if (access.status === 'pending') {
      return (
        <Notice emoji="⏳" heading="Waiting for approval" testId="claim-pending">
          TrashDrop is checking your group. You can claim clean-ups once you're approved. We'll send you a notification.
        </Notice>
      );
    }
    if (access.status === 'rejected') {
      return (
        <Notice emoji="✋" heading="Your group wasn't approved" testId="claim-rejected">
          {access.review_note ? <p className="mb-2">"{access.review_note}"</p> : null}
          Please contact TrashDrop support if you think this is a mistake.
        </Notice>
      );
    }
    return (
      <Notice emoji="ℹ️" heading="Not approved as a volunteer group yet" testId="claim-not-volunteer">
        <p className="mb-4">Only approved volunteer groups can claim clean-ups.</p>
        <button type="button" onClick={sendRequest} disabled={requesting}
          className="w-full py-3 rounded-lg bg-green-600 text-white font-bold disabled:opacity-50" data-testid="send-volunteer-request">
          {requesting ? 'Sending...' : 'Ask TrashDrop to approve our group'}
        </button>
      </Notice>
    );
  }

  return (
    <div data-testid="claim-tab">
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
          {error} <button type="button" className="underline ml-1" onClick={load}>Try again</button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <label htmlFor="claim-district" className="text-sm text-td-ink shrink-0">District</label>
        <select id="claim-district" value={district} onChange={e => setDistrict(e.target.value)}
          className="flex-1 border border-td-border-strong rounded-lg px-3 py-2 bg-white text-td-ink text-sm">
          <option value="">All of {access?.region || 'your region'} ({reports.length})</option>
          {districts.map(d => (
            <option key={d} value={d}>{d} ({reports.filter(r => r.district === d).length})</option>
          ))}
        </select>
        <button type="button" onClick={load} className="text-green-600 px-2 py-2" aria-label="Refresh reports">↻</button>
      </div>

      {shown.length === 0 ? (
        <Notice emoji="🌿" heading="Nothing to clean up here right now" testId="claim-empty">
          New reports appear here once TrashDrop has checked them. Check back later.
        </Notice>
      ) : (
        shown.map(r => (
          <div key={r.id} className="bg-white rounded-lg shadow mb-3 overflow-hidden" data-testid="claim-card">
            <div className="p-4">
              <div className="mb-3 empty:hidden">
                <PhotoGallery photos={r.photos} emptyText={null} />
              </div>
              <h3 className="font-semibold text-base text-td-ink">{r.area_name || r.location || 'Reported dumping site'}</h3>
              <p className="text-sm text-td-sage">{[r.district, r.region].filter(Boolean).join(', ')}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {r.severity && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${SEVERITY_CLASS[r.severity] || 'bg-gray-100 text-td-ink border-td-border'}`}>
                    {title(r.severity)} severity
                  </span>
                )}
                {r.waste_type && <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-td-ink border border-td-border">{title(r.waste_type)}</span>}
                {r.size && <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-td-ink border border-td-border">{title(r.size)} pile</span>}
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-td-tonal text-blue-800 border border-td-border">Reported {reportedOn(r.created_at)}</span>
              </div>
              {r.description && <p className="text-sm text-td-ink mt-2">{r.description}</p>}

              {confirmingId === r.id ? (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg" data-testid="claim-confirm">
                  <p className="text-sm text-td-ink mb-2">
                    Your group will clean this up. Accept it within {ACCEPT_WITHIN_HOURS} hours and finish within {FINISH_WITHIN_HOURS}, or it goes back for others.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className="flex-1 py-2 rounded-lg bg-gray-200 text-td-ink font-medium" onClick={() => setConfirmingId(null)} disabled={busyId === r.id}>
                      Cancel
                    </button>
                    <button type="button" className="flex-1 py-2 rounded-lg bg-green-600 text-white font-bold disabled:opacity-50" onClick={() => claim(r)} disabled={busyId === r.id}>
                      {busyId === r.id ? 'Claiming...' : 'Yes, claim it'}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="mt-3 w-full py-2 rounded-lg bg-green-600 text-white font-bold" onClick={() => setConfirmingId(r.id)}>
                  Claim this clean-up
                </button>
              )}
            </div>
          </div>
        ))
      )}

      <p className="text-xs text-td-sage text-center mt-2 mb-4">
        Your group can have up to {MAX_OPEN_CLAIMS} clean-ups open at a time.
      </p>
    </div>
  );
};

export default ClaimReports;
