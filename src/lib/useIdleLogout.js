import { useEffect, useRef, useState, useCallback } from 'react';

// Automatic logout after a period with no keyboard / mouse / touch / scroll
// activity. The last-activity time lives in localStorage so every open tab of
// the app shares one clock (activity in any tab keeps all of them signed in),
// and so a tab that was closed or asleep is judged by real elapsed time rather
// than by a timer the browser may have paused.

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
export const IDLE_WARNING_MS = 60 * 1000; // warn this long before logging out

const KEY = 'lastActivityAt';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart', 'click'];

export const markActivity = () => {
  try { localStorage.setItem(KEY, String(Date.now())); } catch { /* storage unavailable */ }
};

export const clearActivity = () => {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
};

export const getLastActivity = () => {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
};

// True when a saved login has been idle past the limit (e.g. the browser was
// closed and reopened later). No recorded activity at all counts as fresh.
export const isSessionIdleExpired = () => {
  const last = getLastActivity();
  return last !== null && Date.now() - last >= IDLE_TIMEOUT_MS;
};

// onTimeout(lastActivityMs) runs once when the idle limit is reached.
// Returns { secondsLeft, stayActive }: secondsLeft is null normally, and counts
// down during the final warning minute; stayActive() cancels the warning.
export const useIdleLogout = (enabled, onTimeout) => {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const warningRef = useRef(false);
  const firedRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return undefined;

    firedRef.current = false;
    warningRef.current = false;
    if (getLastActivity() === null) markActivity();

    let lastWrite = 0;
    const onActivity = () => {
      // Once the warning is showing, only the "Stay signed in" button counts —
      // so a bump of the mouse by someone walking past can't silently cancel it.
      if (warningRef.current) return;
      const now = Date.now();
      if (now - lastWrite < 1000) return;
      lastWrite = now;
      markActivity();
    };

    const tick = () => {
      if (firedRef.current) return;
      const last = getLastActivity() ?? Date.now();
      const idle = Date.now() - last;
      if (idle >= IDLE_TIMEOUT_MS) {
        firedRef.current = true;
        onTimeoutRef.current(last);
        return;
      }
      if (idle >= IDLE_TIMEOUT_MS - IDLE_WARNING_MS) {
        warningRef.current = true;
        setSecondsLeft(Math.ceil((IDLE_TIMEOUT_MS - idle) / 1000));
      } else {
        warningRef.current = false;
        setSecondsLeft(null);
      }
    };

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', tick);
    const id = setInterval(tick, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity, { capture: true }));
      document.removeEventListener('visibilitychange', tick);
      clearInterval(id);
    };
  }, [enabled]);

  const stayActive = useCallback(() => {
    warningRef.current = false;
    markActivity();
    setSecondsLeft(null);
  }, []);

  return { secondsLeft, stayActive };
};
