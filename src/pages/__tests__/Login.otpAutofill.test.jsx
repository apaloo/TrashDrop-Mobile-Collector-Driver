import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LoginPage from '../Login';
import { useAuth } from '../../context/AuthContext';
import { extractCode } from '../../hooks/useOtpAutofill';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/supabase', () => ({
  formatPhoneNumber: (p) => (p.startsWith('+') ? p : `+233${p.replace(/\D/g, '').replace(/^0+/, '')}`)
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('../../assets/logo.svg', () => 'logo.svg');

const ShowLocation = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderLogin = (auth) => {
  useAuth.mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/map" element={<ShowLocation />} />
      </Routes>
    </MemoryRouter>
  );
};

const goToCodeStep = async (auth) => {
  const utils = renderLogin(auth);
  fireEvent.change(screen.getByPlaceholderText('0501234567'), { target: { value: '0245724489' } });
  fireEvent.click(screen.getByText('📨 Send Code'));
  await screen.findByText('Enter your code');
  return utils;
};

const signedIn = () => ({
  sendLoginOtp: jest.fn().mockResolvedValue({ success: true }),
  login: jest.fn().mockResolvedValue({ success: true, user: { id: 'jack' } })
});

afterEach(() => {
  delete window.OTPCredential;
  delete navigator.credentials;
});

describe('extractCode', () => {
  it.each([
    ['482913', '482913'],
    ['482 913', '482913'],
    ['Your TrashDrop code is 482913', '482913'],
    ['Your code is 482913\n\n@collector.trashdrops.com #482913', '482913'],
    ['12', null],
    ['1234567', null],
    ['', null],
    [undefined, null]
  ])('%p -> %p', (text, expected) => {
    expect(extractCode(text)).toBe(expected);
  });
});

describe('Login: code autofill', () => {
  it('marks every code box as a one-time code so iPhones offer it from Messages', async () => {
    await goToCodeStep(signedIn());
    const boxes = screen.getAllByRole('textbox', { name: /Code number/ });
    expect(boxes).toHaveLength(6);
    boxes.forEach((box) => {
      expect(box).toHaveAttribute('autocomplete', 'one-time-code');
      expect(box).not.toHaveAttribute('maxlength');
    });
  });

  it('fills all six boxes and signs in when the phone autofills the code', async () => {
    const auth = signedIn();
    await goToCodeStep(auth);

    fireEvent.change(screen.getByRole('textbox', { name: 'Code number 1' }), { target: { value: '482913' } });

    await waitFor(() => expect(auth.login).toHaveBeenCalledWith('+233245724489', '482913'));
    expect(await screen.findByTestId('location')).toHaveTextContent('/map');
  });

  it('signs in when the collector pastes the copied message into any box', async () => {
    const auth = signedIn();
    await goToCodeStep(auth);

    fireEvent.paste(screen.getByRole('textbox', { name: 'Code number 3' }), {
      clipboardData: { getData: () => 'Your TrashDrop code is 482913' }
    });

    await waitFor(() => expect(auth.login).toHaveBeenCalledTimes(1));
    expect(auth.login).toHaveBeenCalledWith('+233245724489', '482913');
  });

  it('on Android, reads the code from the text and signs in', async () => {
    window.OTPCredential = function OTPCredential() {};
    const get = jest.fn().mockResolvedValue({ code: '482913', type: 'otp' });
    Object.defineProperty(navigator, 'credentials', { value: { get }, configurable: true });
    const auth = signedIn();

    await goToCodeStep(auth);

    expect(get).toHaveBeenCalledWith(expect.objectContaining({ otp: { transport: ['sms'] } }));
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith('+233245724489', '482913'));
    expect(await screen.findByTestId('location')).toHaveTextContent('/map');
  });

  it('stops listening for the text when the screen closes', async () => {
    window.OTPCredential = function OTPCredential() {};
    let signal;
    const get = jest.fn((options) => { signal = options.signal; return new Promise(() => {}); });
    Object.defineProperty(navigator, 'credentials', { value: { get }, configurable: true });

    const { unmount } = await goToCodeStep(signedIn());
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('still waits for the Sign In tap when the code is typed one number at a time', async () => {
    const auth = signedIn();
    await goToCodeStep(auth);

    const boxes = screen.getAllByRole('textbox', { name: /Code number/ });
    '482913'.split('').forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }));
    expect(auth.login).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('✅ Sign In'));
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith('+233245724489', '482913'));
  });
});

describe('Signup: code autofill', () => {
  // Signup needs camera, storage and profile services to render; check that
  // it uses the same autofill pieces as Login.
  const source = fs.readFileSync(path.join(__dirname, '..', 'Signup.jsx'), 'utf8');

  it('listens for the text on the code step and accepts pasted or autofilled codes', () => {
    expect(source).toMatch(/useOtpAutofill\(step === 2, fillCode\)/);
    expect(source).toMatch(/autoComplete="one-time-code"/);
    expect(source).toMatch(/onPaste=\{handleOtpPaste\}/);
    expect(source).not.toMatch(/maxLength=\{1\}/);
    expect(source).toMatch(/authService\.verifyOtp\(formData\.phone, code\)/);
  });
});
