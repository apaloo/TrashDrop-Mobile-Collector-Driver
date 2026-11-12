import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { audioAlertService } from '../audioAlertService';

describe('audioAlertService.announceArrival', () => {
  afterEach(() => jest.restoreAllMocks());

  // On phones audio usually can't start until the user taps. The arrival
  // alert used to reassign a const there and throw, so the vibration and the
  // spoken announcement never happened either.
  it('still vibrates when audio cannot be resumed', async () => {
    audioAlertService.isInitialized = false;
    jest.spyOn(audioAlertService, 'resumeOnUserInteraction').mockResolvedValue(false);
    const vibrate = jest.spyOn(audioAlertService, 'vibrate').mockImplementation(() => {});

    await expect(audioAlertService.announceArrival('Osu', { speak: false })).resolves.toBeUndefined();
    expect(vibrate).toHaveBeenCalledWith('arrival');
  });

  it('plays the arrival sound when audio is available', async () => {
    audioAlertService.isInitialized = true;
    audioAlertService.audioContext = { state: 'running' };
    const sound = jest.fn();
    audioAlertService.arrivalSound = sound;
    jest.spyOn(audioAlertService, 'vibrate').mockImplementation(() => {});

    await audioAlertService.announceArrival('Osu', { speak: false });
    expect(sound).toHaveBeenCalledTimes(1);
  });
});
