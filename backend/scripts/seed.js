// issue samples for demo and testing purposes
const mongoose = require("mongoose");
const config = require("../src/config");
const Issue = require("../src/models/Issue");

const CENTER = {
  lat: parseFloat(process.env.SEED_LAT || "18.5204"),
  lng: parseFloat(process.env.SEED_LNG || "73.8567"),
};

const TEMPLATES = {
  road: [["Deep pothole on main road", "A large pothole that damages two-wheelers, especially after rain."], ["Broken footpath near bus stop", "Slabs are cracked and uneven; hard for elders to walk."], ["Road caved in after pipeline work", "The trench was never repaired properly and has sunk."]],
  garbage: [["Garbage not collected for a week", "Waste is overflowing from the bin and attracting stray dogs."], ["Illegal dumping at empty plot", "People dump construction debris and household waste here."], ["Overflowing public dustbin", "The bin is full and rubbish spills on to the road."]],
  streetlight: [["Streetlight not working", "The whole stretch is dark at night and feels unsafe."], ["Flickering light near park gate", "The lamp keeps flickering and goes off after 9 pm."]],
  water: [["Water pipe leaking on the road", "Clean water is wasted every day and the road is slippery."], ["No water supply since morning", "The whole lane has had no supply for two days."], ["Drain blocked and overflowing", "Dirty water is flooding the street."]],
  public_space: [["Broken swings in children's park", "Two swings are broken and the metal edges are sharp."], ["Bench broken in garden", "Seating is damaged and unsafe to sit on."]],
  other: [["Stray dog menace", "A pack of dogs chases cyclists in the evening."], ["Open manhole without a cover", "A dangerous open manhole next to the footpath."]],
};
const AREAS = ["MG Road", "Station Road", "Market Lane", "Temple Street", "Park Avenue", "College Road", "Lake View", "Old City Gate"];
const NAMES = ["Aarav", "Meera", "Rohan", "Sana", "Kabir", "Isha", "Vivek", "Nisha"];

let s = 42;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];

function build(i) {
  const category = Object.keys(TEMPLATES)[i % 6];
  const [title, description] = pick(TEMPLATES[category]);
  const roll = rnd();
  const status = roll < 0.35 ? "reported" : roll < 0.55 ? "acknowledged" : roll < 0.75 ? "in_progress" : "resolved";
  const ageDays = 2 + Math.floor(rnd() * 150);
  const createdAt = new Date(Date.now() - ageDays * 86400000);
  const at = (d) => new Date(createdAt.getTime() + d * 86400000);
  const history = [{ status: "reported", note: "Issue reported", at: createdAt }];
  let resolvedAt = null;
  if (status !== "reported") history.push({ status: "acknowledged", note: "Seen by the ward office", at: at(Math.min(2, ageDays)) });
  if (status === "in_progress" || status === "resolved") history.push({ status: "in_progress", note: "Work has started", at: at(Math.min(5, ageDays)) });
  if (status === "resolved") {
    const d = Math.min(ageDays, 6 + Math.floor(rnd() * 25));
    resolvedAt = at(d);
    history.push({ status: "resolved", note: "Fixed and checked", at: resolvedAt });
  }
  const lat = CENTER.lat + (rnd() - 0.5) * 0.09;
  const lng = CENTER.lng + (rnd() - 0.5) * 0.09;
  const votes = Math.floor(rnd() * 40);
  const upvotes = Array.from({ length: votes }, (_, k) => `demo-voter-${i}-${k}`);
  return {
    title, description, category, status,
    address: `${pick(AREAS)}`,
    location: { type: "Point", coordinates: [+lng.toFixed(6), +lat.toFixed(6)] },
    reporter: { uid: "demo-user-" + (i % NAMES.length), name: NAMES[i % NAMES.length] },
    upvotes, upvoteCount: votes,
    statusHistory: history, resolvedAt, demo: true,
    createdAt, updatedAt: resolvedAt || createdAt,
  };
}

async function main() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
  if (process.argv.includes("--reset")) {
    const r = await Issue.deleteMany({ demo: true });
    console.log(`Removed ${r.deletedCount} earlier demo issues.`);
  }
  await Issue.init();
  const docs = Array.from({ length: 36 }, (_, i) => build(i));
  await Issue.insertMany(docs, { timestamps: false });
  console.log(`Added ${docs.length} demo issues around ${CENTER.lat}, ${CENTER.lng}.`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
