# Traveler Health Declaration Web (DHIS2‑Powered)

This repository contains a single‑page web portal for collecting **Traveler Health Declarations** and syncing them with **DHIS2 Tracker**. The portal is a thin client: it reads/writes travelers (TEIs), enrollments, and events directly to DHIS2 via the Tracker API v40. All analytics and risk classification logic live in DHIS2.

Here’s a clean, fixed snippet you can paste in:

* **New submission:** create or update a traveler, then post Travel + Clinical events.
* **Edit a current declaration:** find and update an in-progress declaration.
* **Get my QR code:** render a QR with traveler identifiers and risk classification (optionally signed & compressed).
* **Powered by DHIS2:** the UI and logic are driven by DHIS2 metadata, and all data is stored in DHIS2 (which also powers analytics).

   * “Countries visited in the last 21 days” comes from a DHIS2 **Option Group**.
   * The **Clinical** step maps to the **Pre-Clinical Data** program stage.
   * **Risk classification** is assigned by three DHIS2 **Program Rules** (GREEN / YELLOW / RED).
* **Duplicate protection:** blocks new submissions when a current/future arrival already exists, and offers to continue in **Edit**.


---

## Table of Contents

- [What this web is](#what-this-web-is)
- [User options](#user-options)
  - [New submission](#new-submission)
  - [Edit a current declaration](#edit-a-current-declaration)
  - [Get my QR code](#get-my-qr-code)
- [End‑to‑end flow](#end-to-end-flow)
- [Validation & UX](#validation--ux)
- [Identity search & de‑duplication](#identity-search--de-duplication)
- [Duplicate submission blocker](#duplicate-submission-blocker)
- [Edit retrieval blocker](#edit-retrieval-blocker)
- [Powered by DHIS2](#powered-by-dhis2)
  - [Configurable metadata](#configurable-metadata)
  - [DHIS2 as backend + analytics](#dhis2-as-backend--analytics)
- [Data mapping (TEAs & DEs)](#data-mapping-teas--des)
- [API patterns](#api-patterns)
- [QR code (current & signed plan)](#qr-code-current--signed-plan)
- [Admin cookbook](#admin-cookbook)
- [Appendix: IDs to configure](#appendix-ids-to-configure)

---

## What this web is

A guided, mobile‑friendly portal where travelers provide **Personal**, **Travel**, and **Clinical** information. The app writes everything to **DHIS2 Tracker**:

- **TEI (Tracked Entity Instance)** → the traveler (names, passport, phone, sex, DOB, nationality, guardians).
- **Program** → the Traveler Health Declaration.
- **Program Stages / Events**:
  - **Travel Information** (arrival date, airline/flight, departure country/city, visited countries).
  - **Pre‑Clinical Data** (the entire Clinical step; questions come from DHIS2 metadata).
- **Program Rules** → derive **risk classification** server‑side after submission.

There is **no custom backend** beyond the app itself; DHIS2 is the system of record and analytics platform.

---

## User options

### New submission

Four steps, with validation and progress state:

1) **Personal data**
   - First, middle, last name (Unicode; last name allows **one** space for double surnames).
   - Date of birth → computes **minor** (<18) status.
   - Sex (3‑button segmented control: Male / Female / –).
   - Passport, Phone (digits + optional leading “+”), Nationality.
   - **Guardian name & phone** (required if minor).

2) **Travel Information**
   - Purpose of travel.
   - Airline (catalog or “Other” + free text).
   - Flight number, seat.
   - Departure **country** and **city**.
   - Arrival date.
   - **Visited countries (21 days)** from a DHIS2 Option Group.

3) **Clinical**
   - Dynamically rendered from the DHIS2 **Pre‑Clinical Data** program stage.
   - Add/remove/reorder/compulsory/option sets are all metadata‑driven in DHIS2.

4) **Summary & Submit**
   - Read‑only summary + legal consent.
   - On submit, identity is matched; data is posted; program rules run and the risk is then available for QR generation.

### Edit a current declaration

Find and continue an **in‑progress** declaration:
- Enter **Declaration ID** (token) **OR** **Last name + Passport**.
- The app hydrates personal attributes and the **latest** Travel + Clinical events.
- If the saved **arrival date** is **in the past**, editing is **blocked** (see below).

### Get my QR code

Retrieve a QR representing traveler identifiers and current **risk classification**. The app can render the QR locally. (Optionally switch to **signed & compressed** payloads to prevent forgery.)

---

## End‑to‑end flow

1. **Validate** current step; focus & scroll to first error.
2. On **Submit**:
   - **Identity search** (see next section).
   - If TEI found, check **latest Travel event** arrival:
     - If **today/future** → **block new submission** with a modal (Cancel vs Continue to Edit).
     - If **past** → proceed (new trip).
   - **Build attributes** from sanitized inputs and **merge** with existing attributes from lookup (preserves required program attributes like residence/administrative geography).
   - **Create/Update** TEI, enrollment, Travel & Clinical events.
   - **Program Rules** run in DHIS2 → set final risk classification.
   - Generate QR (current or signed mode) and display.

---

## Validation & UX

- Progress bar: **yellow** during input, **red** on validation error, **green** after passing step.
- Inline error message sits **left of Back**.
- Scroll to first invalid field (inputs must have matching `name`/`id`, or a wrapper with `data-field`).
- Guardian fields are required only if **minor**.
- Names are **trimmed**; last name collapses multiple spaces to **one**.
- Phones accept digits and optional single leading “+” and are **trimmed** before submission.

---

## Identity search & de‑duplication

When submitting a declaration, the app looks for an **existing traveler** in DHIS2 using **two scenarios**, in order:

1) **Passport + Nationality** (primary)  
   - Filters: `ATT_PASSPORT:eq`, `ATT_NATIONALITY:eq`.
   - Fetches: `fields=enrollments[enrollment,enrolledAt],trackedEntity,orgUnit,attributes[attribute,value]`.

2) **First name + Last name + DOB** (fallback)  
   - Filters: `ATT_FIRST_NAME:ilike`, `ATT_LAST_NAME:ilike`, `ATT_DATE_OF_BIRTH:eq`.
   - Optionally add middle name (`ATT_MIDDLE_NAME:ilike`) to disambiguate.

If a TEI is found, its **attributes** are already in the lookup response and are **merged** with the outgoing set so required program attributes aren’t lost.

Passports change over time, so we also try to match by first name, last name, and date of birth. When those are accurate, we will manage to find the existing traveler in DHIS2 and still link the submission to them, adding the declaration as new events, and update their passport number. If no match is found, we create a new traveler record—acceptable because the portal’s goal is to process current declarations, not to maintain a full longitudinal travel history for each person.

---

## Duplicate submission blocker

If a traveler exists **and** the most recent **Travel Information** event has an **arrival date** that is **today or in the future**, the app will **not** create a new submission. Instead it shows a **modal**:

- **Cancel** (red) → returns to Home.
- **Continue to edit declaration** (blue) → switches to the **Edit** view, pre‑fills **Last name + Passport**, and focuses the last name input.

This prevents multiple active declarations per traveler and **unblocks** the day after arrival.

---

## Edit retrieval blocker

Editing an existing declaration is **not** allowed if the saved Travel event’s **arrival date** is **in the past**. The app will display:

> “There is no current declaration in progress to edit.”

This ensures only **current** (not historical) declarations are edited.

---

## Powered by DHIS2

The portal is **metadata‑driven**. Admins can modify DHIS2 and the portal will adapt on next load.

### Configurable metadata

**A) Option Group — “Countries visited in the last 21 days”**  
- Drives the **multi‑select** in Travel step.  
- Add/remove/reorder countries in DHIS2; the UI will reflect changes.  
- **UID in app config:**

```ts
export const OG_VISITED_COUNTRIES = "m0EgeLz1Jzc";
```

> API helper:  
> `GET /api/optionGroups.json?filter=name:eq:Countries visited in the last 21 days&fields=id,name,options[id,name,code]&paging=false`

**B) Program Stage — “Pre‑Clinical Data”** (Clinical step)  
- Entire Clinical step is generated from this **Program Stage**.  
- Add/remove DEs, reorder, change value types/option sets, toggle **Compulsory** — **no app code change required**.  
- **UID in app config:**

```ts
export const CLINICAL_STAGE_ID = "nqE0Yrh0XvW";
```

> API helper:  
> `GET /api/programStages/{id}.json?fields=id,name,programStageDataElements[dataElement[id,name,valueType,optionSet[id,name]],compulsory,sortOrder]`

**C) Program Rules — Risk classification (server‑side)**  
After submit, DHIS2 program rules derive **risk** from Clinical answers. The portal then reads the final classification for the QR.

Configured rules (names & IDs):
- **zFMEzQEgthB** — ASSIGN GREEN Health Flag Status - Default for all travelers
- **IdXBsPN0ZJy** — ASSIGN YELLOW Health Flag Status - Runs after status set to GREEN
- **eYTUA7O3wWI** — ASSIGN RED Health Flag Status - Runs after status set to YELLOW

Admins can modify the rule conditions/actions to change risk behavior without app changes.

### DHIS2 as backend + analytics

There is **no separate backend**. The app authenticates to DHIS2 and uses the Tracker API for all CRUD:

- **System of record**: DHIS2 stores TEIs, attributes, enrollments, and events.
- **Analytics**: build dashboards, indicators, and line‑lists in DHIS2 apps (Data Visualizer, Line Listing, etc.).
- **Security**: governed by DHIS2 user roles and sharing (program/org unit/attribute access).

---

## Data mapping (TEAs & DEs)

### Tracked Entity Attributes (TEAs)

```ts
export const ATT_FIRST_NAME         = "ur1JM6CZeSb";
export const ATT_MIDDLE_NAME        = "wS7QQnuWCtc";
export const ATT_LAST_NAME          = "vUacdogzWI6";
export const ATT_DATE_OF_BIRTH      = "Rv8WM2mTuS5";
export const ATT_SEX                = "S0laL1aHf6i";
export const ATT_PHONE              = "Vr0lFuBkaaV";
export const ATT_NATIONALITY        = "GWQC1qQdw8Y";
export const ATT_PASSPORT           = "kDWurLVuVZw";
export const ATT_GUARDIAN_FULL_NAME = "ecHExEkzOGO";
export const ATT_GUARDIAN_PHONE     = "DnWpyjuxhnh";
```

### Data Elements (Travel Information)

```ts
export const DE_AIRLINE_FLIGHT_COMBINED = "dP5GhQYdMMf";
export const DE_PURPOSE                 = "BXGTya98TLD";
export const DE_AIRLINE_NAME            = "EvJTARXbuPj";
export const DE_OTHER_AIRLINE           = "ozBn9o48C7F";
export const DE_FLIGHT_NUMBER           = "R775EQee9sB";
export const DE_SEAT_NUMBER             = "Q20Pk08bg5U";
export const DE_DEPARTURE_COUNTRY       = "BoQdGhFv7te";
export const DE_DEPARTURE_CITY          = "ebDNzAopp9K";

export const DE_VISITED_1               = "AXpyzUwlcxY";
export const DE_VISITED_2               = "g4la792LVkV";
export const DE_VISITED_3               = "k9KUAc7EUvk";
export const DE_VISITED_4               = "f5H0rOaVBzu";
export const DE_VISITED_5               = "aUfY6AbcnH0";
```

### Data Elements (Clinical)

```ts
export const DE_CLINICAL_CLASSIFICATION = "cGSuTAbYhkM"; // (not user-entered)
```

---

## API patterns

**Lookup (includes attributes to avoid extra fetches):**
```
GET {API_PREFIX}/40/tracker/trackedEntities
  ?fields=enrollments[enrollment,enrolledAt],trackedEntity,orgUnit,attributes[attribute,value]
  &program={PROGRAM_ID}
  &page=1
  &ouMode=ACCESSIBLE
  &filter={ATT_PASSPORT}:eq:{passport}
  &filter={ATT_NATIONALITY}:eq:{nationality}
```

**Fallback lookup by names + DOB:**
```
...&filter={ATT_FIRST_NAME}:ilike:{firstName}
...&filter={ATT_LAST_NAME}:ilike:{lastName}
...&filter={ATT_DATE_OF_BIRTH}:eq:{dobISO}
```

**Hydrate detailed events (when editing):**
```
GET {API_PREFIX}/40/tracker/trackedEntities/{tei}
  ?program={PROGRAM_ID}
  &fields=enrollments[enrollment,events[event,programStage,dataValues[dataElement,value],occurredAt,completedAt]],attributes[attribute,value]
```

---

## QR code (current & signed plan)

- **Current**: QR is rendered locally from a string containing a json payload with the traveler key data and their risk classification:
```
const qrPayload = JSON.stringify(qrData);
const qrService = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=";
const qrImageUrl = qrService + encodeURIComponent(qrPayload);
```
- **Recommended (signed)**: use encryption!! We could send a tiny, non‑PII payload to a server route (`POST /qr/sign`); the server returns `TRV1:<base45(deflate(JWS))>`. Render locally using a QR library. Android scanners verify the Ed25519 signature with a public key (JWKS or bundled). TO BE DONE!!!

---

## Admin cookbook

- **Change visited‑countries list:** edit Option Group **“Countries visited in the last 21 days”** (Options add/remove/reorder).
- **Add a clinical question:** edit Program Stage **“Pre‑Clinical Data”** (add DE, set value type/option set, compulsory, order).
- **Adjust risk thresholds:** edit Program Rules (IDs listed above).
- **Prevent duplicates:** the app already blocks new submissions when a declaration with a current/future arrival exists in the system.

---

## Appendix: IDs to configure

Fill these in your app constants (and keep them documented here for admins):

```ts
export const API_PREFIX           = "<https://your-dhis2.example.org/api>";
export const PROGRAM_ID           = "<PROGRAM_UID>";
export const TRAVEL_STAGE_ID      = "<TRAVEL_STAGE_UID>";
export const CLINICAL_STAGE_ID    = "<PRE_CLINICAL_STAGE_UID>";
export const OG_VISITED_COUNTRIES = "<OPTION_GROUP_UID>";
// Optionally the default org unit to enroll into:
export const ORG_UNIT_ID          = "<ORG_UNIT_UID>";
```

**Program Rules (fixed by DHIS2 config):**
- zFMEzQEgthB — GREEN default
- IdXBsPN0ZJy — YELLOW after GREEN
- eYTUA7O3wWI — RED after YELLOW
