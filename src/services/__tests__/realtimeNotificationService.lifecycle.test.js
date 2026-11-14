// New-job alerts, the connection side: subscribing to Realtime when the
// collector goes on duty, reconnecting (with a limit) when the channel drops,
// the browser notification shown as a backup, and stopping cleanly.
// realtimeNotificationService.test.js covers which inserts sound an alert.
import { realtimeNotificationService as service } from '../realtimeNotificationService';
import { audioAlertService } from '../audioAlertService';
import { supabase } from '../supabase.js';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../supabase.js', () => ({ supabase: { channel: jest.fn(), removeChannel: jest.fn() } }));
jest.mock('../audioAlertService.js', () => ({
  audioAlertService: { initialize: jest.fn(), playNewRequestAlert: jest.fn(), speak: jest.fn() },
}));

const OSU = '0101000020E6100000560E2DB29DEFC7BF7C613255306A1640'; // POINT(-0.187 5.6037), Accra
const KUMASI = '0101000020E61000005AF5B9DA8AFDF9BF1B2FDD2406C11A40'; // ~200 km away

// A fake Realtime channel: records what it listens to, and lets a test say
// what status Supabase reports
let channels;
const fakeChannel = () => {
  const ch = { listeners: [], statusCallback: null };
  ch.on = jest.fn((type, filter, handler) => { ch.listeners.push({ type, filter, handler }); return ch; });
  ch.subscribe = jest.fn((cb) => { ch.statusCallback = cb; return ch; });
  channels.push(ch);
  return ch;
};
const latest = () => channels[channels.length - 1];

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  channels = [];
  supabase.channel.mockImplementation(fakeChannel);
  supabase.removeChannel.mockResolvedValue();
  audioAlertService.initialize.mockResolvedValue();
  audioAlertService.playNewRequestAlert.mockResolvedValue();
  audioAlertService.speak.mockResolvedValue();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  await service.destroy();
  service.reconnectAttempts = 0;
  service.reconnectDelay = 5000;
  service.lastNotificationTime = 0;
  service.collectorLocation = null;
  delete window.Notification;
  supabase.removeChannel.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('going on duty', () => {
  it('listens for new pending pickup requests and digital bins, with the radius given', async () => {
    await service.initialize('collector-1', { searchRadius: 8 });
    expect(supabase.channel).toHaveBeenCalledWith('new_request_alerts');
    expect(latest().listeners.map((l) => [l.filter.table, l.filter.event, l.filter.filter])).toEqual([
      ['pickup_requests', 'INSERT', 'status=eq.pending'],
      ['digital_bins', 'INSERT', 'status=eq.pending'],
    ]);
    expect(service.searchRadius).toBe(8);
    expect(service.audioInitialized).toBe(true);

    latest().statusCallback('SUBSCRIBED');
    expect(service.isListening).toBe(true);
  });

  it('the default radius is 5 km, and sound that needs a tap first does not stop it', async () => {
    audioAlertService.initialize.mockRejectedValueOnce(new Error('needs a user gesture'));
    service.audioInitialized = false;
    await service.initialize('collector-1');
    expect(service.searchRadius).toBe(5);
    expect(service.audioInitialized).toBe(false);
    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it('a second start for the same collector while listening does not open another channel', async () => {
    await service.initialize('collector-1');
    latest().statusCallback('SUBSCRIBED');
    await service.initialize('collector-1');
    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it('a new subscription closes the old channel first, without that close counting as a drop', async () => {
    await service.initialize('collector-1');
    const first = latest();
    supabase.removeChannel.mockImplementationOnce(async () => first.statusCallback('CLOSED'));
    await service.setupRealtimeSubscription();
    expect(supabase.removeChannel).toHaveBeenCalledWith(first);
    expect(service.reconnectAttempts).toBe(0);
    expect(channels).toHaveLength(2);
  });

  it('the inserts Realtime delivers reach the alert: near ones sound, far ones do not', async () => {
    const heard = [];
    service.onNewRequest((req) => heard.push(req.id));
    service.updateLocation({ lat: 5.61, lng: -0.19 });
    await service.initialize('collector-1');
    const [pickups, bins] = latest().listeners;
    await pickups.handler({ new: { id: 'near', coordinates: OSU } });
    service.lastNotificationTime = 0;
    await bins.handler({ new: { id: 'far-bin', coordinates: KUMASI } });
    expect(heard).toEqual(['near']);
  });
});

describe('when the channel drops', () => {
  it('reconnects after 5 s, then backs off, while still on duty', async () => {
    await service.initialize('collector-1');
    latest().statusCallback('CHANNEL_ERROR');
    expect(service.isListening).toBe(false);
    expect(service.reconnectAttempts).toBe(1);

    await jest.advanceTimersByTimeAsync(4999);
    expect(channels).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(channels).toHaveLength(2);

    latest().statusCallback('CLOSED');
    await jest.advanceTimersByTimeAsync(9999);
    expect(channels).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(channels).toHaveLength(3);
  });

  it('a successful reconnect resets the back-off', async () => {
    await service.initialize('collector-1');
    latest().statusCallback('CLOSED');
    await jest.advanceTimersByTimeAsync(5000);
    latest().statusCallback('SUBSCRIBED');
    expect(service.reconnectAttempts).toBe(0);
    expect(service.reconnectDelay).toBe(5000);
  });

  it('the wait never exceeds 30 s, and it gives up after 10 attempts', async () => {
    await service.initialize('collector-1');
    for (let i = 0; i < 12; i += 1) {
      latest().statusCallback('CLOSED');
      await jest.advanceTimersByTimeAsync(30000);
    }
    expect(service.reconnectAttempts).toBeGreaterThanOrEqual(service.MAX_RECONNECT_ATTEMPTS);
    // the first channel plus 9 reconnects, each within the 30 s waited
    expect(channels).toHaveLength(service.MAX_RECONNECT_ATTEMPTS);
    const opened = channels.length;
    await jest.advanceTimersByTimeAsync(120000);
    expect(channels).toHaveLength(opened);
  });

  it('a subscription that throws is retried too', async () => {
    supabase.channel.mockImplementationOnce(() => { throw new Error('offline'); });
    service.collectorId = 'collector-1';
    await service.setupRealtimeSubscription();
    expect(service.reconnectAttempts).toBe(1);
    await jest.advanceTimersByTimeAsync(5000);
    expect(channels).toHaveLength(1);
  });

  it('no reconnect once the collector has gone off duty', async () => {
    await service.initialize('collector-1');
    latest().statusCallback('CLOSED');
    await service.destroy();
    await jest.advanceTimersByTimeAsync(60000);
    expect(channels).toHaveLength(1);
  });
});

describe('going off duty', () => {
  it('closes the channel, forgets the page callbacks and does not reconnect', async () => {
    const heard = jest.fn();
    service.onNewRequest(heard);
    await service.initialize('collector-1');
    const ch = latest();
    supabase.removeChannel.mockImplementationOnce(async () => ch.statusCallback('CLOSED'));
    await service.destroy();
    expect(supabase.removeChannel).toHaveBeenCalledWith(ch);
    expect(service.isListening).toBe(false);
    expect(service.callbacks.size).toBe(0);
    expect(service.reconnectAttempts).toBe(0);
  });

  it('a page that unsubscribes is no longer told', async () => {
    const heard = jest.fn();
    const stop = service.onNewRequest(heard);
    stop();
    await service.triggerNewRequestAlert({ id: 'r' }, null, 'pickup_request');
    expect(heard).not.toHaveBeenCalled();
  });
});

describe('the alert itself', () => {
  it('a page callback that throws does not stop the others', async () => {
    const heard = jest.fn();
    service.onNewRequest(() => { throw new Error('page bug'); });
    service.onNewRequest(heard);
    await service.triggerNewRequestAlert({ id: 'r' }, 1.2, 'pickup_request');
    expect(heard).toHaveBeenCalledWith({ id: 'r' }, 1.2, 'pickup_request');
  });

  it('sound not yet allowed is tried again when an alert comes', async () => {
    service.audioInitialized = false;
    await service.triggerNewRequestAlert({ id: 'r' }, null, 'pickup_request');
    expect(audioAlertService.initialize).toHaveBeenCalled();
    expect(service.audioInitialized).toBe(true);
  });

  it('the phone vibrates', async () => {
    navigator.vibrate = jest.fn();
    await service.triggerNewRequestAlert({ id: 'r' }, null, 'pickup_request');
    expect(navigator.vibrate).toHaveBeenCalledWith([200, 100, 200, 100, 300]);
    delete navigator.vibrate;
  });

  it('with notifications allowed, a browser notification is shown too and closes after 10 s', async () => {
    const shown = [];
    window.Notification = jest.fn(function Notification(title, opts) { this.title = title; this.opts = opts; this.close = jest.fn(); shown.push(this); });
    window.Notification.permission = 'granted';
    await service.triggerNewRequestAlert({ id: 'r9', waste_type: 'plastic' }, 0.8, 'pickup_request');
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe('New Pickup Request! 🚛');
    expect(shown[0].opts).toMatchObject({ tag: 'request-r9', body: expect.stringMatching(/^New plastic pickup request 0\.8 kilometers away/) });
    window.focus = jest.fn();
    shown[0].onclick();
    expect(shown[0].close).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(10000);
    expect(shown[0].close).toHaveBeenCalledTimes(2);
  });

  it('not yet asked: asks for permission for next time, shows nothing now', async () => {
    window.Notification = jest.fn();
    window.Notification.permission = 'default';
    window.Notification.requestPermission = jest.fn();
    await service.triggerNewRequestAlert({ id: 'r' }, null, 'pickup_request');
    expect(window.Notification.requestPermission).toHaveBeenCalled();
    expect(window.Notification).not.toHaveBeenCalled();
  });

  it('notifications refused: nothing is shown or asked', async () => {
    window.Notification = jest.fn();
    window.Notification.permission = 'denied';
    window.Notification.requestPermission = jest.fn();
    await service.triggerNewRequestAlert({ id: 'r' }, null, 'pickup_request');
    expect(window.Notification).not.toHaveBeenCalled();
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('turning sound on by hand reports whether it worked', async () => {
    await expect(service.initializeAudio()).resolves.toBe(true);
    audioAlertService.initialize.mockRejectedValueOnce(new Error('blocked'));
    await expect(service.initializeAudio()).resolves.toBe(false);
  });

  it('the test alert announces a sample request half a kilometre away', async () => {
    const heard = [];
    service.onNewRequest((req, distance) => heard.push([req.waste_type, distance]));
    await service.testAlert();
    expect(heard).toEqual([['recyclable', 0.5]]);
  });

  it('the radius can be changed while on duty', async () => {
    service.updateSearchRadius(2);
    service.updateLocation({ lat: 5.61, lng: -0.19 });
    const heard = [];
    service.onNewRequest((req) => heard.push(req.id));
    // OSU is ~0.75 km from the collector: inside 2 km; KUMASI is not
    await service.handleNewRequest({ new: { id: 'osu', coordinates: OSU } });
    service.lastNotificationTime = 0;
    await service.handleNewDigitalBin({ new: { id: 'kumasi', coordinates: KUMASI } });
    expect(heard).toEqual(['osu']);
  });
});
