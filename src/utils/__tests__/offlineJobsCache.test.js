import { saveJobs, loadJobs, clearAllJobs, savedAtLabel } from '../offlineJobsCache';

beforeEach(() => localStorage.clear());

describe('offlineJobsCache', () => {
  it('saves and loads lists per screen and per user', () => {
    saveJobs('requests', 'u1', { accepted: [{ id: 'a' }] });
    saveJobs('assignments', 'u1', { accepted: [{ id: 'c' }] });
    saveJobs('requests', 'u2', { accepted: [{ id: 'b' }] });
    expect(loadJobs('requests', 'u1').data.accepted[0].id).toBe('a');
    expect(loadJobs('assignments', 'u1').data.accepted[0].id).toBe('c');
    expect(loadJobs('requests', 'u2').data.accepted[0].id).toBe('b');
    expect(typeof loadJobs('requests', 'u1').savedAt).toBe('number');
  });

  it('returns null when nothing is saved, for no user, or for corrupt data', () => {
    expect(loadJobs('requests', 'u1')).toBeNull();
    expect(loadJobs('requests', null)).toBeNull();
    localStorage.setItem('td_offline_jobs_v1:requests:u1', '{not json');
    expect(loadJobs('requests', 'u1')).toBeNull();
  });

  it('clearAllJobs removes every saved list but nothing else', () => {
    saveJobs('requests', 'u1', { accepted: [] });
    saveJobs('assignments', 'u2', { accepted: [] });
    localStorage.setItem('other_key', 'keep');
    clearAllJobs();
    expect(loadJobs('requests', 'u1')).toBeNull();
    expect(loadJobs('assignments', 'u2')).toBeNull();
    expect(localStorage.getItem('other_key')).toBe('keep');
  });

  it('labels today with the time only', () => {
    const label = savedAtLabel(Date.now());
    expect(label).toMatch(/\d{1,2}:\d{2}/);
    expect(label).not.toMatch(/,/);
  });
});
