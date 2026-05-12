# HR Tool – Beta Feedback Backlog

**Source:** Granola meeting "HR Tool try-out" — Apr 29, 2026, 10:30 AM
**Attendees:** Jesse (Bopinc), Akhlaque Khan (ImpactGuru), Sahil (CarePal Money)
**Status:** Beta v1 reviewed live. Database not yet connected (Excel-populated data). Recruiter view not yet built — only admin view shown.

> Logic note: I grouped related items and assigned IDs for tracking. Where Sahil and Akhlaque overlapped on a point, I merged their input into a single item and noted both. Items marked **[needs decision]** were discussed but not concluded — handle those before implementing.

---

## 1. Terminology & labels

- **T1.** Rename "Pipeline" → "Offered" everywhere it appears (dashboard header, candidate stage, etc.). Akhlaque: "Pipeline" is too generic, not a real stage. Sahil agreed.
- **T2.** Rename "Candidates in pipeline" header to use the same "Offered" terminology — drop "pipeline" wording entirely.
- **T3.** Consolidate "Offers extended" and "Offer sent" — they're the same thing, only show one.
- **T4.** Revisit definitions/labels of dashboard headers (Target / Active / Open / Pipeline) — Jesse acknowledged they aren't intuitive enough. Make them self-explanatory.

## 2. Main dashboard

- **D1.** **Eliminate the separate "Headcount" tab.** Move its content (target, active, on notice, PIP, in training, offered, deficit by city) into the main dashboard view. Sahil's principle: "minimize until you are left with the most basic" — remove anything that adds no value.
- **D2.** On the main dashboard, the city-level breakdown should show: target headcount, active headcount, on notice, PIP, in training, offered, deficit (= target − active). This is the "exact view" Sahil wants.
- **D3.** "Approved headcount" / target headcount number is set manually from the annual operating plan — no source-of-truth integration needed. Just keep it manually editable.

## 3. Requisitions tab

- **R1.** **Add hospital name and city to the requisition filter / list display.** Currently shows requisition number + "Focus BD" which Sahil cannot work with. He needs to filter by e.g. "Apollo Navi Mumbai", not by requisition number alone. Multiple requisitions in the same hospital should each show as a separate row.
- **R2.** Add a city filter on the requisitions tab.
- **R3.** Add a "Closure date" / anticipated closure date column next to the existing requisition raised date.
- **R4.** Add a column showing whether an offer has been made for that requisition (yes/no).
- **R5.** Add a column showing the **anticipated date of joining** (pulled from the linked offered candidate). This lets Sahil look at any requisition and immediately know when it could close.
- **R6.** Sync the requisitions data source directly from the existing Google Form for requisitions — don't make anyone re-enter that data manually.

## 4. Candidates tab

- **C1.** **Make the requisition number on a candidate editable via a dropdown** so a candidate can be re-tagged to a different requisition (e.g., same city, different hospital). Currently visible but not changeable.
- **C2.** Add an **"Expected joining date"** field that becomes populatable once a candidate hits the Offered stage. To be filled in manually by the TA team.
- **C3.** Update candidate stages to: **Offered → Joined → Training → Active**. These stages must sync live to the dashboard / headcount view so the dashboard reflects current candidate state.

## 5. Interviews tab

- **I1.** Add a **date range filter** (start date + end date) so you can pull interview activity for any period (e.g., "how many interviews in the last month, broken into R1, R2, offered, joined").
- **I2.** Add a **city filter** on the interviews tab.
- **I3.** Restructure the page: put filters at the top. Below the filters, show a dynamic summary block with: # of requisitions, # of R1 interviews, # of R2 interviews, etc. for the selected filter. Below that, show the actual interview activity list. The summary block should update dynamically as filters change.
  - Rationale (per Akhlaque/Sahil): the level of interview activity in a city is directly correlated to the number of open requisitions there — they want to see both side by side to plan TA workload.
- **I4.** Keep the interviews tab as a separate tab (Sahil questioned whether it duplicated the candidates view, but Jesse argued it's useful for someone running interviews to see what's scheduled. Both agreed to keep it.)

## 6. Notifications & calendar integration

- **N1.** When an interview is scheduled in the tool, automatically send an email invite to **both** the candidate's email and the interviewer's email.
- **N2.** The invite should include customizable preparation instructions for the interviewee (e.g., what decks/material to prepare). Jesse to ask Sahil/Akhlaque what content they want in the invite.
- **N3.** At minimum: invites accepted via email should land in the recipient's Google Calendar (standard ICS-style invite flow). **[needs decision]** Whether to do a deeper Google Calendar API integration depends on backend scope — Jesse flagged it would require work Sujeet may not want to take on.

## 7. Data ingestion / workflow

- **W1.** **[needs decision]** How candidates enter the system: fully manual entry vs. setting up a dedicated email address that auto-collects resumes, runs a first filter, and pushes candidates into the tool. Jesse flagged this needs to be discussed before building — manual-only will be a lot of work for the TA team.

## 8. UI / general

- **U1.** General UI feedback from Sahil was positive ("clean, not cluttered") — keep that aesthetic when adding the items above. No specific UI rework requested beyond the items in sections 1–7.

---

## Out of scope / explicitly rejected (do **not** build)

- Showing where currently active employees are placed when clicking the active headcount number. Sahil suggested it; Jesse confirmed it was not in scope and the team agreed to drop it.
- A full database mapping of all current Carepal employees (names, business unit, hospital, etc.). Only candidate data + requisition data is needed for the tool to function.

---

## External blockers (not Claude Code tasks)

- **B1.** **Database setup by Sujeet (CarePal side).** The tool currently runs on Excel-populated data. Sahil committed to chasing Sujeet to resolve "today or tomorrow" (i.e., by Apr 30 / May 1, 2026). Until this is done, the tool can't be properly tested with real data and Akhlaque/Sahil can't give meaningful in-use feedback.
- **B2.** Recruiter view (and other non-admin user views) not yet built. Out of scope for this feedback round per Jesse — flagged here so Claude Code knows it's a known gap, not an oversight.

---

## Follow-up actions agreed in the meeting (for your tracking, not Claude Code)

- Akhlaque + Sahil to test the tool individually once the DB is connected and send detailed voice-message feedback.
- Sahil to push Sujeet on database resolution.
- Jesse to implement the items above in the meantime.
