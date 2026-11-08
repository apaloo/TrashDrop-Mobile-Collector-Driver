import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import InstallPrompt from '../InstallPrompt';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile';

const offerInstall = (outcome = 'accepted') => {
  const offer = new Event('beforeinstallprompt');
  offer.prompt = jest.fn().mockResolvedValue();
  offer.userChoice = Promise.resolve({ outcome });
  act(() => { window.dispatchEvent(offer); });
  return offer;
};

const openScreen = async () => {
  render(<InstallPrompt />);
  await act(async () => { jest.advanceTimersByTime(2100); });
};

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  window.matchMedia = jest.fn(() => ({ matches: false }));
  jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ANDROID);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Add to Home Screen on Android', () => {
  it('opens the install dialog and closes once installed', async () => {
    await openScreen();
    const offer = offerInstall('accepted');

    await act(async () => { fireEvent.click(screen.getByText('Add to Home Screen')); });

    expect(offer.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('TrashDrop Carter')).not.toBeInTheDocument();
    expect(localStorage.getItem('trashdrop_install_prompt_shown')).toBe('installed');
  });

  it('waits for the browser when tapped before it is ready', async () => {
    await openScreen();
    await act(async () => { fireEvent.click(screen.getByText('Add to Home Screen')); });
    expect(screen.getByText('Getting ready…')).toBeInTheDocument();

    const offer = offerInstall('accepted');
    await act(async () => {});

    expect(offer.prompt).toHaveBeenCalledTimes(1);
  });

  it('stays on the screen when the collector declines the dialog', async () => {
    await openScreen();
    offerInstall('dismissed');

    await act(async () => { fireEvent.click(screen.getByText('Add to Home Screen')); });

    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument();
    expect(localStorage.getItem('trashdrop_install_prompt_shown')).not.toBe('installed');
  });

  it('shows the steps when the browser cannot install', async () => {
    await openScreen();

    await act(async () => { fireEvent.click(screen.getByText('Add to Home Screen')); });
    await act(async () => { jest.advanceTimersByTime(3100); });

    expect(screen.getByText('Add to Home Screen:')).toBeInTheDocument();
    expect(screen.queryByText('Lightning-fast loading times')).not.toBeInTheDocument();
  });

  it('keeps the buttons outside the scrolling area', async () => {
    await openScreen();

    const scrollArea = screen.getByTestId('install-scroll');
    expect(scrollArea).toContainElement(screen.getByText('Welcome to TrashDrop'));
    expect(scrollArea).not.toContainElement(screen.getByText('Add to Home Screen'));
    expect(scrollArea).not.toContainElement(screen.getByText('Open App'));
  });

  it('asks again next visit after Open App', async () => {
    await openScreen();

    fireEvent.click(screen.getByText('Open App'));

    expect(screen.queryByText('Add to Home Screen')).not.toBeInTheDocument();
    expect(localStorage.getItem('trashdrop_install_prompt_dismissed')).toBeNull();
  });
});
