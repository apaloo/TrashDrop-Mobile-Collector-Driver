// A collector taking a job: the Request page lists the pending pickup with
// its real bag count, Accept claims it for this collector only, and it moves
// to the Accepted tab with Directions and Scan QR. Supabase is the fake in
// fakeSupabase.mjs.
import { test, expect } from '@playwright/test';
import { fakeSupabase, collector, collectPageErrors } from './fakeSupabase.mjs';

const account = collector({ phone: '233501234567' });
const PROFILE = {
  id: 'cp-1', user_id: account.user.id, first_name: 'Kofi', last_name: 'Mensah', phone: '+233501234567',
  region: 'Greater Accra', vehicle_type: 'tricycle', license_plate: 'GR-1234-24',
  status: 'active', collector_type: 'professional', deactivated_at: null,
};
const OSU_EWKB = '0101000020E6100000560E2DB29DEFC7BF7C613255306A1640'; // POINT(-0.187 5.6037)
const JOB_ID = '0f6c2a1e-3b4d-4c5e-8f9a-1b2c3d4e5f60';
// Shaped as production's pickup_requests rows: bag_count, no bags or points column
const job = (extra = {}) => ({ id: JOB_ID, status: 'pending', coordinates: OSU_EWKB, location: 'Osu, Accra', waste_type: 'general', bag_count: 30, fee: 300, collector_id: null, created_at: new Date().toISOString(), ...extra });

test.use({ geolocation: { latitude: 5.61, longitude: -0.19, accuracy: 8 }, permissions: ['geolocation'] });

async function signInToRequests(page, pickups) {
  const calls = await fakeSupabase(page, { account, rpc: { collector_phone_registered: true }, tables: { collector_profiles: [PROFILE], pickup_requests: pickups } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open App' }).click();
  await page.getByRole('textbox', { name: '0501234567' }).fill('0501234567');
  await page.getByRole('button', { name: /Send Code/ }).click();
  await page.getByRole('textbox', { name: 'Code number 1' }).click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: /Sign In/ }).click();
  await expect(page).toHaveURL(/\/map$/);
  await page.getByRole('link', { name: 'Request', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/request$/);
  return calls;
}

const claims = (calls) => calls.filter((c) => c.method === 'PATCH' && c.path === '/rest/v1/pickup_requests');

test('a pending job shows its real 30 bags and no made-up points', async ({ page }) => {
  const errors = collectPageErrors(page);
  await signInToRequests(page, [job()]);
  await expect(page.getByText('30 bags')).toBeVisible();
  await expect(page.getByText(/^\d+ points$/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Accept claims the job for this collector and moves it to Accepted', async ({ page }) => {
  const errors = collectPageErrors(page);
  const calls = await signInToRequests(page, [job()]);
  await page.getByRole('button', { name: 'Accept', exact: true }).click();

  await expect.poll(() => claims(calls).length).toBe(1);
  const [claim] = claims(calls);
  expect(claim.query).toContain(`id=eq.${JOB_ID}`);
  expect(claim.body).toMatchObject({ status: 'accepted', collector_id: account.user.id });
  // the collector has 10 hours to collect before the job is released
  const hours = (Date.parse(claim.body.assignment_expires_at) - Date.parse(claim.body.accepted_at)) / 3_600_000;
  expect(hours).toBe(10);

  await expect(page.getByRole('button', { name: /Directions/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Scan QR/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a job already holding another collector is not claimed again', async ({ page }) => {
  // The database's answer to the app's check before claiming: another
  // collector's id is on it (their claim landed first)
  const calls = await signInToRequests(page, [job({ collector_id: 'someone-else' })]);
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect.poll(() => calls.filter((c) => c.method === 'GET' && c.query.includes(`id=eq.${JOB_ID}`)).length).toBeGreaterThan(0);
  await expect(page.getByText(/already been accepted by another collector/i).first()).toBeVisible();
  expect(claims(calls)).toEqual([]);
});

// An accepted digital bin whose only position is its bin location, stored as
// EWKB hex. The Request page had its own reader that read EWKB only on a
// pickup's own coordinates, so Directions fell back to a map search (TD71).
test('Directions on an accepted digital bin opens in-app navigation from its EWKB bin location', async ({ page }) => {
  const errors = collectPageErrors(page);
  await fakeSupabase(page, {
    account,
    rpc: { collector_phone_registered: true },
    tables: {
      collector_profiles: [PROFILE],
      digital_bins: [{ id: 'bin-1', status: 'accepted', collector_id: account.user.id, waste_type: 'general', bin_size_liters: 120, fee: 36, created_at: new Date().toISOString(), bin_locations: { coordinates: OSU_EWKB, location_name: 'Osu Bin Station' } }],
    },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open App' }).click();
  await page.getByRole('textbox', { name: '0501234567' }).fill('0501234567');
  await page.getByRole('button', { name: /Send Code/ }).click();
  await page.getByRole('textbox', { name: 'Code number 1' }).click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: /Sign In/ }).click();
  await expect(page).toHaveURL(/\/map$/);
  await page.getByRole('link', { name: 'Request', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: /^Accepted/ }).click();

  const popups = [];
  page.on('popup', (p) => popups.push(p.url()));
  await page.getByRole('button', { name: /Directions/ }).click();
  await expect(page.getByText('Opening in-app navigation to Osu Bin Station')).toBeVisible();
  expect(popups).toEqual([]);
  expect(errors).toEqual([]);
});
