// MoMo numbers never reach the console in full (payment and gateway logs).
import { redactForLog } from '../redactForLog';

it('masks phone-number fields at any depth and leaves everything else', () => {
  expect(redactForLog({ amount: 10, clientMomo: '0244123456', client_momo: '0201234567', nested: { accountNumber: '233244123456', status: 'ok' }, list: [{ phone: '0551234567' }] }))
    .toEqual({ amount: 10, clientMomo: '024***56', client_momo: '020***67', nested: { accountNumber: '233***56', status: 'ok' }, list: [{ phone: '055***67' }] });
});

it('hides short values entirely and passes non-objects through', () => {
  expect(redactForLog({ momo: '12345' })).toEqual({ momo: '***' });
  expect(redactForLog('text')).toBe('text');
  expect(redactForLog(null)).toBe(null);
  expect(redactForLog({ momo: null })).toEqual({ momo: null });
});
