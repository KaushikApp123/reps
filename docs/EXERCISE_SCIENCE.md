# Exercise science behind the app's logic

This is the reasoning encoded in `src/lib/muscles.ts`, `src/lib/exercise-library.ts`,
and the day templates in `src/lib/splits.ts`. It exists so future changes to the
tagging are made deliberately rather than by vibes.

## The core idea

A muscle is not a single unit you either "train" or "don't". Most of the muscles
people care about have heads or regions that respond to *different joint angles*.
Two exercises can both be labelled "shoulders" and produce almost no overlapping
growth. That's why the exercise library tags at head level (`Side Delt`,
`Triceps Long Head`) rather than by coarse group, and why the coverage checker
grades a day against a head-level checklist.

**A muscle listed only as `secondary` does not count as covered.** Overhead
pressing brushes the side delts; it is not side delt training. That distinction
is the entire point of the coverage feature.

## Shoulders — the most commonly botched muscle

| Head | Trained by | Notes |
|---|---|---|
| Front delt | Overhead press, any horizontal press | Usually *over*-trained: it works on every chest day too |
| Side delt | Lateral raises (abduction) | Pressing does not build it — needs dedicated abduction |
| Rear delt | Face pulls, reverse flyes, rows | Needs horizontal abduction; easy to skip entirely |

EMG comparisons put lateral raises far ahead of overhead pressing for the lateral
head (~66% vs ~28% MVC in one comparison), while the overhead press dominates for
the anterior head. Lateral raises also out-activate pressing for the posterior
head. Practical upshot, encoded in the Push/Upper day templates: **a day with only
presses fails its shoulder requirement.**

## Triceps — the long head needs an overhead angle

The long head is the only head that crosses the shoulder joint, so it's only
loaded in a stretched position — arms overhead. A study in the *European Journal
of Sport Science* found overhead extensions produced roughly **50% more long-head
growth** than neutral-arm pushdowns. Pushdowns, meanwhile, bias the lateral head.
The medial head works in essentially all elbow extension.

So a complete triceps day needs **both** an overhead movement and a pushdown —
which is what `PUSH` requires.

## Biceps — position of the shoulder decides the head

- **Long head (outer):** lengthened by shoulder *extension* → incline dumbbell
  curls, Bayesian cable curls.
- **Short head (inner):** favoured by shoulder *flexion* → preacher and spider curls.
- **Brachialis / brachioradialis:** neutral and pronated grips → hammer and
  reverse curls. Hammer curls show notably lower biceps activation than supinated
  curls, which is why they're tagged brachialis-primary, not biceps-primary.

## Chest — incline angle matters, and only up to a point

Upper (clavicular) fibres peak around a **30° incline**; past ~45° the front delt
takes over and upper-pec activation actually falls. Flat pressing favours the
sternal (mid) fibres, which are most active at 0°. Decline and dips bias the lower
fibres. A hypertrophy study found an incline-only group gained significantly more
upper-chest thickness than flat-only or mixed groups.

Hence Push and Upper days require **both** `Upper Chest` and `Mid Chest`.

## Back — two planes, not one

- **Vertical pulls** (pull-ups, pulldowns) bias the **lats** and lower traps.
- **Horizontal pulls** (rows) recruit **mid traps and rhomboids** substantially more.

These aren't interchangeable, so the Pull and Upper templates require lats *and*
rhomboids/mid traps, which forces at least one movement from each plane.

## Quads — squats barely grow the rectus femoris

The rectus femoris crosses the hip, so during a squat it's working against its own
shortening at the hip and gets little stimulus. Studies show squat training grows
the vastii (notably vastus lateralis) while producing minimal rectus femoris
hypertrophy; leg extensions grow all three regions of the rectus femoris because
they load it in a shortened position the squat never reaches.

That's why `Rectus Femoris` is a separate required muscle from `Quads (Vastii)` —
a leg day of squats and presses alone will correctly be flagged incomplete.

## Hamstrings — hip function and knee function are different

- **Hip extension** (RDLs, back extensions) grows the **long head of biceps
  femoris and semimembranosus**.
- **Knee flexion** (leg curls, Nordics) grows the **short head of biceps femoris
  and semitendinosus**.

Seated leg curls (hip flexed, hamstrings lengthened) bias the long head and
semimembranosus more than lying curls. Both functions are required on leg days —
tagged `Hamstrings (Hip)` and `Hamstrings (Knee)`.

## Glutes — and the honest caveat about EMG

Hip thrusts produce higher glute EMG than squats at every measured site, but a
controlled trial found **similar glute max hypertrophy** from hip thrust and back
squat training when volume was equated. Neither grew the gluteus medius, which
needs abduction work.

This is the general caveat worth remembering: **EMG activation is not hypertrophy.**
Where activation data and growth data disagree, the tagging in this app follows the
growth data. The `hip_thrust` and `squat` patterns are treated as comparable for
glute max; `Glute Medius` is only satisfied by `hip_abduction` exercises.

## Calves — knee angle selects the muscle

Knee straight (standing raises) → **gastrocnemius**, which crosses the knee.
Knee bent (seated raises) → **soleus**, since the bent knee takes the gastroc out.
Tagged separately, so a leg day with only standing raises is flagged for soleus.

## How this drives the features

1. **Coverage** (`src/lib/coverage.ts`) grades a day's chosen exercises against
   its required heads. Primary = covered, secondary = "indirect" (still flagged),
   absent = missing.
2. **Substitutions** (`src/lib/substitutions.ts`) require a candidate to share at
   least one *primary* muscle, then rank by shared primaries, matching movement
   pattern, and shared secondaries. This is what makes "the pec deck is taken"
   return cable flyes and dumbbell flyes rather than an unrelated press.
3. **Equipment honesty** (`requiredFor` in `src/lib/splits.ts`) narrows the
   checklist to muscles that at least one exercise at the user's tier trains
   directly. A bodyweight-only user is never told they're missing side delt
   isolation that doesn't exist for them.

## Sources

- [Front vs Back and Barbell vs Machine Overhead Press: An Electromyographic Analysis](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9354811/)
- [Overhead Press vs Lateral Raises: Muscles Worked (EMG)](https://www.shred.app/thinking/overhead-press-vs-lateral-raises-muscles-worked)
- [Triceps long-head growth with overhead extensions (PubMed)](https://pubmed.ncbi.nlm.nih.gov/35819335/)
- [Exercise selection for the hamstrings — Stronger by Science](https://www.strongerbyscience.com/exercise-selection-hamstrings/)
- [Muscle Activation Patterns Among Hip Extension and Knee Flexion Exercises](https://pmc.ncbi.nlm.nih.gov/articles/PMC9362892/)
- [Does Back Squat Exercise Lead to Regional Hypertrophy among Quadriceps Femoris Muscles?](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9737272/)
- [The effects of hip flexion angle on quadriceps hypertrophy in leg extension](https://www.tandfonline.com/doi/full/10.1080/02640414.2024.2444713)
- [Hip thrust and back squat training elicit similar gluteus muscle hypertrophy](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10593473/)
- [The Effect of Different Incline Angles on Clavicular Head Activation](https://eu-opensci.org/index.php/sport/article/view/9255)
- [Is Regional Hypertrophy Predictable? — Stronger by Science](https://www.strongerbyscience.com/regional-hypertrophy/)
- [Distinct muscle growth after preacher and incline biceps curl](https://www.researchgate.net/publication/388004281_Distinct_muscle_growth_and_strength_adaptations_after_preacher_and_incline_biceps_curl)
