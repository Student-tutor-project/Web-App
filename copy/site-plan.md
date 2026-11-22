# Student Tutor: plan for the rest of the site

Written 2026-11-22, after the hero was rebuilt as the conference room. Nothing below is built yet unless it says **Built**. No step needs Higgsfield credits; the two optional ones say so.

## What the hero is now (built)

- A live three.js conference room high above a futuristic city, recoloured to the reference photo: slate wall, ceiling white, chrome, daylight blue.
- Three choices with floating signs:
  - the **tutor's chair** (the end chair, in front of the laptop) opens sign-up as a tutor;
  - the **student's chair** (the next chair to its right) opens sign-up as a parent (labelled "Your child's chair");
  - the **laptop** opens log in.
  - Hovering a chair lights a ring under it. Choosing one glides the camera to it, then opens the panel. Closing the panel glides back.
- Slight animation:
  - the signs float;
  - dust drifts in the sunlight;
  - small craft glide between the towers, clouds drift, and the halo rings pulse;
  - the camera breathes and follows the cursor a little.
- Five scroll beats move the camera through the room. The signs belong to the first screen only.
- Reduced motion turns off all of that ambient movement.
- Phones get the same scene at lighter quality, with the copy on top and the seats below.

## The hero animation: next steps

1. **One opening move (the single page-load sequence).** The page opens on the city through the glass, then the camera turns into the room and settles on beat 1 over about 2.5 seconds. The signs appear last, one after another, so the first thing a visitor reads is where to sit. It's skippable: any scroll or click finishes it at once. Under reduced motion it's skipped.
2. **Sitting down, per choice** (replaces today's single glide):
   - *Tutor's chair:* the camera lowers to seat height behind the chair, looking over the laptop at the student's chair, and the panel opens. The tutor's view is "your student is here".
   - *Student's chair:* the camera lowers to seat height, looking at the tutor's chair across the corner, and the panel opens.
   - *Laptop:* the camera pushes in until the screen fills the view, and the log-in panel grows out of the screen's position. That makes the screen the panel. This is the signature moment, and it's worth doing well.
3. **Seat state after signing up.** A signed-in visitor's chair keeps a soft glow, and its sign changes to "Your seat". Signed-in tutors see the student's chair labelled "Next lesson" once bookings are real.
4. **Keyboard and screen readers.** The signs are already real buttons in reading order (copy, then the three seats). Add a visible "Skip the room" link that jumps to the booking section.

## The rest of the site, section by section

Order and job of each section. The room comes back twice, so the 3D stays a thread rather than a one-off hero.

| # | Section | Job | Plan |
|---|---|---|---|
| 1 | The story (5 beats) | Explain the promise | **Built.** Possible polish: on beat 2 ("Checked by a person"), a sample tutor's profile card floats against the glass with a "Grades checked" line. It's HTML, not baked into 3D. |
| 2 | Impact | The price, said plainly | Keep the three prices. Recolour only (done). |
| 3 | Book a first lesson | The goal of the site | Keep it plain and fast, with no 3D behind it (design ban). The student's chair and "Book a tutor" both lead here after sign-up. |
| 4 | Why parents trust it | Safety | Keep the two-column list. Recolour only (done). |
| 5 | **Who's at the table** (new, replaces the lamp's Explore) | Show real tutors | The stage undims and the room returns, seen from above the table. Each chair is a sample tutor: hovering or tabbing to one shows their subject, school, rate and "Grades checked". Clicking "Book with Aisha" jumps to step 2 of the booking flow with that tutor chosen. It uses the 7 sample tutors that already exist in `booking.js`. |
| 6 | For student tutors | Recruit tutors | The tutor's chair again: a still render from the tutor's seat looking at the student's chair, beside the three tutor benefits. Its "Apply to teach" opens the tutor sign-up rather than an email. |
| 7 | Free lessons | The free track | Done 2026-11-22: `world.jpg` replaced by `free.jpg`, a daylight render of the room looking down the glass wall (text on the slate wall). A dusk version, with the city light lines on, is still an option. Rendered from the scene, so no credits. |
| 8 | Questions parents ask | Objections | Keep. Add "What does a tutor see?" and "Can my child use their own account?" now that students can sign up. |
| 9 | Final call | Last push | Keep. |
| 10 | Footer | Contact | Keep. Replace the placeholder contacts before launch. |

**Light modes, reborn.** If you want an Explore-style moment, the room can switch between *Morning*, *Afternoon* and *Dusk* (the sun's angle and the city's lights). This fits naturally in section 5. It's optional.

## Order of work

1. Opening move and the per-seat "sitting down" moves, plus "Skip the room". This is hero polish and needs no new assets.
2. The laptop-screen-to-panel transition (the signature moment).
3. "Who's at the table" (section 5), wired to the booking flow.
4. The dusk render for the free-lessons section, and the tutor's-seat still for section 6.
5. FAQ additions, then a full check at 1440 and 375 wide, with the copy and design gates.

Optional, with credits (ask first):
- a better laptop model;
- a short looping video of the city at dusk for the free-lessons section.

## Decisions I need from you

- **Roles.** Decided 2026-11-22: two account types, **Student tutor** (the tutors are students) and **Parent** (who books for their child). Children do not get their own accounts.
- **Tutor apply flow.** Does "Apply to teach" stay an email for now, or become the tutor sign-up?

## Verified and not verified (as of this plan)

- **Verified in the browser at 1440×900 and 375×812:**
  - the room renders;
  - hovering a chair lights its ring and sign;
  - clicking the student's chair glides the camera and opens "Create an account" with "Parent" chosen;
  - closing the panel glides back;
  - the signs hide after the first screen;
  - beats 2 to 5 keep the copy on the slate wall;
  - no horizontal scroll on phones;
  - no console errors.
- **Not verified:**
  - frame rate on a real mid-range phone;
  - a real sign-up email;
  - the reduced-motion pass in a real browser setting.
