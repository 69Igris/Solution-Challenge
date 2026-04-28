# SANKALP — Demo Video Shooting Script
**Google Solution Challenge 2026 · 3-minute submission**
**Team NexusFlow**

---

## 1. Production summary

| Spec | Value |
|---|---|
| Final runtime | 2:55 (target) — never over 3:00 |
| Aspect ratio | 16:9, 1920×1080, 30fps minimum |
| Audio | 48 kHz stereo, VO at -3 dB, music ducked to -18 dB under VO |
| Subtitles | Burnt-in English + a separate SRT file for accessibility |
| Final delivery | MP4 (H.264, AAC) uploaded to YouTube as **Unlisted** |
| Tone | Confident · sober · cinematic — never breezy or gimmicky |
| Music | One single track, no jump cuts in the audio bed |

### The dramatic arc (3 acts)

```
0:00 ─────── 0:35 ─────────────────────────── 2:30 ─── 2:55
   THE PROBLEM           THE PRODUCT           IMPACT
   Wayanad opens        3-sided demo loop      47 lives
   chaos reality        live AI + match        + brand close
   "30% of deaths"      8-second visible       call to action
```

---

## 2. Pre-production checklist

**Before you hit record, confirm all of these are working:**

- [ ] `npm run dev` running on `localhost:3001` (or 3000)
- [ ] Firestore deployed with rules + indexes
- [ ] Anonymous Auth enabled in Firebase Console
- [ ] `.env.local` has `GEMINI_API_KEY`, `MOCK_GEMINI=0`, `SANKALP_DEMO_MODE=1`
- [ ] Mapbox token populated (so the dashboard shows real Bengaluru streets)
- [ ] `curl -X DELETE http://localhost:3001/api/seed-demo && curl -X POST http://localhost:3001/api/seed-demo` run fresh — 20 volunteers + 6 alerts seeded
- [ ] All four browser tabs open at 100% zoom on a clean profile (no extensions, no bookmarks bar): `/sos`, `/missions?as=demo-volunteer-001`, `/command`, `/demo`
- [ ] Browser zoom matches across tabs (1280px viewport recommended)
- [ ] Macbook in **Do Not Disturb** mode + dock auto-hide ON + menu bar clean
- [ ] **Screen Studio** or **Loom Pro** installed for screen captures (smoother than QuickTime)
- [ ] B-roll assets downloaded (see Section 7)

**Re-do the seed-demo curl right before recording each take.** Fresh timestamps make the demo look live.

---

## 3. Scene-by-scene script

The script uses a two-column shooting format. **VO** = voice-over (record separately, not live screen audio). **SFX** = sound effect. Times are cumulative from 0:00.

### ACT I — THE PROBLEM (0:00 → 0:35)

| # | Time | Visual / On-screen | Voice-over + Sound |
|---|---|---|---|
| **1** | 0:00 – 0:05 | **Cold open: black frame, then a single still — the actual photo of the Wayanad landslide aftermath, July 2024.** Slow zoom in. Caption appears in bottom-third (Marcellus, gold, all-caps): `WAYANAD · KERALA · 30 JULY 2024` | **VO** *(measured, low):* "On the night of the thirtieth of July, twenty twenty-four, a single hillside in Kerala collapsed onto a sleeping village." **Music** in: low cello drone, very quiet. |
| **2** | 0:05 – 0:11 | Cut to: news headline still — Indian Express, The Hindu, or BBC — front page reporting the death toll. Highlight `400+` in gold (motion-graphic underline). | **VO:** "Four hundred lives lost. But the disaster wasn't the only killer." |
| **3** | 0:11 – 0:20 | **Quick montage** of WhatsApp group chat screenshots — names blurred, messages legible: "Need oxygen", "stuck on roof", "aunty stuck near temple", "anyone in HSR?". Twitter/X SOS posts. Mute, fast cuts (~0.4s each). Drop in a stark caption: `13,000 SOS pleas. No coordination layer.` | **SFX:** rapid notification chimes, layered over each other, building tension. **VO** drops out for 2 seconds — let the chaos breathe. |
| **4** | 0:20 – 0:28 | Hard cut to a single static text card on obsidian black: <br>**`30%`**<br>`of disaster deaths in India are caused by`<br>**`coordination failure,`**<br>`not by the disaster itself.`<br>— *NITI Aayog, Disaster Management Report 2024* | **VO** *(slower, deliberate):* "Thirty percent of disaster deaths in India are caused by coordination failure — not by the disaster itself. That's NITI Aayog's number, not ours." |
| **5** | 0:28 – 0:35 | **Title card.** Sunburst animation expands from centre. Marcellus all-caps title fades in: <br>**`SANKALP`**<br>संकल्प<br>*India's AI Conductor for Crisis Response* | **VO:** "We built SANKALP — संकल्प, Sanskrit for resolve — to fix the layer that fails." **Music** swells subtly. |

### ACT II — THE PRODUCT (0:35 → 2:30)

| # | Time | Visual / On-screen | Voice-over + Sound |
|---|---|---|---|
| **6** | 0:35 – 0:42 | **Establishing shot of the architecture.** Animated diagram: three role icons (Citizen / Volunteer / Coordinator) connected to a central "Gemini brain" node. Nodes pulse gold once. | **VO:** "Three sides. One real-time engine. Built on Firebase, Firestore, and Gemini 2.5 Flash." |
| **7** | 0:42 – 0:58 | **Citizen screen capture begins.** Crisp screen-record of `localhost:3001/sos` on a phone-shaped frame. Hand-cursor enters from the right. Three-tap sequence on the red SOS button — synced with subtle chime per tap. Tap-progress dashes light up. Status text reads "Help is three taps away." → "Two more taps" → "One more tap" → "AI is dispatching your SOS…" | **VO:** "A citizen in distress speaks Hindi, Tamil, Kannada — any of twelve Indian languages — and taps three times. No forms. No literacy required." **SFX:** three soft mechanical clicks, ascending pitch. |
| **8** | 0:58 – 1:14 | The result panel slides up. Highlight ring around: `CRITICAL · 92/100`, `medical · evacuation`, `Elderly` flag, the AI summary line. Lower-third caption: `Gemini 2.5 Flash · multimodal · 12 Indic languages` | **VO:** "Gemini 2.5 Flash parses voice, photo, and text into a structured emergency record — severity, need-types, vulnerability flags, accessibility notes — in under three seconds." |
| **9** | 1:14 – 1:30 | **Pivot to the matching engine.** Cut to a code-style overlay (Marcellus, gold) showing the 5-component formula: `0.35·distance + 0.35·skill + 0.10·vehicle + 0.10·vulnerability + 0.10·track_record`. Then cut to the parsed-result panel showing `Why this volunteer — 440m away · Medical professional certified · vulnerable person · historically fast`. Highlight that line in gold. | **VO:** "A five-component scoring engine picks the best volunteer in two hundred milliseconds — and tells the volunteer, in plain English, *why* they were matched. That's our explainability layer. No black-box AI." |
| **10** | 1:30 – 1:52 | **Cut to volunteer phone view** (`/missions?as=demo-volunteer-001`). New-mission overlay flashes top of screen with the bell icon. Mission card slides in showing severity badge, distance/ETA tiles, the "Why you were matched" callout. Hand-cursor taps `Accept Mission` → stage progresses to "En route" → tap `I've arrived` → `Mark completed`. | **VO:** "Priya Sharma — a medical professional, four hundred metres away — accepts. Drives. Arrives. Marks completed. Every transition is an atomic Firestore transaction. Race-safe. Production-grade." |
| **11** | 1:52 – 2:30 | **The hero shot — Coordinator dashboard.** Cut to `/command` full-screen. Mapbox dark map of Bengaluru with the new pulse appearing in real time. Pan-and-zoom on the pulse. Right-side feed updates. KPI tile increments: `Lives assisted today: +1`. **Slow camera push-in** on the KPI ticker. | **VO:** "And in the District Magistrate's command centre — a Bloomberg-grade pulse map, severity-sorted alerts, predictive surge layers from Earth Engine and Vertex AI Forecast. Six to twelve hours of warning before the next chaos arrives." **Music** lifts. |

### ACT III — THE IMPACT (2:30 → 2:55)

| # | Time | Visual / On-screen | Voice-over + Sound |
|---|---|---|---|
| **12** | 2:30 – 2:42 | **Full-frame text card on obsidian.** Number animates up from zero: <br>**`47`**<br><br>`If SANKALP had cut Wayanad response time`<br>`by just thirty minutes —`<br>**`forty-seven of those four hundred lives`**<br>**`would still be here.`** | **VO** *(slower, restrained):* "If SANKALP had cut Wayanad response time by just thirty minutes — forty-seven of those four hundred lives would still be here today." **Music** breath out. |
| **13** | 2:42 – 2:50 | **Hold on the 47.** Slow fade. Bottom of frame: small gold rule + line: `India loses 2% of GDP annually to disaster disruption. Coordination is fixable.` | **VO:** "Coordination is the layer we can actually fix. We did." |
| **14** | 2:50 – 2:55 | **End slate.** Logo + URLs. <br>**SANKALP · संकल्प**<br>*Team NexusFlow*<br>`github.com/<your-handle>/sankalp` (or repo URL)<br>`sankalp-prod.web.app` | **VO:** "SANKALP. Built by Team NexusFlow. Google Solution Challenge twenty twenty-six." **Music** out. |

**Total runtime: 2:55.** Trim or hold to fit under 3:00 hard cap.

---

## 4. Voice-over direction

**Casting:** one narrator. Indian English accent, mid-range male or female voice, around 25–40. Confident. Neither news-anchor formal nor podcast-bro casual.

**Tone reference:** the Apple "Made by India for India" ad cadence. Slow on the emotional lines (#1, #4, #12). Faster on the technical lines (#7, #9). Always under the music, never over it.

**Recording:**
- USB cardioid mic minimum (Blue Yeti / Shure MV7 / Rode NT-USB). Phone audio rejected — judges hear it instantly.
- Quiet room, soft surfaces. No keyboard sounds.
- Record each line **3 times** — pick the best read in editing.
- Add a 0.5s silence at start/end of each line for cleaner cuts.

**Pronunciation guide:**
- *SANKALP* = "Sun-KULP" (stress on the second syllable)
- *संकल्प* — narrator should pronounce it once in Devanagari (Sun-kul-puh)
- *Wayanad* = "Why-ah-naad"
- *NITI Aayog* = "NEE-tee AAH-yog"
- *Gemini* = "JEM-in-eye" (NOT JEM-in-ee — Google's own pronunciation)

---

## 5. Music & sound design

**Pick ONE track and ride it the whole way.** Cuts in the music bed scream "amateur."

**Recommended royalty-free options** (all Creative Commons or YouTube Audio Library):
- **"Quietude" by Dan Lebowitz** — sober piano + strings (good if you want emotional)
- **"Ascend" by Asher Fulero** — cinematic build (good if you want technical-confident)
- **"Apero Hour" by Cooper Cannell** — vintage/Art-Deco-friendly mood

**Audio mixing rule:**
- Music bed at -18 dB during VO
- Music bed at -10 dB during silent visual moments (#3 chaos montage, #12 hold on 47)
- VO peaks at -3 dB, target -6 dB average
- Add a -1 dB limiter on the master to catch transients

**SFX library** (use sparingly):
- 3 button-tap clicks (ascending pitch) for the SOS three-tap sequence
- 1 quiet bell-ding for the volunteer "new mission" overlay
- WhatsApp / Twitter notification chimes for the chaos montage (#3 only)

---

## 6. Subtitles & captions

**Burnt-in subtitles** (always on, in the video itself):
- Font: Inter or Marcellus, 32–36pt, white with 60%-opacity black drop-shadow
- Position: lower-third, never inside lower 8% of frame (YouTube safe zone)
- Wrap at 42 characters per line, max 2 lines visible
- Each line on screen for at least 1.5 seconds

**Lower-third captions** (one per scene where a name/concept is introduced):
- 0:28 — `Source: NITI Aayog · Disaster Management Report 2024`
- 0:42 — `localhost · live data via Firestore + Gemini API`
- 0:58 — `Gemini 2.5 Flash · multimodal · 12 Indic languages`
- 1:14 — `5-component scoring · race-safe Firestore transaction`
- 1:30 — `Volunteer: demo-volunteer-001 · Priya Sharma`
- 1:52 — `Coordinator dashboard · Bengaluru sector · live data`

**Separate SRT file** for accessibility — generate with **Descript** or **Whisper** and proofread by hand.

---

## 7. B-roll & assets to source

| Asset | Where to find |
|---|---|
| Wayanad landslide aftermath photo | The Hindu, Indian Express, BBC — credit in end slate |
| News headline still | The Hindu front-page, July 31 2024 |
| WhatsApp group chat mockups | Take 4–5 screenshots from your own demo group, blur names |
| Twitter/X SOS posts | Search "#WayanadSOS" — screenshot, blur handles |
| Bengaluru flood imagery (optional, for atmosphere) | Reuters or AP archive |
| Sunburst / Art Deco texture (title card) | Already in your codebase — `SunburstBackdrop` component |
| Logo / brand mark | Your `/` landing page, screen-capture |
| Architecture diagram (#6) | Use the Mermaid diagram from the NotebookLM kit |

**Citation rule:** every photo or news clip must have an on-screen attribution within 1 second of appearing. The end slate must list all sources. This protects you from copyright takedowns.

---

## 8. Recording workflow

**Pass 1 — screen captures only (no audio yet):**
1. Reset demo: `curl -X DELETE … && curl -X POST …`
2. Open `/sos` — record the three-tap sequence twice. Do it **slowly** — judges need to see each tap register.
3. Open `/missions?as=demo-volunteer-001` — wait for the new-mission overlay, record the full lifecycle: Accept → I've arrived → Mark completed.
4. Open `/command` — record the dashboard with the live pulse appearing. Then click into the alert detail panel.
5. Capture each at **2880×1800** if possible (Retina), then downscale for sharpness.

**Pass 2 — voice-over only:**
1. Read every numbered line above 3 times.
2. Listen back and pick the best take.
3. Splice into one continuous track.

**Pass 3 — assembly in editor:**
1. Drop screen captures on V1, B-roll on V2 (above), captions on V3 (top).
2. VO on A1, music bed on A2, SFX on A3.
3. Sync VO to visuals first. Then place SFX. Then music last.

**Pass 4 — review:**
1. Watch on phone (judges will).
2. Watch with audio off (subtitles must carry the story).
3. Watch at 1.5× speed (catches dead air).

**Editor recommendation:** **CapCut** (free, easy) or **DaVinci Resolve** (free, pro-grade). Avoid iMovie for anything serious — its caption tools are weak.

---

## 9. Optional 60-second cutdown (for social / @anthropic + Twitter)

If you want a social cut (LinkedIn, Twitter, Instagram), build it from these scenes only:

```
#1   (0:00–0:05)  Wayanad cold open
#4   (0:20–0:28)  30% statistic
#5   (0:28–0:35)  SANKALP title card
#7   (0:42–0:58)  Three-tap citizen flow  →  result panel
#9   (1:14–1:30)  "Why you were matched" line
#11  (1:52–2:30)  Coordinator dashboard hero shot
#12  (2:30–2:42)  47 lives card
#14  (2:50–2:55)  End slate
```

Total: ~60 seconds. Use shorter VO from the long version's scripts. Keep the 47-lives ending intact — it's the line that gets the share.

---

## 10. The single most important rule

**Cold-open lands the deck before the tech does.**

Judges watch hundreds of demo videos. Almost every one opens with "Hello, we are team X and our project is Y." Yours opens with a real disaster, a real number, and a real name (Wayanad). By the time the title card lands at 0:28, the judge is already emotionally inside your problem. Every technical brag in Act II then *means something* — it's not "look at our cool stack," it's "this stack saves forty-seven lives."

That's the line that wins the 25% Cause category before a judge has reviewed a single line of your code.

---

## 11. Final submission checklist

- [ ] Runtime ≤ 3:00 (verified in player, not just timeline)
- [ ] All on-screen text readable at 360p (test it on YouTube's lowest quality)
- [ ] No copyrighted music (use only the recommended royalty-free tracks)
- [ ] All photo/footage credits visible on end slate
- [ ] Subtitles burnt in + separate `.srt` file uploaded
- [ ] No personal info visible (emails, phone numbers, real names except Priya in the demo data)
- [ ] Mapbox token is restricted to your demo URL (not exposed)
- [ ] Uploaded to YouTube as **Unlisted** (not Private — judges can't open Private)
- [ ] Link tested in an incognito window
- [ ] Link added to the Solution Challenge submission form

---

**You don't need to film this beautifully — you need to land emotionally in the first 35 seconds and prove the loop in the next 115. The 30-second close is the one judges remember.**

Good luck. *जय हिंद.*
