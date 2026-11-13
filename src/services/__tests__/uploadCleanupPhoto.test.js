// Cleanup proof photos are public (owner's decision 2026-11-13, TD70): they
// go to the public illegal-dumping-photos bucket, so the saved link opens.
import { authService } from '../supabase';

const mockCalls = [];
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }), getSession: async () => ({ data: { session: null } }) },
    storage: {
      from: (bucket) => ({
        upload: async (path) => { mockCalls.push(['upload', bucket, path]); return { error: global.__uploadError || null }; },
        getPublicUrl: (path) => { mockCalls.push(['getPublicUrl', bucket, path]); return { data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` } }; },
      }),
    },
    from: () => ({}),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  }),
}));
jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

beforeEach(() => { mockCalls.length = 0; global.__uploadError = null; });

it('uploads to the public bucket under the job and returns a link that opens', async () => {
  const result = await authService.uploadCleanupPhoto({ name: 'proof.jpg' }, 'job-1');
  expect(result.success).toBe(true);
  expect(mockCalls.map(([m, b]) => `${m}:${b}`)).toEqual(['upload:illegal-dumping-photos', 'getPublicUrl:illegal-dumping-photos']);
  expect(mockCalls[0][2]).toMatch(/^cleanup-photos\/job-1\/\d+\.jpg$/);
  expect(result.url).toContain('/object/public/illegal-dumping-photos/cleanup-photos/job-1/');
});

it('a refused upload is reported, with no link', async () => {
  global.__uploadError = { message: 'new row violates row-level security policy' };
  expect(await authService.uploadCleanupPhoto({ name: 'proof.jpg' }, 'job-1')).toEqual({ success: false, error: 'new row violates row-level security policy' });
  expect(mockCalls.some(([m]) => m === 'getPublicUrl')).toBe(false);
});
