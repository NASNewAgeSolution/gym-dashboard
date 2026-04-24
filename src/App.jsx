import { useState, useEffect, useRef } from "react";

/* ─── GLOBAL STYLES ─────────────────────────────────────── */
const $s = document.createElement("style");
$s.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;overflow-x:hidden;-webkit-text-size-adjust:100%}
  body{background:#07090E;font-family:'Nunito',sans-serif;color:#E8EDF5;overflow-y:auto;-webkit-overflow-scrolling:touch}
  /* CRITICAL: prevent iOS auto-zoom on input focus (font-size must be >= 16px) */
  input,textarea,select{font-size:16px !important;-webkit-appearance:none;border-radius:0}
  ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#FF4500;border-radius:2px}
  @keyframes su{from{opacity:0}to{opacity:1}}
  @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  @keyframes bb{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
  @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  .su{animation:su .25s ease forwards}.spin{animation:spin 1s linear infinite}
  .bb{animation:bb 1.5s ease-in-out infinite}.shake{animation:shake .4s ease}
  .pulse{animation:pulse 2s ease-in-out infinite}
  /* Prevent scroll-jump on input focus */
  input:focus,textarea:focus{outline:none;transform:translateZ(0)}
`;
document.head.appendChild($s);

/* ─── PALETTE ───────────────────────────────────────────── */
const C={bg:"#07090E",surf:"#0D1117",card:"#111827",border:"#1F2937",
  mus:"#FF4500",fat:"#00E676",blue:"#00D4FF",accent:"#AAFF00",
  text:"#E8EDF5",muted:"#6B7A99",warn:"#FFB300",danger:"#FF3366",ok:"#00E676"};
const GOALS={
  muscle:{label:"BUILD MUSCLE",icon:"🏋️",color:C.mus,desc:"26-Week Strength & Mass",weeks:26},
  fat:   {label:"LOSE WEIGHT", icon:"🔥",color:C.fat,desc:"12-Week Fat Burn",      weeks:12},
};
const G=u=>GOALS[u?.goal||"muscle"];
const DAY_NAMES=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/* ─── UTILS ──────────────────────────────────────────────── */
const kgToLbs=kg=>+(kg/0.453592).toFixed(1);
const fmtDate=d=>d.toISOString().split("T")[0];
const todayStr=()=>fmtDate(new Date());
const yesterdayStr=()=>fmtDate(new Date(Date.now()-864e5));
const todayDOW=()=>new Date().getDay();

function calcMusMacros(kg,train){
  const lbs=kgToLbs(kg),cal=Math.round(lbs*(train?20:18));
  return{cal,protein:Math.round(cal*(train?0.30:0.40)/4),carbs:Math.round(cal*(train?0.50:0.30)/4),fat:Math.round(cal*(train?0.20:0.30)/9)};
}
function calcFatMacros(kg,train){
  const lbs=kgToLbs(kg),cal=Math.round(lbs*(train?12:10)),protein=Math.round(lbs),rem=Math.max(cal-protein*4,0);
  return{cal,protein,carbs:Math.max(Math.round(rem*0.65/4),0),fat:Math.max(Math.round(rem*0.35/9),0)};
}

/* ─── MUSCLE TRACKING MAP ───────────────────────────────── */
const MUSCLE_EX={
  Chest:["Bench Press","Incline Bench Press","Dumbbell Bench Press","Incline Dumbbell Press","Incline Dumbbell Flyes","Close Grip Bench Press","Push-up","Dumbbell Press"],
  Back:["Barbell Deadlift","Barbell Bent Over Row","Barbell Row","Cable Row","T-Bar Row","Dumbbell Row","Wide Grip Lat Pull-down","Close Grip Lat Pull-down","Weighted Pull-up","Sumo Deadlift"],
  Shoulders:["Seated Barbell Overhead Shoulder Press","Arnold Press","Dumbbell Lateral Raise","Lateral Raise","Dumbbell Shoulder Press"],
  Biceps:["Barbell Curl","EZ Bar Curls","Cross Body Hammer Curls","Bicep Curl"],
  Triceps:["Weighted Triceps Dip","Close Grip Bench Press","Overhead Seated Tricep Extension","Tricep Pushdown","Tricep Dip"],
  Quads:["Barbell Squat","Front Squat","Hack Squat","Leg Press","Leg Extension","Goblet Squat","Sumo Squat","Jump Squat","Dumbbell Lunge","Step-up"],
  Hamstrings:["Stiff Leg Deadlift","Romanian Deadlift","Leg Curl","Glute Bridge"],
  Calves:["Standing Barbell Calf Raise","Seated Calf Raise"],
  Core:["Cable Crunch","Hanging Leg Raises","Plank","Side Plank","Russian Twist","V-Up","Mountain Climber","Dead Bug"],
  Traps:["Barbell Shrug"],
  Cardio:["Burpee","High Knees","Jumping Jacks","Skater Jump","Jumping Lunge","Box Jump"],
};

function getMuscleFreq(wh){
  const freq={};
  (wh||[]).filter(w=>w.completed&&w.sets).forEach(w=>{
    Object.keys(w.sets).forEach(ex=>{
      const done=Object.values(w.sets[ex]).some(s=>s.done||s.weight);
      if(!done)return;
      Object.entries(MUSCLE_EX).forEach(function(entry){var muscle=entry[0];var exList=entry[1];if(exList.some(function(e){return ex.includes(e.split(" ")[0])||e.includes(ex.split(" ")[0]);})){freq[muscle]=(freq[muscle]||0)+1;}});
    });
  });
  return freq;
}

function getTotalKg(wh){
  let total=0;
  (wh||[]).filter(w=>w.completed&&w.sets).forEach(w=>{
    Object.values(w.sets).forEach(exSets=>{
      Object.values(exSets).forEach(s=>{if(s.weight&&s.reps&&s.done)total+=parseFloat(s.weight||0)*parseInt(s.reps||0);});
    });
  });
  return Math.round(total);
}

/* ─── STORAGE ────────────────────────────────────────────── */
// ─── SUPABASE CONFIG ─────────────────────────────────────────
// Paste your Supabase URL and anon key here:
const SUPA_URL = 'https://qfmjuqhcheesnsifbqky.supabase.co/rest/v1/';       // e.g. https://xxxxx.supabase.co
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbWp1cWhjaGVlc25zaWZicWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjUzMTksImV4cCI6MjA5MjYwMTMxOX0.s-MpJWvS_hKCpnG3a4EvgWmfoh1NK0BeSI03TM45aYU';  // starts with eyJ...

async function supaGet(key) {
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/gym_data?key=eq.${encodeURIComponent(key)}&select=value`, {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    });
    const rows = await res.json();
    return rows?.[0]?.value ? JSON.parse(rows[0].value) : null;
  } catch { return null; }
}

async function supaSet(key, value) {
  try {
    await fetch(`${SUPA_URL}/rest/v1/gym_data`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ key, value: JSON.stringify(value) })
    });
  } catch {}
}

// Local cache so reads are instant after first load
const _cache = {};

const DB = {
  async get(k) {
    if (_cache[k] !== undefined) return _cache[k];
    const v = await supaGet('gd_' + k);
    _cache[k] = v;
    return v;
  },
  async set(k, v) {
    _cache[k] = v;
    await supaSet('gd_' + k, v);
  },
  async getS(k) {
    if (_cache['s_'+k] !== undefined) return _cache['s_'+k];
    const v = await supaGet('gds_' + k);
    _cache['s_'+k] = v;
    return v;
  },
  async setS(k, v) {
    _cache['s_'+k] = v;
    await supaSet('gds_' + k, v);
  },
};

/* ─── SCHEDULE / PROGRAM HELPERS ────────────────────────── */
const MUS_SEQ=["pushA","pullA","legsA","pushB","pullB","legsB"];
const FAT_SEQ=["circuitA","hiit","circuitB","circuitC","hiit2"];
const MUS_INFO={pushA:{label:"Push A",theme:"Strength 💥"},pullA:{label:"Pull A",theme:"Strength ⚡"},legsA:{label:"Legs A",theme:"Strength 🦵"},pushB:{label:"Push B",theme:"Size 💪"},pullB:{label:"Pull B",theme:"Size 🦍"},legsB:{label:"Legs B",theme:"Size 👑"},rest:{label:"REST",theme:"Recovery 😴"}};
const FAT_INFO={circuitA:{label:"Circuit A",theme:"Full Body 💪"},hiit:{label:"HIIT 1",theme:"Cardio Blast 🔥"},circuitB:{label:"Circuit B",theme:"Upper + Core 💥"},circuitC:{label:"Circuit C",theme:"Lower + Power ⚡"},hiit2:{label:"HIIT 2",theme:"Fat Burn Finale 🔥"},active:{label:"Active",theme:"Recovery Walk 🚶"},rest:{label:"REST",theme:"Full Rest 😴"}};

function getUserSchedule(user){return user.schedule||[1,2,3,4,5,6];}
function getTodayWorkout(user,wh){
  const sched=getUserSchedule(user),dow=todayDOW(),seq=user.goal==="fat"?FAT_SEQ:MUS_SEQ;
  if(!sched.includes(dow))return"rest";
  const done=(wh||[]).filter(w=>w.completed).length;
  return seq[done%seq.length];
}
function getTomorrowWorkout(user,wh){
  const sched=getUserSchedule(user),seq=user.goal==="fat"?FAT_SEQ:MUS_SEQ;
  let offset=1;
  while(offset<=7){
    const dow=(todayDOW()+offset)%7;
    if(sched.includes(dow)){
      const done=(wh||[]).filter(w=>w.completed).length;
      return{type:seq[done%seq.length],daysAway:offset};
    }
    offset++;
  }
  return{type:"rest",daysAway:1};
}
function getMCycle(user,wh){return Math.min(Math.max(Math.floor(((wh||[]).filter(w=>w.completed).length)/6)+1,1),25);}
function getFCycle(user,wh){return Math.min(Math.max(Math.floor(((wh||[]).filter(w=>w.completed).length)/5)+1,1),12);}
function getMSets(c){return[3,4,5,3,1][((c-1)%5)];}
function isMDeload(c){return c%5===0;}
function isMWeightUp(c){return((c-1)%5)===3;}

/* ─── EXERCISE DATABASES ─────────────────────────────────── */
const MDB={
  "Bench Press":{m:"Chest",i:"🏋️",t:"Shoulder blades pinched. Bar to lower chest. Drive feet into floor.",v:"https://youtube.com/results?search_query=bench+press+form",sw:["Dumbbell Bench Press","Push-up","Cable Fly","Machine Chest Press"]},
  "Incline Bench Press":{m:"Upper Chest",i:"📐",t:"30-45° incline. Bar to upper chest. Elbows at 75°.",v:"https://youtube.com/results?search_query=incline+bench+press+form",sw:["Incline Dumbbell Press","Incline Push-up","High Cable Fly","Incline Machine Press"]},
  "Seated Barbell Overhead Shoulder Press":{m:"Shoulders",i:"🔺",t:"Core braced. Press from collarbone to lockout.",v:"https://youtube.com/results?search_query=overhead+press+form",sw:["Dumbbell Shoulder Press","Arnold Press","Smith Machine Press","Landmine Press"]},
  "Weighted Triceps Dip":{m:"Triceps",i:"💪",t:"Lean forward. Lower to 90°. Add weight via belt.",v:"https://youtube.com/results?search_query=weighted+dips+form",sw:["Close Grip Bench Press","Tricep Pushdown","Skull Crusher","Overhead Tricep Extension"]},
  "Barbell Deadlift":{m:"Full Back",i:"⚡",t:"Bar over mid-foot. Hinge hips. Drive floor away. Back neutral.",v:"https://youtube.com/results?search_query=deadlift+proper+form",sw:["Romanian Deadlift","Trap Bar Deadlift","Rack Pull","Dumbbell Deadlift"]},
  "Barbell Bent Over Row":{m:"Back",i:"🔙",t:"Hinge 45°. Pull to belly. Squeeze shoulder blades.",v:"https://youtube.com/results?search_query=barbell+bent+over+row+form",sw:["Dumbbell Row","Cable Row","T-Bar Row","Machine Row"]},
  "Weighted Pull-up":{m:"Lats",i:"🦍",t:"Full dead hang. Pull elbows to hips. Add belt weight.",v:"https://youtube.com/results?search_query=weighted+pullup+form",sw:["Lat Pull-down","Assisted Pull-up","Cable Pullover","Straight Arm Pushdown"]},
  "Barbell Shrug":{m:"Traps",i:"🗻",t:"Straight up. 1-sec hold at top. No rolling.",v:"https://youtube.com/results?search_query=barbell+shrug+form",sw:["Dumbbell Shrug","Cable Shrug","Trap Bar Shrug"]},
  "Barbell Curl":{m:"Biceps",i:"💪",t:"Elbows pinned. Full ROM. Controlled 3-sec negative.",v:"https://youtube.com/results?search_query=barbell+curl+form",sw:["Dumbbell Curl","EZ Bar Curl","Cable Curl","Hammer Curl"]},
  "Barbell Squat":{m:"Quads/Glutes",i:"👑",t:"Bar on traps. Below parallel. Drive knees out. Chest up.",v:"https://youtube.com/results?search_query=barbell+back+squat+form",sw:["Front Squat","Hack Squat","Leg Press","Goblet Squat"]},
  "Stiff Leg Deadlift":{m:"Hamstrings",i:"🦵",t:"Soft knees. Hinge deep feeling hamstring stretch.",v:"https://youtube.com/results?search_query=stiff+leg+deadlift+form",sw:["Romanian Deadlift","Nordic Curl","Leg Curl","Good Morning"]},
  "Standing Barbell Calf Raise":{m:"Calves",i:"🦶",t:"Full stretch at bottom. Explosive up. 2-sec pause at top.",v:"https://youtube.com/results?search_query=standing+calf+raise+form",sw:["Seated Calf Raise","Leg Press Calf Raise","Donkey Calf Raise"]},
  "Seated Calf Raise":{m:"Soleus",i:"🦶",t:"Pad on lower thighs. Full range. Slow and controlled.",v:"https://youtube.com/results?search_query=seated+calf+raise+form",sw:["Standing Barbell Calf Raise","Leg Press Calf Raise","Single Leg Calf Raise"]},
  "Dumbbell Bench Press":{m:"Chest",i:"🏋️",t:"Greater ROM than barbell. Squeeze at top. Control descent.",v:"https://youtube.com/results?search_query=dumbbell+bench+press+form",sw:["Bench Press","Push-up","Cable Fly","Machine Chest Press"]},
  "Incline Dumbbell Flyes":{m:"Upper Chest",i:"🦅",t:"Slight elbow bend throughout. Deep stretch. Squeeze at top.",v:"https://youtube.com/results?search_query=incline+dumbbell+flyes+form",sw:["Cable Fly","Pec Deck","Incline Bench Press"]},
  "Arnold Press":{m:"All Delts",i:"🌀",t:"Rotate palms outward as you press. Full ROM.",v:"https://youtube.com/results?search_query=arnold+press+form",sw:["Dumbbell Shoulder Press","Seated Barbell Overhead Shoulder Press","Lateral Raise"]},
  "Dumbbell Lateral Raise":{m:"Side Delts",i:"✈️",t:"Lead with elbows. Stop at shoulder. Slight forward lean.",v:"https://youtube.com/results?search_query=lateral+raise+form",sw:["Cable Lateral Raise","Machine Lateral Raise","Upright Row","Face Pull"]},
  "Close Grip Bench Press":{m:"Triceps",i:"🔧",t:"Shoulder-width grip. Elbows tucked. Feel stretch at bottom.",v:"https://youtube.com/results?search_query=close+grip+bench+press+form",sw:["Tricep Pushdown","Skull Crusher","Dip","Overhead Tricep Extension"]},
  "Overhead Seated Tricep Extension":{m:"Triceps",i:"⬆️",t:"Elbows forward. Full extension. Hold at top.",v:"https://youtube.com/results?search_query=overhead+tricep+extension+form",sw:["Tricep Pushdown","Skull Crusher","Close Grip Bench Press","Dip"]},
  "Barbell Row":{m:"Back",i:"🔙",t:"Pull to belly. Squeeze blades.",v:"https://youtube.com/results?search_query=barbell+row+form",sw:["Cable Row","Dumbbell Row","T-Bar Row","Machine Row"]},
  "Close Grip Lat Pull-down":{m:"Lats",i:"🔽",t:"Lean back slightly. Pull to upper chest. Squeeze lats.",v:"https://youtube.com/results?search_query=lat+pulldown+form",sw:["Wide Grip Lat Pull-down","Weighted Pull-up","Cable Pullover"]},
  "Cable Row":{m:"Mid Back",i:"🔁",t:"Sit tall. Pull to belly. Squeeze shoulder blades.",v:"https://youtube.com/results?search_query=cable+row+form",sw:["Dumbbell Row","Barbell Bent Over Row","Machine Row","T-Bar Row"]},
  "EZ Bar Curls":{m:"Biceps",i:"〰️",t:"EZ grip reduces wrist strain.",v:"https://youtube.com/results?search_query=ez+bar+curl+form",sw:["Barbell Curl","Dumbbell Curl","Cable Curl","Preacher Curl"]},
  "Cross Body Hammer Curls":{m:"Brachialis",i:"🔨",t:"Curl across to opposite shoulder.",v:"https://youtube.com/results?search_query=cross+body+hammer+curl+form",sw:["Hammer Curl","Rope Curl","Reverse Curl"]},
  "Leg Press":{m:"Quads",i:"🦵",t:"Feet hip-width. Don't lock knees. Full depth.",v:"https://youtube.com/results?search_query=leg+press+form",sw:["Barbell Squat","Hack Squat","Goblet Squat","Bulgarian Split Squat"]},
  "Leg Curl":{m:"Hamstrings",i:"🌙",t:"Curl slowly. Squeeze at top. Don't let hips rise.",v:"https://youtube.com/results?search_query=leg+curl+form",sw:["Romanian Deadlift","Good Morning","Nordic Curl","Swiss Ball Curl"]},
  "Leg Extension":{m:"Quads",i:"⬆️",t:"Full extension. Squeeze quads. Slow negative.",v:"https://youtube.com/results?search_query=leg+extension+form",sw:["Wall Sit","Barbell Squat","Step-up","Bulgarian Split Squat"]},
  "Cable Crunch":{m:"Abs",i:"🔥",t:"Kneel. Crunch elbows to knees. Contract abs hard.",v:"https://youtube.com/results?search_query=cable+crunch+form",sw:["Decline Crunch","Ab Wheel Rollout","Hanging Leg Raises","Plank"]},
  "Hanging Leg Raises":{m:"Lower Abs",i:"🎯",t:"Hang from bar. Raise legs to parallel+. Control swing.",v:"https://youtube.com/results?search_query=hanging+leg+raise+form",sw:["Cable Crunch","Decline Crunch","Ab Wheel Rollout","V-Up"]},
  "Front Squat":{m:"Quads",i:"👑",t:"Bar on front delts. Elbows high. Stay upright.",v:"https://youtube.com/results?search_query=front+squat+form",sw:["Barbell Squat","Hack Squat","Goblet Squat","Leg Press"]},
  "T-Bar Row":{m:"Mid Back",i:"🔤",t:"Chest on pad. Pull to chest. Squeeze hard.",v:"https://youtube.com/results?search_query=t+bar+row+form",sw:["Cable Row","Barbell Bent Over Row","Dumbbell Row","Machine Row"]},
  "Hack Squat":{m:"Quads",i:"🦾",t:"Feet low on platform for more quads. Go deep.",v:"https://youtube.com/results?search_query=hack+squat+form",sw:["Leg Press","Barbell Squat","Front Squat","Bulgarian Split Squat"]},
  "Wide Grip Lat Pull-down":{m:"Lats",i:"🔽",t:"Wide grip. Pull to collarbone. Lean back slightly.",v:"https://youtube.com/results?search_query=wide+grip+lat+pulldown+form",sw:["Weighted Pull-up","Close Grip Lat Pull-down","Cable Pullover"]},
  "Dumbbell Row":{m:"Back",i:"🔙",t:"One knee on bench. Pull to hip. Full stretch at bottom.",v:"https://youtube.com/results?search_query=dumbbell+row+form",sw:["Cable Row","Barbell Bent Over Row","T-Bar Row","Machine Row"]},
  "Incline Dumbbell Press":{m:"Upper Chest",i:"📐",t:"30° incline. Control descent. Squeeze at top.",v:"https://youtube.com/results?search_query=incline+dumbbell+press+form",sw:["Incline Bench Press","Incline Cable Fly","Incline Push-up"]},
  "Tricep Pushdown":{m:"Triceps",i:"⬇️",t:"Elbows pinned. Full extension. Slow negative.",v:"https://youtube.com/results?search_query=tricep+pushdown+form",sw:["Skull Crusher","Close Grip Bench Press","Overhead Tricep Extension","Dip"]},
  "Dumbbell Shoulder Press":{m:"Shoulders",i:"🔺",t:"Press from ears to lockout. Core tight.",v:"https://youtube.com/results?search_query=dumbbell+shoulder+press+form",sw:["Arnold Press","Seated Barbell Overhead Shoulder Press","Landmine Press"]},
  "Sumo Deadlift":{m:"Glutes/Inner",i:"🦾",t:"Wide stance. Toes out. Pull bar close to body.",v:"https://youtube.com/results?search_query=sumo+deadlift+form",sw:["Barbell Deadlift","Romanian Deadlift","Hip Thrust","Cable Pull-through"]},
};
const FDB={
  "Goblet Squat":{m:"Quads/Glutes",i:"🏆",t:"Dumbbell at chest. Squat deep. Elbows inside knees.",v:"https://youtube.com/results?search_query=goblet+squat+form",sw:["Barbell Squat","Leg Press","Sumo Squat","Wall Sit"]},
  "Romanian Deadlift":{m:"Hamstrings",i:"🦵",t:"Hinge at hips. Soft knees. Feel full hamstring stretch.",v:"https://youtube.com/results?search_query=romanian+deadlift+form",sw:["Leg Curl","Good Morning","Nordic Curl","Swiss Ball Curl"]},
  "Dumbbell Lunge":{m:"Quads/Glutes",i:"🚶",t:"Big step. Back knee 1 inch off floor. Chest up.",v:"https://youtube.com/results?search_query=dumbbell+lunge+form",sw:["Step-up","Bulgarian Split Squat","Goblet Squat","Reverse Lunge"]},
  "Dumbbell Press":{m:"Chest",i:"💪",t:"Control descent. Squeeze chest at top. Full ROM.",v:"https://youtube.com/results?search_query=dumbbell+press+form",sw:["Push-up","Cable Fly","Machine Chest Press","Bench Press"]},
  "Push-up":{m:"Chest/Triceps",i:"⬆️",t:"Rigid plank. Chest to floor. Elbows at 45°.",v:"https://youtube.com/results?search_query=push+up+proper+form",sw:["Dumbbell Press","Incline Push-up","Decline Push-up","Diamond Push-up"]},
  "Dumbbell Row":{m:"Back",i:"🔙",t:"Brace on bench. Pull to hip. Full stretch at bottom.",v:"https://youtube.com/results?search_query=dumbbell+row+form",sw:["Cable Row","Band Row","TRX Row","Machine Row"]},
  "Dumbbell Shoulder Press":{m:"Shoulders",i:"🔺",t:"Press from ears to lockout. Core tight.",v:"https://youtube.com/results?search_query=dumbbell+shoulder+press+form",sw:["Arnold Press","Pike Push-up","Band Overhead Press","Landmine Press"]},
  "Lateral Raise":{m:"Side Delts",i:"✈️",t:"Lead with elbows. Stop at shoulder height.",v:"https://youtube.com/results?search_query=lateral+raise+form",sw:["Cable Lateral Raise","Upright Row","Face Pull","Band Lateral Raise"]},
  "Tricep Dip":{m:"Triceps",i:"🔽",t:"Hands on chair/bench. Lower to 90°. Don't sink shoulders.",v:"https://youtube.com/results?search_query=tricep+dip+bodyweight",sw:["Tricep Pushdown","Overhead Tricep Extension","Diamond Push-up","Skull Crusher"]},
  "Bicep Curl":{m:"Biceps",i:"💪",t:"Elbows pinned. Full ROM. Squeeze at top.",v:"https://youtube.com/results?search_query=dumbbell+bicep+curl+form",sw:["Hammer Curl","EZ Bar Curl","Resistance Band Curl","Concentration Curl"]},
  "Glute Bridge":{m:"Glutes",i:"🍑",t:"Shoulders on floor. Drive hips to ceiling. Squeeze glutes.",v:"https://youtube.com/results?search_query=glute+bridge+form",sw:["Hip Thrust","Donkey Kick","Cable Kickback","Single Leg Glute Bridge"]},
  "Sumo Squat":{m:"Inner Thigh",i:"🦵",t:"Wide stance. Toes out. Squat low. Knees track toes.",v:"https://youtube.com/results?search_query=sumo+squat+form",sw:["Goblet Squat","Sumo Deadlift","Plie Squat","Cable Pull-through"]},
  "Step-up":{m:"Quads/Glutes",i:"🏃",t:"Drive through heel on step. Don't lean forward.",v:"https://youtube.com/results?search_query=dumbbell+step+up+form",sw:["Dumbbell Lunge","Bulgarian Split Squat","Box Jump","Reverse Lunge"]},
  "Plank":{m:"Core",i:"🧱",t:"Rigid body. Glutes squeezed. Don't sag or pike.",v:"https://youtube.com/results?search_query=plank+proper+form",sw:["Dead Bug","Ab Wheel Rollout","Bird Dog","Hollow Body Hold"]},
  "Side Plank":{m:"Obliques",i:"📐",t:"Stacked feet. Hip fully elevated. Breathe.",v:"https://youtube.com/results?search_query=side+plank+form",sw:["Russian Twist","Bicycle Crunch","Woodchop","Pallof Press"]},
  "Russian Twist":{m:"Obliques",i:"🔄",t:"Feet up. Rotate fully each side. Touch floor.",v:"https://youtube.com/results?search_query=russian+twist+form",sw:["Side Plank","Bicycle Crunch","Cable Woodchop","Oblique Crunch"]},
  "V-Up":{m:"Abs",i:"⬆️",t:"Lift legs and torso together. Touch toes at top.",v:"https://youtube.com/results?search_query=v+up+ab+exercise",sw:["Sit-up","Cable Crunch","Decline Crunch","Jackknife"]},
  "Burpee":{m:"Full Body",i:"💥",t:"Jump high at top. Chest to floor at bottom. Be explosive.",v:"https://youtube.com/results?search_query=how+to+do+burpees+properly",sw:["Squat Thrust","Mountain Climber","Jump Squat","Bear Crawl"]},
  "Mountain Climber":{m:"Core/Cardio",i:"🏔️",t:"Fast alternating knees to chest. Hips level. Flat back.",v:"https://youtube.com/results?search_query=mountain+climbers+form",sw:["High Knees","Burpee","Plank","Bear Crawl"]},
  "Jump Squat":{m:"Quads/Cardio",i:"🚀",t:"Squat deep then explode. Land soft with bent knees.",v:"https://youtube.com/results?search_query=jump+squat+form",sw:["Box Jump","Goblet Squat","Squat","Jumping Lunge"]},
  "High Knees":{m:"Cardio/Core",i:"🏃",t:"Drive knees to waist. Pump arms. Stay on toes.",v:"https://youtube.com/results?search_query=high+knees+exercise+form",sw:["Mountain Climber","Jump Rope","Butt Kicks","Fast Feet"]},
  "Jumping Jacks":{m:"Cardio",i:"⭐",t:"Arms overhead. Feet wide. Land softly. Keep rhythm.",v:"https://youtube.com/results?search_query=jumping+jacks+form",sw:["Star Jump","Squat Jack","Plyo Jack","Step Jack"]},
  "Skater Jump":{m:"Glutes/Cardio",i:"⛸️",t:"Lateral hop. Land on one leg. Slight forward lean.",v:"https://youtube.com/results?search_query=skater+jump+exercise",sw:["Lateral Shuffle","Side Lunge","Lateral Jump","Curtsy Lunge"]},
  "Jumping Lunge":{m:"Legs/Cardio",i:"⚡",t:"Explode up. Switch legs in air. Land soft. Alternate.",v:"https://youtube.com/results?search_query=jumping+lunge+form",sw:["Reverse Lunge","Jump Squat","Split Squat","Step-up"]},
  "Box Jump":{m:"Power/Cardio",i:"📦",t:"Arm swing + hip hinge. Land soft on full foot. Step down.",v:"https://youtube.com/results?search_query=box+jump+form",sw:["Jump Squat","Step-up","Broad Jump","Squat"]},
};

function getMExercises(cycle){
  const ph=Math.ceil(cycle/5),s=getMSets(cycle);
  const base={
    pushA:[{n:"Bench Press",s,r:"4-6"},{n:"Incline Bench Press",s,r:"4-6"},{n:"Seated Barbell Overhead Shoulder Press",s,r:"4-6"},{n:"Weighted Triceps Dip",s,r:"4-6"}],
    pullA:[{n:"Barbell Deadlift",s,r:"4-6"},{n:"Barbell Bent Over Row",s,r:"4-6"},{n:"Weighted Pull-up",s,r:"4-6"},{n:"Barbell Shrug",s,r:"4-6"},{n:"Barbell Curl",s,r:"4-6"}],
    legsA:[{n:"Barbell Squat",s,r:"4-6"},{n:"Stiff Leg Deadlift",s,r:"4-6"},{n:"Standing Barbell Calf Raise",s,r:"4-6"},{n:"Seated Calf Raise",s,r:"4-6"}],
    pushB:[{n:"Dumbbell Bench Press",s,r:"8-10"},{n:"Incline Dumbbell Flyes",s,r:"12-15"},{n:"Arnold Press",s,r:"8-10"},{n:"Dumbbell Lateral Raise",s,r:"12-15"},{n:"Close Grip Bench Press",s,r:"8-10"},{n:"Overhead Seated Tricep Extension",s,r:"8-10"}],
    pullB:[{n:"Barbell Row",s,r:"8-10"},{n:"Close Grip Lat Pull-down",s,r:"8-10"},{n:"Cable Row",s,r:"8-10"},{n:"EZ Bar Curls",s,r:"8-10"},{n:"Cross Body Hammer Curls",s,r:"8-10"}],
    legsB:[{n:"Barbell Squat",s,r:"8-10"},{n:"Leg Press",s,r:"8-10"},{n:"Leg Curl",s,r:"8-10"},{n:"Leg Extension",s,r:"8-10"},{n:"Standing Barbell Calf Raise",s,r:"12-15"},{n:"Seated Calf Raise",s,r:"12-15"},{n:"Cable Crunch",s,r:"10-12"},{n:"Hanging Leg Raises",s,r:"10-12"}],
  };
  if(ph>=3){
    base.pushA=[{n:"Bench Press",s,r:"4-6"},{n:"Incline Bench Press",s,r:"4-6"},{n:"Seated Barbell Overhead Shoulder Press",s,r:"4-6"},{n:"Close Grip Bench Press",s,r:"4-6"}];
    base.legsA=[{n:"Front Squat",s,r:"4-6"},{n:"Stiff Leg Deadlift",s,r:"4-6"},{n:"Standing Barbell Calf Raise",s,r:"4-6"},{n:"Seated Calf Raise",s,r:"4-6"}];
    base.pushB=[{n:"Incline Dumbbell Press",s,r:"8-10"},{n:"Incline Dumbbell Flyes",s,r:"12-15"},{n:"Arnold Press",s,r:"8-10"},{n:"Dumbbell Lateral Raise",s,r:"12-15"},{n:"Tricep Pushdown",s,r:"8-10"},{n:"Overhead Seated Tricep Extension",s,r:"8-10"}];
    base.pullB=[{n:"T-Bar Row",s,r:"6-8"},{n:"Wide Grip Lat Pull-down",s,r:"8-10"},{n:"Dumbbell Row",s,r:"8-10"},{n:"EZ Bar Curls",s,r:"8-10"},{n:"Cross Body Hammer Curls",s,r:"8-10"}];
    base.legsB=[{n:"Hack Squat",s,r:"6-8"},{n:"Leg Press",s,r:"8-10"},{n:"Leg Curl",s,r:"8-10"},{n:"Leg Extension",s,r:"12-15"},{n:"Standing Barbell Calf Raise",s,r:"12-15"},{n:"Seated Calf Raise",s,r:"12-15"},{n:"Cable Crunch",s,r:"10-12"},{n:"Hanging Leg Raises",s,r:"10-12"}];
  }
  return base;
}
function getFDayData(week){
  const block=Math.ceil(week/3),r=[2,3,3,4][block-1]+[0,1,2][((week-1)%3)];
  return{
    circuitA:{type:"circuit",rounds:r,exercises:[{n:"Goblet Squat",r:"15 reps",i:"🏆"},{n:"Push-up",r:"12 reps",i:"⬆️"},{n:"Romanian Deadlift",r:"12 reps",i:"🦵"},{n:"Dumbbell Row",r:"12 each",i:"🔙"},{n:"Mountain Climber",r:"30 secs",i:"🏔️"},{n:"Plank",r:"45 secs",i:"🧱"},...(block>=2?[{n:"Jump Squat",r:"10 reps",i:"🚀"}]:[]),]},
    circuitB:{type:"circuit",rounds:r,exercises:[{n:"Dumbbell Press",r:"12 reps",i:"💪"},{n:"Dumbbell Row",r:"12 each",i:"🔙"},{n:"Lateral Raise",r:"15 reps",i:"✈️"},{n:"Dumbbell Shoulder Press",r:"12 reps",i:"🔺"},{n:"Tricep Dip",r:"15 reps",i:"🔽"},{n:"Bicep Curl",r:"15 reps",i:"💪"},{n:"Russian Twist",r:"30 reps",i:"🔄"},{n:"V-Up",r:"12 reps",i:"⬆️"},]},
    circuitC:{type:"circuit",rounds:r,exercises:[{n:"Sumo Squat",r:"15 reps",i:"🦵"},{n:"Dumbbell Lunge",r:"10 each",i:"🚶"},{n:"Romanian Deadlift",r:"12 reps",i:"🦵"},{n:"Glute Bridge",r:"20 reps",i:"🍑"},{n:"Jump Squat",r:"10 reps",i:"🚀"},{n:"High Knees",r:"30 secs",i:"🏃"},{n:"Side Plank",r:"30s each",i:"📐"},...(block>=2?[{n:"Step-up",r:"12 each",i:"🏃"},{n:"Skater Jump",r:"12 each",i:"⛸️"}]:[]),]},
    hiit:{type:"hiit",rounds:block<=1?6:block<=2?8:10,work:block<=1?30:40,rest:block<=1?30:20,exercises:[{n:"Burpee",i:"💥"},{n:"High Knees",i:"🏃"},{n:"Jump Squat",i:"🚀"},{n:"Mountain Climber",i:"🏔️"},{n:"Jumping Lunge",i:"⚡"},{n:"Jumping Jacks",i:"⭐"},...(block>=2?[{n:"Skater Jump",i:"⛸️"}]:[]),...(block>=3?[{n:"Box Jump",i:"📦"}]:[]),]},
    hiit2:{type:"hiit",rounds:block<=1?6:block<=2?8:10,work:block<=1?30:40,rest:block<=1?30:20,exercises:[{n:"Jumping Jacks",i:"⭐"},{n:"Mountain Climber",i:"🏔️"},{n:"Burpee",i:"💥"},{n:"High Knees",i:"🏃"},{n:"Jump Squat",i:"🚀"},{n:"Skater Jump",i:"⛸️"},]},
  };
}

/* ─── CONSTANTS ─────────────────────────────────────────────── */
const EMOJIS=["🦁","🐯","🦊","🐺","🦅","🐉","🦈","🐻","🦏","🐗","🔥","⚡","💎","🏆","👊","🦖","🐲","💀"];
const ACOLORS=["#FF4500","#00D4FF","#AAFF00","#FF3366","#FFB300","#9B59B6","#2ECC71","#E67E22","#1ABC9C","#E91E63"];
const MQ=["The Iron never lies. — Henry Rollins","You must ALWAYS beat your last workout.","Train heavy. Eat smart. Sleep. Repeat.","Every set is a brick in your temple.","6 months of discipline = a lifetime of confidence.","Champions keep going when they want to stop.","Your body can do it. It's your mind you need to convince."];
const FQ=["Every rep burns the old you away.","Sweat is just fat crying. Make it weep.","1% better daily = 37× better this year.","You are ONE workout away from a good mood.","That comfort zone? It's killing your potential.","The scale is just a number. Your effort is everything.","Excuses don't burn calories. Effort does."];
const REPRIMANDS=["You haven't trained in %d days. The couch is not a gym.","Come on! %d days without training? Champions don't take that many breaks.","Wake up! %d days missed. Every day you skip, someone else is getting ahead.","Really? %d days off? Your future self is disappointed right now."];

/* ─── IMAGE UTIL ─────────────────────────────────────────────── */
async function compressImage(file){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement('canvas');
        const max=600,ratio=Math.min(max/img.width,max/img.height,1);
        canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.55));
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ─── UI PRIMITIVES ──────────────────────────────────────────── */
const Badge=({ch,col=C.mus})=>(<span style={{background:col+"22",color:col,border:`1px solid ${col}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,fontFamily:"Bebas Neue",whiteSpace:"nowrap"}}>{ch}</span>);

function Btn({ch,onClick,col,ghost=false,sm=false,full=false,disabled=false,danger=false}){
  const uc=danger?C.danger:(col||C.mus);
  const bg=ghost?"transparent":`linear-gradient(135deg,${uc},${uc}99)`;
  const tc=ghost?uc:(uc===C.fat?"#000":"#fff");
  return(<button onClick={disabled?undefined:onClick} style={{border:ghost?`1px solid ${uc}55`:"1px solid transparent",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontFamily:"Nunito",fontWeight:800,letterSpacing:.5,transition:"all .2s",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5,padding:sm?"6px 13px":"10px 20px",fontSize:sm?12:14,opacity:disabled?.45:1,background:bg,color:tc,boxShadow:ghost?"none":`0 3px 12px ${uc}33`,width:full?"100%":"auto"}}>{ch}</button>);
}
const Card=({children,style:s={},gc})=>(<div style={{background:C.card,borderRadius:16,border:`1px solid ${gc?gc+"44":C.border}`,padding:20,...s}}>{children}</div>);
const Input=({label,value,onChange,type="text",placeholder="",unit="",sm=false})=>(<div style={{marginBottom:sm?8:14}}>{label&&<div style={{color:C.muted,fontSize:10,fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>{label}</div>}<div style={{display:"flex",alignItems:"center"}}><input value={value} onChange={e=>onChange(e.target.value)} type={type} placeholder={placeholder} style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:unit?"8px 0 0 8px":8,padding:"11px 14px",color:C.text,fontSize:16,fontFamily:"Nunito",width:"100%",outline:"none",WebkitAppearance:"none"}}/>{unit&&<span style={{background:C.border,border:`1px solid ${C.border}`,borderLeft:"none",borderRadius:"0 8px 8px 0",padding:"11px 12px",color:C.muted,fontSize:13,whiteSpace:"nowrap"}}>{unit}</span>}</div></div>);
const Textarea=({label,value,onChange,rows=3})=>(<div style={{marginBottom:12}}>{label&&<div style={{color:C.muted,fontSize:10,fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>{label}</div>}<textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:"Nunito",width:"100%",outline:"none",resize:"vertical"}}/></div>);
const Bar=({val,max,col=C.mus,h=8,label,sub})=>(<div>{label&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:C.muted}}>{label}</span><span style={{fontSize:12,color:col,fontWeight:700}}>{sub||`${val}/${max}`}</span></div>}<div style={{background:C.surf,borderRadius:h,height:h,overflow:"hidden"}}><div style={{background:`linear-gradient(90deg,${col},${col}77)`,height:"100%",width:`${Math.min(100,(val/max)*100)}%`,borderRadius:h,transition:"width .6s ease"}}/></div></div>);
const Stat=({label,value,icon,col=C.mus,sub})=>(<div style={{textAlign:"center"}}>{icon&&<div style={{fontSize:20,marginBottom:3}}>{icon}</div>}<div style={{fontSize:24,fontWeight:900,color:col,fontFamily:"Bebas Neue",letterSpacing:1}}>{value}</div><div style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>{sub&&<div style={{fontSize:10,color:C.muted}}>{sub}</div>}</div>);
const Avatar=({user,size=50})=>(<div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,background:`radial-gradient(circle,${user.color}33,${user.color}11)`,border:`2px solid ${user.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.44}}>{user.emoji||"💪"}</div>);

/* ─── MUSCLE BODY SVG ─────────────────────────────────────────── */
function MuscleSVG({freq}){
  const vals=Object.values(freq);
  const maxFreq=Math.max(...vals,1);
  function col(muscle,alpha=false){
    const v=Math.min((freq[muscle]||0)/maxFreq,1);
    if(alpha)return v;
    const r=Math.round(v*255).toString(16).padStart(2,"0");
    if(v<0.01)return "#1a1a2e";
    const intensity=Math.round(40+v*215);
    return `rgba(255,${Math.round(100-v*80)},0,${0.15+v*0.85})`;
  }
  const label=(muscle,x,y)=>{
    const v=freq[muscle]||0;
    return v>0?<text x={x} y={y} textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700" fontFamily="Nunito">{v}</text>:null;
  };
  return(
    <svg viewBox="0 0 160 320" style={{width:"100%",maxWidth:140}}>
      {/* Head */}
      <ellipse cx="80" cy="22" rx="16" ry="18" fill="#1e1e2e"/>
      {/* Neck */}
      <rect x="74" y="37" width="12" height="10" fill="#1e1e2e"/>
      {/* Traps */}
      <path d="M64,47 Q80,40 96,47 Q88,62 80,58 Q72,62 64,47Z" fill={col("Traps")}/>
      {/* Shoulders */}
      <ellipse cx="55" cy="62" rx="16" ry="12" fill={col("Shoulders")}/>
      <ellipse cx="105" cy="62" rx="16" ry="12" fill={col("Shoulders")}/>
      {label("Shoulders",55,65)}{label("Shoulders",105,65)}
      {/* Chest */}
      <path d="M65,55 L95,55 L98,95 L62,95Z" fill={col("Chest")}/>
      {label("Chest",80,78)}
      {/* Core / Abs */}
      <rect x="65" y="95" width="30" height="40" rx="4" fill={col("Core")}/>
      {label("Core",80,118)}
      {/* Upper arms */}
      <rect x="38" y="62" width="15" height="45" rx="7" fill={col("Biceps")}/>
      <rect x="107" y="62" width="15" height="45" rx="7" fill={col("Biceps")}/>
      {label("Biceps",45,88)}{label("Biceps",114,88)}
      {/* Forearms */}
      <rect x="36" y="110" width="14" height="38" rx="6" fill="#1e1e2e"/>
      <rect x="110" y="110" width="14" height="38" rx="6" fill="#1e1e2e"/>
      {/* Hips */}
      <path d="M63,135 L97,135 L100,148 L60,148Z" fill={col("Hamstrings")} opacity=".7"/>
      {/* Quads */}
      <rect x="62" y="148" width="26" height="65" rx="10" fill={col("Quads")}/>
      <rect x="92" y="148" width="26" height="65" rx="10" fill={col("Quads")}/>
      {label("Quads",75,185)}{label("Quads",105,185)}
      {/* Calves */}
      <ellipse cx="75" cy="250" rx="13" ry="25" fill={col("Calves")}/>
      <ellipse cx="105" cy="250" rx="13" ry="25" fill={col("Calves")}/>
      {label("Calves",75,252)}{label("Calves",105,252)}
      {/* Back label */}
      <text x="80" y="315" textAnchor="middle" fill={C.muted} fontSize="7" fontFamily="Nunito">Back tracked in history</text>
    </svg>
  );
}

/* ─── PIN ENTRY ──────────────────────────────────────────────── */
function PinEntry({user,onSuccess,onCancel}){
  const[digits,setDigits]=useState([]);
  const[error,setError]=useState(false);
  function press(d){
    if(digits.length>=4)return;
    const next=[...digits,d];setDigits(next);
    if(next.length===4){
      if(next.join("")===user.pin)onSuccess();
      else{setError(true);setTimeout(()=>{setDigits([]);setError(false);},600);}
    }
  }
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <Avatar user={user} size={72}/>
      <div style={{fontFamily:"Bebas Neue",fontSize:28,letterSpacing:2,marginTop:14,marginBottom:4}}>{user.name}</div>
      <div style={{color:C.muted,fontSize:13,marginBottom:28}}>Enter your PIN</div>
      <div className={error?"shake":""} style={{display:"flex",gap:16,marginBottom:32}}>
        {[0,1,2,3].map(i=><div key={i} style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${error?C.danger:C.muted}`,background:i<digits.length?(error?C.danger:user.color):"transparent",transition:"all .2s"}}/>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,width:240}}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>(
          <button key={i} onClick={()=>d==="⌫"?setDigits(x=>x.slice(0,-1)):d!==""?press(String(d)):null}
            style={{height:60,borderRadius:12,border:`1px solid ${C.border}`,background:d===""?"transparent":C.surf,color:C.text,fontSize:20,fontFamily:"Nunito",fontWeight:700,cursor:d===""?"default":"pointer",transition:"all .15s"}}
            onMouseOver={e=>{if(d!=="")e.currentTarget.style.background=user.color+"33";}}
            onMouseOut={e=>{e.currentTarget.style.background=d===""?"transparent":C.surf;}}>
            {d}
          </button>
        ))}
      </div>
      {error&&<div style={{color:C.danger,fontSize:13,fontWeight:700,marginTop:16}}>Wrong PIN. Try again.</div>}
      <button onClick={onCancel} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13,marginTop:24}}>← Back</button>
    </div>
  );
}

/* ─── GOAL SELECTOR ──────────────────────────────────────────── */
function GoalSelector({onSelect}){
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontFamily:"Bebas Neue",fontSize:12,color:C.muted,letterSpacing:3,marginBottom:8}}>CHOOSE YOUR MISSION</div>
        <h1 style={{fontFamily:"Bebas Neue",fontSize:"clamp(38px,9vw,68px)",letterSpacing:3,lineHeight:1,background:`linear-gradient(135deg,${C.text},${C.muted})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>WHAT'S YOUR<br/>GOAL?</h1>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:16,width:"100%",maxWidth:540}}>
        {[{goal:"muscle",col:C.mus,emoji:"🏋️",title:"BUILD MUSCLE",sub:"26 WEEKS · STRENGTH & MASS",bullets:["Push/Pull/Legs split","Heavy compounds + progressive overload","Caloric surplus nutrition","Deload weeks built-in"],cta:"START BUILDING →"},
          {goal:"fat",col:C.fat,emoji:"🔥",title:"LOSE WEIGHT",sub:"12 WEEKS · FAT BURN",bullets:["Full body circuits + HIIT","High reps, short rest periods","Caloric deficit nutrition","4 progressive blocks"],cta:"START BURNING →"},
        ].map(({goal,col,emoji,title,sub,bullets,cta})=>(
          <div key={goal} onClick={()=>onSelect(goal)} className="su"
            style={{background:`linear-gradient(160deg,${col}14,${C.card})`,border:`2px solid ${col}55`,borderRadius:20,padding:28,cursor:"pointer",transition:"all .25s",textAlign:"center"}}
            onMouseOver={e=>{e.currentTarget.style.border=`2px solid ${col}`;e.currentTarget.style.transform="translateY(-5px)";}}
            onMouseOut={e=>{e.currentTarget.style.border=`2px solid ${col}55`;e.currentTarget.style.transform="";}}>
            <div style={{fontSize:48,marginBottom:10}} className="bb">{emoji}</div>
            <div style={{fontFamily:"Bebas Neue",fontSize:24,letterSpacing:2,color:col,marginBottom:3}}>{title}</div>
            <div style={{fontFamily:"Bebas Neue",fontSize:10,color:C.muted,letterSpacing:1,marginBottom:12}}>{sub}</div>
            <div style={{fontSize:12,color:C.muted,lineHeight:1.9,textAlign:"left",marginBottom:14}}>{bullets.map(b=>`✦ ${b}`).map((b,i)=><div key={i}>{b}</div>)}</div>
            <div style={{background:col,color:col===C.fat?"#000":"#fff",borderRadius:10,padding:9,fontFamily:"Bebas Neue",fontSize:14,letterSpacing:1}}>{cta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SCHEDULE PICKER ───────────────────────────────────────── */
function SchedulePicker({value,onChange,goalColor}){
  const presets=[{label:"Mon–Sat",days:[1,2,3,4,5,6]},{label:"Mon–Fri",days:[1,2,3,4,5]},{label:"4 Days",days:[1,2,4,5]},{label:"3 Days",days:[1,3,5]}];
  return(
    <div>
      <div style={{color:C.muted,fontSize:10,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Training Days</div>
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {DAY_NAMES.map((d,i)=>{const a=value.includes(i);return(<div key={i} onClick={()=>onChange(a?value.filter(x=>x!==i):[...value,i].sort((a,b)=>a-b))} style={{width:38,height:38,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:11,fontWeight:700,border:`2px solid ${a?goalColor:C.border}`,background:a?goalColor+"22":C.surf,color:a?goalColor:C.muted,transition:"all .15s"}}>{d}</div>);})}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
        {presets.map(p=><div key={p.label} onClick={()=>onChange(p.days)} style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",background:C.surf,border:`1px solid ${C.border}`,color:C.muted,transition:"all .15s"}} onMouseOver={e=>{e.currentTarget.style.color=goalColor;e.currentTarget.style.borderColor=goalColor;}} onMouseOut={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border;}}>{p.label}</div>)}
      </div>
      <div style={{fontSize:11,color:C.muted}}>ℹ️ Rest days are auto-inserted. Your program sequence carries over — you never miss a session.</div>
    </div>
  );
}

/* ─── PROFILE SELECTOR ──────────────────────────────────────── */
function ProfileSelector({users,onSelect,onAdd}){
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",padding:"36px 20px"}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:11,color:C.muted,fontWeight:700,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>{DAY_FULL[todayDOW()]} · No excuses today 🔥</div>
        <h1 style={{fontFamily:"Bebas Neue",fontSize:"clamp(44px,10vw,72px)",letterSpacing:3,lineHeight:.95,background:`linear-gradient(135deg,${C.text},${C.mus})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>WHO'S<br/>TRAINING<br/>TODAY?</h1>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(148px,1fr))",gap:12,width:"100%",maxWidth:680,marginBottom:20}}>
        {users.map(u=>{const g=GOALS[u.goal||"muscle"];return(
          <div key={u.id} onClick={()=>onSelect(u)} className="su"
            style={{background:C.card,border:`2px solid ${g.color}33`,borderRadius:16,padding:18,cursor:"pointer",textAlign:"center",transition:"all .2s",position:"relative",overflow:"hidden"}}
            onMouseOver={e=>{e.currentTarget.style.border=`2px solid ${g.color}`;e.currentTarget.style.transform="scale(1.04) translateY(-3px)";}}
            onMouseOut={e=>{e.currentTarget.style.border=`2px solid ${g.color}33`;e.currentTarget.style.transform="";}}>
            <div style={{position:"absolute",inset:0,background:`radial-gradient(circle at top,${g.color}0c,transparent)`,pointerEvents:"none"}}/>
            <div style={{fontSize:34,marginBottom:7}}>{u.emoji}</div>
            <div style={{fontFamily:"Bebas Neue",fontSize:17,letterSpacing:1}}>{u.name}</div>
            <div style={{marginTop:5,marginBottom:5}}><Badge ch={`${g.icon} ${u.goal==="fat"?"FAT BURN":"MUSCLE"}`} col={g.color}/></div>
            <div style={{fontSize:11,color:C.muted}}>🔒 PIN Protected</div>
            {(u.streak||0)>0&&<div style={{marginTop:5}}><Badge ch={`🔥 ${u.streak}d`} col={C.warn}/></div>}
          </div>
        );})}
        <div onClick={onAdd} style={{background:"transparent",border:`2px dashed ${C.border}`,borderRadius:16,padding:18,cursor:"pointer",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:7,minHeight:140,transition:"all .2s"}} onMouseOver={e=>{e.currentTarget.style.border=`2px dashed ${C.mus}`;}} onMouseOut={e=>{e.currentTarget.style.border=`2px dashed ${C.border}`;}}>
          <div style={{fontSize:26,color:C.mus}}>+</div>
          <div style={{color:C.muted,fontSize:12,fontWeight:700}}>New Profile</div>
        </div>
      </div>
    </div>
  );
}

/* ─── CREATE / EDIT PROFILE ─────────────────────────────────── */
function CreateProfile({onBack,existing,onNeedGoal,onDelete}){
  const[name,setName]=useState(existing?.name||"");
  const[emoji,setEmoji]=useState(existing?.emoji||EMOJIS[0]);
  const[color,setColor]=useState(existing?.color||ACOLORS[0]);
  const[height,setHeight]=useState(existing?.height||"");
  const[weight,setWeight]=useState(existing?.weightHistory?.at(-1)?.weight||"");
  const[exp,setExp]=useState(existing?.experience||"beginner");
  const[pin,setPin]=useState(existing?.pin||"");
  const[pin2,setPin2]=useState(existing?.pin||"");
  const[sched,setSched]=useState(existing?.schedule||[1,2,3,4,5,6]);
  const[goal,setGoal]=useState(existing?.goal||"muscle");
  const[confirmDel,setConfirmDel]=useState(false);
  const gc=goal==="fat"?C.fat:C.mus;

  function save(){
    if(!name.trim())return alert("Enter your name!");
    if(!height||!weight)return alert("Height and weight are required!");
    if(pin.length!==4||!/^\d{4}$/.test(pin))return alert("PIN must be exactly 4 digits.");
    if(pin!==pin2)return alert("PINs do not match.");
    onNeedGoal({...(existing||{}),id:existing?.id||Date.now().toString(),name:name.trim(),emoji,color,experience:exp,height:parseFloat(height),weightHistory:[...(existing?.weightHistory||[]),{date:todayStr(),weight:parseFloat(weight)}],programStart:existing?.programStart||todayStr(),totalWorkouts:existing?.totalWorkouts||0,streak:existing?.streak||0,lastWorkoutDate:existing?.lastWorkoutDate||null,pin,schedule:sched,goal});
  }

  return(
    <div style={{minHeight:"100vh",background:C.bg,padding:24}}>
      <div style={{maxWidth:500,margin:"0 auto"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13,marginBottom:16,display:"flex",alignItems:"center",gap:5}}>← Back</button>
        <h1 style={{fontFamily:"Bebas Neue",fontSize:36,letterSpacing:2,marginBottom:16}}>{existing?"EDIT PROFILE":"CREATE PROFILE"}</h1>

        <Card style={{marginBottom:12}}>
          <div style={{fontFamily:"Bebas Neue",fontSize:12,color:gc,letterSpacing:1,marginBottom:10}}>IDENTITY</div>
          <Input label="Warrior Name" value={name} onChange={setName} placeholder="Your name"/>
          <div style={{marginBottom:12}}><div style={{color:C.muted,fontSize:10,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Avatar</div><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{EMOJIS.map(e=><div key={e} onClick={()=>setEmoji(e)} style={{width:36,height:36,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,cursor:"pointer",border:`2px solid ${emoji===e?gc:C.border}`,background:emoji===e?gc+"22":C.surf,transition:"all .15s"}}>{e}</div>)}</div></div>
          <div><div style={{color:C.muted,fontSize:10,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Colour</div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{ACOLORS.map(col=><div key={col} onClick={()=>setColor(col)} style={{width:26,height:26,borderRadius:"50%",background:col,cursor:"pointer",border:`3px solid ${color===col?"#fff":"transparent"}`,transition:"all .15s"}}/>)}</div></div>
        </Card>

        <Card style={{marginBottom:12}}>
          <div style={{fontFamily:"Bebas Neue",fontSize:12,color:gc,letterSpacing:1,marginBottom:10}}>BODY STATS</div>
          <Input label="Height" value={height} onChange={setHeight} type="number" unit="cm" placeholder="175"/>
          <Input label="Current Weight" value={weight} onChange={setWeight} type="number" unit="kg" placeholder="80"/>
          <div><div style={{color:C.muted,fontSize:10,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Experience</div><div style={{display:"flex",gap:7}}>{["beginner","intermediate","advanced"].map(e=><div key={e} onClick={()=>setExp(e)} style={{flex:1,padding:"8px 4px",borderRadius:8,textAlign:"center",cursor:"pointer",fontSize:11,fontWeight:700,background:exp===e?gc+"22":C.surf,border:`1px solid ${exp===e?gc:C.border}`,color:exp===e?gc:C.muted,textTransform:"capitalize",transition:"all .15s"}}>{e}</div>)}</div></div>
        </Card>

        <Card style={{marginBottom:12}}>
          <div style={{fontFamily:"Bebas Neue",fontSize:12,color:gc,letterSpacing:1,marginBottom:10}}>GOAL</div>
          <div style={{display:"flex",gap:10}}>{["muscle","fat"].map(g=>(<div key={g} onClick={()=>setGoal(g)} style={{flex:1,padding:12,borderRadius:12,textAlign:"center",cursor:"pointer",border:`2px solid ${goal===g?(g==="fat"?C.fat:C.mus):C.border}`,background:goal===g?(g==="fat"?C.fat+"22":C.mus+"22"):C.surf,transition:"all .15s"}}><div style={{fontSize:26,marginBottom:3}}>{g==="fat"?"🔥":"🏋️"}</div><div style={{fontFamily:"Bebas Neue",fontSize:12,color:goal===g?(g==="fat"?C.fat:C.mus):C.muted}}>{g==="fat"?"LOSE WEIGHT":"BUILD MUSCLE"}</div></div>))}</div>
        </Card>

        <Card style={{marginBottom:12}}>
          <div style={{fontFamily:"Bebas Neue",fontSize:12,color:gc,letterSpacing:1,marginBottom:10}}>TRAINING SCHEDULE</div>
          <SchedulePicker value={sched} onChange={setSched} goalColor={gc}/>
        </Card>

        <Card style={{marginBottom:12}}>
          <div style={{fontFamily:"Bebas Neue",fontSize:12,color:gc,letterSpacing:1,marginBottom:8}}>🔒 PROFILE PIN</div>
          <p style={{color:C.muted,fontSize:12,marginBottom:10}}>4-digit PIN keeps your data private. Weight is hidden from the profile selector.</p>
          <Input label="PIN (4 digits)" value={pin} onChange={v=>setPin(v.replace(/\D/g,"").slice(0,4))} type="password" placeholder="••••"/>
          <Input label="Confirm PIN" value={pin2} onChange={v=>setPin2(v.replace(/\D/g,"").slice(0,4))} type="password" placeholder="••••"/>
        </Card>

        <Btn ch={existing?"💾 Save Changes":"🚀 Create Profile"} onClick={save} full col={gc}/>

        {existing&&(
          <div style={{marginTop:16}}>
            {!confirmDel
              ?<Btn ch="🗑️ Delete Profile" onClick={()=>setConfirmDel(true)} full ghost danger/>
              :<div style={{background:C.danger+"11",border:`1px solid ${C.danger}44`,borderRadius:12,padding:16}}>
                <div style={{fontFamily:"Bebas Neue",fontSize:14,color:C.danger,marginBottom:8}}>⚠️ ARE YOU SURE?</div>
                <p style={{fontSize:12,color:C.muted,marginBottom:12}}>This will permanently delete <b style={{color:C.text}}>{existing.name}</b>'s profile and all their data. There's no going back.</p>
                <div style={{display:"flex",gap:8}}>
                  <Btn ch="Yes, Delete Forever" onClick={()=>onDelete(existing.id)} full danger/>
                  <Btn ch="Cancel" onClick={()=>setConfirmDel(false)} full ghost col={C.muted}/>
                </div>
              </div>}
          </div>
        )}
        <div style={{height:20}}/>
      </div>
    </div>
  );
}

/* ─── SWAP PANEL ────────────────────────────────────────────── */
function SwapPanel({exName,isFatProg,onSwap,onClose}){
  const db=isFatProg?FDB:MDB,info=db[exName]||{};
  return(
    <div className="su" style={{background:C.surf,border:`2px solid ${C.warn}55`,borderRadius:14,padding:14,marginTop:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div><div style={{fontFamily:"Bebas Neue",fontSize:14,color:C.warn}}>🔄 SWAP EXERCISE</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Equipment busy? Same muscle, different move:</div></div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:18}}>✕</button>
      </div>
      {info.m&&<div style={{marginBottom:10}}><Badge ch={`Same target: ${info.m}`} col={C.warn}/></div>}
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {(info.sw||[]).map((alt,i)=>{const ai=db[alt]||{};return(
          <div key={i} onClick={()=>onSwap(alt)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 13px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"all .2s"}} onMouseOver={e=>{e.currentTarget.style.border=`1px solid ${C.warn}`;e.currentTarget.style.background=C.warn+"11";}} onMouseOut={e=>{e.currentTarget.style.border=`1px solid ${C.border}`;e.currentTarget.style.background=C.card;}}>
            <span style={{fontSize:19}}>{ai.i||"💪"}</span>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:13}}>{alt}</div>{ai.m&&<div style={{fontSize:11,color:C.muted}}>{ai.m}</div>}</div>
            <div style={{color:C.warn,fontWeight:700,fontSize:12}}>USE →</div>
          </div>
        );})}
      </div>
    </div>
  );
}

/* ─── EXERCISE CARD ─────────────────────────────────────────── */
function ExCard({ex,isFatProg=false,prevLog=null,onSetUpdate,sets,progColor=C.mus,isCircuit=false,circuitDone=false,onCircuitToggle}){
  const db=isFatProg?FDB:MDB;
  const[expanded,setExpanded]=useState(false);
  const[showSwap,setShowSwap]=useState(false);
  const[swapped,setSwapped]=useState(false);
  const[curName,setCurName]=useState(ex.n);
  const info=db[curName]||{m:"",i:"💪",t:"",v:"",sw:[]};
  function handleSwap(alt){setCurName(alt);setShowSwap(false);setSwapped(true);setExpanded(false);}

  return(
    <Card style={{marginBottom:9,border:`1px solid ${expanded?progColor:C.border}`,transition:"border .2s"}} gc={expanded?progColor:undefined}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div onClick={()=>{setExpanded(!expanded);setShowSwap(false);}} style={{display:"flex",alignItems:"center",gap:10,flex:1,cursor:"pointer"}}>
          <span style={{fontSize:21}}>{info.i}</span>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
              <span style={{fontWeight:800,fontSize:13}}>{curName}</span>
              {swapped&&<Badge ch="🔄 SWAPPED" col={C.warn}/>}
            </div>
            <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap"}}>
              {!isCircuit&&<><Badge ch={`${ex.s} sets`} col={C.blue}/><Badge ch={`${ex.r} reps`} col={progColor}/></>}
              {isCircuit&&<Badge ch={ex.r} col={progColor}/>}
              {info.m&&<Badge ch={info.m} col={C.muted}/>}
            </div>
          </div>
          <span style={{color:C.muted,fontSize:13}}>{expanded?"▲":"▼"}</span>
        </div>
        {isCircuit&&<button onClick={onCircuitToggle} style={{width:30,height:30,borderRadius:7,border:"none",cursor:"pointer",background:circuitDone?C.fat:C.border,color:circuitDone?"#000":C.muted,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",flexShrink:0}}>✓</button>}
        <button onClick={()=>{setShowSwap(!showSwap);setExpanded(false);}} style={{background:showSwap?C.warn+"22":"transparent",border:`1px solid ${showSwap?C.warn:C.border}`,borderRadius:7,padding:"5px 8px",cursor:"pointer",color:showSwap?C.warn:C.muted,fontSize:11,fontWeight:700,fontFamily:"Nunito",transition:"all .2s",whiteSpace:"nowrap",flexShrink:0}}>🔄 Swap</button>
      </div>
      {prevLog&&!isCircuit&&<div style={{background:C.surf,borderRadius:7,padding:"5px 10px",fontSize:11,color:C.warn,marginTop:7}}>📊 Last: {Object.values(prevLog).filter(s=>s.weight).map(s=>`${s.weight}kg×${s.reps}`).join(", ")||"—"} — Beat it! 🔥</div>}
      {showSwap&&<SwapPanel exName={curName} isFatProg={isFatProg} onSwap={handleSwap} onClose={()=>setShowSwap(false)}/>}
      {expanded&&(
        <div className="su" style={{marginTop:12}}>
          {info.t&&<div style={{background:C.accentD||"#AAFF0010",borderRadius:8,padding:10,marginBottom:10,border:"1px solid #AAFF0022"}}><span style={{color:C.accent,fontWeight:700,fontSize:11}}>💡 FORM TIP  </span><span style={{fontSize:12,color:C.text,lineHeight:1.5}}>{info.t}</span></div>}
          {info.v&&<a href={info.v} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:5,color:C.blue,fontSize:11,fontWeight:700,textDecoration:"none",marginBottom:11}}>▶️ Watch Tutorial on YouTube</a>}
          {!isCircuit&&Array.from({length:ex.s}).map((_,si)=>{
            const s=sets?.[curName]?.[si]||{};
            return(<div key={si} style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr auto",gap:7,alignItems:"center",marginBottom:7,padding:8,borderRadius:8,transition:"all .2s",background:s.done?C.fat+"0d":C.surf,border:`1px solid ${s.done?C.fat+"44":C.border}`}}>
              <div style={{fontFamily:"Bebas Neue",fontSize:13,color:C.muted,width:20,textAlign:"center"}}>S{si+1}</div>
              <input value={s.weight||""} onChange={e=>onSetUpdate(curName,si,"weight",e.target.value)} type="number" placeholder="kg" style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 8px",color:C.text,fontSize:13,fontFamily:"Nunito",outline:"none",width:"100%"}}/>
              <input value={s.reps||""} onChange={e=>onSetUpdate(curName,si,"reps",e.target.value)} type="number" placeholder="Reps" style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 8px",color:C.text,fontSize:13,fontFamily:"Nunito",outline:"none",width:"100%"}}/>
              <button onClick={()=>onSetUpdate(curName,si,"done",!s.done)} style={{width:30,height:30,borderRadius:7,border:"none",cursor:"pointer",fontSize:13,background:s.done?C.fat:C.border,color:s.done?"#000":C.muted,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>✓</button>
            </div>);
          })}
        </div>
      )}
    </Card>
  );
}

/* ─── MUSCLE WORKOUT ─────────────────────────────────────────── */
function MuscleWorkout({user,workoutHistory,onComplete}){
  const cycle=getMCycle(user,workoutHistory),wType=getTodayWorkout(user,workoutHistory);
  const dayInfo=MUS_INFO[wType]||MUS_INFO.rest;
  const exercises=wType!=="rest"?(getMExercises(cycle)[wType]||[]):[];
  const[sets,setSets]=useState({});
  const completed=workoutHistory.find(w=>w.date===todayStr()&&w.completed);
  useEffect(()=>{const tl=workoutHistory.find(w=>w.date===todayStr());if(tl?.sets)setSets(tl.sets);},[]);
  function getPrev(n){for(let i=workoutHistory.length-1;i>=0;i--){const w=workoutHistory[i];if(w.date!==todayStr()&&w.sets?.[n])return w.sets[n];}return null;}
  function updateSet(ex,si,f,v){setSets(p=>({...p,[ex]:{...(p[ex]||{}),[si]:{...(p[ex]?.[si]||{}),[f]:v}}}))}
  function finish(){onComplete({date:todayStr(),type:wType,cycle,sets,completed:true});}
  return(
    <div style={{padding:20,maxWidth:600,margin:"0 auto"}}>
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",gap:7,marginBottom:8,flexWrap:"wrap"}}>
          <div style={{background:`linear-gradient(135deg,${C.mus},#FF6A00)`,borderRadius:7,padding:"4px 12px",fontFamily:"Bebas Neue",fontSize:12,letterSpacing:2}}>CYCLE {cycle} · PHASE {Math.ceil(cycle/5)}</div>
          {isMDeload(cycle)&&<Badge ch="🔋 DELOAD" col={C.accent}/>}
          {isMWeightUp(cycle)&&<Badge ch="⬆️ +10% WEIGHT" col={C.warn}/>}
        </div>
        <h2 style={{fontFamily:"Bebas Neue",fontSize:28,letterSpacing:2}}>{dayInfo.label} <span style={{color:C.mus}}>·</span> {dayInfo.theme}</h2>
        {completed&&<div style={{marginTop:5}}><Badge ch="✅ COMPLETED TODAY! BEAST!" col={C.fat}/></div>}
      </div>
      {wType==="rest"?(
        <Card style={{textAlign:"center",padding:32}}>
          <div style={{fontSize:48,marginBottom:10}}>😴</div>
          <div style={{fontFamily:"Bebas Neue",fontSize:22,letterSpacing:2}}>REST & RECOVER</div>
          <p style={{color:C.muted,marginTop:8,lineHeight:1.7,fontSize:13}}>Muscles grow on rest days — not in the gym.<br/>Hydrate. Hit your macros. Sleep 8–10 hours.</p>
          <div style={{marginTop:16,background:C.warn+"11",borderRadius:10,padding:12,fontSize:12,color:C.warn}}>💡 Use this time to visualise tomorrow's session. Champions prepare mentally.</div>
        </Card>
      ):(
        <>
          <div style={{background:C.warn+"11",border:`1px solid ${C.warn}33`,borderRadius:10,padding:"9px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:16}}>🔄</span><span style={{fontSize:12,color:C.warn}}>Equipment taken? Tap <b>Swap</b> on any exercise for a same-muscle alternative. No excuses!</span>
          </div>
          {exercises.map((ex,ei)=><ExCard key={`${ei}-${ex.n}`} ex={ex} isFatProg={false} prevLog={getPrev(ex.n)} sets={sets} onSetUpdate={updateSet} progColor={C.mus}/>)}
          {!completed&&<div style={{marginTop:14}}><Btn ch="🏆 Mark Workout Complete" onClick={finish} full col={C.mus}/></div>}
        </>
      )}
    </div>
  );
}

/* ─── FAT WORKOUT ────────────────────────────────────────────── */
function FatWorkout({user,workoutHistory,onComplete}){
  const week=getFCycle(user,workoutHistory),wType=getTodayWorkout(user,workoutHistory);
  const dayInfo=FAT_INFO[wType]||FAT_INFO.rest;
  const allDays=getFDayData(week),dayData=allDays[wType]||{type:"rest"};
  const block=Math.ceil(week/3),rounds=dayData.rounds||3;
  const[doneRounds,setDoneRounds]=useState(0);
  const[circuitDone,setCircuitDone]=useState({});
  const completed=workoutHistory.find(w=>w.date===todayStr()&&w.completed);
  function finish(){onComplete({date:todayStr(),type:wType,week,completed:true});}
  const isCircuit=dayData.type==="circuit",isHIIT=dayData.type==="hiit";
  return(
    <div style={{padding:20,maxWidth:600,margin:"0 auto"}}>
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",gap:7,marginBottom:8,flexWrap:"wrap"}}>
          <div style={{background:`linear-gradient(135deg,${C.fat},#69FF9A)`,color:"#000",borderRadius:7,padding:"4px 12px",fontFamily:"Bebas Neue",fontSize:12,letterSpacing:2}}>WEEK {week} · BLOCK {block}</div>
        </div>
        <h2 style={{fontFamily:"Bebas Neue",fontSize:28,letterSpacing:2}}>{dayInfo.label} <span style={{color:C.fat}}>·</span> {dayInfo.theme}</h2>
        {completed&&<div style={{marginTop:5}}><Badge ch="✅ CRUSHED IT! 🔥" col={C.fat}/></div>}
      </div>
      {dayData.type==="rest"&&<Card gc={C.fat} style={{textAlign:"center",padding:32}}><div style={{fontSize:48,marginBottom:10}}>🛌</div><div style={{fontFamily:"Bebas Neue",fontSize:22,color:C.fat,letterSpacing:2}}>FULL REST DAY</div><p style={{color:C.muted,marginTop:8,lineHeight:1.7,fontSize:13}}>Recovery is non-negotiable. Your body rebuilds on rest days.<br/>Drink water. Sleep 8+ hours. Eat your protein.</p></Card>}
      {dayData.type==="active"&&<Card gc={C.fat} style={{textAlign:"center",padding:32}}><div style={{fontSize:48,marginBottom:10}}>🚶</div><div style={{fontFamily:"Bebas Neue",fontSize:22,color:C.fat,letterSpacing:2}}>ACTIVE RECOVERY</div><p style={{color:C.muted,marginTop:8,lineHeight:1.7,fontSize:13}}>30–45 min brisk walk or easy cycling. Heart rate 100–120 BPM.<br/>Low intensity. Your muscles need to breathe.</p>{!completed&&<div style={{marginTop:18}}><Btn ch="✅ Walk Done" onClick={finish} full col={C.fat}/></div>}</Card>}
      {isHIIT&&(
        <div>
          <Card gc={C.fat} style={{marginBottom:12,textAlign:"center"}}>
            <div style={{fontSize:11,color:C.fat,fontWeight:700,letterSpacing:2,marginBottom:8}}>⚡ HIIT PROTOCOL — GO ALL OUT. NO HALF MEASURES.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
              <Stat label="Rounds" value={dayData.rounds} col={C.fat} icon="🔄"/>
              <Stat label="Work" value={`${dayData.work}s`} col={C.mus} icon="⚡"/>
              <Stat label="Rest" value={`${dayData.rest}s`} col={C.blue} icon="⏸️"/>
            </div>
          </Card>
          <div style={{background:C.warn+"11",border:`1px solid ${C.warn}33`,borderRadius:10,padding:"9px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>🔄</span><span style={{fontSize:12,color:C.warn}}>Space taken? Tap <b>Swap</b> on any exercise. Keep moving!</span></div>
          {(dayData.exercises||[]).map((ex,ei)=><ExCard key={`${ei}-${ex.n}`} ex={ex} isFatProg={true} progColor={C.fat} isCircuit={false} sets={{}} onSetUpdate={()=>{}}/>)}
          {!completed&&<div style={{marginTop:12}}><Btn ch="🔥 HIIT Complete!" onClick={finish} full col={C.fat}/></div>}
        </div>
      )}
      {isCircuit&&(
        <div>
          <Card gc={C.fat} style={{marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,textAlign:"center",marginBottom:10}}>
              <Stat label="Rounds" value={rounds} col={C.fat} icon="🔄"/>
              <Stat label="Btwn Ex." value="60s" col={C.blue} icon="⏸️"/>
              <Stat label="Btwn Rds" value="90s" col={C.muted} icon="😤"/>
            </div>
            <Bar val={doneRounds} max={rounds} col={C.fat} label="Rounds Completed" sub={`${doneRounds}/${rounds}`}/>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <Btn ch="+ Round Done" onClick={()=>setDoneRounds(r=>Math.min(r+1,rounds))} col={C.fat} sm/>
              <Btn ch="− Round" onClick={()=>setDoneRounds(r=>Math.max(r-1,0))} ghost col={C.fat} sm/>
            </div>
          </Card>
          <div style={{background:C.warn+"11",border:`1px solid ${C.warn}33`,borderRadius:10,padding:"9px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>🔄</span><span style={{fontSize:12,color:C.warn}}>Equipment taken? Tap <b>Swap</b> for a same-muscle alternative. Keep the sweat flowing!</span></div>
          {(dayData.exercises||[]).map((ex,ei)=><ExCard key={`${ei}-${ex.n}`} ex={ex} isFatProg={true} progColor={C.fat} isCircuit={true} sets={{}} onSetUpdate={()=>{}} circuitDone={!!circuitDone[ex.n]} onCircuitToggle={()=>setCircuitDone(p=>({...p,[ex.n]:!p[ex.n]}))}/>)}
          {!completed&&<div style={{marginTop:12}}><Btn ch="🔥 Mark Circuit Complete" onClick={finish} full col={C.fat}/></div>}
        </div>
      )}
    </div>
  );
}

/* ─── FUEL / NUTRITION + MEAL TRACKING ──────────────────────── */
function NutritionView({user,mealLogs,onLogMeal}){
  const isFat=user.goal==="fat",g=G(user);
  const wKg=user.weightHistory?.at(-1)?.weight||80;
  const sched=getUserSchedule(user),isTraining=sched.includes(todayDOW());
  const m=isFat?calcFatMacros(wKg,isTraining):calcMusMacros(wKg,isTraining);
  const[plan,setPlan]=useState(null);
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState("");
  const[tab,setTab]=useState("plan");
  const todayLog=mealLogs[todayStr()]||{eaten:[],totalCal:0};
  const eatenCal=todayLog.eaten.reduce((a,ml)=>a+(ml.calories||0),0);

  // Calorie history — last 7 days
  const calHistory=Array.from({length:7}).map((_,i)=>{
    const d=fmtDate(new Date(Date.now()-i*864e5));
    return{date:d,cal:(mealLogs[d]?.totalCal||0)};
  }).reverse();
  const maxCal=Math.max(...calHistory.map(x=>x.cal),m.cal);

  // ── Fallback meal plan builder (runs instantly, no API needed) ──
  function buildFallbackPlan(){
    const perMeal=Math.round(m.cal/5);
    const pPerMeal=Math.round(m.protein/5);
    const cPerMeal=Math.round(m.carbs/5);
    const fPerMeal=Math.round(m.fat/5);
    if(isFat){
      return[
        {time:"7:00 AM",name:"Protein Breakfast",foods:[`Egg whites (${Math.round(pPerMeal*3)}g)`,`Spinach & mushrooms (100g)`,"Black coffee / green tea"],macros:{protein:pPerMeal,carbs:Math.round(cPerMeal*0.4),fat:Math.round(fPerMeal*0.5),calories:Math.round(perMeal*0.8)}},
        {time:"10:00 AM",name:"Mid-Morning Snack",foods:[`0% Greek yoghurt (${Math.round(pPerMeal*4)}g)`,"Berries (80g)"],macros:{protein:pPerMeal,carbs:Math.round(cPerMeal*0.7),fat:Math.round(fPerMeal*0.3),calories:Math.round(perMeal*0.7)}},
        {time:"1:00 PM",name:"Lean Protein Lunch",foods:[`Chicken breast (${Math.round(pPerMeal*4)}g)`,`Broccoli & cucumber (200g)`,`Sweet potato (${Math.round(cPerMeal*4)}g)`],macros:{protein:Math.round(pPerMeal*1.3),carbs:cPerMeal,fat:Math.round(fPerMeal*0.5),calories:perMeal}},
        {time:"4:00 PM",name:"Pre-Workout Snack",foods:[`Cottage cheese (${Math.round(pPerMeal*3)}g)`,"Rice cakes (2)","Watermelon (150g)"],macros:{protein:pPerMeal,carbs:Math.round(cPerMeal*0.8),fat:Math.round(fPerMeal*0.3),calories:Math.round(perMeal*0.8)}},
        {time:"7:00 PM",name:"Dinner",foods:[`White fish / tuna (${Math.round(pPerMeal*4)}g)`,`Mixed veg (250g)`,`Zucchini (150g)`,"Lemon & herbs"],macros:{protein:Math.round(pPerMeal*1.4),carbs:Math.round(cPerMeal*1.1),fat:fPerMeal,calories:Math.round(perMeal*0.9)}},
      ];
    }else{
      return[
        {time:"7:00 AM",name:"Power Breakfast",foods:[`Oats (${Math.round(cPerMeal*4)}g)`,`Whole eggs (3)`,`Banana (1)`,`Milk (200ml)`],macros:{protein:pPerMeal,carbs:cPerMeal,fat:fPerMeal,calories:perMeal}},
        {time:"10:30 AM",name:"Mid-Morning Fuel",foods:[`Protein shake (${Math.round(pPerMeal*4)}g whey)`,`Brown rice cakes (4)`,`Peanut butter (${Math.round(fPerMeal*8)}g)`],macros:{protein:Math.round(pPerMeal*1.2),carbs:cPerMeal,fat:fPerMeal,calories:perMeal}},
        {time:"1:00 PM",name:"Muscle Lunch",foods:[`Chicken breast (${Math.round(pPerMeal*4)}g)`,`Brown rice (${Math.round(cPerMeal*4)}g)`,`Broccoli (150g)`,`Olive oil (${Math.round(fPerMeal*8)}ml)`],macros:{protein:Math.round(pPerMeal*1.3),carbs:Math.round(cPerMeal*1.1),fat:fPerMeal,calories:perMeal}},
        {time:"4:00 PM",name:"Pre-Workout Meal",foods:[`Sweet potato (${Math.round(cPerMeal*4)}g)`,`Turkey mince (${Math.round(pPerMeal*4)}g)`,`Avocado (½)`],macros:{protein:pPerMeal,carbs:cPerMeal,fat:Math.round(fPerMeal*1.2),calories:perMeal}},
        {time:"7:30 PM",name:"Post-Workout Dinner",foods:[`Beef / salmon (${Math.round(pPerMeal*4)}g)`,`Pasta / quinoa (${Math.round(cPerMeal*4)}g)`,`Mixed veg (200g)`,`Nuts (${Math.round(fPerMeal*5)}g)`],macros:{protein:Math.round(pPerMeal*1.4),carbs:cPerMeal,fat:fPerMeal,calories:perMeal}},
      ];
    }
  }

  async function genPlan(){
    setLoading(true);setErr("");
    try{
      const prompt=isFat
        ?`Create a fat loss meal plan. CALORIC DEFICIT. Weight: ${wKg}kg. ${isTraining?"Training":"Rest"} day. STRICT targets: ${m.cal} kcal total, Protein ${m.protein}g, Carbs ${m.carbs}g, Fat ${m.fat}g. High-volume low-calorie whole foods, lean proteins, lots of veg. 5 meals. Return ONLY a valid JSON array, no other text: [{"time":"7:00 AM","name":"Meal","foods":["item (Xg)"],"macros":{"protein":0,"carbs":0,"fat":0,"calories":0}}]`
        :`Create a muscle building meal plan. CALORIC SURPLUS. Weight: ${wKg}kg. ${isTraining?"Training":"Rest"} day. Targets: ${m.cal} kcal, Protein ${m.protein}g, Carbs ${m.carbs}g, Fat ${m.fat}g. Nutrient-dense whole foods. 5 meals. Return ONLY a valid JSON array, no other text: [{"time":"7:00 AM","name":"Meal","foods":["item (Xg)"],"macros":{"protein":0,"carbs":0,"fat":0,"calories":0}}]`;

      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),15000); // 15s timeout
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]}),
        signal:controller.signal,
      });
      clearTimeout(timeout);

      if(res.status===429){
        // Rate limited — use our instant fallback instead of showing an error
        setPlan(buildFallbackPlan());
        setErr("ℹ️ AI rate limit reached — showing your personalised plan based on your macros. This resets shortly.");
        setLoading(false);return;
      }
      if(!res.ok){throw new Error(`Server error ${res.status}. Using offline plan.`);}

      const data=await res.json();
      const txt=data.content?.find(b=>b.type==="text")?.text||"";
      if(!txt)throw new Error("Empty AI response");
      const match=txt.match(/\[[\s\S]*\]/);
      if(!match)throw new Error("Could not parse AI response");
      const meals=JSON.parse(match[0]);
      if(!Array.isArray(meals)||meals.length===0)throw new Error("Invalid meal plan");
      setPlan(meals);
    }catch(e){
      // Any error → fall back to offline plan, never leave user stuck
      if(e.name==="AbortError"){
        setErr("ℹ️ AI took too long — showing your personalised offline plan instead.");
      }else if(e.message?.includes("429")||e.message?.includes("rate")){
        setErr("ℹ️ AI rate limit reached — showing your personalised offline plan based on your macros.");
      }else{
        setErr("ℹ️ AI unavailable — showing your personalised offline plan based on your macros.");
      }
      setPlan(buildFallbackPlan());
    }
    setLoading(false);
  }

  function markEaten(meal){
    const already=todayLog.eaten.find(e=>e.name===meal.name);
    const newEaten=already?todayLog.eaten.filter(e=>e.name!==meal.name):[...todayLog.eaten,{name:meal.name,calories:meal.macros?.calories||0,time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}];
    onLogMeal(todayStr(),{eaten:newEaten,totalCal:newEaten.reduce((a,e)=>a+(e.calories||0),0)});
  }

  const foodGroups=isFat?[
    {label:"🥩 Protein (Priority!)",foods:["Chicken breast","Egg whites","White fish","Tuna","Turkey","0% Greek yoghurt","Cottage cheese"],col:C.blue},
    {label:"🥦 Low-Cal Carbs",foods:["Broccoli","Spinach","Cucumber","Zucchini","Cauliflower","Lettuce","Sweet potato (small)"],col:C.fat},
    {label:"🍎 Fruit (Limit)",foods:["Berries","Apple","Grapefruit","Watermelon"],col:C.warn},
  ]:[
    {label:"🥩 Protein",foods:["Chicken","Turkey","Beef","Eggs","Fish","Cottage cheese","Protein powder"],col:C.blue},
    {label:"🍚 Carbs",foods:["Sweet potato","Brown rice","Oats","Pasta","Quinoa","Fruit","Veg"],col:C.accent},
    {label:"🥑 Fats",foods:["Avocado","Nuts","Olive oil","Coconut oil","Fatty fish","Nut butter"],col:C.warn},
  ];

  return(
    <div style={{padding:20,maxWidth:600,margin:"0 auto"}}>
      <h2 style={{fontFamily:"Bebas Neue",fontSize:30,letterSpacing:2,marginBottom:4}}>{isFat?"🔥 CUT NUTRITION":"🏋️ BULK NUTRITION"}</h2>
      <p style={{color:C.muted,fontSize:12,marginBottom:12}}>{isTraining?"Training":"Rest"} day · {wKg}kg · {isFat?"Caloric deficit":"Caloric surplus"}</p>

      {/* Macro targets */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <Card style={{textAlign:"center",background:`linear-gradient(135deg,${g.color}16,${C.card})`}}>
          <div style={{fontFamily:"Bebas Neue",fontSize:38,color:g.color}}>{m.cal}</div>
          <div style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase"}}>{isFat?"Deficit Calories":"Total Calories"}</div>
        </Card>
        <Card><Stat label="Protein" value={`${m.protein}g`} col={C.blue} icon="🥩"/></Card>
        <Card><Stat label="Carbs" value={`${m.carbs}g`} col={C.accent} icon={isFat?"🥦":"🍚"}/></Card>
        <Card><Stat label="Fat" value={`${m.fat}g`} col={C.warn} icon="🥑"/></Card>
      </div>

      {/* Today's calorie tracker */}
      <Card style={{marginBottom:12,border:`1px solid ${eatenCal>=m.cal?C.fat+"44":C.border}`}}>
        <div style={{fontFamily:"Bebas Neue",fontSize:13,color:g.color,letterSpacing:1,marginBottom:8}}>🍽 TODAY'S INTAKE TRACKER</div>
        <Bar val={eatenCal} max={m.cal} col={eatenCal>=m.cal?C.fat:g.color} label="Calories Eaten" sub={`${eatenCal} / ${m.cal} kcal`}/>
        <div style={{marginTop:8,fontSize:12,color:C.muted}}>
          {eatenCal===0?"Start logging your meals below by tapping ✓ on each meal you eat.":eatenCal>=m.cal?`🎉 Daily goal reached! ${eatenCal} kcal consumed.`:`${m.cal-eatenCal} kcal remaining today.`}
        </div>
        {todayLog.eaten.length>0&&<div style={{marginTop:10}}>{todayLog.eaten.map((e,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}><span style={{color:C.text}}>{e.name}</span><span style={{color:g.color,fontWeight:700}}>{e.calories} kcal</span></div>)}</div>}
      </Card>

      {/* Tabs */}
      <div style={{display:"flex",gap:7,marginBottom:12}}>
        {["plan","history","foods"].map(t=><button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"8px 4px",borderRadius:8,border:"none",cursor:"pointer",background:tab===t?g.color:C.surf,color:tab===t?(g.color===C.fat?"#000":"#fff"):C.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,fontFamily:"Nunito",transition:"all .2s"}}>{t==="plan"?"🤖 Meal Plan":t==="history"?"📊 Cal History":"✅ Foods"}</button>)}
      </div>

      {tab==="plan"&&(
        <div>
          <Btn ch={loading?"⏳ Generating Meal Plan...":"🤖 Generate Today's AI Meal Plan"} onClick={genPlan} full col={g.color} disabled={loading}/>
          {err&&<div style={{background:err.startsWith("ℹ️")?C.blue+"11":C.danger+"11",border:`1px solid ${err.startsWith("ℹ️")?C.blue+"44":C.danger+"33"}`,borderRadius:8,padding:"10px 14px",marginTop:10,fontSize:12,color:err.startsWith("ℹ️")?C.blue:C.danger}}>{err}</div>}
          {!plan&&!loading&&!err&&<div style={{textAlign:"center",padding:30,color:C.muted,fontSize:13}}>"What you eat in private, you wear in public." — Generate your personalised plan now.</div>}
          {plan&&(
            <div style={{marginTop:12}}>
              <div style={{fontSize:12,color:C.muted,marginBottom:10}}>✓ tap each meal when you've eaten it to track your calories</div>
              {plan.map((meal,i)=>{
                const isEaten=todayLog.eaten.some(e=>e.name===meal.name);
                return(
                  <Card key={i} style={{marginBottom:9,border:`1px solid ${isEaten?C.fat+"44":C.border}`,background:isEaten?C.fat+"08":C.card}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                      <div><div style={{fontFamily:"Bebas Neue",fontSize:15,letterSpacing:1}}>{meal.name}</div><div style={{fontSize:11,color:C.muted}}>{meal.time}</div></div>
                      <div style={{display:"flex",gap:7,alignItems:"center"}}>
                        <Badge ch={`${meal.macros?.calories||0} kcal`} col={g.color}/>
                        <button onClick={()=>markEaten(meal)} style={{width:30,height:30,borderRadius:7,border:"none",cursor:"pointer",background:isEaten?C.fat:C.border,color:isEaten?"#000":C.muted,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",flexShrink:0}}>✓</button>
                      </div>
                    </div>
                    {(meal.foods||[]).map((f,fi)=><div key={fi} style={{fontSize:12,color:C.text,padding:"2px 0",borderBottom:fi<meal.foods.length-1?`1px solid ${C.border}`:""}}>• {f}</div>)}
                    <div style={{display:"flex",gap:5,marginTop:7,flexWrap:"wrap"}}>
                      <Badge ch={`P: ${meal.macros?.protein||0}g`} col={C.blue}/>
                      <Badge ch={`C: ${meal.macros?.carbs||0}g`} col={C.accent}/>
                      <Badge ch={`F: ${meal.macros?.fat||0}g`} col={C.warn}/>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab==="history"&&(
        <Card>
          <div style={{fontFamily:"Bebas Neue",fontSize:13,color:g.color,letterSpacing:1,marginBottom:12}}>📊 CALORIE HISTORY — LAST 7 DAYS</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:4,height:100,marginBottom:12}}>
            {calHistory.map((d,i)=>{
              const h=Math.max(((d.cal/maxCal)*80),d.cal>0?8:0);
              const isToday=d.date===todayStr();
              return(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <div style={{fontSize:8,color:g.color,fontWeight:700}}>{d.cal||""}</div>
                <div style={{width:"100%",background:`linear-gradient(180deg,${g.color}${isToday?"ff":"77"},${g.color}${isToday?"cc":"33"})`,borderRadius:"3px 3px 0 0",height:h,transition:"height .5s",minHeight:d.cal>0?4:0}}/>
                <div style={{fontSize:8,color:isToday?C.text:C.muted,fontWeight:isToday?700:400}}>{d.date.slice(5)}</div>
              </div>);
            })}
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,fontSize:12,color:C.muted}}>
            Daily target: <b style={{color:g.color}}>{m.cal} kcal</b> {isFat?"— Stay in your deficit every day!":"— Hit your surplus to grow!"}
          </div>
        </Card>
      )}

      {tab==="foods"&&(
        <Card>
          <div style={{fontFamily:"Bebas Neue",fontSize:13,color:g.color,letterSpacing:1,marginBottom:10}}>✅ {isFat?"FAT LOSS FOODS":"BULK FOODS"}</div>
          {foodGroups.map(({label,foods,col})=>(
            <div key={label} style={{marginBottom:12}}>
              <div style={{color:col,fontWeight:700,fontSize:11,marginBottom:5}}>{label}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{foods.map(x=><span key={x} style={{background:col+"22",border:`1px solid ${col}33`,borderRadius:20,padding:"2px 9px",fontSize:11,color:C.text}}>{x}</span>)}</div>
            </div>
          ))}
          {isFat&&<div style={{background:"#FF336611",border:"1px solid #FF336633",borderRadius:8,padding:"7px 12px",fontSize:11,color:"#FF6688",marginTop:4}}>🚫 AVOID: Alcohol · White bread · Sugary drinks · Fried food · Sauces</div>}
        </Card>
      )}
    </div>
  );
}

/* ─── WATER ──────────────────────────────────────────────────── */
function WaterView({waterData,onUpdate}){
  const td=todayStr(),count=waterData[td]||0,goal=8,pct=count/goal*100,col=count>=goal?C.fat:C.blue;
  return(
    <div style={{padding:20,maxWidth:480,margin:"0 auto",textAlign:"center"}}>
      <h2 style={{fontFamily:"Bebas Neue",fontSize:36,letterSpacing:2,marginBottom:4}}>HYDRATION</h2>
      <p style={{color:C.muted,marginBottom:6,fontSize:13}}>3–4 litres daily · 8 glasses target</p>
      <div style={{fontSize:12,color:count<4?C.danger:count<8?C.warn:C.fat,marginBottom:20,fontWeight:700}}>
        {count===0?"Your muscles are crying for water. Drink up! 💧":count<4?"Seriously? Drink more! Dehydration kills performance.":count<8?`${8-count} more glasses. Push through!`:"🎉 Hydration champion! Your performance thanks you."}
      </div>
      <div style={{position:"relative",width:160,height:160,margin:"0 auto 24px",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <svg width="160" height="160" style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}}>
          <circle cx="80" cy="80" r="70" fill="none" stroke={C.border} strokeWidth="10"/>
          <circle cx="80" cy="80" r="70" fill="none" stroke={col} strokeWidth="10" strokeDasharray={`${2*Math.PI*70}`} strokeDashoffset={`${2*Math.PI*70*(1-pct/100)}`} strokeLinecap="round" style={{transition:"all .5s ease"}}/>
        </svg>
        <div><div style={{fontFamily:"Bebas Neue",fontSize:48,color:col,lineHeight:1}}>{count}</div><div style={{fontSize:12,color:C.muted}}>of {goal}</div></div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:18}}>
        {Array.from({length:goal}).map((_,i)=>(
          <div key={i} onClick={()=>onUpdate(td,i<count?i:i+1)} style={{width:46,height:60,borderRadius:8,cursor:"pointer",transition:"all .2s",background:i<count?`linear-gradient(180deg,${C.blue}77,${C.blue})`:C.surf,border:`2px solid ${i<count?C.blue:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transform:i<count?"scale(1.07)":"scale(1)"}}>💧</div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"center"}}>
        <Btn ch="+ Glass" onClick={()=>onUpdate(td,Math.min(count+1,goal))} col={C.mus} disabled={count>=goal}/>
        <Btn ch="− Glass" onClick={()=>onUpdate(td,Math.max(count-1,0))} ghost disabled={count<=0}/>
      </div>
    </div>
  );
}

/* ─── STATS (progress + muscle map + photos + history) ──────── */
function StatsView({user,workoutHistory,onUpdateMeasurements,measurements,photos,onSavePhoto}){
  const[tab,setTab]=useState("progress");
  const g=G(user);
  const wh=user.weightHistory||[];
  const minW=wh.length?Math.min(...wh.map(w=>w.weight)):60,maxW=wh.length?Math.max(...wh.map(w=>w.weight)):100,range=maxW-minW||10;
  const[newW,setNewW]=useState("");
  const[newM,setNewM]=useState({chest:"",waist:"",hips:"",bicep:"",thigh:"",neck:""});
  const[showM,setShowM]=useState(false);
  const total=workoutHistory.filter(w=>w.completed).length;
  const cycle=user.goal==="fat"?getFCycle(user,workoutHistory):getMCycle(user,workoutHistory);
  const totalWeeks=user.goal==="fat"?12:25;
  const totalKg=getTotalKg(workoutHistory);
  const freq=getMuscleFreq(workoutHistory);
  const freqEntries=Object.entries(freq).sort((a,b)=>b[1]-a[1]);
  const maxFreq=Math.max(...Object.values(freq),1);

  // Photo upload
  const beforeRef=useRef(),afterRef=useRef();
  async function handlePhoto(file,type){
    if(!file)return;
    const compressed=await compressImage(file);
    onSavePhoto(type,compressed);
  }

  // Exercise history
  const exHistory=workoutHistory.filter(w=>w.completed&&w.sets).slice(-20).reverse();

  return(
    <div style={{padding:20,maxWidth:600,margin:"0 auto"}}>
      <h2 style={{fontFamily:"Bebas Neue",fontSize:34,letterSpacing:2,marginBottom:4}}>YOUR STATS</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:14}}>
        <Card style={{textAlign:"center",padding:10}}><Stat label="Sessions" value={total} col={g.color} icon="💪"/></Card>
        <Card style={{textAlign:"center",padding:10}}><Stat label="Streak" value={user.streak||0} sub="days" col={C.warn} icon="🔥"/></Card>
        <Card style={{textAlign:"center",padding:10,background:`linear-gradient(135deg,${C.mus}11,${C.card})`}}>
          <div style={{fontSize:14,marginBottom:2}}>🏋️</div>
          <div style={{fontFamily:"Bebas Neue",fontSize:18,color:C.mus}}>{totalKg>=1000?`${(totalKg/1000).toFixed(1)}T`:`${totalKg}kg`}</div>
          <div style={{fontSize:9,color:C.muted,fontWeight:700,textTransform:"uppercase"}}>Total Lifted</div>
          {totalKg>0&&<div style={{fontSize:8,color:C.muted,marginTop:1}}>{totalKg>=1000?`That's ${(totalKg/6300).toFixed(1)} average cars! 🚗`:`${(totalKg/80).toFixed(0)} people your weight! 💀`}</div>}
        </Card>
      </div>
      <Bar val={cycle} max={totalWeeks} col={g.color} label={g.desc} sub={`Week ${cycle}/${totalWeeks} · ${Math.round(cycle/totalWeeks*100)}%`}/>
      <div style={{height:14}}/>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {[["progress","📈 Weight"],["muscles","💪 Muscles"],["photos","📸 Photos"],["history","📋 History"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,minWidth:70,padding:"8px 4px",borderRadius:8,border:"none",cursor:"pointer",background:tab===t?g.color:C.surf,color:tab===t?(g.color===C.fat?"#000":"#fff"):C.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.4,fontFamily:"Nunito",transition:"all .2s"}}>{l}</button>
        ))}
      </div>

      {tab==="progress"&&(
        <div className="su">
          <Card style={{marginBottom:10}}>
            <div style={{fontFamily:"Bebas Neue",fontSize:12,color:g.color,letterSpacing:1,marginBottom:8}}>{user.goal==="fat"?"⚖️ WEIGHT LOSS CHART":"⚖️ WEIGHT GAIN CHART"}</div>
            {wh.length>0?(
              <>
                <div style={{display:"flex",alignItems:"flex-end",gap:3,height:80,marginBottom:6}}>
                  {wh.slice(-14).map((w,i)=>{const h=((w.weight-minW)/range)*60+18;return(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{fontSize:7,color:g.color,fontWeight:700}}>{w.weight}</div><div style={{width:"100%",background:`linear-gradient(180deg,${g.color},${g.color}44)`,borderRadius:"3px 3px 0 0",height:h,transition:"height .5s"}}/></div>);})}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,borderTop:`1px solid ${C.border}`,paddingTop:7}}>
                  <span style={{color:C.muted}}>Start: <b style={{color:C.text}}>{wh[0]?.weight}kg</b></span>
                  <span style={{color:C.muted}}>Now: <b style={{color:g.color}}>{wh.at(-1)?.weight}kg</b></span>
                  <span style={{color:C.muted}}>Δ: <b style={{color:g.color}}>{wh.length>1?`${wh.at(-1).weight-wh[0].weight>=0?"+":""}${(wh.at(-1).weight-wh[0].weight).toFixed(1)}`:0}kg</b></span>
                </div>
              </>
            ):<div style={{color:C.muted,textAlign:"center",padding:14,fontSize:13}}>No weight logged yet</div>}
          </Card>
          <Card style={{marginBottom:10}}>
            <div style={{fontFamily:"Bebas Neue",fontSize:12,color:g.color,letterSpacing:1,marginBottom:8}}>LOG THIS WEEK'S WEIGHT</div>
            <div style={{display:"flex",gap:8}}>
              <input value={newW} onChange={e=>setNewW(e.target.value)} type="number" placeholder="Weight (kg)" style={{flex:1,background:C.surf,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:"Nunito",outline:"none"}}/>
              <Btn ch="Save" onClick={()=>{if(newW){onUpdateMeasurements("weight",parseFloat(newW));setNewW("");}}} col={g.color}/>
            </div>
          </Card>
          {measurements.body?.length>0&&<Card style={{marginBottom:10}}>
            <div style={{fontFamily:"Bebas Neue",fontSize:12,color:g.color,letterSpacing:1,marginBottom:8}}>LATEST MEASUREMENTS</div>
            {Object.entries(measurements.body.at(-1)||{}).filter(([k])=>k!=="date").map(([k,v])=>(<div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.muted,fontSize:12,textTransform:"capitalize"}}>{k}</span><span style={{color:C.text,fontWeight:700,fontSize:12}}>{v} cm</span></div>))}
          </Card>}
          <Btn ch={showM?"Cancel":"📏 Log New Measurements"} onClick={()=>setShowM(!showM)} full ghost col={g.color}/>
          {showM&&<Card style={{marginTop:10}} className="su">
            <div style={{fontFamily:"Bebas Neue",fontSize:12,color:g.color,letterSpacing:1,marginBottom:8}}>BODY MEASUREMENTS (cm)</div>
            {Object.keys(newM).map(k=><Input key={k} label={k.charAt(0).toUpperCase()+k.slice(1)} value={newM[k]} onChange={v=>setNewM(p=>({...p,[k]:v}))} type="number" unit="cm" sm/>)}
            <Btn ch="Save Measurements" onClick={()=>{onUpdateMeasurements("body",{...newM,date:todayStr()});setShowM(false);setNewM({chest:"",waist:"",hips:"",bicep:"",thigh:"",neck:""});}} full col={g.color}/>
          </Card>}
        </div>
      )}

      {tab==="muscles"&&(
        <div className="su">
          <div style={{fontFamily:"Bebas Neue",fontSize:13,color:C.mus,letterSpacing:1,marginBottom:12}}>💪 MUSCLE GROUP TRAINING FREQUENCY</div>
          {freqEntries.length===0?(
            <Card><div style={{textAlign:"center",padding:20,color:C.muted,fontSize:13}}>No workouts logged yet. Start training to see your muscle map!</div></Card>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,alignItems:"start"}}>
              <div>
                <MuscleSVG freq={freq}/>
                <div style={{textAlign:"center",fontSize:10,color:C.muted,marginTop:4}}>Darker = more trained</div>
              </div>
              <div>
                {freqEntries.map(([muscle,count])=>(
                  <div key={muscle} style={{marginBottom:9}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:700,color:C.text}}>{muscle}</span>
                      <span style={{fontSize:11,color:C.mus,fontWeight:700}}>{count}×</span>
                    </div>
                    <Bar val={count} max={maxFreq} col={C.mus} h={6}/>
                  </div>
                ))}
                {freqEntries.length>0&&(
                  <div style={{marginTop:10,padding:10,background:C.mus+"11",borderRadius:8,fontSize:11,color:C.muted}}>
                    Most trained: <b style={{color:C.mus}}>{freqEntries[0]?.[0]}</b><br/>
                    Least trained: <b style={{color:C.warn}}>{freqEntries.at(-1)?.[0]}</b> — Focus here!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab==="photos"&&(
        <div className="su">
          <div style={{fontFamily:"Bebas Neue",fontSize:13,color:g.color,letterSpacing:1,marginBottom:8}}>📸 BEFORE & AFTER</div>
          <p style={{color:C.muted,fontSize:12,marginBottom:16,lineHeight:1.6}}>Upload your before photo now. After completing the program, add your after photo to see your incredible transformation. This is for YOUR eyes only — it stays private.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {["before","after"].map(type=>(
              <div key={type}>
                <div style={{fontFamily:"Bebas Neue",fontSize:12,color:C.muted,letterSpacing:1,marginBottom:8,textAlign:"center"}}>{type==="before"?"📅 BEFORE":"🏆 AFTER"}</div>
                <div style={{borderRadius:12,overflow:"hidden",border:`2px solid ${photos[type]?g.color:C.border}`,aspectRatio:"3/4",background:C.surf,position:"relative",cursor:"pointer"}} onClick={()=>(type==="before"?beforeRef:afterRef).current?.click()}>
                  {photos[type]
                    ?<img src={photos[type]} alt={type} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    :<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:8,padding:12}}>
                      <div style={{fontSize:28}}>📷</div>
                      <div style={{color:C.muted,fontSize:11,textAlign:"center",fontWeight:700}}>Tap to upload {type} photo</div>
                      {type==="before"&&<div style={{color:C.muted,fontSize:10,textAlign:"center"}}>Take this now. You'll thank yourself later.</div>}
                      {type==="after"&&<div style={{color:C.muted,fontSize:10,textAlign:"center"}}>Complete the program first. Earn it.</div>}
                    </div>
                  }
                  <input ref={type==="before"?beforeRef:afterRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handlePhoto(e.target.files?.[0],type)}/>
                </div>
                {photos[type]&&<div style={{marginTop:6}}><Btn ch="🔄 Replace" onClick={()=>(type==="before"?beforeRef:afterRef).current?.click()} full ghost col={g.color} sm/></div>}
              </div>
            ))}
          </div>
          {photos.before&&photos.after&&(
            <Card style={{marginTop:16,background:`linear-gradient(135deg,${g.color}11,${C.card})`,border:`1px solid ${g.color}44`,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:6}}>🏆</div>
              <div style={{fontFamily:"Bebas Neue",fontSize:20,color:g.color,letterSpacing:1}}>TRANSFORMATION COMPLETE!</div>
              <p style={{color:C.muted,fontSize:12,marginTop:6}}>Look at what you built. This is the result of every early morning, every skipped excuse, every rep. Legendary.</p>
            </Card>
          )}
        </div>
      )}

      {tab==="history"&&(
        <div className="su">
          <div style={{fontFamily:"Bebas Neue",fontSize:13,color:g.color,letterSpacing:1,marginBottom:10}}>📋 EXERCISE HISTORY</div>
          {exHistory.length===0?(
            <Card><div style={{textAlign:"center",padding:20,color:C.muted,fontSize:13}}>No workout history yet. Get off the bench and start logging! 💪</div></Card>
          ):(
            exHistory.map((w,i)=>(
              <Card key={i} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div>
                    <div style={{fontFamily:"Bebas Neue",fontSize:15,letterSpacing:1}}>{(w.type||"").toUpperCase()}</div>
                    <div style={{fontSize:11,color:C.muted}}>{w.date}</div>
                  </div>
                  <Badge ch={user.goal==="fat"?`Wk ${w.week||1}`:`Cy ${w.cycle||1}`} col={g.color}/>
                </div>
                {w.sets&&Object.entries(w.sets).map(([exName,exSets])=>{
                  const doneSets=Object.values(exSets).filter(s=>s.done&&s.weight&&s.reps);
                  if(!doneSets.length)return null;
                  const totalVol=doneSets.reduce((a,s)=>a+parseFloat(s.weight||0)*parseInt(s.reps||0),0);
                  return(
                    <div key={exName} style={{padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                      <div style={{fontWeight:700,fontSize:12,marginBottom:3}}>{exName}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {doneSets.map((s,si)=><Badge key={si} ch={`${s.weight}kg × ${s.reps}`} col={C.muted}/>)}
                        <Badge ch={`Vol: ${Math.round(totalVol)}kg`} col={g.color}/>
                      </div>
                    </div>
                  );
                })}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── CHAT VIEW ──────────────────────────────────────────────── */
// Module-level cache — survives re-renders so poll never wipes sent messages
let _chatCache = [];

function ChatView({currentUser,allUsers}){
  const[messages,setMessages]=useState(_chatCache);
  const[text,setText]=useState("");
  const pollRef=useRef();
  const bottomRef=useRef();
  const EMOJIS_QUICK=["💪","🔥","🏆","👊","⚡","😤","🎉","💀","🦁","❤️","🚀","👏"];

  async function loadMessages(){
    try{
      const msgs=await DB.getS("gym-chat")||[];
      // Only update if remote has MORE messages than our in-memory cache
      if(msgs.length>_chatCache.length){
        _chatCache=msgs;
        setMessages([..._chatCache]);
      }
    }catch(e){}
  }

  useEffect(()=>{
    loadMessages();
    pollRef.current=setInterval(loadMessages,6000);
    return()=>clearInterval(pollRef.current);
  },[]);

  useEffect(()=>{
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
  },[messages.length]);

  async function send(content){
    if(!content.trim())return;
    const msg={id:Date.now(),userId:currentUser.id,name:currentUser.name,emoji:currentUser.emoji,color:currentUser.color,text:content.trim(),ts:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),date:todayStr()};
    // Update module cache first — this is source of truth
    _chatCache=[..._chatCache.slice(-200),msg];
    setMessages([..._chatCache]);
    setText("");
    // Persist to shared storage (best effort — don't await, don't block)
    DB.setS("gym-chat",_chatCache).catch(()=>{});
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),80);
  }

  const motiv=["You're all killers. Keep pushing! 🔥","Pain is temporary. Glory is forever.","No great body was built inside the comfort zone."];
  const motivTip=motiv[new Date().getMinutes()%motiv.length];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 136px)",overflow:"hidden"}}>
      <div style={{background:`linear-gradient(135deg,${C.mus}22,${C.card})`,padding:"10px 16px",borderBottom:`1px solid ${C.border}`,textAlign:"center",flexShrink:0}}>
        <div style={{fontFamily:"Bebas Neue",fontSize:13,color:C.mus,letterSpacing:1}}>💬 SQUAD CHAT</div>
        <div style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>"{motivTip}"</div>
      </div>

      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {messages.length===0&&(
          <div style={{textAlign:"center",padding:40,color:C.muted}}>
            <div style={{fontSize:40,marginBottom:10}}>💬</div>
            <div style={{fontSize:14}}>No messages yet. Be the first to fire it up!</div>
          </div>
        )}
        {messages.map((msg,i)=>{
          const isMe=msg.userId===currentUser.id;
          return(
            <div key={msg.id||i} style={{display:"flex",flexDirection:isMe?"row-reverse":"row",alignItems:"flex-end",gap:8}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:`${msg.color}22`,border:`1px solid ${msg.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{msg.emoji}</div>
              <div style={{maxWidth:"72%"}}>
                {!isMe&&<div style={{fontSize:10,color:msg.color,fontWeight:700,marginBottom:3,paddingLeft:4}}>{msg.name}</div>}
                <div style={{background:isMe?`linear-gradient(135deg,${currentUser.color}33,${currentUser.color}22)`:C.surf,border:`1px solid ${isMe?currentUser.color+"44":C.border}`,borderRadius:isMe?"14px 14px 2px 14px":"14px 14px 14px 2px",padding:"9px 13px",fontSize:14,color:C.text,wordBreak:"break-word"}}>{msg.text}</div>
                <div style={{fontSize:9,color:C.muted,marginTop:2,textAlign:isMe?"right":"left",paddingLeft:4}}>{msg.ts}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      <div style={{flexShrink:0,borderTop:`1px solid ${C.border}`,background:C.surf}}>
        <div style={{display:"flex",gap:6,padding:"6px 12px",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          {EMOJIS_QUICK.map(e=><button key={e} onClick={()=>send(e)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,padding:"4px",borderRadius:6,flexShrink:0,transition:"transform .15s"}} onMouseOver={x=>x.currentTarget.style.transform="scale(1.3)"} onMouseOut={x=>x.currentTarget.style.transform="scale(1)"}>{e}</button>)}
        </div>
        <div style={{display:"flex",gap:8,padding:"8px 12px 14px"}}>
          <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(text);}}} placeholder="Talk trash, share wins, hype your crew..." style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:16,fontFamily:"Nunito",outline:"none",WebkitAppearance:"none"}}/>
          <Btn ch="Send" onClick={()=>send(text)} col={currentUser.color} disabled={!text.trim()}/>
        </div>
      </div>
    </div>
  );
}



/* ─── LEADERBOARD + BADGES ───────────────────────────────────── */
function SocialView({user,users,allWH,allWD,allLogs,workoutHistory}){
  const[tab,setTab]=useState("leaderboard");
  const g=G(user);

  const stats=users.map(u=>{
    const wh=allWH[u.id]||[],wd=allWD[u.id]||{},lg=allLogs[u.id]||[];
    const ug=GOALS[u.goal||"muscle"];
    const now=new Date(),weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay()+1);weekStart.setHours(0,0,0,0);
    const weekSessions=wh.filter(w=>w.completed&&new Date(w.date)>=weekStart).length;
    const todayWater=wd[todayStr()]||0;
    const weekPRs=lg.filter(e=>e.tag?.includes("PR")&&new Date(e.date)>=weekStart).length;
    const cycle=u.goal==="fat"?getFCycle(u,wh):getMCycle(u,wh);
    const total=u.totalWorkouts||0,streak=u.streak||0,isFat=u.goal==="fat";
    const badges=[total>=1,total>=10,total>=25,total>=50,total>=100,streak>=7,streak>=14,streak>=30,isFat?cycle>3:cycle>5,isFat?cycle>6:cycle>12,isFat?cycle>=12:cycle>=25].filter(Boolean).length;
    const totalKg=getTotalKg(wh);
    return{u,ug,weekSessions,todayWater,weekPRs,badges,total,streak,totalKg};
  });

  const sections=[
    {title:"🏆 Most Sessions",key:"total",col:C.warn,fmt:v=>`${v} sessions`},
    {title:"🔥 Longest Streak",key:"streak",col:C.mus,fmt:v=>`${v} days`},
    {title:"💪 This Week",key:"weekSessions",col:C.blue,fmt:v=>`${v} sessions`},
    {title:"💧 Water Today",key:"todayWater",col:C.blue,fmt:v=>`${v}/8 glasses`},
    {title:"🏅 Badges Earned",key:"badges",col:C.accent,fmt:v=>`${v} badges`},
    {title:"🏋️ Total KG Lifted",key:"totalKg",col:C.mus,fmt:v=>`${v>=1000?(v/1000).toFixed(1)+"T":v+"kg"}`},
    {title:"🆕 PRs This Week",key:"weekPRs",col:C.fat,fmt:v=>`${v} PR${v!==1?"s":""}`},
  ];

  // Achievements for current user
  const total=user.totalWorkouts||0,streak=user.streak||0;
  const cycle=user.goal==="fat"?getFCycle(user,workoutHistory):getMCycle(user,workoutHistory);
  const isFat=user.goal==="fat";
  const badges=[
    {title:"First Rep",desc:"Complete your first session",icon:"🩸",unlocked:total>=1},
    {title:"Getting Serious",desc:"10 sessions completed",icon:"⚔️",unlocked:total>=10},
    {title:"Committed",desc:"25 sessions done",icon:"🏛️",unlocked:total>=25},
    {title:"Beast Mode",desc:"50 sessions completed",icon:"🦁",unlocked:total>=50},
    {title:"Legend",desc:"100 sessions logged",icon:"👑",unlocked:total>=100},
    {title:"On Fire",desc:"7-day streak",icon:"🔥",unlocked:streak>=7},
    {title:"Unstoppable",desc:"14-day streak",icon:"🌋",unlocked:streak>=14},
    {title:"Iron Will",desc:"30-day streak",icon:"⚡",unlocked:streak>=30},
    ...(isFat?[{title:"Block 1",desc:"3 weeks done",icon:"🎯",unlocked:cycle>3},{title:"Halfway Shredded",desc:"6 weeks in!",icon:"🎖️",unlocked:cycle>6},{title:"SHREDDED",desc:"Full 12-week program!",icon:"🏆",unlocked:cycle>=12}]:[{title:"Phase 1",desc:"5 cycles done",icon:"🎯",unlocked:cycle>5},{title:"Halfway Beast",desc:"12 cycles done",icon:"🎖️",unlocked:cycle>12},{title:"ALPHA",desc:"Full 26-week program!",icon:"🏆",unlocked:cycle>=25}]),
    {title:"Swap Master",desc:"Used exercise swap",icon:"🔄",unlocked:false},
    {title:"Hydrated",desc:"8 glasses in a day",icon:"💧",unlocked:false},
    {title:"Chat Warrior",desc:"Sent a message to the squad",icon:"💬",unlocked:false},
  ];
  const unlocked=badges.filter(b=>b.unlocked).length;

  return(
    <div style={{padding:20,maxWidth:600,margin:"0 auto"}}>
      <h2 style={{fontFamily:"Bebas Neue",fontSize:32,letterSpacing:2,marginBottom:14}}>SOCIAL</h2>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["leaderboard","🏆 Board"],["badges","🎖️ Badges"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"9px 4px",borderRadius:8,border:"none",cursor:"pointer",background:tab===t?g.color:C.surf,color:tab===t?(g.color===C.fat?"#000":"#fff"):C.muted,fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,fontFamily:"Nunito",transition:"all .2s"}}>{l}</button>
        ))}
      </div>

      {tab==="leaderboard"&&sections.map(({title,key,col,fmt})=>{
        const sorted=[...stats].sort((a,b)=>b[key]-a[key]);
        return(
          <Card key={key} style={{marginBottom:12}}>
            <div style={{fontFamily:"Bebas Neue",fontSize:13,color:col,letterSpacing:1,marginBottom:10}}>{title}</div>
            {sorted.map((s,i)=>(
              <div key={s.u.id} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:i<sorted.length-1?`1px solid ${C.border}`:""}}>
                <div style={{fontFamily:"Bebas Neue",fontSize:18,color:i===0?C.warn:i===1?"#bbb":i===2?"#cd7f32":C.muted,width:24}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</div>
                <Avatar user={s.u} size={28}/>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{s.u.name}</div><div style={{fontSize:10,color:C.muted}}>{s.ug.icon} {s.ug.label}</div></div>
                <div style={{fontFamily:"Bebas Neue",fontSize:15,color:col}}>{fmt(s[key])}</div>
              </div>
            ))}
          </Card>
        );
      })}

      {tab==="badges"&&(
        <div>
          <p style={{color:C.muted,fontSize:12,marginBottom:12}}>{unlocked}/{badges.length} unlocked · Keep grinding for more! 💀</p>
          <Bar val={unlocked} max={badges.length} col={g.color}/>
          <div style={{height:16}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            {badges.map((b,i)=>(
              <Card key={i} style={{opacity:b.unlocked?1:.35,border:`1px solid ${b.unlocked?g.color+"44":C.border}`,background:b.unlocked?`linear-gradient(135deg,${g.color}0e,${C.card})`:C.card,padding:14}}>
                <div style={{fontSize:26,marginBottom:5}}>{b.icon}</div>
                <div style={{fontWeight:800,fontSize:12,color:b.unlocked?g.color:C.muted}}>{b.title}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:2,lineHeight:1.4}}>{b.desc}</div>
                {b.unlocked&&<div style={{marginTop:6}}><Badge ch="✓ UNLOCKED" col={g.color}/></div>}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── HOME VIEW ──────────────────────────────────────────────── */
function HomeView({user,workoutHistory,waterToday,onSwitchGoal}){
  const g=G(user),isFat=user.goal==="fat";
  const quotes=isFat?FQ:MQ,quote=quotes[new Date().getDate()%quotes.length];
  const sched=getUserSchedule(user),isTraining=sched.includes(todayDOW());
  const wType=getTodayWorkout(user,workoutHistory);
  const tomorrow=getTomorrowWorkout(user,workoutHistory);
  const infoMap=isFat?FAT_INFO:MUS_INFO;
  const dayInfo=infoMap[wType]||{label:"REST",theme:"Recovery 😴"};
  const tomorrowInfo=infoMap[tomorrow.type]||{label:"REST",theme:"Recovery"};
  const completed=workoutHistory.find(w=>w.date===todayStr()&&w.completed);
  const wKg=user.weightHistory?.at(-1)?.weight||80;
  const m=isFat?calcFatMacros(wKg,isTraining):calcMusMacros(wKg,isTraining);
  const cycle=isFat?getFCycle(user,workoutHistory):getMCycle(user,workoutHistory);
  const totalWeeks=isFat?12:25;
  const totalKg=getTotalKg(workoutHistory);

  // Motivational vs reprimand
  const lastDate=user.lastWorkoutDate;
  const daysSince=lastDate?Math.floor((Date.now()-new Date(lastDate))/(864e5)):999;
  const isSlacking=daysSince>=2&&!completed;
  const reprimand=isSlacking?REPRIMANDS[Math.min(daysSince-2,REPRIMANDS.length-1)].replace("%d",daysSince):null;

  return(
    <div style={{padding:20,maxWidth:600,margin:"0 auto"}}>
      {/* Motivational banner or reprimand */}
      {reprimand?(
        <div style={{background:C.danger+"11",border:`1px solid ${C.danger}44`,borderRadius:12,padding:"12px 16px",marginBottom:16}} className="pulse">
          <div style={{fontFamily:"Bebas Neue",fontSize:15,color:C.danger,marginBottom:3}}>⚠️ WAKE UP CALL</div>
          <p style={{fontSize:13,color:C.text,lineHeight:1.5}}>{reprimand}</p>
        </div>
      ):(
        <div style={{background:`linear-gradient(135deg,${g.color}11,${C.card})`,border:`1px solid ${g.color}33`,borderRadius:12,padding:"10px 14px",marginBottom:14}}>
          <p style={{fontSize:12,color:C.muted,fontStyle:"italic"}}>"{quote}"</p>
        </div>
      )}

      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:C.muted,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:3}}>{DAY_FULL[todayDOW()]}</div>
        <h1 style={{fontFamily:"Bebas Neue",fontSize:"clamp(26px,7vw,42px)",letterSpacing:2,lineHeight:1.1,background:`linear-gradient(135deg,${C.text},${g.color})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>WELCOME BACK,<br/>{user.name.toUpperCase()}</h1>
      </div>

      {/* Today */}
      <Card style={{marginBottom:11,border:`1px solid ${g.color}44`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:11,color:g.color,fontWeight:700,letterSpacing:2,marginBottom:3}}>TODAY'S SESSION</div>
            <div style={{fontFamily:"Bebas Neue",fontSize:24,letterSpacing:2}}>{dayInfo.label}</div>
            <div style={{fontSize:13,color:C.muted}}>{dayInfo.theme}</div>
          </div>
          <div style={{fontSize:34}}>{wType==="rest"?"😴":wType==="active"?"🚶":"⚡"}</div>
        </div>
        {completed?<div style={{marginTop:7}}><Badge ch="✅ BEAST! Session complete! 🏆" col={C.fat}/></div>
          :isTraining?<div style={{marginTop:7,fontSize:12,color:C.muted}}>💡 Equipment busy? Hit Train → Swap on any exercise. No excuses.</div>
          :<div style={{marginTop:7,fontSize:12,color:C.muted}}>Rest day. Use it wisely. Recover hard.</div>}
      </Card>

      {/* Tomorrow preview */}
      <Card style={{marginBottom:11,background:C.surf}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:C.blue,fontWeight:700,letterSpacing:2,marginBottom:3}}>🔮 TOMORROW — MENTALLY PREPARE NOW</div>
            <div style={{fontFamily:"Bebas Neue",fontSize:18,letterSpacing:2,color:C.text}}>{tomorrowInfo.label}</div>
            <div style={{fontSize:12,color:C.muted}}>{tomorrowInfo.theme} {tomorrow.daysAway>1?`· In ${tomorrow.daysAway} days`:""}</div>
          </div>
          <div style={{fontFamily:"Bebas Neue",fontSize:13,color:C.blue,textAlign:"right"}}>
            {tomorrow.type==="rest"?"😴 Rest":"Get ready 💪"}
          </div>
        </div>
        {tomorrow.type!=="rest"&&<div style={{marginTop:8,fontSize:11,color:C.muted,background:C.card,borderRadius:8,padding:"6px 10px"}}>💡 Visualise every rep tonight. Champions are made in the mind first.</div>}
      </Card>

      {/* Goal progress */}
      <Card gc={g.color} style={{marginBottom:11,background:`linear-gradient(135deg,${g.color}12,${C.card})`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:g.color,fontWeight:700,letterSpacing:2,marginBottom:3}}>{g.icon} {g.label}</div>
            <div style={{fontSize:12,color:C.muted}}>{g.desc} · Week {cycle}/{totalWeeks}</div>
          </div>
          <button onClick={onSwitchGoal} style={{background:"transparent",border:`1px solid ${g.color}55`,borderRadius:8,padding:"5px 10px",color:g.color,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Nunito"}}>SWITCH</button>
        </div>
        <div style={{marginTop:9}}><Bar val={cycle} max={totalWeeks} col={g.color}/></div>
      </Card>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:11}}>
        <Card style={{textAlign:"center",padding:10}}><Stat label="🔥 Streak" value={user.streak||0} sub="days" col={C.warn}/></Card>
        <Card style={{textAlign:"center",padding:10}}><Stat label="💪 Sessions" value={user.totalWorkouts||0} col={g.color}/></Card>
        <Card style={{textAlign:"center",padding:10}}><Stat label="💧 Water" value={`${waterToday}/8`} col={C.blue}/></Card>
      </div>

      {/* Total KG bar */}
      {totalKg>0&&(
        <Card style={{marginBottom:11,background:`linear-gradient(135deg,${C.mus}09,${C.card})`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontFamily:"Bebas Neue",fontSize:13,color:C.mus,letterSpacing:1}}>🏋️ TOTAL IRON MOVED</div>
            <div style={{fontFamily:"Bebas Neue",fontSize:22,color:C.mus}}>{totalKg>=1000?`${(totalKg/1000).toFixed(1)}T`:`${totalKg}kg`}</div>
          </div>
          <div style={{fontSize:11,color:C.muted}}>
            {totalKg<1000?`Only ${1000-totalKg}kg until your first tonne! 💀`
              :totalKg<5000?`${(totalKg/1000).toFixed(1)} tonnes of pure iron. Absolute beast.`
              :`${(totalKg/1000).toFixed(1)} tonnes. You're built different. 🏆`}
          </div>
          <div style={{marginTop:8}}><Bar val={Math.min(totalKg,10000)} max={10000} col={C.mus} h={6}/></div>
        </Card>
      )}

      {/* Macros */}
      <Card>
        <div style={{fontFamily:"Bebas Neue",fontSize:12,color:g.color,letterSpacing:1,marginBottom:9}}>🍽 {isFat?"CUT":"BULK"} MACROS · {isTraining?"TRAINING":"REST"} · {m.cal} KCAL</div>
        <Bar val={m.protein} max={m.protein} col={C.blue} label="Protein" sub={`${m.protein}g`}/>
        <div style={{height:5}}/>
        <Bar val={m.carbs} max={m.carbs} col={C.accent} label="Carbs" sub={`${m.carbs}g`}/>
        <div style={{height:5}}/>
        <Bar val={m.fat} max={m.fat} col={C.warn} label="Fat" sub={`${m.fat}g`}/>
        {isFat&&<div style={{marginTop:8,fontSize:11,color:C.fat}}>⚠️ Stay in your deficit. Track every meal. The scale doesn't lie.</div>}
      </Card>
    </div>
  );
}

/* ─── LOGBOOK VIEW ───────────────────────────────────────────── */
function LogbookView({logs, onAdd, userColor}){
  const[text,setText]=useState("");
  const[tag,setTag]=useState("general");
  const col=userColor||C.mus;
  const tags=["general","🏆 PR / PB","💪 workout","😴 recovery","🥗 nutrition","🧠 mindset","⚖️ weigh-in"];
  return(
    <div style={{padding:20,maxWidth:600,margin:"0 auto"}}>
      <h2 style={{fontFamily:"Bebas Neue",fontSize:34,letterSpacing:2,marginBottom:4}}>LOGBOOK</h2>
      <p style={{color:C.muted,fontSize:12,marginBottom:14}}>"Every champion was once a contender who refused to give up." Log your journey.</p>
      <Card style={{marginBottom:14}}>
        <div style={{fontFamily:"Bebas Neue",fontSize:12,color:col,letterSpacing:1,marginBottom:10}}>✍️ NEW ENTRY</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
          {tags.map(t=><div key={t} onClick={()=>setTag(t)} style={{padding:"3px 9px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,background:tag===t?col+"22":C.surf,border:`1px solid ${tag===t?col:C.border}`,color:tag===t?col:C.muted,transition:"all .15s"}}>{t}</div>)}
        </div>
        <Textarea value={text} onChange={setText} placeholder="Log your PRs, swaps, feelings, wins... Champions track everything."/>
        <Btn ch="Add Entry" onClick={()=>{if(text.trim()){onAdd({date:todayStr(),time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),text:text.trim(),tag});setText("");}}} full col={col} disabled={!text.trim()}/>
      </Card>
      {[...logs].reverse().map((e,i)=>(
        <Card key={i} style={{marginBottom:9}} className="su">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
            <Badge ch={e.tag} col={col}/>
            <div style={{fontSize:10,color:C.muted,textAlign:"right"}}>{e.date}<br/>{e.time}</div>
          </div>
          <p style={{fontSize:13,color:C.text,lineHeight:1.6}}>{e.text}</p>
        </Card>
      ))}
      {logs.length===0&&<div style={{textAlign:"center",padding:46}}><div style={{fontSize:40,marginBottom:10}}>📔</div><div style={{color:C.muted,fontSize:14}}>Your logbook is empty.<br/>Champions track everything. Start now.</div></div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN APP
════════════════════════════════════════════════════════════════ */
export default function App(){
  const[users,setUsers]=useState([]);
  const[currentUser,setCurrentUser]=useState(null);
  const[view,setView]=useState("profiles");
  const[pendingUser,setPendingUser]=useState(null);
  const[pinTarget,setPinTarget]=useState(null);
  const[tab,setTab]=useState("home");
  const[workoutHistory,setWH]=useState([]);
  const[waterData,setWater]=useState({});
  const[logs,setLogs]=useState([]);
  const[measurements,setMeas]=useState({body:[]});
  const[mealLogs,setMealLogs]=useState({});
  const[photos,setPhotos]=useState({before:null,after:null});
  const[loading,setLoading]=useState(true);
  const[allWH,setAllWH]=useState({});
  const[allWD,setAllWD]=useState({});
  const[allLogs,setAllLogs]=useState({});

  useEffect(()=>{DB.get("gym-users").then(u=>{if(u)setUsers(u);setLoading(false);});},[]);

  async function saveUsers(u){setUsers(u);await DB.set("gym-users",u);}

  async function loadAllData(allU){
    const whs={},wds={},lgs={};
    await Promise.all(allU.map(async u=>{whs[u.id]=await DB.get(`gym-wh-${u.id}`)||[];wds[u.id]=await DB.get(`gym-wd-${u.id}`)||{};lgs[u.id]=await DB.get(`gym-lg-${u.id}`)||[];}));
    setAllWH(whs);setAllWD(wds);setAllLogs(lgs);
  }

  async function selectUser(user){
    setCurrentUser(user);
    const[wh,wd,lg,ms,ml,ph]=await Promise.all([
      DB.get(`gym-wh-${user.id}`),DB.get(`gym-wd-${user.id}`),DB.get(`gym-lg-${user.id}`),
      DB.get(`gym-ms-${user.id}`),DB.get(`gym-ml-${user.id}`),DB.get(`gym-ph-${user.id}`),
    ]);
    setWH(wh||[]);setWater(wd||{});setLogs(lg||[]);setMeas(ms||{body:[]});setMealLogs(ml||{});setPhotos(ph||{before:null,after:null});
    setTab("home");setView("dashboard");
    const allU=users.length?users:[user];
    loadAllData(allU);
  }

  function handleNeedGoal(userData){
    if(view==="edit"){handleGoalSelect(userData.goal||"muscle",userData);return;}
    setPendingUser(userData);setView("goal");
  }

  async function handleGoalSelect(goal,base){
    const userData={...(base||pendingUser),goal};
    const exists=users.find(u=>u.id===userData.id);
    const updated=exists?users.map(u=>u.id===userData.id?userData:u):[...users,userData];
    await saveUsers(updated);
    if(currentUser?.id===userData.id)setCurrentUser(userData);
    setPendingUser(null);
    await selectUser(userData);
  }

  async function handleDeleteProfile(id){
    const updated=users.filter(u=>u.id!==id);
    await saveUsers(updated);
    setCurrentUser(null);setView("profiles");
  }

  async function handleWorkoutComplete(session){
    const td=todayStr(),already=workoutHistory.find(w=>w.date===td&&w.completed);
    const newH=[...workoutHistory.filter(w=>w.date!==td),session];
    setWH(newH);await DB.set(`gym-wh-${currentUser.id}`,newH);
    const newStreak=(currentUser.lastWorkoutDate===yesterdayStr()||currentUser.lastWorkoutDate===td)?(currentUser.lastWorkoutDate===td?(currentUser.streak||1):(currentUser.streak||0)+1):1;
    const updated={...currentUser,totalWorkouts:(currentUser.totalWorkouts||0)+(already?0:1),streak:newStreak,lastWorkoutDate:td};
    setCurrentUser(updated);await saveUsers(users.map(u=>u.id===updated.id?updated:u));
    setAllWH(p=>({...p,[currentUser.id]:newH}));
  }

  async function handleWater(ds,count){const u={...waterData,[ds]:count};setWater(u);await DB.set(`gym-wd-${currentUser.id}`,u);setAllWD(p=>({...p,[currentUser.id]:u}));}
  async function handleAddLog(entry){const u=[...logs,entry];setLogs(u);await DB.set(`gym-lg-${currentUser.id}`,u);setAllLogs(p=>({...p,[currentUser.id]:u}));}
  async function handleMealLog(date,data){const u={...mealLogs,[date]:data};setMealLogs(u);await DB.set(`gym-ml-${currentUser.id}`,u);}
  async function handleSavePhoto(type,data64){const u={...photos,[type]:data64};setPhotos(u);await DB.set(`gym-ph-${currentUser.id}`,u);}

  async function handleUpdateMeasurements(type,data){
    if(type==="weight"){
      const newH=[...(currentUser.weightHistory||[]),{date:todayStr(),weight:data}];
      const updated={...currentUser,weightHistory:newH};
      setCurrentUser(updated);await saveUsers(users.map(u=>u.id===updated.id?updated:u));
    }else{
      const u={...measurements,body:[...(measurements.body||[]),data]};
      setMeas(u);await DB.set(`gym-ms-${currentUser.id}`,u);
    }
  }

  function switchGoal(){setPendingUser(currentUser);setView("goal");}

  function handleProfileClick(user){
    if(user.pin)setPinTarget(user);
    else selectUser(user);
  }

  const g=currentUser?G(currentUser):GOALS.muscle;

  const TABS=[
    {id:"home",   i:"🏠",l:"Home"},
    {id:"workout",i:"⚡",l:"Train"},
    {id:"fuel",   i:"🥗",l:"Fuel"},
    {id:"stats",  i:"📊",l:"Stats"},
    {id:"water",  i:"💧",l:"Water"},
    {id:"chat",   i:"💬",l:"Chat"},
    {id:"social", i:"🏆",l:"Social"},
    {id:"log",    i:"📔",l:"Log"},
  ];

  if(loading)return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg}}><div style={{textAlign:"center"}}><div style={{fontSize:44,display:"inline-block"}} className="spin">⚡</div><div style={{fontFamily:"Bebas Neue",fontSize:20,letterSpacing:2,marginTop:12,color:C.mus}}>LOADING...</div></div></div>);
  if(pinTarget)return(<PinEntry user={pinTarget} onSuccess={()=>{selectUser(pinTarget);setPinTarget(null);}} onCancel={()=>setPinTarget(null)}/>);
  if(view==="profiles")return(<ProfileSelector users={users} onSelect={handleProfileClick} onAdd={()=>setView("create")}/>);
  if(view==="create"||view==="edit")return(<CreateProfile onBack={()=>setView(currentUser?"dashboard":"profiles")} existing={view==="edit"?currentUser:null} onNeedGoal={handleNeedGoal} onDelete={handleDeleteProfile}/>);
  if(view==="goal")return(<GoalSelector onSelect={goal=>handleGoalSelect(goal,pendingUser)}/>);

  const isFat=currentUser.goal==="fat";

  return(
    <div style={{minHeight:"100vh",background:C.bg,paddingBottom:72}}>
      {/* Header */}
      <div style={{background:C.surf,borderBottom:`1px solid ${C.border}`,padding:"9px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,borderTop:`3px solid ${g.color}`}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <Avatar user={currentUser} size={32}/>
          <div>
            <div style={{fontFamily:"Bebas Neue",fontSize:14,letterSpacing:1}}>{currentUser.name}</div>
            <div style={{fontSize:9,color:C.muted,display:"flex",gap:5,alignItems:"center"}}>
              <Badge ch={`${g.icon} ${isFat?"FAT BURN":"MUSCLE"}`} col={g.color}/>
              <span>🔥{currentUser.streak||0}d</span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:5}}>
          <Btn ch="Edit" onClick={()=>{setPendingUser(currentUser);setView("edit");}} ghost sm col={g.color}/>
          <Btn ch="↩" onClick={()=>{setCurrentUser(null);setView("profiles");}} ghost sm col={g.color}/>
        </div>
      </div>

      {/* Content */}
      <div key={tab} className="su">
        {tab==="home"    &&<HomeView user={currentUser} workoutHistory={workoutHistory} waterToday={waterData[todayStr()]||0} onSwitchGoal={switchGoal}/>}
        {tab==="workout" &&(isFat?<FatWorkout user={currentUser} workoutHistory={workoutHistory} onComplete={handleWorkoutComplete}/>:<MuscleWorkout user={currentUser} workoutHistory={workoutHistory} onComplete={handleWorkoutComplete}/>)}
        {tab==="fuel"    &&<NutritionView user={currentUser} mealLogs={mealLogs} onLogMeal={handleMealLog}/>}
        {tab==="stats"   &&<StatsView user={currentUser} workoutHistory={workoutHistory} onUpdateMeasurements={handleUpdateMeasurements} measurements={measurements} photos={photos} onSavePhoto={handleSavePhoto}/>}
        {tab==="water"   &&<WaterView waterData={waterData} onUpdate={handleWater}/>}
        {tab==="chat"    &&<ChatView currentUser={currentUser} allUsers={users}/>}
        {tab==="social"  &&<SocialView user={currentUser} users={users} allWH={allWH} allWD={allWD} allLogs={allLogs} workoutHistory={workoutHistory}/>}
        {tab==="log" && <LogbookView logs={logs} onAdd={handleAddLog} userColor={g.color}/>}
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.surf,borderTop:`2px solid ${C.border}`,display:"flex",zIndex:100,padding:"3px 0"}}>
        {TABS.map(t=>{
          const active=tab===t.id;
          return(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:"none",border:"none",cursor:"pointer",padding:"5px 2px",display:"flex",flexDirection:"column",alignItems:"center",gap:1,transition:"all .2s",color:active?g.color:C.muted}}>
              <div style={{fontSize:15,transition:"transform .2s",transform:active?"scale(1.25)":"scale(1)"}}>{t.i}</div>
              <div style={{fontSize:8,fontWeight:700,fontFamily:"Nunito",textTransform:"uppercase",letterSpacing:.3}}>{t.l}</div>
              {active&&<div style={{width:12,height:2,borderRadius:1,background:g.color}}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
