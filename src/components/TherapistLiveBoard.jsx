import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { durationOf, toMinutes, fmtClock, fmtSpan } from '../lib/appointmentDuration';

const pad2 = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const nowMinutes = (d) => d.getHours() * 60 + d.getMinutes();

const DEFAULT_START = 8 * 60;
const DEFAULT_END = 19 * 60;
const ROW_LANE_H = 46;

// Real-time "who is free right now" board for today. Reads today's
// appointments live (onSnapshot) and ticks every 30 s so the NOW line, the
// dimmed past and the busy/free status stay current without a refresh.
const TherapistLiveBoard = ({ therapists }) => {
  const [now, setNow] = useState(() => new Date());
  const [appointments, setAppointments] = useState([]);
  const today = toDateStr(now);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'appointments'), where('date', '==', today)),
      (snap) => setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error('Live board listener error:', err)
    );
    return unsub;
  }, [today]);

  const nowMin = nowMinutes(now);

  // Sessions per therapist (cancelled ones don't occupy anyone).
  const sessionsByTherapist = useMemo(() => {
    const map = {};
    appointments.forEach(a => {
      if (a.status === 'cancelled') return;
      const start = toMinutes(a.time);
      if (start === null) return;
      const ids = a.therapistIds?.length ? a.therapistIds : (a.therapistId ? [a.therapistId] : []);
      const end = start + durationOf(a);
      ids.forEach(id => {
        (map[id] = map[id] || []).push({ ...a, start, end });
      });
    });
    Object.values(map).forEach(list => list.sort((x, y) => x.start - y.start));
    return map;
  }, [appointments]);

  // Timeline window: fitted to the day's sessions (with an hour of margin) so
  // blocks use the full width; falls back to working hours on an empty day.
  const { winStart, winEnd } = useMemo(() => {
    const all = Object.values(sessionsByTherapist).flat();
    if (all.length === 0) return { winStart: DEFAULT_START, winEnd: DEFAULT_END };
    const first = Math.min(...all.map(x => x.start));
    const last = Math.max(...all.map(x => x.end));
    const s = Math.max(0, Math.floor((first - 30) / 60) * 60);
    let e = Math.min(24 * 60, Math.ceil((last + 30) / 60) * 60);
    if (e - s < 6 * 60) e = Math.min(24 * 60, s + 6 * 60);
    return { winStart: s, winEnd: e };
  }, [sessionsByTherapist]);

  const span = winEnd - winStart;
  const pct = (m) => `${((Math.min(Math.max(m, winStart), winEnd) - winStart) / span) * 100}%`;
  const nowInWindow = nowMin >= winStart && nowMin <= winEnd;
  const hours = [];
  for (let h = winStart; h <= winEnd; h += 60) hours.push(h);

  const stateOf = (s) => {
    if (s.status === 'completed') return 'done';
    if (s.status === 'in-progress' && nowMin >= s.start) return 'current';
    if (nowMin >= s.end) return 'done';
    if (nowMin >= s.start) return 'current';
    return 'upcoming';
  };

  const describe = (list) => {
    const current = list.find(s => stateOf(s) === 'current');
    const upcoming = list.filter(s => stateOf(s) === 'upcoming');
    const next = upcoming[0];
    if (current) {
      // Busy until the end of any back-to-back sessions.
      let freeAt = current.end;
      list.forEach(s => { if (stateOf(s) === 'upcoming' && s.start <= freeAt) freeAt = Math.max(freeAt, s.end); });
      const after = list.find(s => stateOf(s) === 'upcoming' && s.start > freeAt);
      return {
        busy: true,
        headline: `Busy until ${fmtClock(freeAt)}`,
        detail: `With ${current.patient || 'patient'}${after ? ` · next ${fmtClock(after.start)}` : ' · nothing after'}`,
      };
    }
    if (next) {
      return {
        busy: false,
        headline: 'Free now',
        detail: `Next ${fmtClock(next.start)} (in ${fmtSpan(next.start - nowMin)}) · ${next.patient || 'patient'}`,
      };
    }
    return {
      busy: false,
      headline: 'Free now',
      detail: list.length ? 'Done for the day' : 'No sessions today',
    };
  };

  const rows = therapists.map(t => {
    const list = sessionsByTherapist[t.id] || [];
    // Lanes so overlapping (double-booked) sessions don't draw on top of each other.
    const laneEnds = [];
    const placed = list.map(s => {
      let lane = laneEnds.findIndex(e => e <= s.start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(s.end); } else laneEnds[lane] = s.end;
      return { ...s, lane };
    });
    const lanes = Math.max(1, laneEnds.length);
    return { t, list: placed, lanes, info: describe(list), conflict: lanes > 1 };
  });

  const busyCount = rows.filter(r => r.info.busy).length;
  const freeCount = rows.length - busyCount;

  if (therapists.length === 0) {
    return <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">No therapists found. Add therapists via User Management.</div>;
  }

  const nowLabel = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Therapist Live Board</h2>
          <p className="text-emerald-100 text-xs">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · updates automatically
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="bg-white/20 text-white px-3 py-1 rounded-full">🕒 {nowLabel}</span>
          <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full">{busyCount} busy</span>
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">{freeCount} free</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 720 }}>
          {/* Hour header */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <div className="w-52 shrink-0 px-4 py-2 text-xs font-semibold text-gray-500">Therapist</div>
            <div className="relative flex-1 h-8">
              {hours.map(h => (
                <span key={h} className="absolute top-2 text-[11px] text-gray-500 -translate-x-1/2" style={{ left: pct(h) }}>
                  {fmtClock(h).replace(':00', '')}
                </span>
              ))}
            </div>
          </div>

          {rows.map(({ t, list, lanes, info, conflict }) => (
            <div key={t.id} className="flex border-b border-gray-100">
              <div className="w-52 shrink-0 px-4 py-3 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${info.busy ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
                  <span className="font-semibold text-gray-900 text-sm truncate">{t.name}</span>
                </div>
                <p className={`text-xs font-semibold mt-1 ${info.busy ? 'text-orange-700' : 'text-green-700'}`}>{info.headline}</p>
                <p className="text-[11px] text-gray-500 truncate" title={info.detail}>{info.detail}</p>
                {conflict && <p className="text-[11px] text-red-600 font-semibold mt-0.5">⚠ Overlapping sessions</p>}
              </div>

              <div
                className="relative flex-1 bg-green-50"
                style={{ height: Math.max(56, lanes * ROW_LANE_H + 10) }}
              >
                {/* hour gridlines */}
                {hours.map(h => (
                  <div key={h} className="absolute top-0 bottom-0 border-l border-green-100" style={{ left: pct(h) }} />
                ))}

                {/* sessions */}
                {list.map(s => {
                  const st = stateOf(s);
                  const style = {
                    left: pct(s.start),
                    width: `calc(${pct(s.end)} - ${pct(s.start)})`,
                    top: 5 + s.lane * ROW_LANE_H,
                    height: ROW_LANE_H - 6,
                  };
                  const look =
                    st === 'current' ? 'bg-orange-500 text-white ring-2 ring-orange-300 shadow'
                    : st === 'done' ? 'bg-gray-300 text-gray-500'
                    : 'bg-blue-600 text-white';
                  return (
                    <div
                      key={s.id}
                      className={`absolute rounded-md px-2 py-1 overflow-hidden text-[11px] leading-tight ${look}`}
                      style={style}
                      title={`${fmtClock(s.start)} – ${fmtClock(s.end)} · ${s.patient || ''} · ${s.type || ''}${st === 'done' ? ' (done)' : ''}`}
                    >
                      <div className="font-semibold truncate">{s.patient || 'Patient'}</div>
                      <div className="truncate opacity-90">{fmtClock(s.start).replace(' ', '')}–{fmtClock(s.end).replace(' ', '')} · {s.type || ''}</div>
                    </div>
                  );
                })}

                {/* dim everything that has already passed */}
                {nowInWindow && (
                  <div className="absolute top-0 bottom-0 left-0 bg-gray-400/25 pointer-events-none" style={{ width: pct(nowMin) }} />
                )}
                {!nowInWindow && nowMin > winEnd && (
                  <div className="absolute inset-0 bg-gray-400/25 pointer-events-none" />
                )}
                {/* NOW line */}
                {nowInWindow && (
                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none" style={{ left: pct(nowMin) }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200" /> Free</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-500" /> Busy now</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600" /> Upcoming</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-300" /> Done (dimmed)</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-red-500" /> Now</span>
        <span className="text-gray-400">Sessions without a duration use 30 min (consultation / follow-up) or 60 min (therapy).</span>
      </div>
    </div>
  );
};

export default TherapistLiveBoard;
