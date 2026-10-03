---
name: full-test-agent
description: Full test agent for the Tatva Ayurved HMS — runs the OP → IP conversion test end to end in the Browser pane and reports, field by field, what carried over from the OP Case Sheet into the IP Case Sheet. Use when the user says "run the full test agent", "test the OP to IP conversion", or asks whether all OP details are captured in the IP sheet.
---

# Full Test Agent — OP → IP conversion

Drives the live app (https://tatva-ayurved-hms.vercel.app, or `preview_start dev` if `vercel dev` is available — plain `vite` dev cannot log in for real, Firestore then rejects every write) with a disposable `ZZ Test` patient, fills **every** OP Case Sheet field with a distinct value, converts the patient to IP, imports, saves, reopens, and compares.

## Rules
- The user must sign in themselves in the Browser pane (never type their password). Ask, wait for "logged in".
- Use patient name `ZZ Test FullConv`, Female (so menstrual fields apply), fee 0, fake phone. Leave "Send Welcome SMS" off.
- It writes to the real Firestore; delete the patient at the end (Patient Portal → Delete Patient, with `window.confirm=()=>true`).
- Tell the user it's running against live data before starting; narrate each stage as it happens so they can watch the pane.

## Procedure
1. Patient Portal → Register New Patient: first `ZZ Test`, last `FullConv`, age 34, Female, OP, fee 0. Submit (JS `.click()` on the "Register Patient" button works; wait ~5 s for "Patient Registered"). Click "Back to Patient Portal".
2. Open the row's **Open OP Case Sheet** button (`button[title="Open OP Case Sheet"]`).
3. Install helpers via javascript_exec (React inputs need the native setter + an `input`/`change` event):
```js
window.__modal=()=>[...document.querySelectorAll('.fixed')].pop();
window.__label=(e)=>{let d=e.parentElement;for(let i=0;i<4&&d;i++){const l=d.querySelector('label');if(l)return l.innerText.replace(/\s*from OP\s*$/,'').trim();d=d.parentElement}return e.placeholder||''};
window.__set=(e,v)=>{const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,v);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))};
window.__fillTab=async()=>{const out={};const els=[...__modal().querySelectorAll('input,textarea,select')].filter(e=>!e.readOnly&&!e.disabled&&e.type!=='file'&&e.type!=='checkbox'&&e.offsetParent!==null);for(const e of els){const l=__label(e);if(!l)continue;let v;if(e.tagName==='SELECT'){const o=[...e.options].filter(o=>o.value&&!/^—|Select/.test(o.text));if(!o.length)continue;v=o[0].value}else if(e.type==='number')v='12';else if(e.type==='date'||e.type==='time')continue;else v='ZZ '+l.slice(0,24);__set(e,v);await new Promise(r=>setTimeout(r,15));out[l]=e.value}return out};
```
4. Run `await __fillTab()` on **Initial Assessment**, click the **History & Examination** tab button, wait 800 ms, run it again. Keep both maps (expect ~24 + ~58 fields). Click **Save** (`alert` is auto-dismissed by the pane — override `window.alert` to capture "✅ Case sheet saved!"). Close the modal (icon-only button at top right).
4b. (Optional extension) Visit Log tab: add an entry with a medicine/dose/frequency/days — note the current import does not map it.
5. Edit Patient (`button[title="Edit Patient"]`): set the Patient Type select (the one with an `IP` option and no `all` option) to `IP` via `__set`; confirm "IP Number … will be assigned on save"; click **Update Patient**. Confirm the row now shows an IP-xxxx number and the IP action buttons (Open IP Case Sheet, IP Daily Progress, Discharge…).
6. `button[title="Open IP Case Sheet"]`. Confirm the green banner "This patient has an OP case sheet from <date>" with **Review & import**.
7. Click **Review & import**. Record the dialog text. Click **Everything** (vitals are unticked by default because they're stale by admission — note that). Expand "N OP entries have no matching IP field" and record the unmatched list. Click **Bring N fields into IP sheet**.
8. Confirm highlighted "from OP" fields on the IP tabs, click **Save** (find it with the `find` tool — the header button — if a scripted lookup fails). Close the modal, reopen the IP Case Sheet, then read every populated input on all four tabs (Case Sheet, History & Examination, Investigations & Procedure, Vitals & Daily Log) via `__label`.
9. Compare with the expected mapping below. The banner must be gone after saving.
10. Delete the patient; confirm it left the list.

## Expected mapping (OP label → IP label)
S/D/W/o→Father / Husband Name · Religion · Occupation · Marital Status · Department · Physician→Physician's Name · Presenting Complaints→Roopam · Diagnosis (or Provisional Diagnosis fallback)→Diagnosis · History of Present Illness→History of Presenting Complaints · History of Previous Illness→History of Past Illness · Family History · Medication Details · Treatment Details · Diet · Appetite · Bowel Habits→Bowel · Micturition · Sleep · Known Addictions→Habits / Addiction · Known Allergies→Hypersensitivity · the 8 menstrual fields→one "Menstrual History" line · Systemic Examination→CVS / CNS / RS / LS · DM · HTN · IHD · Hyperlipidemia · Prakrithi→Prakruti · Vayah · Satvam→Satwa · Satmyam→Satmya · Dushyam→Dooshya · Kalam→Kala · Srotas→Srotas Involved · Investigations · attachments · Pulse · BP · Temperature · Height · Weight (vitals).
Also mapped (each has its own IP field): Informant · Socio-Economic Status · Pain Assessment · Immunization History · Thyroid Dysfunction · Other Condition (label) · Other Condition Value · Consciousness · Orientation · Mobility · Vikrithi · Sara · Samhanana · Pramana · Aharasakthi · Vyayamasakthi · Dosham · Agni.
That is 57 import items (52 default-ticked + 5 vitals). The dialog's "no matching IP field" list should now be empty; if it shows entries, report them.

Still not mapped: RR, BMI/nutrition fields, Visit Log entries, the duplicated "Others" fields (they aren't in the dialog's unmatched list either).

## Report
Per step pass/fail; a table of every mapped field (OP value → IP value → ✓/✗); the unmatched list; anything unexpected; what was cleaned up. Any mapped field that is missing or different after save is a failure.
