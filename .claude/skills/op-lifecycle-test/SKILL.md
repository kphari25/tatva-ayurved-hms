---
name: op-lifecycle-test
description: Runs a full end-to-end QA test of the OP (out-patient) journey in the Tatva Ayurved HMS app — registration, an OP Case Sheet visit with a prescribed medicine, the compiled Prescription rollup, checkout, and a final invoice — confirming none of it touches Room Management or IP-only state. Use this whenever the user asks to test, verify, or QA the OP patient flow, an out-patient visit end-to-end, or says something like "run the OP lifecycle test" / "test the full OP journey" / "test an OP visit from registration to invoice." This is the OP counterpart to ip-lifecycle-test — use that one instead for anything involving admission, rooms, or a multi-day stay.
---

# OP Lifecycle Test

This drives the live app in the Browser pane through one complete out-patient journey, using disposable "ZZ Test" data, and reports a pass/fail summary at the end. It's the OP counterpart to `ip-lifecycle-test` — OP visits are simpler (no admission, no room, no multi-day stay), so this test is shorter, but it's just as much worth running because OP and IP share the same `patients`/`appointments`/`invoices` collections, and a change meant for one can leak into the other.

## Before you start

Ask the user only what varies between runs:

1. **Invoice charges**: ₹0 (safe — permanently recorded, since invoices can't be deleted) or realistic charges (permanently changes real Total Revenue). Default to ₹0 unless told otherwise.

Everything else below is fixed procedure.

## Setup

Same as `ip-lifecycle-test`: `preview_start({name: "dev"})`, wait ~3s for Firestore's first fetch, use a patient name prefixed `ZZ Test` for the whole run.

## Known gotchas

Identical to `ip-lifecycle-test`'s gotchas section — re-read it there if you haven't already this session:
- `window.confirm`/`window.alert` need overriding via JS-exec before any delete/checkout click, since the automated browser silently auto-dismisses them.
- Invoice/Medicine Sale "Save & Print" freezes the tab (native `window.print()`) — expected, recover by closing and reopening the tab at `http://localhost:5173`, verify the save already succeeded via console log or by re-checking the list.
- The Prescription modal's print preview auto-triggers print on load — don't open it if avoiding the freeze matters; the on-screen medicine table is enough to verify.

## The procedure

Check the actual state after each step before moving to the next.

1. **Register the patient.** Patient Portal → Register New Patient. Patient Type = OP (should be the default). Minimal fields: name (`ZZ Test <something>`), age, gender, registration fee = 0, phone.

2. **Confirm registration didn't touch Room Management.** Navigate to Room Management before doing anything else and note the current Occupied/Reserved/Vacant counts — they must be identical after registering this OP patient, since OP patients have no room concept at all. This is the main thing distinguishing this test from the IP one: proving isolation, not just that OP registration works.

3. **Record a visit with a prescribed medicine.** Patient Portal → this patient → OP Case Sheet → "Visit Log" tab. Add an entry: a Medicine (any name — inventory autocomplete may say "No medicines found" for a made-up name, that's fine, free text is still accepted), a Dose (e.g. "1-0-1"), Frequency (e.g. "BD"), Days (e.g. 5). Click Add Entry. Confirm the tab header updates to "Visit Log (1)" and the entry appears in the list below with the date and a "Medication Details" summary line.

4. **Verify the Prescription rollup picks it up.** Patient Portal → this patient → Prescription button. Confirm it shows a section headed **"OP Visit Log"** (not "IP Daily Progress" — that label is the IP-only branch) with today's date, and the exact medicine/dose/frequency/days just entered. Do not click Print here (see gotchas).

5. **Checkout the patient.** Patient Portal → this patient → **Checkout** button (this is the OP equivalent of IP discharge — same `admission_status: 'discharged'` field under the hood, just without a billing wizard). Confirm the patient's Status badge flips to "Inactive" and they move out of the Active tab into Inactive/Discharged.

6. **Verify Room Management is still untouched.** Check the Occupied/Reserved/Vacant counts again — still identical to step 2's baseline. Checkout for an OP patient must never touch room state.

7. **Generate the invoice.** Invoices → New Invoice → Patient Invoice → select the patient → confirm it defaults to Out Patient (O/P) and shows no In-Patient Charges section at all (no room/mess/admission fields should be visible anywhere in the form). If ₹0 was agreed, leave all charge fields at 0. Add a note identifying it as test data. Use "Preview & Print" first to check the rendered document safely, then "Save & Print" to actually persist it (expect the tab-freeze gotcha).

8. **Verify the invoice landed correctly.** Invoices Management: Type = OP, correct patient/MRD, and — if ₹0 was used — Total Revenue unchanged from immediately before this invoice (state the before/after numbers in your report).

## Cleanup

With the `window.confirm` override active:
- Delete the OP Case Sheet's Visit Log entry (trash icon next to it) — this one actually can be deleted, unlike IP's discharge/case-sheet records, since `op_visit_notes` docs support deletion in this app.
- Delete the patient (Patient Portal → Delete Patient).

**Cannot be deleted**: the invoice itself. Say so plainly in the report.

## Final report

Step-by-step pass/fail (steps 1–8), anything that didn't match expectations, what got cleaned up vs. what's permanent (just the invoice, here — OP leaves much less residue than IP), and the Total Revenue before/after if ₹0 charges were used.
