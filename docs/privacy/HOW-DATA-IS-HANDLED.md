# How patient data is handled — staff guide

**DRAFT — for the clinic's Data Protection Officer to review and adopt.** Written in plain words for the people who work in the clinic. Technical detail is in `AUDIT.md`.

## 1. The basics
- Patient information is **only for caring for that patient** and running the clinic. Don't open a record out of curiosity — **every record you open is written down** with your name, and the administrator can see who looked at which patient and when.
- Sign in with **your own account**. Never share a password or let someone else use your session. Passwords are at least 12 characters. After 5 wrong tries the account locks for 15 minutes.
- Log out when you leave the computer. Don't leave a patient screen open and unattended.
- Don't put patient names, numbers or diagnoses in chat messages, personal email, screenshots or paper notes outside the clinic.

## 2. What each role can do
| Role | Can see | Can change |
|------|---------|------------|
| Patient | their own record only | their own details, consent, requests |
| Staff (front desk) | patient list and records, queue, payments | bookings, queue, payments, vitals |
| Doctor | patient records | their own consultations, prescriptions, certificates |
| Admin | everything, plus the access log and privacy requests | settings, staff accounts, refunds |

Doctors and staff can open any patient's record (the clinic works that way). If the DPO wants this limited to "patients you are treating", that is a change to ask for.

## 3. Patient privacy requests (do these within the clinic's response time)
- **Consent:** each patient chooses Agree or Decline; they can withdraw in Profile → Privacy. Don't tick for them. If a patient has withdrawn, ask them to agree again before booking new visits.
- **Download my data:** the patient does it themselves (Profile → Privacy). Staff can't download it for someone else.
- **Correction request:** Admin → Settings → Privacy & consent → *Patient data requests*. Fix the record, then **Mark done** (or **Reject** with a reason the patient will read).
- **Deletion request:** medical records must be kept **7 years after the last visit**. The system schedules the request for that date and won't let it be marked done earlier. When the date comes, the admin deletes the record and marks it done.

## 4. Files and documents
Lab results and documents are private. They open only through the app for the patient and clinic staff. Only PDF, JPG, PNG, WebP, GIF, DOC and DOCX files up to 10 MB are accepted — the system checks the actual file, not just its name.

## 5. If you think data has leaked
Examples: a lost/stolen laptop or phone that was signed in, a wrong person received a document, someone used another person's login, a spreadsheet of patients was sent to the wrong address.
1. **Tell the Data Protection Officer immediately** — do not wait to be sure. Write down what happened, when, which patients.
2. Sign the lost device out (Admin can deactivate the account — that also ends its sessions) and change the passwords involved.
3. **The clinic must notify the National Privacy Commission and the affected patients within 72 hours** of learning of a breach involving sensitive personal information (such as health data) that is likely to cause serious harm (NPC Circular 16-03). The DPO decides and files; the 72 hours starts when the clinic knew, so a delay in telling the DPO eats into it.
4. The DPO keeps a record of every incident, even ones not reported.

## 6. Keeping the system safe (for whoever hosts it)
- The server needs these set as **environment variables**, not in files: the database connection, the signing secret (`Jwt__Secret`), the allowed web address (`Cors__AllowedOrigins__0`). In production the API refuses to start on the placeholder secret.
- Serve the site over **HTTPS only**.
- Back up the database and the uploads folder, and keep backups as protected as the live data.
- Keep the access log and sign-in log (Admin → Audit log → Record type "Auth" for sign-ins and failed sign-ins, "Access" for record views; each patient's *Access log* tab).
