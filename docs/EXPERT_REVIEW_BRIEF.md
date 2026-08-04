# SetSwipe — brief for an expert reviewer

**What I'd like from you:** a rating of the exercises in this app's library, plus a
sanity check on how it decides what a training day owes you. Details of the exact
scoring at the bottom — but read the first two sections first, because the way the
app models muscles changes what the ratings are *for*.

Live app: **setswipe.vercel.app** · Code: **github.com/KaushikApp123/setswipe**

---

## 1. What the app does

It builds a training programme for someone, then guides them through each session.

1. **Onboarding** — days per week, goal (strength / muscle growth / general),
   equipment (bodyweight only / home / full gym).
2. **Split recommendation** — rule-based, no AI. 2–3 days → Full Body or PPL,
   4 → Upper/Lower, 5 → PPL + Upper/Lower, 6 → PPL ×2 or Arnold.
3. **Swipe to build** — the user swipes through exercises filtered to their
   equipment and that day's target muscles. Right = add.
4. **Guided session** — one exercise at a time, with a suggested weight from their
   last logged performance, a rest timer, and automatic PR detection.
5. **Mid-session swap** — if a machine is taken, it offers ranked alternatives.

---

## 2. The bit that matters most: muscles are modelled at head level

Most apps tag an exercise "shoulders". This one tags it `Side Delt` or `Front Delt`,
because those need different exercises and the distinction is the whole point.

The library currently tags **34 distinct muscles/regions**, including:

- Delts split into **front / side / rear** (plus rotator cuff)
- Triceps split into **long / lateral / medial** heads
- Biceps split into **long / short** head, plus brachialis and brachioradialis
- Chest split into **upper / mid / lower**
- Back split into **lats, rhomboids, mid traps, lower traps, teres major, erectors**
- Quads split into **vastii** vs **rectus femoris**
- Hamstrings split by function: **hip extension** vs **knee flexion**
- Calves split into **gastrocnemius** (knee straight) vs **soleus** (knee bent)

Every exercise carries a **primary** list (muscles it's genuinely a good stimulus
for) and a **secondary** list (worked, but not why you'd choose it).

**This is the thing I'd most like checked.** The app grades a training day by
whether every muscle that day owes you has at least one exercise where it's
*primary*. A muscle that only ever shows up as *secondary* is reported as a gap —
so if a push day is all pressing, the app says "no direct work for side delts or
triceps long head."

If the primary/secondary calls are wrong, that grading is wrong.

---

## 3. Reasoning currently baked in

Please tell me where this is wrong, oversimplified, or out of date:

| Claim in the app | Consequence |
|---|---|
| Pressing drives the front delt; side delts need abduction (raises) | A day of presses is flagged as missing side delt work |
| Triceps long head needs an overhead/stretched position; pushdowns bias the lateral head | Both an overhead movement and a pushdown are required for a complete triceps day |
| Biceps long head is lengthened by shoulder extension (incline curls); short head by shoulder flexion (preacher) | Those two are not treated as interchangeable |
| Hammer/reverse grip is brachialis-dominant, not biceps | Hammer curls do **not** satisfy a "biceps" requirement |
| Upper chest peaks near a 30° incline | Incline and flat are separate requirements |
| Squats grow the vastii but barely the rectus femoris | Leg extensions are required separately from squats |
| Hip hinges bias hamstring hip function; leg curls bias knee function | A leg day needs both, not either |
| Standing calf raise = gastroc, seated = soleus | Both required |
| Hip thrust and squat produce similar glute growth despite very different EMG | They're treated as interchangeable for glute max |

The last one reflects a deliberate stance: **where EMG activation and measured
hypertrophy disagree, the app follows hypertrophy.** Push back if you think that's
the wrong call anywhere.

---

## 4. The library

**173 exercises**, in `docs/EXERCISE_LIST.md`, grouped by muscle and marked by
equipment tier:

- `BW` — bodyweight, no equipment at all
- `HOME` — dumbbells, bands, a pull-up bar
- `GYM` — barbells, machines, cables

Tiers are cumulative: a bodyweight exercise shows for everyone; a gym exercise only
at a full gym.

### Known thin spots after a recent trim

| Tier | Muscles with no direct exercise |
|---|---|
| Bodyweight | upper/lower chest, side delt, rear delt, rotator cuff, traps, teres major, erectors, brachialis, brachioradialis, forearms, glute medius, adductors |
| Home | lower chest, lower traps, erectors, adductors |
| Full gym | lower traps, adductors |

**Are any of these worth filling, and with what?** Lower traps and adductors have no
exercise at any tier, which seems like an oversight. Bodyweight-only users currently
get no side or rear delt work at all — I'd like to know whether anything is actually
worth adding there or whether that's just an honest limitation.

---

## 5. What I'd like rated

For each exercise, ideally 1–5:

1. **Stimulus quality** — how good is it for its listed primary muscle(s)?
2. **Is the primary/secondary tagging right?** Especially: anything tagged primary
   that shouldn't be, or a muscle that should be primary and is only secondary.
3. **Technique demand** — how easily does a novice do this badly? (Used to decide
   what to show beginners.)
4. **Injury risk / joint stress** for a general population.
5. **Cut it?** Anything redundant, outdated, or not worth the space.

### Where a rating would change the app most

- **Swipe ordering** — the highest-rated exercise for a gap should surface first.
- **Substitutions** — when a machine is taken, the ranked replacement should be the
  best remaining option, not just a pattern match.
- **Beginner filtering** — high technique-demand lifts could be de-prioritised for
  someone new.

### Also useful, if you have opinions

- Is the split recommendation sensible at each day count?
- Default sets/reps: strength 4×5, muscle growth 3×8–12, general 3×10.
- Rest: strength 180s, growth 90s, general 60s — cut by a third for isolation work.
- Progression rule: add weight only once the top of the rep range is hit on every
  set; otherwise hold weight and chase a rep. Upper body +5 lb, lower +10 lb.
- Plateau rule: flagged when the top set hasn't increased in 3 sessions.

---

## 6. Context worth knowing

- It's a **portfolio project**, not a commercial product — the aim is that the
  training logic is defensible, not that it ships to thousands.
- Exercise selection is currently justified from published research
  (see `docs/EXERCISE_SCIENCE.md` for sources). **Coaching experience contradicting
  a study is a valid answer** — I'd rather know where the literature and the weight
  room disagree.
- Nutrition, cardio programming, and periodisation beyond deload nudges are all
  deliberately out of scope.
