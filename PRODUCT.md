# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Everyone in a Nigerian secondary school, with no single audience ranked above the others (confirmed by the owner):
- Principals and school admins run the day on desktop: registers, result approvals, fees, school setup.
- Teachers work mostly on phones in class: marking registers, entering scores, recording lessons.
- Parents and guardians use phones almost exclusively: attendance alerts, results, fees, receipts.
- Students watch recorded lessons, ask the LUMI tutor, and check timetable and results.
- Lantern's own staff onboard and bill schools (platform admin).

## Product Purpose
One place to run a school: registers, results with an approval chain, report cards, fees and receipts, timetable, announcements and documents, and an LMS with recorded lessons and LUMI, an AI tutor grounded in the teacher's notes. Success is a school running its whole day in Lantern and every parent hearing what happened the minute it does.

## Positioning
Built around the Nigerian school year (three terms, JSS 1 to SS 3, class arms, CA plus exam weighting, A1–F9 grades, naira fees). Guardians are told the moment a register is saved. Results move teacher → head of department → principal before parents see them. LUMI answers only from the teacher's own notes.

## Operating Context
Multi-tenant: each school chooses one brand colour and a crest, and every school-facing screen wears that colour. Slow or intermittent connections are common; the register works offline. Parents do not install an app (PWA in the browser).

## Capabilities and Constraints
Next.js 16 App Router, React 19, Tailwind v4, Supabase (auth, Postgres with RLS, storage). Roles and permissions decide what each person sees. Icon set: Hugeicons (owner request).

## Brand Commitments
Name: Lantern. AI tutor name: LUMI. The school's chosen colour must drive the app UI dynamically; Lantern's own colours apply only before sign-in and on the website.

**Locked brand colours (approved by the owner; do not change):**
- Navy `#182350`: primary, buttons, headings, text on light surfaces.
- Deep navy `#131c40`: sidebar and bold panels.
- Gold `#b9915e`: accent only (rules, highlights), never body text.

These match the original code (`app/globals.css` on `main` before the redesign). Do not swap them for the logo's royal blue/yellow or any other shade. Use navy sparingly on the website: light sections, with navy on buttons and headings.

## Evidence on Hand
No customer testimonials, logos, pricing or case studies exist yet — do not invent them. Classroom photographs from Wikimedia Commons with credits in public/landing/CREDITS.md.

## Product Principles
- The first line of every screen says what matters today, in the school's own words.
- The most frequent job is one tap away, especially on a phone.
- Colour carries meaning: the school colour for identity and the main action, fixed status colours for present, late, absent, paid, owing.
- Numbers are true and add up; empty, zero and offline states are designed, not left blank.

## Accessibility & Inclusion
WCAG 2.1 AA contrast for any school colour (derived shades guarantee it); 44px touch targets; respects reduced motion.
