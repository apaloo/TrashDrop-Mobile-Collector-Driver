import { useEffect, useRef } from 'react';

// Sign-in codes are 6 numbers long
export const CODE_LENGTH = 6;

/**
 * Pulls the 6-number code out of text the phone pasted or autofilled:
 * "123456", "123 456", or a whole copied message such as
 * "Your TrashDrop code is 123456". Returns null when there is no code.
 */
export const extractCode = (text) => {
  const value = String(text || '');
  const run = value.match(/(?:^|\D)(\d{6})(?!\d)/);
  if (run) return run[1];
  const digits = value.replace(/\D/g, '');
  return digits.length === CODE_LENGTH ? digits : null;
};

/**
 * Android (Chrome): reads the code straight from the incoming text and hands
 * it to onCode, after the phone asks the collector "Allow ... to read this
 * code?". This only works when the text ends with a line like
 * "@collector.trashdrops.com #123456". iPhones don't need this: the
 * autoComplete="one-time-code" boxes get the code from Messages above the
 * keyboard.
 *
 * Waits while `active` is true and stops when it turns false or the screen
 * closes. If the phone can't do this, or the collector says no, nothing
 * happens and typing the code still works.
 */
export const useOtpAutofill = (active, onCode) => {
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (!active || typeof window === 'undefined' || !('OTPCredential' in window)) return undefined;
    if (!navigator.credentials?.get) return undefined;

    const controller = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: controller.signal })
      .then((credential) => {
        const code = extractCode(credential?.code);
        if (code && !controller.signal.aborted) onCodeRef.current(code);
      })
      .catch(() => {}); // stopped, refused or timed out: typing still works

    return () => controller.abort();
  }, [active]);
};

export default useOtpAutofill;
