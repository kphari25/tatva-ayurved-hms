---
name: full-test-agent
description: Full test agent for the Tatva Ayurved HMS — drives the live app in the Browser pane with disposable "ZZ" data and reports pass/fail. Suite A tests the OP → IP conversion field by field (OP Case Sheet → IP Case Sheet import). Suite B tests internal liquid (ml) usage tracking — bottle size in the Manual Entry grid and Add Medicine, the Used (ml) deduction from the IP Daily Log and OP Visit Log, edit/delete reversal, restocking and Usage History. Suite C tests Patient Category (General/PNC) — registration field, Patient Portal column, filter and inline dropdown, persistence. Suite D tests the Reports — patient counts (OP/IP/New/Return/PNC), the 1 Month / 3 / 6 / custom ranges, clickable drill-downs, and the Patients by Doctor report. Use when the user says "run the full test agent", "test the OP to IP conversion", "test the liquid/ml usage", "test the reports", "test patient category / PNC", or asks whether report counts reconcile. With no suite named, run all four.
---

# Full Test Agent

Drives the live app (https://tatva-ayurved-hms.vercel.app, or `preview_start dev` only if `vercel dev` is available — plain `vite` dev cannot log in for real, and Firestore then rejects every write) using disposable `ZZ ...` data, and reports a pass/fail summary. Four suites:

- **Suite A — OP → IP conversion** (all OP Case Sheet details carried into the IP Case Sheet)
- **Suite B — Liquid (ml) usage tracking** (internal stock tracking, never billed or printed)
- **Suite C — Patient Category** (General / PNC on registration, the Patient Portal list, filter, inline dropdown)
- **Suite D — Reports** (patient counts, date ranges, drill-downs, Patients by Doctor)

## Rules (all suites)
- The user must sign in themselves in the Browser pane (never type their password). Ask, wait for "logged in". If a navigation opens a fresh tab, the session usually persists; if the login page shows, ask again.
- It writes to the **real Firestore**. Say so before starting, narrate each stage so the user can watch the pane, and delete every `ZZ` record at the end (patients: Patient Portal → Delete Patient; inventory items: Inventory → expand row → Delete; both with `window.confirm=()=>true`). Verify Inventory "Total Items" is back to what it was.
- Never deploy/commit as part of a test run. Never leave a `ZZ` item or patient behind; if a step fails midway, still clean up.
- Leave "Send Welcome SMS" off. Fake phones like `99999000xx`. Registration fee 0.

## Pane gotchas (learned the hard way)
- React inputs need the native setter + an `input`/`change` event. Install once per page load (a reload wipes it):
```js
window.__set=(e,v)=>{const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,v);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))};
window.__modal=()=>[...document.querySelectorAll('.fixed')].pop();
window.__alerts=[];window.alert=(m)=>window.__alerts.push(m);window.confirm=()=>true;   // the pane silently dismisses native dialogs — capture them instead
```
- **Printing freezes the pane** (discharge summary preview auto-prints on load; "Save & Print" buttons call `window.print()`). Avoid them. To inspect a print preview safely, before opening it run `Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{configurable:true,get(){return {focus(){},print(){window.__printBlocked=true}}}})`, then read `iframe.contentDocument.body.innerText`. If the pane does freeze: open a new tab (`tabs_create`), close the old one, and navigate again.
- **Key presses race with `javascript_exec`.** After a batch of `computer key`/`type` actions, add a `wait` (≥1 s) before reading `document.activeElement`, or digits you type next land in the wrong cell. For multi-step keyboard tests do one key per step, then wait, then check. For plain data entry, setting values with `__set` is fine and much faster.
- Layout shifts: e.g. choosing Treatment Days ≥ 2 in the OP Visit Log inserts a notice banner and moves the medicine row down — re-screenshot before clicking by coordinate.
- Icon-only buttons (close X, trash, pencil) have no text: find the close button with `b.querySelector('svg')&&!b.innerText.trim()&&b.getBoundingClientRect().top<200`; for Visit Log entry delete/edit, screenshot and click the entry's own pencil/bin (the form's medicine-row trash icons look the same and match a generic selector).
- After a save, lists reload asynchronously — wait 3–5 s (retry a read once) before concluding something didn't save. To tell whether a save fired, check `window.__alerts`, not old console history.
- **Reports screen**: it loads ~8 collections, so wait ~8–9 s after opening it before reading (a spinner says "Loading report data…"). Reports is read-only — it needs no cleanup. Range buttons are plain buttons (`1 Month`, `Last 3 Months`, `Last 6 Months`, `Last 12 Months`, `This Year`, `Custom`); Custom shows two `input[type=date]` — set both with `__set` (`dates[0]` from, `dates[1]` to). Clickable counts have `title="Click to see the patients"`; the drill-down is the topmost `.fixed` modal (close with its icon-only X). Clicking a row in it fires the `viewPatient` event and lands on Patient Details.
- **Patient Portal**: the default Active tab hides inactive/discharged patients; search (`input[placeholder^="Search by name"]`) searches across all of them. Row action buttons are found by `title` (`Edit Patient`, `Delete Patient`, …); the category dropdown is `select[title="Change patient category"]`.
- Searching the Inventory list: `__set(document.querySelector('input[placeholder^="Search"]'), 'ZZ ...')`, wait ~3 s; clicking a row (`tr`) expands it. Total Items shows in the header.

---

# Suite A — OP → IP conversion

Fills **every** OP Case Sheet field with a distinct value, converts the patient to IP, imports, saves, reopens, and compares. Patient: `ZZ Test FullConv`, Female (so menstrual fields apply).

## Procedure
1. Patient Portal → Register New Patient: first `ZZ Test`, last `FullConv`, age 34, Female, OP, fee 0. Submit (JS `.click()` on the "Register Patient" button works; wait ~5 s for "Patient Registered"). Click "Back to Patient Portal".
2. Open the row's **Open OP Case Sheet** button (`button[title="Open OP Case Sheet"]`).
3. Install the fill helpers (in addition to the common ones above):
```js
window.__label=(e)=>{let d=e.parentElement;for(let i=0;i<4&&d;i++){const l=d.querySelector('label');if(l)return l.innerText.replace(/\s*from OP\s*$/,'').trim();d=d.parentElement}return e.placeholder||''};
window.__fillTab=async()=>{const out={};const els=[...__modal().querySelectorAll('input,textarea,select')].filter(e=>!e.readOnly&&!e.disabled&&e.type!=='file'&&e.type!=='checkbox'&&e.offsetParent!==null);for(const e of els){const l=__label(e);if(!l)continue;let v;if(e.tagName==='SELECT'){const o=[...e.options].filter(o=>o.value&&!/^—|Select/.test(o.text));if(!o.length)continue;v=o[0].value}else if(e.type==='number')v='12';else if(e.type==='date'||e.type==='time')continue;else v='ZZ '+l.slice(0,24);__set(e,v);await new Promise(r=>setTimeout(r,15));out[l]=e.value}return out};
```
4. Run `await __fillTab()` on **Initial Assessment**, click the **History & Examination** tab button, wait 800 ms, run it again. Keep both maps (expect ~24–26 + ~58 fields). Click **Save**, confirm "✅ Case sheet saved!" in `__alerts`. Close the modal.
4b. (Optional) Visit Log tab: add an entry with a medicine — note the current import does not map Visit Log entries.
5. Edit Patient (`button[title="Edit Patient"]`): set the Patient Type select (the one with an `IP` option and no `all` option) to `IP` via `__set`; confirm "IP Number … will be assigned on save"; click **Update Patient**. Confirm the row shows an IP-xxxx number and the IP action buttons (Open IP Case Sheet, IP Daily Progress, Discharge…).
6. `button[title="Open IP Case Sheet"]`. Confirm the green banner "This patient has an OP case sheet from <date>" with **Review & import**.
7. Click **Review & import**. Record the dialog text. Click **Everything** (vitals are unticked by default because they're stale by admission — note that). Expand "N OP entries have no matching IP field" if present and record the list. Click **Bring N fields into IP sheet**.
8. Confirm highlighted "from OP" fields, click **Save** (the header button; use the `find` tool if a scripted lookup fails). Close the modal, reopen the IP Case Sheet, then read every populated input on all four tabs (Case Sheet, History & Examination, Investigations & Procedure, Vitals & Daily Log) via `__label`.
9. Compare with the expected mapping below. The banner must be gone after saving.
10. Delete the patient; confirm it left the list.

## Expected mapping (OP label → IP label)
S/D/W/o→Father / Husband Name · Religion · Occupation · Marital Status · Department · Physician→Physician's Name · Presenting Complaints→Roopam · Diagnosis (or Provisional Diagnosis fallback)→Diagnosis · History of Present Illness→History of Presenting Complaints · History of Previous Illness→History of Past Illness · Family History · Medication Details · Treatment Details · Diet · Appetite · Bowel Habits→Bowel · Micturition · Sleep · Known Addictions→Habits / Addiction · Known Allergies→Hypersensitivity · the 8 menstrual fields→one "Menstrual History" line · Systemic Examination→CVS / CNS / RS / LS · DM · HTN · IHD · Hyperlipidemia · Prakrithi→Prakruti · Vayah · Satvam→Satwa · Satmyam→Satmya · Dushyam→Dooshya · Kalam→Kala · Srotas→Srotas Involved · Investigations · attachments · Pulse · BP · Temperature · Height · Weight (vitals).
Also mapped (each has its own IP field): Informant · Socio-Economic Status · Pain Assessment · Immunization History · Thyroid Dysfunction · Other Condition (label) · Other Condition Value · Consciousness · Orientation · Mobility · Vikrithi · Sara · Samhanana · Pramana · Aharasakthi · Vyayamasakthi · Dosham · Agni.
That is 57 import items (52 default-ticked + 5 vitals). The dialog's "no matching IP field" list should be empty; if it shows entries, report them.

Still not mapped: RR, BMI/nutrition fields, Visit Log entries, the duplicated "Others" fields.

---

# Suite B — Liquid (ml) usage tracking

Internal-only stock tracking for liquids sold/used in part (oils, thailam). Model (see `src/lib/liquidUsage.js`): an item with a **bottle size** (`pack_size`, ml) keeps `stock_quantity` = *sealed* bottles and `open_balance` = ml left in the opened bottle; total ml = sealed × size + open. Daily-log medicine rows get an amber **Used (ml)** column for such items; saving deducts from the open bottle (opening the next sealed bottle, earliest-expiry batch first, when needed) and writes one `inventory_usage` doc per row, shown in the item's **Usage History**. Editing an entry replaces its usage; deleting it gives the oil back. Nothing appears on invoices or printed documents.

Disposable data: inventory items `ZZ ...` (e.g. `ZZ Test Oil`, code `ZZTO1`), patients `ZZ Test Oil…` (IP and OP). Note the starting "Total Items" count.

## B1 — Bottle size when adding items
1. Inventory → Add Medicine → **Single Entry Form**: confirm the "Bottle Size (liquids only)" field (ml). (Optionally add a `ZZ` item here: category Ayurvedic Oils, purchase 50, MRP 80, stock 3, bottle size 100, batch `ZZB1`, expiry 2027-06-30.)
2. Add Medicine → **Manual Entry** grid: confirm the header has **Bottle Size (ml)** right after **Stock Qty**, and that **Enter** on Stock Qty → Bottle Size → Entry Date (one key per step, wait, check `document.activeElement.getAttribute('data-cell')`; columns are 0 name, 1 code, 2 batch, 3 manufacturer, 4 HSN, 5 purchase, 6 MRP, 7 discount, 8 GST, 9 stock, 10 bottle size, 11 entry date).
3. Fill row 1 as a liquid (stock 2, bottle size 100) and row 2 as an ordinary item (stock 5, bottle size blank) with `__set` on `[data-cell="r-c"]`, click **Save 2 to Inventory**; alert should read "2 new medicines added". Search the list: the liquid must read **"2 sealed + 0 ml open · 200 ml total"**, the ordinary item **"5 Nos"** (no ml tracking).

## B2 — Restocking existing items from the grid
4. Open the grid, type `ZZ ...` in Medicine Name, ArrowDown, Enter (or click) to pick the liquid: the row turns green (title "Existing item — stock will be added to it") and **Bottle Size prefills** 100. Set a new batch code, stock 1, Save → "0 new, 1 existing restocked". The item must read **3 sealed + 0 ml open · 300 ml**, and its Purchase History must list both batches.
5. Item **with no bottle size yet**: create an ordinary `ZZ` item (stock 2), then restock it via the grid typing bottle size 100 and stock 1 → must become "3 sealed + 0 ml open · 300 ml" (existing units are reinterpreted as sealed bottles — report that).
6. Restock the same item once more but overwrite the prefilled size with 250 → size must stay 100 (4 sealed · 400 ml, not 1000 ml).

## B3 — IP Daily Log deduction (two patients, like patient 1 = 25 ml, patient 2 = 50 ml)
7. Register two IP patients (`ZZ Test OilOne`, `ZZ Test OilTwo`: type IP, fee 0). Both show "Pending Admission" — that is fine. Use the row's **IP Daily Progress** button (`button[title="IP Daily Progress"]`).
8. In the Medicines Given table click the Medicine field, **type** `ZZ ...` (real typing so the suggestion list appears), click the suggestion. The amber **Used (ml)** column must appear with placeholder `of 100` and "3 sealed + 0 ml open" beneath. Type 25, **Save Record** (wait ~7 s; History count goes to 1).
9. Patient 2: the row must now read "2 sealed + 75 ml open" before typing; enter 50, save.
10. Inventory → the item reads **2 sealed + 25 ml open · 225 ml total**; expanded **Usage History** lists both patients (IP number shown), source "IP Daily Log", batch, 25 ml and 50 ml.
11. Delete both daily records (trash icon on each Progress History entry) → item back to **3 sealed + 0 ml open · 300 ml**, Usage History empty.

## B4 — OP Visit Log deduction, edit and pre-scheduling
12. Register an OP patient (`ZZ Test OPOil`, fee 0). **Open OP Case Sheet** → **Visit Log** tab.
13. Set **Treatment Days = 2** (select; this shows a banner and shifts the layout). Pick the `ZZ` liquid in the medicine row — **Used (ml)** column appears. Enter 25, click **Add 2 Entries**. Two entries appear (today = Day 1, tomorrow = Day 2).
14. Inventory: **only Day 1 deducted** → 2 sealed + 75 ml open (275 ml); Usage History has a single line, source **OP Visit Log**. (Future-dated Day 2 must not deduct.)
15. Back in the Visit Log, click the **pencil** on Day 1; the saved 25 shows in the Used (ml) box. Change to 40, **Update Entry**. Item must read **260 ml** (2 sealed + 60 ml open) with one usage line of 40 ml — replaced, not added.
16. Delete both entries with their own bin icons (screenshot first; see gotchas). Item back to **3 sealed + 0 ml open · 300 ml**, Usage History empty.

## B5 — Not covered unless explicitly asked
Opening a second bottle when the first runs out, a shortage (usage > on-hand shows "short X"), discharge-summary medicine table (must NOT deduct), Medicine Sale of sealed bottles, pasting Excel data into the new Bottle Size column. `liquidUsage.js` core can be sanity-checked offline by extracting `consume`/`restore` into a scratch `.mjs` and running with node (e.g. 100 ml bottle: 25 → 75 open, 50 → 25 open, then 40 opens the next bottle: 1 sealed + 85 open).

## Cleanup (Suite B)
Delete the OP patient and both IP patients; delete the `ZZ` inventory items (expanded row → **Delete**); confirm "Total Items" equals the starting count. Usage docs for deleted entries are already reversed; none should remain.

---

# Suite C — Patient Category (General / PNC)

`patient_category` is a patient field ('General' default, or 'PNC'). It is set on registration/Edit Patient, shown and editable inline in the Patient Portal list, and feeds the PNC count in Suite D. (It does not belong on the inventory Manual Entry grid — that grid is for medicines.)

Disposable data: patient `ZZ Test PNCCat` / `ZZ Test CatInline`; note Patient Portal "Total Patients" first.

1. **Registration form:** Patient Portal → Register New Patient: confirm **Patient Category** (General / PNC (Post-Natal Care)) right after Patient Type, default General. Register `ZZ Test PNCCat` (Female, 29, fee 0) with category **PNC** (`__set` on the select found via its label).
2. **List column:** in Patient Portal the table header must read `MRD / IP NO., NAME, AGE/GENDER, TYPE, CATEGORY, CONTACT, REGISTRATION DATE, STATUS, ACTIONS`. Switch to **All Patients** and confirm every untouched patient shows General (a patient without the field counts as General) and `ZZ Test PNCCat` shows PNC (pink).
3. **Filter:** the "All Categories" dropdown offers All / General / PNC. PNC → only PNC patients (initially just the ZZ patient, unless real ones were marked); General → excludes it; General + PNC = All.
4. **Inline dropdown:** register a second patient `ZZ Test CatInline` (General). In its row, `select[title="Change patient category"]` must show General with options General/PNC; set it to **PNC** → it saves immediately (no alert, dropdown turns pink). **Reload the page** (`navigate`) and re-search: still PNC (proves it was written to Firestore).
5. **Flows into Reports:** Reports → **1 Month** → **PNC Patients** card count must include the ZZ patients (compare before/after if a baseline was taken; open the card's list and see them with a PNC badge). See Suite D.
6. **Switch back:** set `ZZ Test CatInline` back to General (value persists), then delete both ZZ patients; Total Patients returns to its starting number.
Not covered unless asked: the save-failure rollback of the inline dropdown.

---

# Suite D — Reports (patient counts, ranges, drill-down, doctors)

Read-only against live data, so no cleanup. Definitions (see `src/lib/patientReport.js`): a patient is **seen** in a range if they are **New** (registered inside the range) or **Return** (registered before the range but visited in it — last visit date, an admission, or a checked-in appointment). Each patient counts once. **PNC** = Patient Category PNC *or* a diagnosis (OP/IP case sheet, discharge summary) containing "PNC"/"post natal". Doctor = the patient's assigned doctor, with spelling variants merged to the HR/user doctor list.

Open Reports (sidebar), wait ~9 s. Record every number.

1. **Range controls:** buttons `1 Month`, `Last 3 Months`, `Last 6 Months`, `Last 12 Months`, `This Year`, `Custom` all exist; the info line reads "Patients seen in <range>…".
2. **Invariants (must hold for every range tried — check at least Last 6 Months, 1 Month and a Custom month such as the previous full month):** Patients Seen = OP + IP = New + Return. The Monthly Breakdown row for a month that is fully inside the range equals the Custom result for exactly that month (e.g. custom 1–30 Sep ⇒ same six numbers as the "Sept 2026" row of the 6-month view). Note that Return can be 0 for a long range even when its monthly rows show some (Return is relative to the period chosen).
3. **Cards → drill-down:** click each card (Patients Seen / OP / IP / New / Return / PNC). The list's title and "N patients" subtitle must equal the card number, its row count must equal N, and the rows must all satisfy the filter (OP card ⇒ every Type = OP, Return card ⇒ every row Return, PNC card ⇒ every row shows PNC). Columns: Patient, MRD / IP, Type, New / Return, Category, Doctor, Registered, Last Visit, Phone. Test the search box (type a name → filtered rows) and, if wanted, Export (downloads an .xlsx — only click it if the user agreed to a download).
4. **Click-through:** click a patient row in a drill-down → the app jumps to Patient Portal and opens that patient's **Patient Details** modal (name/MRD match); close it and return to Reports.
5. **Monthly table:** counts in the table are clickable links (underlined) that open that month's list; zero counts are plain "0".
6. **Patients by Doctor tab:** select the same range. Cards: Patients Seen (must equal the Patient Reports total), Doctors, Busiest Doctor, Unassigned. The "Distribution by Doctor" table: **the Patients column of all doctor rows must sum to the Total row, and the Total row must equal Patients Seen**; Share % sums to 100; each doctor's OP + IP = Patients and New + Return = Patients. Click a doctor name → list whose title/subtitle count equals that doctor's Patients number and whose Doctor column is that one doctor only. Click a count cell (e.g. PNC for one doctor) → that filtered subset.
7. **Doctor name merging:** the same person must not appear on several rows because of spelling (e.g. "Dr. Satheesh" / "Dr. Satheesh Kumar" / "Dr. C . Satheesh Kumar" ⇒ one row; "Dr. shruthi" / "Dr. sruthy" ⇒ Dr. Sruthi Muralidharan). Report any near-duplicate rows as a failure; a genuinely different name staying separate is fine. Patients with no doctor appear as **Unassigned**.
8. **PNC detection:** the PNC card must include patients whose diagnosis says PNC even though their Category is still General (e.g. Mrs. Nasriyath, whose discharge summary diagnosis is PNC), and any patient set to PNC in Suite C.
9. **1 Month:** shows the current calendar month so far; its numbers equal the matching month row in the Last 3/6 Months views for the portion of that month up to today.
10. **Inventory Reports tab** is untouched by these changes — one glance that it still renders is enough.

Failure examples to watch for: card number ≠ list length, OP + IP ≠ total, doctor rows not summing to the total, a patient in the OP list showing IP, a drill-down click that does nothing, the Reports page stuck on "Loading report data…" (check the console for Firestore permission errors).

---

## Report
Per step pass/fail. Suite C: the category value at each step (form → list → filter → inline → after reload → in Reports). Suite D: the numbers read at each range, the invariant checks (✓/✗ with the actual figures), drill-down count vs card count, the doctor table with its sum check, and any near-duplicate doctor rows. Suite A: a table of every mapped field (OP value → IP value → ✓/✗), the unmatched list, anything unexpected. Suite B: the stock line (sealed + open · total ml) after each step against the expected value, Usage History rows, and any step that needed a retry because of pane timing (say so — don't count it as an app failure unless it reproduces). Finish with what was cleaned up and the final Total Items count. Any mapped field missing/different after save, or any stock figure that doesn't match, is a failure.
