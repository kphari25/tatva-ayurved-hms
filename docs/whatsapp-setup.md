# WhatsApp setup — Tatva Ayurved HMS

How WhatsApp messaging works in this app, how it was set up with Meta, and what to do when something goes wrong. **No secrets are stored here** — the access token lives only in Vercel's environment variables, and the two-step verification PIN is kept by the clinic owner.

Last verified working: 19–20 October 2026 (messages delivered to India and US numbers).

---

## 1. What it does

Staff can send patients (and doctors) WhatsApp messages from the HMS. Every send goes through a **confirm-before-send dialog** that shows the number and the exact message; nothing is sent until the person presses **Send**.

| Where in the app | Who gets it | Template used |
|---|---|---|
| Dashboard → Add Appointment (and the existing-patient booking step) — "Send WhatsApp confirmation to patient" | Patient | `appointment_confirmation` |
| Dashboard → same form — "Send WhatsApp to doctor" (uses the number on the doctor's staff record) | Doctor | `doctor_appointment_notice` |
| Dashboard appointment cards — WhatsApp icon | Patient | `appointment_confirmation` |
| Patient Portal → Schedule Appointment — patient / doctor checkboxes, then **Send WhatsApp** on each row of the confirmation screen | Patient, doctor | `appointment_confirmation`, `doctor_appointment_notice` |
| Invoice window (Invoices → New Invoice → Patient Invoice) — **WhatsApp** button | Patient | `invoice_generated` |
| Invoices list — **WhatsApp** button on each saved invoice, and in the View Invoice window (with **Attach the invoice PDF**, see §7) | Patient | `invoice_generated`, or `invoice_copy` with the PDF |
| Registration success screen — **Send Welcome on WhatsApp** (only if the patient ticked the WhatsApp consent box) | Patient | `registration_confirmation` |
| Patient → **Message** button (free text) | Patient | none — free text; Meta only delivers it inside 24 h of the patient's last message, otherwise the app falls back to the one-click chat |

### Two modes
- **Automatic (API) mode** — `VITE_WHATSAPP_API_ENABLED=true`. The dialog's button says **Send** and delivers the approved template through the WhatsApp Business Cloud API. If that fails, the dialog offers **Open WhatsApp instead**.
- **One-click mode** — flag `false`/unset. The button says **Open WhatsApp** and opens a pre-filled `wa.me` chat for staff to press Send themselves (works with no Meta approval).

### Phone numbers
A number written **with a country code** (`+1 732 207 9036`, `00…`, or 11+ digits such as `966506163596`) is used as given. A plain **10-digit** number — or one with a leading 0 — is treated as Indian (+91). The same rule is in `api/send-whatsapp.js` and `src/lib/whatsapp.js` (`toWhatsAppNumber`). Keep them in step.

---

## 2. Meta setup (what exists)

| Item | Value |
|---|---|
| Business portfolio | Tatvaayurved (business verified) |
| WhatsApp Business Account (WABA) | ID `1783264252791974`, currency INR |
| Sending number | +91 81378 47270, **phone number ID `1468821816308247`**, display name `TatvaAyurved` |
| Platform | Cloud API, account mode LIVE |
| Meta system user | `tatvahms` (Admin) — owns the permanent access token |
| Developer app | linked to the portfolio; `whatsapp_business_messaging` + `whatsapp_business_management` |
| Payment method for message charges | Card on the WABA — see *Billing* below |

There is also a free **Test WhatsApp Business Account** with Meta's test number; it is not used in production.

### Billing
The card that pays Meta for messages is on the **WhatsApp account**, visible at **business.facebook.com → Billing & payments → WhatsApp Business accounts** (and in the account's *Summary* tab → Payment method). **WhatsApp Manager → Payment configurations** is *not* this — that page is for *receiving* customer payments.

### The access token
Created under **Business settings → Users → System users → `tatvahms` → Generate token**, app = the developer app, expiration **Never**, permissions `whatsapp_business_messaging` and `whatsapp_business_management`. Meta shows it once. To rotate: **Revoke tokens**, generate a new one, update `WHATSAPP_ACCESS_TOKEN` in Vercel, redeploy.

---

## 3. Vercel environment variables

Set in Vercel → project → Settings → Environment Variables, then **Redeploy** (values are read at build/deploy time).

| Variable | Type | Purpose |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | **Secret** (no `VITE_` prefix — server only) | System-user token |
| `WHATSAPP_PHONE_NUMBER_ID` | Config | `1468821816308247` |
| `WHATSAPP_API_VERSION` | Config | e.g. `v25.0` |
| `VITE_WHATSAPP_API_ENABLED` | Config (browser-visible on purpose) | `true` = automatic mode, `false` = one-click |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Config, optional | WABA ID, used only by the status check |
| `VITE_WHATSAPP_INVOICE_PDF_ENABLED` | Config | `true` once the `invoice_copy` template is approved — turns on the "Attach the invoice PDF" option (needs automatic mode on too) |

Never put the token in a `VITE_` variable — that would expose it in the browser bundle.

---

## 4. Approved message templates

Created in **WhatsApp Manager → Message templates**. All are **Utility**, language **English** (`en`). The app sends them *by name* with the variables in this exact order — **changing a template's variable count or order needs a code change** in `src/lib/whatsapp.js`.

| Name | Variables (in order) | Approved text |
|---|---|---|
| `registration_confirmation` | 1 name, 2 patient ID | Hello {{1}}, your registration at Tatva Ayurved has been recorded under patient record number {{2}}. Our front desk team will assist you with your visit. |
| `invoice_generated` | 1 name, 2 date, 3 type (OP/IP), 4 total, 5 payment mode, 6 patient ID | Dear {{1}}, your invoice dated {{2}} ({{3}}) has been generated. Total amount: Rs.{{4}}. Payment mode: {{5}}. Patient ID: {{6}}. For any queries, please contact Tatva Ayurved. |
| `appointment_confirmation` | 1 name, 2 type, 3 date, 4 time, 5 doctor | Dear {{1}}, your {{2}} at Tatva Ayurved is scheduled on {{3}} at {{4}} with {{5}}. Please arrive 10 minutes early. |
| `doctor_appointment_notice` | 1 doctor, 2 patient, 3 MRD no., 4 type, 5 date, 6 time, 7 notes | Hello {{1}}, an appointment is scheduled. Patient: {{2}} ({{3}}). Type: {{4}}. Date: {{5}} at {{6}}. Notes: {{7}}. Please check the schedule for details. |

| `invoice_copy` | header = PDF document; 1 name, 2 invoice no., 3 date, 4 total | Dear {{1}}, please find attached your invoice {{2}} dated {{3}} from Tatva Ayurved. Total amount: Rs.{{4}}. For any queries, please contact Tatva Ayurved. |

`welcome_patient` was rejected (Meta classed it as Marketing) — it is unused.

### Rules Meta enforced (learned the hard way)
- A template **cannot start or end with a variable** (a closing sentence after the last variable fixes it).
- Wording like "welcome" / "thank you for choosing" gets re-classed as **Marketing** (and a rejected template can't be edited — create a new one under a new name).
- Text that looks like a code ("Patient ID: {{2}}. Please quote this ID…") was flagged as **Authentication**; phrasing it as a "patient record number" passed.
- Editing an approved template sends it back to *In review*.

### Changing wording
- **Automatic messages:** edit the template in WhatsApp Manager and resubmit; keep the variables unchanged, then update the matching preview text in `TEMPLATE_BODIES` in `src/lib/whatsapp.js` so the confirmation dialog shows the right text. Adding/removing a variable = new template name + code change.
- **One-click messages:** plain text in `src/lib/whatsapp.js` (`welcomeMessage`, `invoiceMessage`, `appointmentMessage`, `doctorAppointmentMessage`) — no Meta approval needed.

---

## 5. Code map

| File | Role |
|---|---|
| `api/send-whatsapp.js` | Login-protected serverless function that posts a template or text to Meta's Graph API; normalises the phone number |
| `api/whatsapp-status.js` | Login-protected, **read-only** diagnostics: number health, review state, list of templates |
| `src/lib/whatsapp.js` | Template builders + previews (`TEMPLATE_BODIES`), `toWhatsAppNumber`, one-click helpers, `whatsappApiEnabled` |
| `src/components/WhatsAppSendDialog.jsx` | The confirm-before-send dialog used everywhere |
| Dashboard / Patient Portal / Invoice / Invoices list / Registration components | Open the dialog from their WhatsApp buttons |

Consent: registration saves `whatsapp_consent` and `whatsapp_consent_at` on the patient. Only the registration welcome is gated on it; appointments and invoices are not.

---

## 6. Troubleshooting

### Number shows "Pending" and sends fail with `(#133010) Account not registered`
The number was added but **never registered for the Cloud API** — separate from the display-name review. Fix: a one-time `POST https://graph.facebook.com/<version>/<phone-number-id>/register` with body `{"messaging_product":"whatsapp","pin":"<6 digits>"}` using the system-user token. The PIN also becomes the number's two-step verification PIN (keep it private). This was done on 19 Oct 2026; it only needs repeating if the number is moved/re-registered. (A temporary login-protected function did it and was then deleted — see git history for `api/register-whatsapp.js`.)

### Is Meta blocking sending? Check the number's health
From the browser console while logged in to the app:

```js
const tok = localStorage.getItem('sessionToken');
const r = await fetch('/api/whatsapp-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
  body: JSON.stringify({ wabaId: '1783264252791974' }),          // add action: 'templates' to list templates
});
console.log(await r.json());
```
Look for `health_status.can_send_message: "AVAILABLE"`, `status: "CONNECTED"`, `name_status: "APPROVED"`, `platform_type: "CLOUD_API"`. (SIP/calling errors and "not subscribed to the message webhook" are harmless.)

### Meta says "success" but the message never arrives
"Accepted" ≠ "delivered". Delivery failures are only reported by webhook, which this app does not receive. Check, in order: the recipient number is really on WhatsApp (and has the right country code — see the phone rule above); the card is on the **WABA** (see *Billing*); the template is **Active**; then the health check above.

### The login session expires quickly
The app now logs out after 15 minutes of inactivity; the send functions need a valid session token, so log in again before testing from the console.

### "Unable to access Meta Business Suite with this account"
Wrong Meta tool (it needs a Facebook Page). Use the direct addresses instead: `business.facebook.com/settings` (business settings, system users), `business.facebook.com/wa/manage` (WhatsApp Manager), `developers.facebook.com`.

### Meta support
WhatsApp Manager → **Overview → Resources → Contact support**. Quote the phone number ID and WABA ID above. Meta has no phone support for this.

---

## 7. Sending an invoice copy (PDF)

On a **saved** invoice (Invoices list, the View Invoice window, or the invoice window after *Save & Print*) the WhatsApp dialog offers **Attach the invoice PDF** (ticked by default). Sending then:
1. `src/lib/invoicePdf.js` renders the invoice in the browser exactly as it prints (A4) and turns it into a PDF (html2canvas + jsPDF, loaded on demand; long invoices become multi-page).
2. `api/send-whatsapp-document.js` (login-protected) uploads that PDF straight to Meta's media endpoint — there is **no public link** to the invoice; Meta keeps the file 30 days — and sends the `invoice_copy` template with the PDF as its header.

Requires the **`invoice_copy`** template (Utility, English, header type **Document**, a sample PDF is needed when creating it) to be **Approved**, and `VITE_WHATSAPP_INVOICE_PDF_ENABLED=true`. Unticking the box sends the normal `invoice_generated` text message instead. On an unsaved invoice the option is hidden with a hint to save first. If the send fails, the response includes the stage (`upload` or `send`) and, for a send failure, the uploaded `mediaId`, which shows that the upload itself worked.

---

## 8. Known limits / possible future work
- **No delivery reports.** Receiving statuses and replies needs a webhook, and Meta only sends real data to a **published (Live)** developer app.
- **No scheduled reminders** (e.g. day-before appointment reminders) — would need a scheduled job and one more approved template.
- **Consent** is enforced only on the registration welcome.
- International messages cost more per message than India's; the clinic's card on the WABA pays Meta.
