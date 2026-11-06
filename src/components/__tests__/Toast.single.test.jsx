import { readFileSync } from 'fs';
import path from 'path';
import { render, screen, act } from '@testing-library/react';
import Toast from '../Toast';

describe('Request page toast', () => {
  it('draws each message once (no second banner at the bottom)', () => {
    const source = readFileSync(path.join(__dirname, '../../pages/Request.jsx'), 'utf8');
    // Every message goes through the one <Toast>; no inline copy of toast.message
    expect(source.match(/<Toast\b/g)).toHaveLength(1);
    expect(source).not.toMatch(/>\s*\{toast\.message\}/);
  });

  it('closes after its duration even while the page re-renders', () => {
    jest.useFakeTimers();
    try {
      const onClose = jest.fn();
      const { rerender } = render(<Toast message="Disposed 1/1 items!" type="success" duration={5000} onClose={onClose} />);
      expect(screen.getByText('Disposed 1/1 items!')).toBeInTheDocument();
      act(() => { jest.advanceTimersByTime(3000); });
      rerender(<Toast message="Disposed 1/1 items!" type="success" duration={5000} onClose={onClose} />);
      act(() => { jest.advanceTimersByTime(2400); });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
