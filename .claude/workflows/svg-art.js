export const meta = {
  name: 'svg-art',
  description: 'Create hand-inked SVG art & animations for Wick’s End through a render → critique → revise visual loop',
  whenToUse: 'When you want new or improved SVG sprites/animations that match art/STYLE.md, reviewed visually until they pass the rubric',
  phases: [
    { title: 'Draft', detail: 'author writes the SVG, renders a contact sheet, self-checks it' },
    { title: 'Critique & revise', detail: 'independent critic scores the rendered sheet; reviser fixes; repeat until pass' },
    { title: 'Art direction', detail: 'one director compares every asset side by side for consistency' },
    { title: 'Harmonize', detail: 'targeted consistency fixes, each re-checked by a fresh critic' },
    { title: 'Gallery', detail: 'build art/gallery.html and a screenshot' },
  ],
}

// ---------------------------------------------------------------- config
// args: { assets: [{ id, brief, base? }], maxRounds?: 3, passAvg?: 8, passMin?: 7, harmonize?: true }
// base: id of another asset in the same run whose rig/character this one must reuse (runs after it)
const ROOT = '/Users/alan/DontStarveClone/wicks-end'
const assets = (args && args.assets) || []
if (!assets.length) throw new Error('pass args.assets: [{ id: "campfire", brief: "..." }]')
const MAX_ROUNDS = (args && args.maxRounds) || 3
const PASS_AVG = (args && args.passAvg) || 8
const PASS_MIN = (args && args.passMin) || 7
const HARMONIZE = !(args && args.harmonize === false)

const RENDER = (id) => `cd ${ROOT} && node art/tools/render.mjs art/assets/${id}.svg`
const SHEET = (id) => `${ROOT}/art/renders/${id}.sheet.png`
const COMMON = `Project: Wick's End, a gothic hand-inked survival game (repo ${ROOT}).
The style guide and scoring rubric are in ${ROOT}/art/STYLE.md. Read it fully before doing anything.
The review harness is \`${RENDER('<id>')}\`. It prints a JSON report and writes a contact sheet PNG to art/renders/<id>.sheet.png.
The sheet shows the animation frames, an onion-skin overlay, a greyscale and a solid silhouette, the sprite at game scale on day and night ground, and a large hero view.
You MUST look at the rendered PNG with the Read tool. Judge what you see, not what you intended.`

const SCORES = {
  type: 'object',
  properties: {
    silhouette: { type: 'number' },
    style: { type: 'number' },
    craft: { type: 'number' },
    appeal: { type: 'number' },
    animation: { type: 'number', description: 'use 10 for static assets' },
    technical: { type: 'number' },
  },
  required: ['silhouette', 'style', 'craft', 'appeal', 'animation', 'technical'],
}
const CRITIQUE = {
  type: 'object',
  properties: {
    scores: SCORES,
    strengths: { type: 'array', items: { type: 'string' } },
    fixes: {
      type: 'array',
      description: 'most important first, max 5; each a concrete, visual instruction',
      items: {
        type: 'object',
        properties: { issue: { type: 'string' }, fix: { type: 'string' } },
        required: ['issue', 'fix'],
      },
    },
  },
  required: ['scores', 'fixes'],
}
const AUTHOR_OUT = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    renders: { type: 'number', description: 'how many times you rendered and looked' },
    notes: { type: 'string', description: 'what you changed after looking, one or two sentences' },
  },
  required: ['file', 'notes'],
}

const verdict = (s) => {
  const v = Object.values(s)
  const avg = v.reduce((a, b) => a + b, 0) / v.length
  return { avg: Math.round(avg * 10) / 10, min: Math.round(Math.min(...v) * 10) / 10, pass: avg >= PASS_AVG && Math.min(...v) >= PASS_MIN }
}
const fmt = (s) => Object.entries(s).map(([k, n]) => `${k} ${Math.round(n * 10) / 10}`).join(', ')

// ---------------------------------------------------------------- agents
const author = (a) =>
  agent(
    `${COMMON}

Create the asset "${a.id}" at ${ROOT}/art/assets/${a.id}.svg.
Brief: ${a.brief}
${a.base ? `\nIMPORTANT: this is a new animation of an existing, already-approved puppet. Start by copying ${ROOT}/art/assets/${a.base}.svg.
Reuse its parts, proportions, palette, filigree and joint structure EXACTLY: same character, same rig. Change only the poses and animation.
Render ${a.base} too if you need to compare, so they look like the same puppet.\n` : ''}
Work in a tight visual loop:
1. Write the SVG following STYLE.md: 256×256 viewBox, feet at y≈232, ink outlines, hatching, palette, and a seamless looping animation if the brief implies motion.
2. Run the harness and Read the sheet PNG.
3. Compare what you see to the brief and the rubric. Fix the most visible problem first: silhouette, then proportions, then line quality, then motion arcs in the onion skin. Re-render.
Repeat until you'd honestly score it 8+ on every rubric line, or until you've rendered 4 times. Fix any warnings or errors in the JSON report.`,
    { label: `draft:${a.id}`, phase: 'Draft', schema: AUTHOR_OUT },
  )

const critic = (a, round) =>
  agent(
    `${COMMON}

You are an exacting art director reviewing "${a.id}" (round ${round}). You did NOT make it. Your job is to find what keeps it from being beautiful.
Brief: ${a.brief}

1. Run the harness yourself, so you are looking at the current file, and Read ${SHEET(a.id)}. Also read the SVG source if you need it.
2. Score each rubric dimension 0–10 against STYLE.md. Calibration: a competent first draft is about 5–6; an 8 is portfolio-worthy; don't inflate.
3. List up to 5 fixes, most impactful first. Each fix must be concrete and visual, e.g. "the left leg is 30% too short; extend it to y=232", not "improve proportions".
Check especially:
- Does the solid silhouette read at 40 px?
- Is the look hand-inked or clip-art?
- Do the onion-skin arcs look natural, and does the loop seam pop between the last frame and the first?
- Is the palette on-guide?
Do NOT edit the file.`,
    { label: `critic:${a.id}#${round}`, phase: 'Critique & revise', schema: CRITIQUE },
  )

const reviser = (a, crit, round, phaseName) =>
  agent(
    `${COMMON}

Revise ${ROOT}/art/assets/${a.id}.svg (brief: ${a.brief}).
An independent critic scored it: ${fmt(crit.scores)}.
Strengths to KEEP: ${(crit.strengths || []).join('; ') || '(none listed)'}
Fixes to make, in priority order:
${crit.fixes.map((f, i) => `${i + 1}. ${f.issue} → ${f.fix}`).join('\n')}

Apply the fixes. Render after each significant change and Read the sheet to confirm the fix is visible and nothing else regressed. Render at most 4 times.
Edit in place; rewrite whole sections if that's cleaner.`,
    { label: `revise:${a.id}#${round}`, phase: phaseName, schema: AUTHOR_OUT },
  )

/** Critic gate loop: critique → (pass? stop) → revise → critique … up to MAX_ROUNDS critiques. */
async function iterate(a, startRound, maxRounds, phaseName) {
  const history = []
  for (let round = startRound; round < startRound + maxRounds; round++) {
    const crit = await critic(a, round)
    if (!crit) break
    const v = verdict(crit.scores)
    history.push({ round, ...v, scores: crit.scores })
    log(`${a.id} round ${round}: avg ${v.avg}, min ${v.min}${v.pass ? ' ✓ pass' : ''} (${fmt(crit.scores)})`)
    if (v.pass || round === startRound + maxRounds - 1) {
      if (!v.pass) log(`${a.id}: stopped after ${maxRounds} critique round(s) without passing; the last fixes were not applied`)
      return { id: a.id, pass: v.pass, final: v, history, lastFixes: v.pass ? [] : crit.fixes }
    }
    await reviser(a, crit, round, phaseName)
  }
  return { id: a.id, pass: false, history }
}

// ---------------------------------------------------------------- run
log(`${assets.length} asset(s); pass = avg ≥ ${PASS_AVG} and every score ≥ ${PASS_MIN}; up to ${MAX_ROUNDS} critique rounds each`)

// Per asset, independently: draft → critique/revise loop (no barrier; fast assets finish early)
// Assets with a \`base\` (e.g. walk/chop built on the idle rig) start as soon as their base finishes.
const settled = {}
const runOne = (a) => {
  if (!settled[a.id]) {
    settled[a.id] = (async () => {
      const base = a.base && assets.find((b) => b.id === a.base)
      if (base) await runOne(base)
      await author(a)
      return iterate(a, 1, MAX_ROUNDS, 'Critique & revise')
    })()
  }
  return settled[a.id]
}
const results = await parallel(assets.map((a) => () => runOne(a)))

// Cross-asset consistency needs every sheet at once, so a barrier is justified here
let harmonized = []
if (HARMONIZE && assets.length > 1) {
  phase('Art direction')
  const DIRECTION = {
    type: 'object',
    properties: {
      notes: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } },
          required: ['id', 'issue', 'fix'],
        },
      },
    },
    required: ['notes'],
  }
  const dir = await agent(
    `${COMMON}

You are the lead art director. Read EVERY contact sheet below and judge the set as ONE game's art.
Look for: relative scale (a hog next to a tree), line weight, palette drift, hatching density, lighting direction, animation tempo and energy.
Sheets: ${assets.map((a) => SHEET(a.id)).join(', ')}
Return consistency notes only for assets that clash with the majority. Each note needs a concrete fix. Return an empty list if the set is coherent. Do NOT edit files.`,
    { label: 'director', phase: 'Art direction', schema: DIRECTION },
  )
  const byId = {}
  for (const n of (dir && dir.notes) || []) (byId[n.id] = byId[n.id] || []).push(n)
  const flagged = assets.filter((a) => byId[a.id])
  log(flagged.length ? `director flagged: ${flagged.map((a) => a.id).join(', ')}` : 'director: the set is coherent')
  harmonized = await pipeline(
    flagged,
    (a) => reviser(a, { scores: { consistency: 0 }, strengths: ['everything the director did not mention'], fixes: byId[a.id] }, 'H', 'Harmonize'),
    (_r, a) => iterate(a, MAX_ROUNDS + 1, 1, 'Harmonize'),
  )
}

phase('Gallery')
const gallery = await agent(
  `Run \`cd ${ROOT} && node art/tools/gallery.mjs\`, then Read ${ROOT}/art/renders/gallery.png. Reply with one sentence on how the set looks together, plus the gallery path.`,
  { label: 'gallery', phase: 'Gallery' },
)

const final = results.filter(Boolean).map((r) => {
  const h = harmonized.filter(Boolean).find((x) => x.id === r.id)
  return h ? { ...r, harmonized: h.final, pass: h.pass } : r
})
return { assets: final, gallery }
