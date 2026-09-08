import React, { useState, useEffect, useMemo } from 'react';
import { Building2, User, BedDouble, Snowflake, Fan, CheckCircle2, CalendarClock } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ROOMS } from '../lib/rooms';
import { formatDateOnly, addDaysToDateString, daysSince } from '../lib/formatDate';

// Top-to-bottom, matching the real building — First Floor sits above Ground
// Floor. ROOMS itself stays in plain numeric order (used elsewhere as a flat
// dropdown list), so the floor grouping/ordering lives here instead.
const FLOOR_ORDER = ['First Floor', 'Ground Floor'];

const RoomManagement = () => {
  const [patients, setPatients] = useState([]);
  const [caseSheetsById, setCaseSheetsById] = useState({});
  const [ipAppointments, setIpAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Real-time on all three collections a room's state can come from, so a
  // room picked on a brand-new appointment, an admission recorded on the IP
  // Case Sheet, or a discharge all reflect here the moment they're saved —
  // no refresh needed, and no separate "sync" step for staff to remember.
  useEffect(() => {
    const unsubPatients = onSnapshot(collection(db, 'patients'), (snap) => {
      setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubCaseSheets = onSnapshot(collection(db, 'ip_case_sheets'), (snap) => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setCaseSheetsById(map);
    });
    const unsubAppointments = onSnapshot(query(collection(db, 'appointments'), where('type', '==', 'IP')), (snap) => {
      setIpAppointments(snap.docs.map(d => d.data()));
    });
    return () => { unsubPatients(); unsubCaseSheets(); unsubAppointments(); };
  }, []);

  // Keyed by room number — same "currently admitted" rule and checkout-date
  // computation as the Dashboard's In-Patient Status table, so the two
  // screens never disagree about who's in a room or when they're due out.
  // A discharged patient's admission_status flips away from 'admitted' the
  // moment Discharge is saved, so they drop out of this map — and the room
  // reads Vacant again — on the very next snapshot, automatically.
  const occupancyByRoom = useMemo(() => {
    const map = {};
    patients
      .filter(p => p.patient_type === 'IP' && p.admission_status !== 'pending_admission' && p.admission_status !== 'discharged')
      .forEach(p => {
        const cs = caseSheetsById[p.id] || {};
        if (!cs.room_number) return;
        const admissionDate = p.admission_date || p.created_at;
        const expectedStayDays = p.expected_stay_days != null ? Number(p.expected_stay_days) : null;
        const checkoutDate = admissionDate && expectedStayDays != null
          ? addDaysToDateString(admissionDate, expectedStayDays)
          : null;
        map[cs.room_number] = {
          patientId: p.id,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed patient',
          admissionDate,
          checkoutDate,
          daysAdmitted: admissionDate ? daysSince(admissionDate) : null,
        };
      });
    return map;
  }, [patients, caseSheetsById]);

  // Rooms picked on a booking for a patient who hasn't been admitted yet —
  // shown as "Reserved" rather than "Occupied" so the floor plan reflects a
  // held room without claiming someone is actually staying there. Only the
  // most recent IP appointment per patient counts, same rule the IP Case
  // Sheet's own room pre-fill uses. A room already actually occupied (by a
  // different patient) always wins over a stale reservation for it.
  const reservedByRoom = useMemo(() => {
    const latestApptByPatient = {};
    ipAppointments.forEach(a => {
      if (!a.patient_id || !a.room_number) return;
      const existing = latestApptByPatient[a.patient_id];
      if (!existing || new Date(a.createdAt || 0) > new Date(existing.createdAt || 0)) {
        latestApptByPatient[a.patient_id] = a;
      }
    });
    const map = {};
    patients
      .filter(p => p.patient_type === 'IP' && p.admission_status === 'pending_admission')
      .forEach(p => {
        const appt = latestApptByPatient[p.id];
        if (!appt || occupancyByRoom[appt.room_number]) return;
        map[appt.room_number] = {
          patientId: p.id,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed patient',
          appointmentDate: appt.date || null,
        };
      });
    return map;
  }, [patients, ipAppointments, occupancyByRoom]);

  const occupiedCount = Object.keys(occupancyByRoom).length;
  const reservedCount = Object.keys(reservedByRoom).length;
  const vacantCount = ROOMS.length - occupiedCount - reservedCount;

  const openPatient = (patientId) => {
    if (patientId) window.dispatchEvent(new CustomEvent('viewPatient', { detail: patientId }));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="w-7 h-7 text-teal-600" /> Room Management
        </h1>
        <p className="text-gray-500 text-sm mt-1">IP block floor plan — who's staying where, and for how long.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total Rooms</p>
            <p className="text-2xl font-bold text-gray-900">{ROOMS.length}</p>
          </div>
          <BedDouble className="w-8 h-8 text-gray-300" />
        </div>
        <div className="bg-white rounded-xl shadow-md p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Occupied</p>
            <p className="text-2xl font-bold text-red-600">{occupiedCount}</p>
          </div>
          <User className="w-8 h-8 text-red-200" />
        </div>
        <div className="bg-white rounded-xl shadow-md p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Reserved</p>
            <p className="text-2xl font-bold text-amber-600">{reservedCount}</p>
          </div>
          <CalendarClock className="w-8 h-8 text-amber-200" />
        </div>
        <div className="bg-white rounded-xl shadow-md p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Vacant</p>
            <p className="text-2xl font-bold text-green-600">{vacantCount}</p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-green-200" />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-400">Loading room occupancy…</div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {/* Roof */}
          <div className="flex justify-center bg-teal-800">
            <div
              className="w-0 h-0"
              style={{ borderLeft: '40px solid transparent', borderRight: '40px solid transparent', borderBottom: '28px solid #0f766e' }}
            />
          </div>
          <div className="bg-teal-800 text-center py-2">
            <p className="text-white font-semibold text-sm tracking-wide">TATVA AYURVED — IP BLOCK</p>
          </div>

          {FLOOR_ORDER.map(floor => {
            const floorRooms = ROOMS.filter(r => r.floor === floor);
            return (
              <div key={floor} className="border-t-4 border-teal-900 bg-amber-50">
                <div className="px-6 pt-4 pb-1 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">{floor}</h3>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    {floorRooms[0]?.type === 'A/C' ? <Snowflake className="w-3.5 h-3.5" /> : <Fan className="w-3.5 h-3.5" />}
                    {floorRooms[0]?.type}
                  </span>
                </div>
                <div className="px-6 pb-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${floorRooms.length}, minmax(0, 1fr))` }}>
                  {floorRooms.map(room => {
                    const occ = occupancyByRoom[room.number];
                    const reserved = !occ ? reservedByRoom[room.number] : null;
                    const isOccupied = !!occ;
                    const isReserved = !!reserved;
                    const checkoutIsToday = occ?.checkoutDate === new Date().toISOString().split('T')[0];
                    return (
                      <button
                        key={room.number}
                        onClick={() => (isOccupied || isReserved) && openPatient((occ || reserved).patientId)}
                        className={`text-left rounded-lg border-2 p-4 transition-shadow ${
                          isOccupied
                            ? 'border-red-300 bg-red-50 hover:shadow-md cursor-pointer'
                            : isReserved
                              ? 'border-amber-300 bg-amber-50 hover:shadow-md cursor-pointer'
                              : 'border-green-300 bg-green-50 cursor-default'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-gray-900">Room {room.number}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${
                            isOccupied ? 'bg-red-600' : isReserved ? 'bg-amber-600' : 'bg-green-600'
                          }`}>
                            {isOccupied ? 'Occupied' : isReserved ? 'Reserved' : 'Vacant'}
                          </span>
                        </div>
                        {isOccupied ? (
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-900 truncate" title={occ.name}>{occ.name}</p>
                            <p className="text-xs text-gray-600">
                              From <span className="font-medium">{occ.admissionDate ? formatDateOnly(occ.admissionDate) : '—'}</span>
                            </p>
                            <p className="text-xs text-gray-600">
                              To{' '}
                              <span className={`font-medium ${checkoutIsToday ? 'text-amber-700' : ''}`}>
                                {occ.checkoutDate ? `${formatDateOnly(occ.checkoutDate)}${checkoutIsToday ? ' · Today' : ''}` : 'Ongoing'}
                              </span>
                            </p>
                            {occ.daysAdmitted !== null && (
                              occ.daysAdmitted < 0 ? (
                                <span className="inline-block mt-1 text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                  Admits in {-occ.daysAdmitted} day{occ.daysAdmitted === -1 ? '' : 's'}
                                </span>
                              ) : (
                                <span className="inline-block mt-1 text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                  Day {occ.daysAdmitted + 1}
                                </span>
                              )
                            )}
                          </div>
                        ) : isReserved ? (
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-900 truncate" title={reserved.name}>{reserved.name}</p>
                            <p className="text-xs text-gray-600">
                              Expected{' '}
                              <span className="font-medium">{reserved.appointmentDate ? formatDateOnly(reserved.appointmentDate) : '—'}</span>
                            </p>
                            <p className="text-[10px] text-amber-700 font-medium">Awaiting admission</p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Available now · ₹{room.rate}/day</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Ground line */}
          <div className="h-2 bg-teal-900" />
        </div>
      )}
    </div>
  );
};

export default RoomManagement;
