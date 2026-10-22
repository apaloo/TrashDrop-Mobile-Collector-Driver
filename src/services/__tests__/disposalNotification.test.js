import { notifyUserOfDisposal } from '../disposalService';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock('../supabase', () => ({
  supabase: { from: jest.fn() }
}));

const inserted = [];
let job;
let insertError;

beforeEach(() => {
  inserted.length = 0;
  job = { user_id: 'user-1', waste_type: 'plastic' };
  insertError = null;
  supabase.from.mockImplementation((table) => {
    const query = {
      select: () => query,
      eq: () => query,
      single: () => Promise.resolve({ data: job, error: null }),
      insert: (row) => {
        inserted.push({ table, ...row });
        return Promise.resolve({ error: insertError });
      }
    };
    return query;
  });
});

describe('notifyUserOfDisposal', () => {
  it('tells the job\'s user where their waste was disposed of', async () => {
    await notifyUserOfDisposal('digital_bins', 'bin-1', 'Kpone Landfill');

    expect(supabase.from).toHaveBeenCalledWith('digital_bins');
    expect(inserted).toEqual([expect.objectContaining({
      table: 'notifications',
      user_id: 'user-1',
      type: 'pickup_disposed',
      message: 'Your plastic has been disposed of at Kpone Landfill. Thank you for using TrashDrop!'
    })]);
  });

  it('leaves out the site when it is not known', async () => {
    job = { user_id: 'user-1' };
    await notifyUserOfDisposal('pickup_requests', 'req-1');

    expect(inserted[0].message).toBe('Your waste has been disposed of. Thank you for using TrashDrop!');
  });

  it('never throws, so a disposal is not blocked by a failed notification', async () => {
    insertError = { message: 'permission denied' };
    await expect(notifyUserOfDisposal('pickup_requests', 'req-1', 'Site')).resolves.toBeUndefined();

    supabase.from.mockImplementation(() => { throw new Error('offline'); });
    await expect(notifyUserOfDisposal('pickup_requests', 'req-1', 'Site')).resolves.toBeUndefined();
  });
});
