import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, AlertCircle, CloudUpload } from 'lucide-react';

// Saves a form automatically while the user works on it, so a closed tab, a
// dropped connection or a forgotten Save click doesn't lose what was typed.
//
//   const autosave = useAutosave({ value: form, enabled: !loading, save: writeSheet });
//
// - Nothing is saved until `enabled` turns true (the form has finished
//   loading). The value at that moment is the baseline, so just opening a
//   sheet never writes anything — only a real change does.
// - A save runs `delay` ms after the last change. Changes made while a save is
//   in flight are picked up by a follow-up save; a failed save retries.
// - `ignoreKeys` are left out of the "has it changed?" comparison: derived
//   fields (e.g. BMI, recalculated on open) and fields saved by other means.
// - `flush()` saves anything outstanding right now (call it before closing);
//   it resolves true when everything is saved. `markSaved()` resets the
//   baseline after a manual save. `indicator` is a small status label.
export function useAutosave({ value, enabled, save, delay = 2000, ignoreKeys = [] }) {
  const [status, setStatus] = useState('idle'); // idle | pending | saving | saved | error
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const ignoreRef = useRef(ignoreKeys);
  ignoreRef.current = ignoreKeys;
  const snapshot = useCallback((v) => JSON.stringify(v, (k, val) => (ignoreRef.current.includes(k) ? undefined : val)), []);

  const valueRef = useRef(value);
  valueRef.current = value;
  const saveRef = useRef(save);
  saveRef.current = save;

  const baselineRef = useRef(null);
  const timerRef = useRef(null);
  const inFlightRef = useRef(null);
  const mountedRef = useRef(true);

  const isDirty = useCallback(
    () => baselineRef.current !== null && snapshot(valueRef.current) !== baselineRef.current,
    [snapshot],
  );

  const runSave = useCallback(async () => {
    clearTimeout(timerRef.current);
    // One save at a time; a change made meanwhile is saved right after.
    if (inFlightRef.current) await inFlightRef.current.catch(() => {});
    if (!isDirty()) return true;

    const current = valueRef.current;
    const snap = snapshot(current);
    if (mountedRef.current) setStatus('saving');
    const p = (async () => saveRef.current(current))();
    inFlightRef.current = p;
    try {
      await p;
      baselineRef.current = snap;
      if (mountedRef.current) {
        setLastSavedAt(new Date());
        setStatus(isDirty() ? 'pending' : 'saved');
      }
      return true;
    } catch (e) {
      console.error('Autosave failed:', e);
      if (mountedRef.current) setStatus('error');
      return false;
    } finally {
      if (inFlightRef.current === p) inFlightRef.current = null;
    }
  }, [isDirty, snapshot]);

  // Take the baseline once the form has loaded.
  useEffect(() => {
    if (enabled && baselineRef.current === null) baselineRef.current = snapshot(valueRef.current);
  }, [enabled, snapshot]);

  // Debounced save after each change; retry a failed save after 10s.
  useEffect(() => {
    if (!enabled || baselineRef.current === null) return;
    if (!isDirty()) {
      if (status === 'pending') setStatus('saved');
      return;
    }
    if (status !== 'saving' && status !== 'error') setStatus('pending');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(runSave, status === 'error' ? 10000 : delay);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled, status === 'error']);

  // Warn before the browser tab is closed or reloaded with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (isDirty() || inFlightRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // If the sheet is unmounted with changes still pending, save them anyway.
  useEffect(() => {
    mountedRef.current = true; // (re)set here too: StrictMode mounts, unmounts and remounts in dev
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      if (isDirty()) runSave();
    };
  }, [isDirty, runSave]);

  const flush = useCallback(async () => {
    if (inFlightRef.current) await inFlightRef.current.catch(() => {});
    return isDirty() ? runSave() : true;
  }, [isDirty, runSave]);

  const markSaved = useCallback(() => {
    baselineRef.current = snapshot(valueRef.current);
    clearTimeout(timerRef.current);
    setLastSavedAt(new Date());
    setStatus('saved');
  }, [snapshot]);

  const time = lastSavedAt?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const indicator = (() => {
    const base = 'flex items-center gap-1 text-xs whitespace-nowrap';
    if (status === 'saving') return <span className={`${base} text-teal-100`}><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</span>;
    if (status === 'pending') return <span className={`${base} text-teal-100`}><CloudUpload className="w-3.5 h-3.5" /> Unsaved changes…</span>;
    if (status === 'error') return <span className={`${base} text-amber-200 font-semibold`} title="Will retry automatically. You can also click Save."><AlertCircle className="w-3.5 h-3.5" /> Couldn't save — retrying</span>;
    if (status === 'saved') return <span className={`${base} text-teal-100`}><Check className="w-3.5 h-3.5" /> All changes saved{time ? ` · ${time}` : ''}</span>;
    return <span className={`${base} text-teal-200`}>Autosave on</span>;
  })();

  return { status, lastSavedAt, flush, markSaved, isDirty, indicator };
}

export default useAutosave;
