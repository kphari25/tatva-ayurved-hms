---
name: ip-lifecycle-test
description: Runs a full end-to-end QA test of the IP (in-patient) journey in the Tatva Ayurved HMS app — an existing patient calling in for a future IP admission, room reservation, check-in/admission, IP Case Sheet, multi-day Daily Progress logs with medicine and treatment, discharge, and final invoice — verifying Room Management and the Dashboard stay in sync at every step. Use this whenever the user asks to test, verify, or QA the IP patient flow, the in-patient admission/discharge cycle, Room Management end-to-end, or says something like "run the IP lifecycle test" / "test the full IP journey" / "test an IP admission from booking to discharge." Always confirm the invoice-charges question (real vs ₹0) before generating the invoice — don't assume.
---

# IP Lifecycle Test

This drives the live app in the Browser pane through one complete in-patient journey, using disposable "ZZ Test" data, and reports a pass/fail summary at the end. It exists because this exact 15-step scenario was manually specified once already — this skill lets you rerun it (or a close variant) without re-explaining it.

## Before you start

Ask the user only what actually varies between runs — don't re-ask things this file already answers:

1. **Invoice charges**: ₹0 (safe — doesn't touch real Total Revenue, since invoices can't be deleted in this app) or realistic auto-computed charges (permanently changes real revenue figures). Default to ₹0 unless the user says otherwise — this was the explicit, deliberate choice made the last time this test ran.
2. **Stay length** (default 4 days) and **how far out the appointment date should be** (default: today + 5 days) — only ask if the user's phrasing suggests a different number.

Everything else below is fixed procedure — follow it, don't ask about it.

## Setup

Start the dev server and open the Browser pane:
- `preview_start({name: "dev"})` (reads `.claude/launch.json`, port 5173)
- Wait ~3s after first load for Firestore's initial data fetch.

Use a patient name prefixed `ZZ Test` (e.g. `ZZ Test IPJourney`) for the whole run — this is how you find and clean it up later, and it's how a human glancing at the data can tell it's disposable.

## Known gotchas (read before touching delete/save buttons)

- **`window.confirm`/`window.alert` are auto-dismissed** by the automated browser, which silently blocks any action gated behind `confirm(...)` (deletes, checkouts, admits with a confirm dialog). Before clicking anything destructive, run:
  ```js
  window.confirm = () => true; window.alert = () => {};
  ```
  via the JS execution tool. Redo this after every full page reload/navigation that resets JS state (it does NOT need to be redone for in-app view switches, only actual reloads).
- **"Save & Print" buttons (Invoice, Medicine Sale) call `window.print()` directly and freeze the automated tab** — there's no way to interact with a native OS print dialog. This is expected, not a bug: the save already completes (confirm via a console log line like `✅ Invoice created: <id>`) before the freeze. Recover by closing the tab and reopening with `preview_start({url: "http://localhost:5173"})` — the dev server keeps running underneath. Prefer "Preview & Print" (no auto-print) to verify content *before* the real save when possible.
- **The Prescription modal's print preview auto-triggers `window.print()` the instant the iframe loads** — don't open it at all if you need to avoid the freeze; the on-screen medicine table (visible before printing) is already enough to verify correctness.
- Room dropdowns only ever offer rooms not held by another **currently-admitted** patient — a room picked at booking time can still lose a race to another pending admission; this is a known, accepted limitation, not something to flag as a bug.
- **MRD numbers are reused after a patient is deleted.** If a prior test run's patient was cleaned up, the next patient you register can land on the exact same MRD number (confirmed twice: `MRD-1071` was reused across separate runs). Don't use MRD number alone to distinguish this run's patient from a previous run's leftover data — match by the full `ZZ Test <name>` name instead.
- **Leave "Send Welcome SMS" unchecked** on the registration form — it's unchecked by default, and there's no reason to enable it for a disposable test patient even though the phone number is fake.
- The Daily Log / Vitals medicine field will show **"No medicines found"** for a made-up medicine name — that's just the inventory autocomplete having nothing to suggest; free text is still accepted and saves fine.

## The procedure

Work through these in order. After each step, take a screenshot or read_page to confirm the expected state before moving on — don't chain several steps blind and only check at the end, since failures are much easier to diagnose immediately after the action that caused them.

1. **Register the "existing" patient.** Patient Portal → Register New Patient. Any Patient Type is fine (OP is most realistic — they're an existing patient who hasn't been an in-patient yet). Minimal required fields only (name, age, gender, registration fee = 0, phone). Note the assigned MRD number.

2. **Book the IP appointment as an existing-patient booking.** Dashboard → Add Appointment → type the patient's name in Patient Name → select their match from the dropdown (this routes to the "Schedule Visit" existing-patient flow, not a fresh-patient one). In that modal: set Appointment Date to the agreed future date, Appointment Type = IP, pick a Room from the dropdown (confirm it only lists currently-vacant rooms), leave Called-in Date/Time at their defaults (today — that's the whole point, they're calling in today for a later date). Save.

3. **Verify Dashboard reflects it.** Pending Admissions count should have incremented; open the popup and confirm the patient's name, admission (appointment) date, and the room badge (🛏️ Room N) all appear — this room badge only appears if [Dashboard.jsx](../../src/components/Dashboard.jsx)'s pendingAdmissions logic correctly joined the appointment's `room_number`.

4. **Verify Room Management reflects the reservation.** Navigate to Room Management. The assigned room should show the amber **"Reserved"** state with this patient's name and the expected (appointment) date — not yet "Occupied". Clicking the room card should open the patient's full details (Patient Portal).

5. **Admit the patient.** Patient Portal → find the patient → **Admit Patient** button. Set Admission Date to the same future date used in step 2, Expected Stay (Days) to the agreed length (default 4). Confirm the modal shows the computed "Expected checkout" date. Admit.

6. **Verify Room Management flipped to Occupied.** The same room should now show red **"Occupied"** with correct From/To dates (To = admission date + stay length) — this confirms the room carried over automatically from the reservation into the IP Case Sheet without a manual case-sheet visit (see [roomAvailability.js](../../src/lib/roomAvailability.js)'s `applyReservedRoomOnAdmission`). If the room shows "Vacant" instead, that's a real regression — the auto-carry-over broke. Check the badge underneath the dates too: since this test uses a future admission date, it should read the purple **"Admits in N days"** badge (N = days until the admission date), not a blue "Day N" badge — a blue "Day N" badge or, worse, a negative "Day -N" badge here would mean the future-admission fix regressed (this exact case — "Day -4" for a future admission — was a real bug found and fixed once already; verified fixed again on a second full run). Only once the admission date has actually arrived does the badge switch to blue "Day 1" (day of admission), incrementing daily after that.

7. **Fill out the IP Case Sheet.** Open it from Patient Portal. On the "Case Sheet" tab: Department, a Physician (pick from the dropdown), confirm Room Number/Admission Date are pre-filled correctly (don't re-type them — that's the point of step 6). Fill a couple of Demographics fields and the Roopam/presenting-complaints box. On "History & Examination": fill at least one field so the section isn't empty. Save.

8. **Add the daily logs in one shot.** Go to the "Vitals & Daily Log" tab. Fill one entry: vitals (BP/Temp/Pulse — pick plausible values), one row under Medicines Given (medicine name, dose e.g. "1-0-1", frequency e.g. "BD", days can stay blank — the group's own "Treatment Days" field controls repetition, not the per-medicine Days column), something under Treatment Performed. Set the **Treatment Days** dropdown to the agreed stay length (4) — this is the shortcut that creates one consecutive daily entry per day in a single "Add Entry" click, instead of repeating steps 8 four times by hand. Click Add Entry.

9. **Verify all days were created.** The Vitals & Daily Log tab header should now read "(4)" and the entry list below should show 4 consecutive dates, each carrying the same medicine/treatment (staff would normally edit each day's entry individually afterward — that's out of scope for this test, just confirm they exist).

10. **Discharge the patient.** Go to the Discharge page → New Discharge → select the patient. Set Discharge Date = admission date + stay length. If the user asked for ₹0 charges, leave all charge fields at 0 (dates alone will make Room Rent/Doctor's/Nursing fees show non-zero numbers per-day rates times days if the discharge form auto-computes off dates — zero those out explicitly if so). Proceed through to "Complete Discharge".

11. **Verify the room cleared immediately.** Room Management should show that room back to green **"Vacant"** the instant discharge completes — no manual step, no refresh. This is the other half of the auto-sync (the existing `admission_status !== 'discharged'` filter in [RoomManagement.jsx](../../src/components/RoomManagement.jsx)). Also check the Dashboard's "Discharges Today" card lists this patient as Completed, and they've dropped out of "In-Patient Status".

12. **Generate the invoice.** Invoices → New Invoice → Patient Invoice → select the patient → confirm it defaults to In Patient (I/P). If ₹0 was agreed: verify Room Rent, Doctor's/Nursing Fees, and Mess Charges all read ₹0 (they should, if Days on the invoice form itself reads 0 — check this explicitly, since the invoice's own Admission/Discharge Date fields are separate from the ones already saved on the case sheet and may need to be set to make Days compute, or left blank to keep Days at 0). Add a note identifying it as test data. Use **Preview & Print** first to sanity-check the rendered document safely, then **Save & Print** to actually persist it (expect the tab-freeze gotcha above — recover and re-verify via the Invoices Management list afterward).

13. **Verify the invoice landed correctly.** In Invoices Management: Type = IP, correct patient/MRD, and — if ₹0 was used — confirm Total Revenue is unchanged from before this invoice was created (note the before/after figures explicitly in your report).

## Cleanup

Delete everything the UI actually allows deleting, in this order (each needs the `window.confirm` override from above active):
- The Vitals & Daily Log entries (IP Case Sheet → trash icon per entry) — usually already gone if you're deleting the whole patient next, but do it anyway if you want to leave the patient in place for manual inspection.
- The appointment (Dashboard → trash icon on the appointment card).
- The patient (Patient Portal → Delete Patient).

**Cannot be deleted** (no UI exists for it) — say this plainly in your final report rather than silently leaving orphaned data unmentioned:
- The `discharges` record.
- The `ip_case_sheets` document (orphaned once the patient is gone).
- The invoice itself.

## Final report

Give the user a step-by-step pass/fail list (steps 1–13), name anything that didn't match expectations, and state clearly what was cleaned up vs. what remains permanently (discharge record, case sheet, invoice, and the Total Revenue before/after if ₹0 charges were used).
