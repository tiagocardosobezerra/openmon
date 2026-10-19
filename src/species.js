'use strict';

// Everything about the creature that is data, not logic: stats, stages,
// thresholds, lineages, natures, the Opendex and dialogue. The renderer
// gets this through /api/species, so a theme pack only has to replace this
// file and the art.

const STATS = ['craft', 'lore', 'shell', 'test', 'roam', 'swarm', 'docs', 'git', 'debug', 'data', 'style'];

const STAT_LABELS = {
  craft: 'Craft',
  lore: 'Lore',
  shell: 'Shell',
  test: 'Test',
  roam: 'Roam',
  swarm: 'Swarm',
  docs: 'Docs',
  git: 'Git',
  debug: 'Debug',
  data: 'Data',
  style: 'Style',
};

// Agents read and search far more than they browse or spawn subagents.
// Raw counts would make almost every pet a Lore pet, so the lineage is
// picked by weighted affinity: rare work counts more.
// Docs, style and data edits are taken out of Craft; git commands out of
// Shell; Debug only grows when a failure is fixed, so it is the rarest.
const STAT_WEIGHTS = { craft: 1, lore: 0.5, shell: 0.7, test: 1, roam: 3, swarm: 5, docs: 1.3, git: 1.6, debug: 3, data: 2, style: 1.4 };

// Ordered. `xp` is the total XP needed; `bond` is an extra gate.
const STAGES = [
  { id: 'egg', xp: 0 },
  { id: 'sprout', xp: 30 },
  { id: 'juvenile', xp: 400 },
  { id: 'adult', xp: 3000 },
  { id: 'mythic', xp: 15000, bond: 60 },
];

const LINEAGES = {
  craft: { juvenile: 'Tinkit', adult: 'Forgemaw', mythic: 'Archsmith' },
  lore: { juvenile: 'Owlet', adult: 'Scrollwyrm', mythic: 'Oracle' },
  shell: { juvenile: 'Sparkle', adult: 'Voltcrab', mythic: 'Kernel' },
  test: { juvenile: 'Shellby', adult: 'Bastion', mythic: 'Aegis' },
  roam: { juvenile: 'Wisp', adult: 'Skyfin', mythic: 'Wayfarer' },
  swarm: { juvenile: 'Mote', adult: 'Hivekin', mythic: 'Legion' },
  docs: { juvenile: 'Inkling', adult: 'Quillmane', mythic: 'Archivist' },
  git: { juvenile: 'Twiglet', adult: 'Branchoak', mythic: 'Mergewood' },
  debug: { juvenile: 'Mitey', adult: 'Beetlock', mythic: 'Bugbane' },
  data: { juvenile: 'Cubit', adult: 'Prismora', mythic: 'Datanaut' },
  style: { juvenile: 'Dabbit', adult: 'Palettail', mythic: 'Chromancer' },
  // Hidden line: appears only when two kinds of work are almost exactly tied.
  chimera: { adult: 'Chimera', mythic: 'Paragon' },
};

// How close the top two affinities must be (and how big the second one)
// for the hidden Chimera line.
const CHIMERA_GAP = 0.04;
const CHIMERA_MIN = 0.2;

const BASE_FORMS = { egg: 'Egg', sprout: 'Sprout' };

// Legendaries: one form each, never evolving. Each joins your Party (or
// Box) once, the first time its feat is done.
const LEGENDS = {
  mergeon: { name: 'Mergeon', text: 'Two rivers that met and became one. It appears when your first pull request is merged.' },
  aeonbyte: { name: 'Aeonbyte', text: 'Its hourglass has counted a whole year of work with you. The sand inside is made of tiny pixels.' },
  zeroday: { name: 'Zeroday', text: 'A calm guardian with a single eye. It has watched a hundred bugs get fixed and never blinked.' },
};

// The Opendex: one entry per form, numbered like a field guide.
const DEX = [
  { key: 'egg', text: 'Warm to the touch. It listens to every keystroke and hatches when it has heard enough.' },
  { key: 'sprout', text: 'Newly hatched and endlessly curious. The leaf on its head turns toward whatever the agent is doing.' },
  { key: 'craft-juvenile', text: 'Taps on anything it can reach. Its stubby horns warm up after a long edit.' },
  { key: 'craft-adult', text: 'Hammers rough code into shape on a tiny anvil. Wears its goggles even while asleep.' },
  { key: 'craft-mythic', text: 'Said to have forged the first compiler. A crown of embers burns brighter with every clean build.' },
  { key: 'lore-juvenile', text: 'Reads faster than it can blink. Gets grumpy when a file is longer than it expected.' },
  { key: 'lore-adult', text: 'Its tail is a scroll of every file it has ever read. It never forgets a line number.' },
  { key: 'lore-mythic', text: 'Its third eye sees the whole codebase at once. Speaks only in perfectly cited answers.' },
  { key: 'shell-juvenile', text: 'Its antenna crackles when a command is about to run. Loves the smell of a fresh terminal.' },
  { key: 'shell-adult', text: 'Snaps its pincers in time with the cursor. Can pipe anything into anything.' },
  { key: 'shell-mythic', text: 'Lives at ring zero. Every process on the machine bows when it walks past.' },
  { key: 'test-juvenile', text: 'Hides in its shell at the first red test, then peeks out to try again.' },
  { key: 'test-adult', text: 'A wall that no regression has ever crossed. Its shell gets harder with every green run.' },
  { key: 'test-mythic', text: 'Its golden shield turns failures into lessons. Bugs refuse to hatch near it.' },
  { key: 'roam-juvenile', text: 'Drifts from page to page on warm currents of curiosity.' },
  { key: 'roam-adult', text: 'Swims through the open web as easily as through the sky. Always comes back with a link.' },
  { key: 'roam-mythic', text: 'Has visited every corner of the internet and kept a postcard from each one.' },
  { key: 'swarm-juvenile', text: 'Never alone for long. Tiny copies of it keep appearing when there is too much to do.' },
  { key: 'swarm-adult', text: 'A cheerful little colony. Each buddy handles one job, then hurries back to the hive.' },
  { key: 'swarm-mythic', text: 'Commands a thousand helpers with a single thought. Its crown is made of loyal motes.' },
  { key: 'chimera-adult', text: 'Born when two kinds of work weigh exactly the same. Each eye belongs to a different lineage.', hidden: true },
  { key: 'chimera-mythic', text: 'A perfect balance that few trainers ever reach. Researchers argue about which lineage it really is.', hidden: true },
  { key: 'docs-juvenile', text: 'Made of a single folded page. A drop of ink on its cheek shows the last word it wrote.' },
  { key: 'docs-adult', text: 'Its quill tail never runs dry. It writes down what the code does before anyone forgets.' },
  { key: 'docs-mythic', text: 'An open book floats above its head, rewriting itself to stay true to the code.' },
  { key: 'git-juvenile', text: 'A sprout of warm wood. Its leaf twitches every time something is committed.' },
  { key: 'git-adult', text: 'Its branches split apart and grow back together without a single conflict.' },
  { key: 'git-mythic', text: 'An ancient tree spirit. Every branch ever made is braided into its crown.' },
  { key: 'debug-juvenile', text: 'A tiny beetle that crawls into errors. It is happiest right after one goes away.' },
  { key: 'debug-adult', text: 'Studies every stack trace through its lens. No bug hides from it for long.' },
  { key: 'debug-mythic', text: 'Its wing case opens like a cape when a bug is finally fixed for good.' },
  { key: 'data-juvenile', text: 'A small crystal cube. Its core glows a little brighter for every row it counts.' },
  { key: 'data-adult', text: 'Rows of tiny lights run inside it like a table. It can tell you any number you ask.' },
  { key: 'data-mythic', text: 'Small cubes orbit it like moons, each holding a query it answered once.' },
  { key: 'style-juvenile', text: 'A pink chameleon that turns a little bolder every time a colour changes.' },
  { key: 'style-adult', text: 'Paints with its brush tail. It cannot walk past a misaligned button.' },
  { key: 'style-mythic', text: 'Its stripes shift through every colour. Interfaces grow prettier wherever it goes.' },
  { key: 'mergeon', text: LEGENDS.mergeon.text, legend: true },
  { key: 'aeonbyte', text: LEGENDS.aeonbyte.text, legend: true },
  { key: 'zeroday', text: LEGENDS.zeroday.text, legend: true },
];

// Rolled at birth. Each changes idle behaviour and what the pet says.
const NATURES = {
  brave: { label: 'Brave', text: 'Hops around a lot and cheers loudly.' },
  sleepy: { label: 'Sleepy', text: 'Naps whenever it can and yawns between tasks.' },
  curious: { label: 'Curious', text: 'Always looking around at what you are doing.' },
  cheerful: { label: 'Cheerful', text: 'Bouncy, and celebrates every little win.' },
  calm: { label: 'Calm', text: 'Slow and steady. Rarely surprised by anything.' },
  cheeky: { label: 'Cheeky', text: 'Winks at you and makes jokes about your code.' },
};

const SHINY_ODDS = 128;

// Daily missions: three a day, picked from this pool, each worth XP and bond.
// They reward habits that help you anyway: answering your agent quickly,
// green tests, finished turns.
const MISSIONS = [
  { id: 'fast', counter: 'fastAnswers', target: 3 },
  { id: 'green', counter: 'green', target: 3 },
  { id: 'turns', counter: 'turns', target: 5 },
  { id: 'pets', counter: 'pets', target: 3 },
  { id: 'tools', counter: 'tools', target: 100 },
  { id: 'edits', counter: 'edits', target: 20 },
];
const MISSION_XP = 25;
const PERFECT_DAY_XP = 50;

const ACHIEVEMENTS = {
  hatch: { title: 'Hello, world', text: 'Your Openmon hatched.' },
  'first-green': { title: 'First green', text: 'Your agent got a test run to pass.' },
  'first-evolution': { title: 'Growing up', text: 'First evolution.' },
  'green-100': { title: 'Green machine', text: '100 green test runs.' },
  'edits-1000': { title: 'Thousand cuts', text: '1,000 edits.' },
  marathon: { title: 'Marathon', text: '50 actions in a single request to your agent.' },
  swarm: { title: 'Swarm lord', text: 'Five agents working at the same time.' },
  'night-owl': { title: 'Night owl', text: 'Your agent worked between midnight and 5 am.' },
  'quick-hands': { title: 'Quick hands', text: 'Answered your agent quickly 10 times in one day.' },
  'best-friends': { title: 'Best friends', text: 'Friendship reached 100.' },
  mythic: { title: 'Elder', text: 'Became an Elder.' },
  shiny: { title: 'Shiny!', text: 'A one-in-128 shiny Openmon hatched.' },
  hidden: { title: "Who's that Openmon?", text: 'Found a hidden form.', secret: true },
  nocturne: { title: 'Born of the night', text: 'Evolved between midnight and 5 am, into its Nocturne colours.', secret: true },
  legend: { title: 'Legendary', text: 'A legendary Openmon joined your team.' },
  friendship: { title: 'Bond of friendship', text: 'Became an Elder with full friendship.', secret: true },
};

// Accessories: earned by playing, kept forever (across generations), worn
// one per slot. Labels and unlock hints live in the UI strings.
const COSMETICS = {
  cap: { slot: 'head' },
  party: { slot: 'head' },
  beanie: { slot: 'head' },
  headphones: { slot: 'head' },
  flower: { slot: 'head' },
  nightcap: { slot: 'head' },
  wizard: { slot: 'head' },
  crown: { slot: 'head' },
  scarf: { slot: 'neck' },
  bowtie: { slot: 'neck' },
  bandana: { slot: 'neck' },
  medal: { slot: 'neck' },
  // Designer art (public/wear/<id>.svg), placed from each sprite's anchors.
  'glasses-round': { slot: 'face', svg: true },
  'glasses-dark': { slot: 'face', svg: true },
  monocle: { slot: 'face', svg: true },
  'hero-mask': { slot: 'face', svg: true },
  hardhat: { slot: 'head', svg: true },
  'leaf-crown': { slot: 'head', svg: true },
  'explorer-hat': { slot: 'head', svg: true },
  'chef-hat': { slot: 'head', svg: true },
  bow: { slot: 'head', svg: true },
  'star-tiara': { slot: 'head', svg: true },
  'pumpkin-hat': { slot: 'head', svg: true },
  'santa-hat': { slot: 'head', svg: true },
  'party-hat-gold': { slot: 'head', svg: true },
  necktie: { slot: 'neck', svg: true },
  pearls: { slot: 'neck', svg: true },
  cape: { slot: 'neck', svg: true },
  bell: { slot: 'neck', svg: true },
  backpack: { slot: 'neck', svg: true },
};

const WEAR_SLOTS = ['head', 'face', 'neck'];

// Items in the bag. Snacks, candies and charms are used up; the Steady stone
// and the type stones are held. A held stone is spent at the next
// evolution, which then goes to the stone's type.
const ITEMS = {
  snack: { use: 'eat' },
  candy: { use: 'eat' },
  'friend-candy': { use: 'eat' },
  'xp-charm': { use: 'eat' },
  'mystery-egg': { use: 'hatch' },
  everstone: { use: 'hold' },
};
for (const t of STATS) ITEMS[`stone-${t}`] = { use: 'hold', stone: t };

// Elder forms that grow differently when friendship is full (100) at the
// moment of evolving. Lineages without friendship art keep the usual form.
const FRIEND_FORMS = ['craft', 'lore'];

function stageIndex(id) {
  return STAGES.findIndex((s) => s.id === id);
}

function formKey(stage, lineage) {
  return BASE_FORMS[stage] ? stage : `${lineage}-${stage}`;
}

function formName(stage, lineage, legend = null) {
  if (legend && LEGENDS[legend]) return LEGENDS[legend].name;
  if (BASE_FORMS[stage]) return BASE_FORMS[stage];
  return (LINEAGES[lineage] && LINEAGES[lineage][stage]) || 'Openmon';
}

// Dex entries with number, name, stage and lineage filled in.
function dexEntries() {
  return DEX.map((entry, i) => {
    if (entry.legend) return { no: i + 1, key: entry.key, stage: 'legendary', lineage: null, legend: entry.key, name: LEGENDS[entry.key].name, text: entry.text, hidden: true };
    const [lineage, stage] = entry.key.includes('-') ? entry.key.split('-') : [null, entry.key];
    return { no: i + 1, key: entry.key, stage, lineage, name: formName(stage, lineage), text: entry.text, hidden: Boolean(entry.hidden) };
  });
}

module.exports = {
  STATS,
  STAT_LABELS,
  STAT_WEIGHTS,
  STAGES,
  LINEAGES,
  BASE_FORMS,
  NATURES,
  SHINY_ODDS,
  MISSIONS,
  MISSION_XP,
  PERFECT_DAY_XP,
  CHIMERA_GAP,
  CHIMERA_MIN,
  ACHIEVEMENTS,
  COSMETICS,
  WEAR_SLOTS,
  ITEMS,
  LEGENDS,
  FRIEND_FORMS,
  stageIndex,
  formKey,
  formName,
  dexEntries,
};
