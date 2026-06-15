import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, limit, getDocs, serverTimestamp, arrayUnion, arrayRemove } from "firebase/firestore";

const firebaseConfig = { apiKey:"AIzaSyBejVYv-lIcdnzo58GG7wDclfvr2hgKse0", authDomain:"sprak-f7649.firebaseapp.com", projectId:"sprak-f7649", storageBucket:"sprak-f7649.firebasestorage.app", messagingSenderId:"589172963892", appId:"1:589172963892:web:82373424a3d71d1190a861" };
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// ─── SOUND ENGINE ─────────────────────────────────────────────────────────────
const AudioCtx = typeof AudioContext !== "undefined" ? AudioContext : (typeof webkitAudioContext !== "undefined" ? webkitAudioContext : null);
let _ac = null;
function getAC() { if (!_ac && AudioCtx) _ac = new AudioCtx(); return _ac; }

function playTone(freq, type, duration, vol = 0.3, delay = 0) {
  try {
    const ac = getAC(); if (!ac) return;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime + delay);
    g.gain.setValueAtTime(0, ac.currentTime + delay);
    g.gain.linearRampToValueAtTime(vol, ac.currentTime + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
    o.start(ac.currentTime + delay); o.stop(ac.currentTime + delay + duration + 0.05);
  } catch(e) {}
}

const SFX = {
  correct: () => { playTone(523, "sine", 0.1); playTone(659, "sine", 0.1, 0.3, 0.08); playTone(784, "sine", 0.15, 0.3, 0.18); },
  wrong:   () => { playTone(220, "sawtooth", 0.08); playTone(180, "sawtooth", 0.12, 0.2, 0.1); },
  click:   () => { playTone(440, "sine", 0.05, 0.15); },
  levelup: () => { [523,659,784,1047].forEach((f,i) => playTone(f,"sine",0.2,0.35,i*0.1)); },
  streak:  () => { playTone(880,"sine",0.1); playTone(1100,"sine",0.1,0.25,0.12); },
  xp:      () => { playTone(660,"triangle",0.06,0.2); },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const AVATARS = [
  {id:"bear",emoji:"🐻",label:"Bear"},{id:"fox",emoji:"🦊",label:"Fox"},
  {id:"frog",emoji:"🐸",label:"Frog"},{id:"owl",emoji:"🦉",label:"Owl"},
  {id:"bee",emoji:"🐝",label:"Bee"},{id:"cat",emoji:"🐱",label:"Cat"},
];

const ACHIEVEMENTS = [
  {id:"first_lesson",name:"First Steps",description:"Complete your first lesson",icon:"📖"},
  {id:"first_puzzle",name:"Puzzle Solver",description:"Complete your first daily puzzle",icon:"🧩"},
  {id:"streak_3",name:"On Fire!",description:"3 day streak",icon:"🔥"},
  {id:"streak_7",name:"Week Warrior",description:"7 day streak",icon:"⚡"},
  {id:"level_5",name:"Rising Star",description:"Reach level 5",icon:"⭐"},
  {id:"level_10",name:"Sprak Pro",description:"Reach level 10",icon:"🌟"},
  {id:"questions_100",name:"Century",description:"Answer 100 questions",icon:"💯"},
  {id:"perfect_lesson",name:"Perfectionist",description:"Complete a lesson with 100% accuracy",icon:"🎯"},
];

const CURRENCY = { name: "Marks", icon: "ℳ", full: "Sprak Marks" };

const LEAGUES = [
  { id: "bronze", name: "Bronze", icon: "🥉", minXp: 0 },
  { id: "silver", name: "Silver", icon: "🥈", minXp: 750 },
  { id: "gold", name: "Gold", icon: "🥇", minXp: 1750 },
  { id: "emerald", name: "Emerald", icon: "💚", minXp: 3500 },
  { id: "diamond", name: "Diamond", icon: "💎", minXp: 6000 },
  { id: "meister", name: "Meister", icon: "👑", minXp: 10000 },
];

const MOCK_PLAYERS = [
  { username:"WortWolf", displayName:"Mika", avatar:"fox", xp:8420, weeklyXp:1840, streak:32, title:"Der Destroyer", border:"Crystal Frame" },
  { username:"GrammarGoblin", displayName:"Jules", avatar:"frog", xp:7340, weeklyXp:1675, streak:18, title:"Grammar Goblin", border:"Forest Frame" },
  { username:"BrezelBee", displayName:"Tara", avatar:"bee", xp:6110, weeklyXp:1420, streak:9, title:"Café Champion", border:"Golden Frame" },
  { username:"OwlOtto", displayName:"Sam", avatar:"owl", xp:5230, weeklyXp:1290, streak:14, title:"Wortwald Walker", border:"Bookish Frame" },
  { username:"HalloBear", displayName:"Ren", avatar:"bear", xp:4110, weeklyXp:980, streak:6, title:"Rising Star", border:"Wooden Frame" },
];

const SHOP_ITEMS = [
  { id:"title_grammar_goblin", type:"title", name:"Grammar Goblin", icon:"👺", rarity:"Rare", price:350 },
  { id:"title_der_destroyer", type:"title", name:"Der Destroyer", icon:"🛡️", rarity:"Epic", price:700 },
  { id:"title_brezel_boss", type:"title", name:"Brezel Boss", icon:"🥨", rarity:"Rare", price:420 },
  { id:"border_forest", type:"border", name:"Forest Frame", icon:"🌲", rarity:"Common", price:250 },
  { id:"border_gold", type:"border", name:"Golden Frame", icon:"✨", rarity:"Epic", price:900 },
  { id:"border_crystal", type:"border", name:"Crystal Frame", icon:"💎", rarity:"Legendary", price:1500 },
  { id:"banner_berlin", type:"banner", name:"Berlin Night Banner", icon:"🌃", rarity:"Rare", price:600 },
  { id:"banner_wortwald", type:"banner", name:"Wortwald Banner", icon:"🌳", rarity:"Common", price:300 },
  { id:"decor_pretzel", type:"decoration", name:"Pretzel Pin", icon:"🥨", rarity:"Common", price:120 },
  { id:"decor_crown", type:"decoration", name:"Tiny Crown", icon:"👑", rarity:"Legendary", price:1800 },
  { id:"avatar_dragon", type:"avatar", name:"Dragon Avatar", icon:"🐉", rarity:"Legendary", price:2200 },
  { id:"avatar_penguin", type:"avatar", name:"Penguin Avatar", icon:"🐧", rarity:"Epic", price:1100 },
];

function getWeeklyLeague(xp) {
  let current = LEAGUES[0];
  for (const l of LEAGUES) if ((xp||0) >= l.minXp) current = l;
  return current;
}

function getShopRotation() {
  const seed = getDailyKey(); let hash = 0;
  for (const c of seed) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  const pool = [...SHOP_ITEMS]; const result = []; let h = Math.abs(hash);
  while (result.length < 6 && pool.length) { const i = h % pool.length; result.push(pool.splice(i,1)[0]); h = Math.abs(Math.floor(h * 1.6180339)); }
  return result;
}


// ─── CURRICULUM ───────────────────────────────────────────────────────────────
// Curriculum design notes: units are intentionally short in-session but long on the roadmap.
// This mirrors modern language apps and classroom/tutor pacing: introduce → recognize → produce → review → checkup.
// Question types supported: mc, article, fill, tap_build.
function rotateOptions(options, seed) {
  const unique = [...new Set(options.filter(Boolean))];
  if (unique.length <= 1) return unique;
  let h = 0;
  for (const c of seed) h = ((h << 5) - h) + c.charCodeAt(0);
  const shift = Math.abs(h) % unique.length;
  return unique.slice(shift).concat(unique.slice(0, shift));
}
function entryToQuestion(entry, lessonId, idx) {
  const id = `${lessonId}-q${idx + 1}`;
  if (entry.kind === "v") return {
    id, type: "mc", german: entry.german, english: entry.english, category: "Vocabulary",
    prompt: `What does '${entry.german}' mean?`,
    options: rotateOptions([entry.english, ...(entry.wrong || [])], id), correct: entry.english,
    explanation: entry.explanation || `'${entry.german}' means '${entry.english}'.`
  };
  if (entry.kind === "c") return {
    id, type: "mc", category: "Concept Check", prompt: entry.prompt,
    options: rotateOptions(entry.options || [], id), correct: entry.correct, explanation: entry.explanation
  };
  if (entry.kind === "f") return {
    id, type: "fill", category: "Fill in the Blank", german: entry.german, english: entry.english,
    blank: entry.blank, options: rotateOptions(entry.options || [], id), explanation: entry.explanation
  };
  if (entry.kind === "a") return {
    id, type: "article", category: "Articles", german: entry.noun, english: entry.english,
    prompt: `Which article goes with '${entry.noun}' (${entry.english})?`,
    options: ["der", "die", "das"], correct: entry.article, explanation: entry.explanation
  };
  if (entry.kind === "b") return {
    id, type: "tap_build", category: "Sentence Builder", prompt: entry.prompt,
    words: rotateOptions([...(entry.correct || []), ...(entry.extra || [])], id), correct: entry.correct, explanation: entry.explanation
  };
  return entry;
}
function buildLesson(lesson) {
  return { ...lesson, questions: (lesson.entries || []).map((e, i) => entryToQuestion(e, lesson.id, i)) };
}
function cloneForLesson(q, id) {
  return { ...q, id, options: q.options ? [...q.options] : q.options, words: q.words ? [...q.words] : q.words, correct: Array.isArray(q.correct) ? [...q.correct] : q.correct };
}
function withReviewAndCheckup(unit) {
  const lessons = unit.lessons.map(buildLesson);
  const coreQuestions = lessons.flatMap(l => l.questions);
  const reviewQuestions = coreQuestions.slice(0, 10).map((q, i) => cloneForLesson(q, `${unit.id}-review-q${i + 1}`));
  const checkupQuestions = coreQuestions.slice(0, 15).map((q, i) => cloneForLesson(q, `${unit.id}-checkup-q${i + 1}`));
  const reviewLesson = {
    id: `${unit.id}-review`, title: "Guided Unit Review", xpReward: 80,
    intro: { title: `Review: ${unit.title}`, body: "This review mixes the unit's main ideas before the final checkup. It is designed like a tutor recap: quick recall, then production.", tip: "🔁 Mistakes here are useful. They show what to review before the checkup." },
    questions: reviewQuestions
  };
  const checkupLesson = {
    id: `${unit.id}-checkup`, title: "End-of-Unit Checkup", xpReward: 140,
    intro: { title: `Checkup: ${unit.title}`, body: "One bigger quiz for the whole unit. No new teaching here — just prove what stuck.", tip: "🏁 Treat this like a boss lesson. Read carefully, use the feedback, and go for a perfect streak." },
    questions: checkupQuestions
  };
  return { ...unit, lessons: [...lessons, reviewLesson, checkupLesson] };
}
const CURRICULUM_SPECS = [
  {
    "id": 1,
    "title": "Starter German",
    "icon": "👋",
    "color": "#52B788",
    "description": "Greetings, classroom basics, and the first survival phrases every beginner needs.",
    "lessons": [
      {
        "id": "1-1",
        "title": "Hello & Goodbye",
        "xpReward": 30,
        "intro": {
          "title": "First contact",
          "body": "Start with greetings you can actually use. This follows the tutor pattern of recognition first, then production.",
          "tip": "🗣️ Say each answer out loud. German sticks faster when you hear yourself using it."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Hallo",
            "english": "hello",
            "wrong": [
              "goodbye",
              "please",
              "thanks"
            ],
            "explanation": "Hallo is the everyday informal hello."
          },
          {
            "kind": "v",
            "german": "Guten Morgen",
            "english": "good morning",
            "wrong": [
              "good evening",
              "good night",
              "see you soon"
            ],
            "explanation": "Use Guten Morgen before noon."
          },
          {
            "kind": "v",
            "german": "Guten Tag",
            "english": "good day",
            "wrong": [
              "goodbye",
              "good night",
              "thank you"
            ],
            "explanation": "Guten Tag is a polite daytime greeting."
          },
          {
            "kind": "v",
            "german": "Tschüss",
            "english": "bye",
            "wrong": [
              "hello",
              "please",
              "morning"
            ],
            "explanation": "Tschüss is casual and very common."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Good evening'",
            "correct": [
              "Guten",
              "Abend"
            ],
            "extra": [
              "Morgen",
              "Tag"
            ],
            "explanation": "Guten Abend means good evening."
          }
        ]
      },
      {
        "id": "1-2",
        "title": "Polite Phrases",
        "xpReward": 30,
        "intro": {
          "title": "Please, thanks, sorry",
          "body": "German classrooms drill polite chunks early because they unlock real interactions quickly.",
          "tip": "💡 Bitte means please and also you're welcome."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Danke",
            "english": "thank you",
            "wrong": [
              "please",
              "sorry",
              "hello"
            ],
            "explanation": "Danke is the basic thank you."
          },
          {
            "kind": "v",
            "german": "Bitte",
            "english": "please / you're welcome",
            "wrong": [
              "goodbye",
              "excuse me",
              "yes"
            ],
            "explanation": "Bitte changes meaning based on context."
          },
          {
            "kind": "v",
            "german": "Entschuldigung",
            "english": "excuse me / sorry",
            "wrong": [
              "thank you",
              "good night",
              "no"
            ],
            "explanation": "Use Entschuldigung to apologize or get attention."
          },
          {
            "kind": "c",
            "prompt": "Someone says 'Danke!' What do you answer?",
            "options": [
              "Bitte!",
              "Hallo!",
              "Nein!",
              "Tschüss!"
            ],
            "correct": "Bitte!",
            "explanation": "Bitte is the natural response to Danke."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Thank you very much'",
            "correct": [
              "Danke",
              "schön"
            ],
            "extra": [
              "Bitte",
              "Hallo"
            ],
            "explanation": "Danke schön is a warmer thank you."
          }
        ]
      },
      {
        "id": "1-3",
        "title": "Classroom German",
        "xpReward": 35,
        "intro": {
          "title": "Useful lesson commands",
          "body": "Tutors often teach classroom words early so instructions stop feeling confusing.",
          "tip": "📚 These phrases also work in the app: repeat, listen, choose, write."
        },
        "entries": [
          {
            "kind": "v",
            "german": "wiederholen",
            "english": "repeat",
            "wrong": [
              "write",
              "choose",
              "listen"
            ],
            "explanation": "Wiederholen means to repeat."
          },
          {
            "kind": "v",
            "german": "hören",
            "english": "listen / hear",
            "wrong": [
              "read",
              "write",
              "sleep"
            ],
            "explanation": "Hören covers hearing and listening."
          },
          {
            "kind": "v",
            "german": "lesen",
            "english": "read",
            "wrong": [
              "write",
              "speak",
              "buy"
            ],
            "explanation": "Lesen means to read."
          },
          {
            "kind": "v",
            "german": "schreiben",
            "english": "write",
            "wrong": [
              "read",
              "drink",
              "stand"
            ],
            "explanation": "Schreiben means to write."
          },
          {
            "kind": "f",
            "german": "Bitte ___ Sie das Wort.",
            "english": "Please repeat the word.",
            "blank": "wiederholen",
            "options": [
              "wiederholen",
              "trinken",
              "kaufen",
              "schlafen"
            ],
            "explanation": "The polite classroom form is often 'Bitte ... Sie'."
          }
        ]
      },
      {
        "id": "1-4",
        "title": "First Mini Sentences",
        "xpReward": 35,
        "intro": {
          "title": "Chunks before grammar",
          "body": "A lot of modern language teaching uses useful chunks before explaining every grammar rule.",
          "tip": "🧩 Learn phrases as building blocks. Grammar will feel less scary later."
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "How do you say 'I am Liam' using a name?",
            "options": [
              "Ich bin Liam",
              "Ich habe Liam",
              "Ich gehe Liam",
              "Ich trinke Liam"
            ],
            "correct": "Ich bin Liam",
            "explanation": "Ich bin ... means I am ..."
          },
          {
            "kind": "c",
            "prompt": "How do you say 'My name is Anna'?",
            "options": [
              "Ich heiße Anna",
              "Ich habe Anna",
              "Ich bin heiße Anna",
              "Mein Anna heißt"
            ],
            "correct": "Ich heiße Anna",
            "explanation": "Ich heiße literally means I am called."
          },
          {
            "kind": "f",
            "german": "Ich ___ neu.",
            "english": "I am new.",
            "blank": "bin",
            "options": [
              "bin",
              "bist",
              "ist",
              "sind"
            ],
            "explanation": "Ich uses bin."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I am new'",
            "correct": [
              "Ich",
              "bin",
              "neu"
            ],
            "extra": [
              "du",
              "ist"
            ],
            "explanation": "Ich bin neu is a useful beginner sentence."
          },
          {
            "kind": "c",
            "prompt": "What does 'Willkommen!' mean?",
            "options": [
              "Welcome!",
              "Goodbye!",
              "Sorry!",
              "Never!"
            ],
            "correct": "Welcome!",
            "explanation": "Willkommen is what you might see when entering a class or website."
          }
        ]
      }
    ]
  },
  {
    "id": 2,
    "title": "Sounds, Spelling & Numbers",
    "icon": "🔢",
    "color": "#74C0FC",
    "description": "Learn German sounds, umlauts, numbers, age, and basic time expressions.",
    "lessons": [
      {
        "id": "2-1",
        "title": "German Sounds",
        "xpReward": 35,
        "intro": {
          "title": "Sounding it out",
          "body": "Teachers focus on sound early because German spelling is more consistent than English once you know the rules.",
          "tip": "🔊 Practice umlauts: ä, ö, ü. They change the sound and meaning."
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "Which letter has an umlaut?",
            "options": [
              "ü",
              "u",
              "s",
              "t"
            ],
            "correct": "ü",
            "explanation": "The dots are called an Umlaut."
          },
          {
            "kind": "v",
            "german": "ä",
            "english": "a/eh sound",
            "wrong": [
              "sh sound",
              "ch sound",
              "silent letter"
            ],
            "explanation": "ä often sounds like the vowel in 'bed'."
          },
          {
            "kind": "v",
            "german": "ö",
            "english": "rounded o sound",
            "wrong": [
              "hard k sound",
              "long i sound",
              "silent e"
            ],
            "explanation": "ö is made with rounded lips."
          },
          {
            "kind": "v",
            "german": "ü",
            "english": "rounded u sound",
            "wrong": [
              "plain u",
              "th sound",
              "silent h"
            ],
            "explanation": "ü is not the same as u."
          },
          {
            "kind": "c",
            "prompt": "In German, 'sch' usually sounds like...",
            "options": [
              "sh",
              "sk",
              "ch",
              "s"
            ],
            "correct": "sh",
            "explanation": "Schule starts with an English-like 'sh' sound."
          }
        ]
      },
      {
        "id": "2-2",
        "title": "Numbers 0–12",
        "xpReward": 35,
        "intro": {
          "title": "Count out loud",
          "body": "Numbers are taught early because they show up in prices, phone numbers, age, and time.",
          "tip": "🎵 Count rhythmically: eins, zwei, drei..."
        },
        "entries": [
          {
            "kind": "v",
            "german": "null",
            "english": "zero",
            "wrong": [
              "one",
              "nine",
              "ten"
            ],
            "explanation": "Null means zero."
          },
          {
            "kind": "v",
            "german": "eins",
            "english": "one",
            "wrong": [
              "two",
              "three",
              "five"
            ],
            "explanation": "Eins is one."
          },
          {
            "kind": "v",
            "german": "zwei",
            "english": "two",
            "wrong": [
              "three",
              "seven",
              "ten"
            ],
            "explanation": "Zwei is two."
          },
          {
            "kind": "v",
            "german": "fünf",
            "english": "five",
            "wrong": [
              "four",
              "six",
              "eight"
            ],
            "explanation": "Fünf is five."
          },
          {
            "kind": "v",
            "german": "zwölf",
            "english": "twelve",
            "wrong": [
              "two",
              "twenty",
              "ten"
            ],
            "explanation": "Zwölf is twelve."
          }
        ]
      },
      {
        "id": "2-3",
        "title": "Age & Phone Numbers",
        "xpReward": 40,
        "intro": {
          "title": "Numbers in context",
          "body": "Real classes quickly move from isolated numbers to personal info like age and phone numbers.",
          "tip": "☎️ German phone numbers are usually read digit by digit."
        },
        "entries": [
          {
            "kind": "f",
            "german": "Ich bin ___ Jahre alt.",
            "english": "I am ten years old.",
            "blank": "zehn",
            "options": [
              "zehn",
              "eins",
              "zwei",
              "alt"
            ],
            "explanation": "Age uses 'Ich bin ... Jahre alt'."
          },
          {
            "kind": "c",
            "prompt": "How do you ask 'How old are you?'",
            "options": [
              "Wie alt bist du?",
              "Wo bist du?",
              "Wer bist du?",
              "Wie heißt du?"
            ],
            "correct": "Wie alt bist du?",
            "explanation": "Wie alt means how old."
          },
          {
            "kind": "v",
            "german": "Nummer",
            "english": "number",
            "wrong": [
              "name",
              "street",
              "friend"
            ],
            "explanation": "Nummer means number."
          },
          {
            "kind": "f",
            "german": "Meine Nummer ist ___ zwei drei.",
            "english": "My number is one two three.",
            "blank": "eins",
            "options": [
              "eins",
              "alt",
              "bin",
              "null"
            ],
            "explanation": "Use number words one after another."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I am twelve years old'",
            "correct": [
              "Ich",
              "bin",
              "zwölf",
              "Jahre",
              "alt"
            ],
            "extra": [
              "du",
              "heißt"
            ],
            "explanation": "Age sentence pattern: Ich bin + number + Jahre alt."
          }
        ]
      },
      {
        "id": "2-4",
        "title": "Time Basics",
        "xpReward": 40,
        "intro": {
          "title": "Time words",
          "body": "Tutors introduce time early because it pairs naturally with daily routines later.",
          "tip": "🕐 Uhr means o'clock, but also clock/watch."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Uhr",
            "english": "o'clock / clock",
            "wrong": [
              "year",
              "day",
              "house"
            ],
            "explanation": "Uhr is used when telling time."
          },
          {
            "kind": "v",
            "german": "heute",
            "english": "today",
            "wrong": [
              "tomorrow",
              "yesterday",
              "always"
            ],
            "explanation": "Heute means today."
          },
          {
            "kind": "v",
            "german": "morgen",
            "english": "tomorrow / morning",
            "wrong": [
              "evening",
              "week",
              "never"
            ],
            "explanation": "Morgen can mean morning or tomorrow depending on context."
          },
          {
            "kind": "f",
            "german": "Es ist ___ Uhr.",
            "english": "It is two o'clock.",
            "blank": "zwei",
            "options": [
              "zwei",
              "morgen",
              "heute",
              "Tag"
            ],
            "explanation": "Time uses 'Es ist ... Uhr'."
          },
          {
            "kind": "c",
            "prompt": "What does 'am Abend' mean?",
            "options": [
              "in the evening",
              "in the morning",
              "at noon",
              "yesterday"
            ],
            "correct": "in the evening",
            "explanation": "Am Abend = in the evening."
          }
        ]
      }
    ]
  },
  {
    "id": 3,
    "title": "Nouns, Articles & Gender",
    "icon": "📝",
    "color": "#F4A261",
    "description": "Learn der, die, das and build the habit of learning every noun with its article.",
    "lessons": [
      {
        "id": "3-1",
        "title": "Der, Die, Das",
        "xpReward": 40,
        "intro": {
          "title": "German noun gender",
          "body": "Real German tutors usually insist: never learn a noun alone. Learn it with der, die, or das.",
          "tip": "🧠 Say 'der Hund', not just 'Hund'."
        },
        "entries": [
          {
            "kind": "a",
            "noun": "Hund",
            "english": "dog",
            "article": "der",
            "explanation": "It is der Hund."
          },
          {
            "kind": "a",
            "noun": "Katze",
            "english": "cat",
            "article": "die",
            "explanation": "It is die Katze."
          },
          {
            "kind": "a",
            "noun": "Haus",
            "english": "house",
            "article": "das",
            "explanation": "It is das Haus."
          },
          {
            "kind": "a",
            "noun": "Mann",
            "english": "man",
            "article": "der",
            "explanation": "It is der Mann."
          },
          {
            "kind": "a",
            "noun": "Frau",
            "english": "woman",
            "article": "die",
            "explanation": "It is die Frau."
          }
        ]
      },
      {
        "id": "3-2",
        "title": "Article Patterns",
        "xpReward": 40,
        "intro": {
          "title": "Patterns help",
          "body": "There are exceptions, but article patterns make German less random.",
          "tip": "💡 -ung, -heit, -keit are usually die. -chen is always das."
        },
        "entries": [
          {
            "kind": "a",
            "noun": "Zeitung",
            "english": "newspaper",
            "article": "die",
            "explanation": "Words ending in -ung are usually feminine."
          },
          {
            "kind": "a",
            "noun": "Mädchen",
            "english": "girl",
            "article": "das",
            "explanation": "-chen makes a noun neuter, so das Mädchen."
          },
          {
            "kind": "a",
            "noun": "Schule",
            "english": "school",
            "article": "die",
            "explanation": "Many nouns ending in -e are feminine."
          },
          {
            "kind": "a",
            "noun": "Auto",
            "english": "car",
            "article": "das",
            "explanation": "It is das Auto."
          },
          {
            "kind": "a",
            "noun": "Computer",
            "english": "computer",
            "article": "der",
            "explanation": "Borrowed tech words vary; Computer is der."
          }
        ]
      },
      {
        "id": "3-3",
        "title": "Plurals & The",
        "xpReward": 45,
        "intro": {
          "title": "Plural die",
          "body": "In German, plural nouns use die in the nominative, no matter their singular gender.",
          "tip": "📦 Singular: der Hund. Plural: die Hunde."
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "What is the plural article for 'the'?",
            "options": [
              "die",
              "der",
              "das",
              "den"
            ],
            "correct": "die",
            "explanation": "All nominative plurals use die."
          },
          {
            "kind": "c",
            "prompt": "Which means 'the dogs'?",
            "options": [
              "die Hunde",
              "der Hunde",
              "das Hunde",
              "die Hund"
            ],
            "correct": "die Hunde",
            "explanation": "Plural of Hund is Hunde."
          },
          {
            "kind": "c",
            "prompt": "Which means 'the children'?",
            "options": [
              "die Kinder",
              "das Kinder",
              "der Kinder",
              "die Kind"
            ],
            "correct": "die Kinder",
            "explanation": "Plural uses die."
          },
          {
            "kind": "f",
            "german": "Die ___ sind klein.",
            "english": "The cats are small.",
            "blank": "Katzen",
            "options": [
              "Katzen",
              "Katze",
              "Hund",
              "Haus"
            ],
            "explanation": "Katze becomes Katzen in plural."
          },
          {
            "kind": "b",
            "prompt": "Build: 'the houses'",
            "correct": [
              "die",
              "Häuser"
            ],
            "extra": [
              "das",
              "Haus"
            ],
            "explanation": "Plural: die Häuser."
          }
        ]
      },
      {
        "id": "3-4",
        "title": "This, That, A",
        "xpReward": 45,
        "intro": {
          "title": "More noun tools",
          "body": "After articles, schools usually add small noun words: ein, eine, dieser, diese, dieses.",
          "tip": "🧩 These words change with gender, so they reinforce der/die/das."
        },
        "entries": [
          {
            "kind": "f",
            "german": "Das ist ___ Hund.",
            "english": "That is a dog.",
            "blank": "ein",
            "options": [
              "ein",
              "eine",
              "einen",
              "einem"
            ],
            "explanation": "Masculine nominative uses ein."
          },
          {
            "kind": "f",
            "german": "Das ist ___ Katze.",
            "english": "That is a cat.",
            "blank": "eine",
            "options": [
              "eine",
              "ein",
              "einen",
              "das"
            ],
            "explanation": "Feminine nouns use eine."
          },
          {
            "kind": "f",
            "german": "Das ist ___ Haus.",
            "english": "That is a house.",
            "blank": "ein",
            "options": [
              "ein",
              "eine",
              "der",
              "die"
            ],
            "explanation": "Neuter nominative uses ein."
          },
          {
            "kind": "c",
            "prompt": "Which means 'this woman'?",
            "options": [
              "diese Frau",
              "dieser Frau",
              "dieses Frau",
              "diesen Frau"
            ],
            "correct": "diese Frau",
            "explanation": "Frau is feminine: diese Frau."
          },
          {
            "kind": "b",
            "prompt": "Build: 'This is a book'",
            "correct": [
              "Das",
              "ist",
              "ein",
              "Buch"
            ],
            "extra": [
              "eine",
              "Hund"
            ],
            "explanation": "Buch is neuter: ein Buch."
          }
        ]
      }
    ]
  },
  {
    "id": 4,
    "title": "People, Pronouns & Sein",
    "icon": "🧍",
    "color": "#9775FA",
    "description": "Introduce yourself, talk about people, and master the essential verb sein.",
    "lessons": [
      {
        "id": "4-1",
        "title": "Subject Pronouns",
        "xpReward": 40,
        "intro": {
          "title": "Who is doing it?",
          "body": "Pronouns are the backbone of verb conjugation, so tutors drill them early.",
          "tip": "👤 ich, du, er, sie, es, wir, ihr, sie."
        },
        "entries": [
          {
            "kind": "v",
            "german": "ich",
            "english": "I",
            "wrong": [
              "you",
              "he",
              "we"
            ],
            "explanation": "Ich means I."
          },
          {
            "kind": "v",
            "german": "du",
            "english": "you (informal)",
            "wrong": [
              "I",
              "he",
              "they"
            ],
            "explanation": "Du is informal singular you."
          },
          {
            "kind": "v",
            "german": "wir",
            "english": "we",
            "wrong": [
              "you all",
              "they",
              "she"
            ],
            "explanation": "Wir means we."
          },
          {
            "kind": "c",
            "prompt": "Which pronoun is formal 'you'?",
            "options": [
              "Sie",
              "du",
              "er",
              "wir"
            ],
            "correct": "Sie",
            "explanation": "Capitalized Sie is formal you."
          },
          {
            "kind": "f",
            "german": "___ bin neu.",
            "english": "I am new.",
            "blank": "Ich",
            "options": [
              "Ich",
              "Du",
              "Wir",
              "Sie"
            ],
            "explanation": "Ich goes with bin."
          }
        ]
      },
      {
        "id": "4-2",
        "title": "Sein: To Be",
        "xpReward": 45,
        "intro": {
          "title": "The most important verb",
          "body": "Sein is irregular, but it appears constantly in German.",
          "tip": "📋 ich bin, du bist, er/sie/es ist, wir sind."
        },
        "entries": [
          {
            "kind": "f",
            "german": "Ich ___ müde.",
            "english": "I am tired.",
            "blank": "bin",
            "options": [
              "bin",
              "bist",
              "ist",
              "sind"
            ],
            "explanation": "Ich bin."
          },
          {
            "kind": "f",
            "german": "Du ___ nett.",
            "english": "You are nice.",
            "blank": "bist",
            "options": [
              "bist",
              "bin",
              "ist",
              "seid"
            ],
            "explanation": "Du bist."
          },
          {
            "kind": "f",
            "german": "Er ___ Lehrer.",
            "english": "He is a teacher.",
            "blank": "ist",
            "options": [
              "ist",
              "bin",
              "sind",
              "seid"
            ],
            "explanation": "Er ist."
          },
          {
            "kind": "f",
            "german": "Wir ___ Freunde.",
            "english": "We are friends.",
            "blank": "sind",
            "options": [
              "sind",
              "seid",
              "ist",
              "bin"
            ],
            "explanation": "Wir sind."
          },
          {
            "kind": "b",
            "prompt": "Build: 'She is nice'",
            "correct": [
              "Sie",
              "ist",
              "nett"
            ],
            "extra": [
              "bin",
              "bist"
            ],
            "explanation": "Sie ist nett."
          }
        ]
      },
      {
        "id": "4-3",
        "title": "Names & Origins",
        "xpReward": 45,
        "intro": {
          "title": "Personal introductions",
          "body": "This is classic A1 material: name, origin, language, place.",
          "tip": "🌍 'Ich komme aus...' means I come from..."
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "How do you say 'My name is Max'?",
            "options": [
              "Ich heiße Max",
              "Ich habe Max",
              "Ich bin heiße Max",
              "Max ich"
            ],
            "correct": "Ich heiße Max",
            "explanation": "Ich heiße means I am called."
          },
          {
            "kind": "c",
            "prompt": "What does 'Woher kommst du?' mean?",
            "options": [
              "Where are you from?",
              "Where are you going?",
              "What is your name?",
              "How old are you?"
            ],
            "correct": "Where are you from?",
            "explanation": "Woher means from where."
          },
          {
            "kind": "f",
            "german": "Ich komme ___ Amerika.",
            "english": "I come from America.",
            "blank": "aus",
            "options": [
              "aus",
              "in",
              "nach",
              "bei"
            ],
            "explanation": "Origin uses aus."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I come from Germany'",
            "correct": [
              "Ich",
              "komme",
              "aus",
              "Deutschland"
            ],
            "extra": [
              "nach",
              "bin"
            ],
            "explanation": "Ich komme aus Deutschland."
          },
          {
            "kind": "c",
            "prompt": "Which is the natural answer to 'Wie heißt du?'",
            "options": [
              "Ich heiße Anna.",
              "Ich komme Anna.",
              "Ich bin aus Anna.",
              "Ich wohne Anna."
            ],
            "correct": "Ich heiße Anna.",
            "explanation": "Wie heißt du asks your name."
          }
        ]
      },
      {
        "id": "4-4",
        "title": "People Around You",
        "xpReward": 45,
        "intro": {
          "title": "Talking about people",
          "body": "Schools add family/friend words after introductions so learners can describe their world.",
          "tip": "👪 Freund can mean male friend or boyfriend; Freundin can mean female friend or girlfriend."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Freund",
            "english": "friend",
            "wrong": [
              "teacher",
              "child",
              "city"
            ],
            "explanation": "Freund means friend."
          },
          {
            "kind": "v",
            "german": "Mutter",
            "english": "mother",
            "wrong": [
              "father",
              "sister",
              "daughter"
            ],
            "explanation": "Mutter means mother."
          },
          {
            "kind": "v",
            "german": "Vater",
            "english": "father",
            "wrong": [
              "mother",
              "brother",
              "friend"
            ],
            "explanation": "Vater means father."
          },
          {
            "kind": "a",
            "noun": "Kind",
            "english": "child",
            "article": "das",
            "explanation": "It is das Kind."
          },
          {
            "kind": "f",
            "german": "Meine ___ heißt Maria.",
            "english": "My mother is named Maria.",
            "blank": "Mutter",
            "options": [
              "Mutter",
              "Vater",
              "Kind",
              "Hund"
            ],
            "explanation": "Meine Mutter = my mother."
          }
        ]
      }
    ]
  },
  {
    "id": 5,
    "title": "Food, Drink & Ordering",
    "icon": "☕",
    "color": "#E76F51",
    "description": "Practice food vocabulary and polite restaurant/café German.",
    "lessons": [
      {
        "id": "5-1",
        "title": "Cafe Basics",
        "xpReward": 45,
        "intro": {
          "title": "Kaffeepause",
          "body": "A1 classes love café roleplay because it combines numbers, politeness, and food.",
          "tip": "☕ 'Ich hätte gern...' is a polite way to order."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Kaffee",
            "english": "coffee",
            "wrong": [
              "tea",
              "water",
              "bread"
            ],
            "explanation": "Kaffee means coffee."
          },
          {
            "kind": "v",
            "german": "Tee",
            "english": "tea",
            "wrong": [
              "coffee",
              "milk",
              "cake"
            ],
            "explanation": "Tee means tea."
          },
          {
            "kind": "v",
            "german": "Wasser",
            "english": "water",
            "wrong": [
              "juice",
              "wine",
              "milk"
            ],
            "explanation": "Wasser means water."
          },
          {
            "kind": "v",
            "german": "Kuchen",
            "english": "cake",
            "wrong": [
              "bread",
              "cheese",
              "soup"
            ],
            "explanation": "Kuchen means cake."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Coffee, please'",
            "correct": [
              "Kaffee",
              "bitte"
            ],
            "extra": [
              "Tee",
              "Danke"
            ],
            "explanation": "A very simple café order."
          }
        ]
      },
      {
        "id": "5-2",
        "title": "Eating & Drinking Verbs",
        "xpReward": 45,
        "intro": {
          "title": "Useful verbs",
          "body": "Essen and trinken are early verbs because they create immediate sentences.",
          "tip": "🍽️ ich esse, du isst, er isst; ich trinke, du trinkst."
        },
        "entries": [
          {
            "kind": "v",
            "german": "essen",
            "english": "to eat",
            "wrong": [
              "to drink",
              "to buy",
              "to read"
            ],
            "explanation": "Essen means to eat."
          },
          {
            "kind": "v",
            "german": "trinken",
            "english": "to drink",
            "wrong": [
              "to eat",
              "to sleep",
              "to live"
            ],
            "explanation": "Trinken means to drink."
          },
          {
            "kind": "f",
            "german": "Ich ___ Brot.",
            "english": "I eat bread.",
            "blank": "esse",
            "options": [
              "esse",
              "isst",
              "trinke",
              "bist"
            ],
            "explanation": "Ich esse."
          },
          {
            "kind": "f",
            "german": "Du ___ Wasser.",
            "english": "You drink water.",
            "blank": "trinkst",
            "options": [
              "trinkst",
              "trinke",
              "trinkt",
              "isst"
            ],
            "explanation": "Du trinkst."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I drink coffee'",
            "correct": [
              "Ich",
              "trinke",
              "Kaffee"
            ],
            "extra": [
              "esse",
              "Brot"
            ],
            "explanation": "Ich trinke Kaffee."
          }
        ]
      },
      {
        "id": "5-3",
        "title": "Meals",
        "xpReward": 50,
        "intro": {
          "title": "Daily meals",
          "body": "Meal words are practical and pair well with time-of-day vocabulary.",
          "tip": "🥨 Frühstück literally looks like 'early piece'."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Frühstück",
            "english": "breakfast",
            "wrong": [
              "lunch",
              "dinner",
              "snack"
            ],
            "explanation": "Frühstück means breakfast."
          },
          {
            "kind": "v",
            "german": "Mittagessen",
            "english": "lunch",
            "wrong": [
              "breakfast",
              "dinner",
              "dessert"
            ],
            "explanation": "Mittagessen means lunch."
          },
          {
            "kind": "v",
            "german": "Abendessen",
            "english": "dinner",
            "wrong": [
              "breakfast",
              "lunch",
              "coffee"
            ],
            "explanation": "Abendessen means evening meal."
          },
          {
            "kind": "c",
            "prompt": "What do you say before someone eats?",
            "options": [
              "Guten Appetit!",
              "Gute Nacht!",
              "Guten Morgen!",
              "Tschüss!"
            ],
            "correct": "Guten Appetit!",
            "explanation": "Guten Appetit means enjoy your meal."
          },
          {
            "kind": "f",
            "german": "Zum ___ esse ich Brot.",
            "english": "For breakfast I eat bread.",
            "blank": "Frühstück",
            "options": [
              "Frühstück",
              "Abend",
              "Morgen",
              "Wasser"
            ],
            "explanation": "Zum Frühstück = for breakfast."
          }
        ]
      },
      {
        "id": "5-4",
        "title": "Ordering Politely",
        "xpReward": 50,
        "intro": {
          "title": "Restaurant chunks",
          "body": "Tutors teach complete ordering sentences so learners can survive real interactions.",
          "tip": "🙋 'Ich möchte...' is useful, but 'Ich hätte gern...' sounds softer."
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "Which phrase means 'I would like a water'?",
            "options": [
              "Ich hätte gern ein Wasser.",
              "Ich bin Wasser.",
              "Ich gehe Wasser.",
              "Ich habe gern Wasser."
            ],
            "correct": "Ich hätte gern ein Wasser.",
            "explanation": "Ich hätte gern... is a polite order."
          },
          {
            "kind": "f",
            "german": "Ich möchte ___ Kaffee.",
            "english": "I would like a coffee.",
            "blank": "einen",
            "options": [
              "einen",
              "eine",
              "ein",
              "der"
            ],
            "explanation": "Kaffee is masculine: einen Kaffee in accusative."
          },
          {
            "kind": "c",
            "prompt": "What does 'Die Rechnung, bitte' mean?",
            "options": [
              "The bill, please",
              "The water, please",
              "The menu, please",
              "The table, please"
            ],
            "correct": "The bill, please",
            "explanation": "Rechnung is the bill/check."
          },
          {
            "kind": "v",
            "german": "Speisekarte",
            "english": "menu",
            "wrong": [
              "bill",
              "waiter",
              "fork"
            ],
            "explanation": "Speisekarte means menu."
          },
          {
            "kind": "b",
            "prompt": "Build: 'The bill, please'",
            "correct": [
              "Die",
              "Rechnung",
              "bitte"
            ],
            "extra": [
              "Kaffee",
              "Hallo"
            ],
            "explanation": "Die Rechnung, bitte."
          }
        ]
      }
    ]
  },
  {
    "id": 6,
    "title": "Present Tense Verbs",
    "icon": "⚡",
    "color": "#339AF0",
    "description": "Build sentences with common regular and irregular verbs.",
    "lessons": [
      {
        "id": "6-1",
        "title": "Regular Verb Pattern",
        "xpReward": 50,
        "intro": {
          "title": "Verb stems and endings",
          "body": "German tutors explain the regular pattern early: stem + ending.",
          "tip": "⚙️ machen → ich mache, du machst, er macht, wir machen."
        },
        "entries": [
          {
            "kind": "v",
            "german": "machen",
            "english": "to do / make",
            "wrong": [
              "to see",
              "to know",
              "to sleep"
            ],
            "explanation": "Machen means to do or make."
          },
          {
            "kind": "f",
            "german": "Ich ___ Hausaufgaben.",
            "english": "I do homework.",
            "blank": "mache",
            "options": [
              "mache",
              "machst",
              "macht",
              "machen"
            ],
            "explanation": "Ich uses -e."
          },
          {
            "kind": "f",
            "german": "Du ___ Musik.",
            "english": "You make music.",
            "blank": "machst",
            "options": [
              "machst",
              "mache",
              "macht",
              "machen"
            ],
            "explanation": "Du uses -st."
          },
          {
            "kind": "f",
            "german": "Er ___ Sport.",
            "english": "He does sports.",
            "blank": "macht",
            "options": [
              "macht",
              "mache",
              "machen",
              "machst"
            ],
            "explanation": "Er uses -t."
          },
          {
            "kind": "b",
            "prompt": "Build: 'We do homework'",
            "correct": [
              "Wir",
              "machen",
              "Hausaufgaben"
            ],
            "extra": [
              "mache",
              "du"
            ],
            "explanation": "Wir uses the infinitive form: machen."
          }
        ]
      },
      {
        "id": "6-2",
        "title": "Learning & Speaking",
        "xpReward": 50,
        "intro": {
          "title": "Language-learning verbs",
          "body": "These are immediately relevant inside Sprak and in real class conversations.",
          "tip": "🗣️ sprechen is irregular: du sprichst, er spricht."
        },
        "entries": [
          {
            "kind": "v",
            "german": "lernen",
            "english": "to learn",
            "wrong": [
              "to live",
              "to drink",
              "to buy"
            ],
            "explanation": "Lernen means to learn."
          },
          {
            "kind": "v",
            "german": "sprechen",
            "english": "to speak",
            "wrong": [
              "to write",
              "to read",
              "to hear"
            ],
            "explanation": "Sprechen means to speak."
          },
          {
            "kind": "f",
            "german": "Ich ___ Deutsch.",
            "english": "I am learning German.",
            "blank": "lerne",
            "options": [
              "lerne",
              "lernst",
              "lernt",
              "lernen"
            ],
            "explanation": "Ich lerne."
          },
          {
            "kind": "f",
            "german": "Wir ___ Deutsch.",
            "english": "We speak German.",
            "blank": "sprechen",
            "options": [
              "sprechen",
              "sprichst",
              "spricht",
              "spreche"
            ],
            "explanation": "Wir sprechen."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I speak a little German'",
            "correct": [
              "Ich",
              "spreche",
              "ein",
              "bisschen",
              "Deutsch"
            ],
            "extra": [
              "lerne",
              "viel"
            ],
            "explanation": "Ein bisschen Deutsch = a little German."
          }
        ]
      },
      {
        "id": "6-3",
        "title": "Living & Working",
        "xpReward": 55,
        "intro": {
          "title": "Real-life verbs",
          "body": "Where you live and work is A1/A2 conversation material.",
          "tip": "🏠 wohnen = reside; leben = live/be alive."
        },
        "entries": [
          {
            "kind": "v",
            "german": "wohnen",
            "english": "to live / reside",
            "wrong": [
              "to work",
              "to learn",
              "to buy"
            ],
            "explanation": "Wohnen means to reside somewhere."
          },
          {
            "kind": "v",
            "german": "arbeiten",
            "english": "to work",
            "wrong": [
              "to travel",
              "to eat",
              "to sleep"
            ],
            "explanation": "Arbeiten means to work."
          },
          {
            "kind": "f",
            "german": "Ich ___ in Berlin.",
            "english": "I live in Berlin.",
            "blank": "wohne",
            "options": [
              "wohne",
              "wohnt",
              "wohnst",
              "wohnen"
            ],
            "explanation": "Ich wohne."
          },
          {
            "kind": "f",
            "german": "Sie ___ heute.",
            "english": "She works today.",
            "blank": "arbeitet",
            "options": [
              "arbeitet",
              "arbeite",
              "arbeiten",
              "arbeitest"
            ],
            "explanation": "Sie arbeitet."
          },
          {
            "kind": "c",
            "prompt": "Which sentence means 'He lives in Munich'?",
            "options": [
              "Er wohnt in München.",
              "Er arbeitet München.",
              "Er trinkt München.",
              "Er ist München."
            ],
            "correct": "Er wohnt in München.",
            "explanation": "Wohnen in + city."
          }
        ]
      },
      {
        "id": "6-4",
        "title": "Likes & Wants",
        "xpReward": 55,
        "intro": {
          "title": "Preferences",
          "body": "Tutors add mögen/möchte early because they make conversation personal.",
          "tip": "❤️ Ich mag... = I like... / Ich möchte... = I would like..."
        },
        "entries": [
          {
            "kind": "v",
            "german": "mögen",
            "english": "to like",
            "wrong": [
              "to must",
              "to can",
              "to go"
            ],
            "explanation": "Mögen means to like."
          },
          {
            "kind": "f",
            "german": "Ich ___ Kaffee.",
            "english": "I like coffee.",
            "blank": "mag",
            "options": [
              "mag",
              "möchte",
              "muss",
              "kann"
            ],
            "explanation": "Ich mag."
          },
          {
            "kind": "f",
            "german": "Ich ___ Wasser.",
            "english": "I would like water.",
            "blank": "möchte",
            "options": [
              "möchte",
              "mag",
              "bin",
              "habe"
            ],
            "explanation": "Ich möchte is polite and useful."
          },
          {
            "kind": "c",
            "prompt": "Which is more polite for ordering?",
            "options": [
              "Ich möchte Tee.",
              "Ich bin Tee.",
              "Ich muss Tee.",
              "Ich heiße Tee."
            ],
            "correct": "Ich möchte Tee.",
            "explanation": "Ich möchte = I would like."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I like German'",
            "correct": [
              "Ich",
              "mag",
              "Deutsch"
            ],
            "extra": [
              "möchte",
              "Kaffee"
            ],
            "explanation": "Ich mag Deutsch."
          }
        ]
      }
    ]
  },
  {
    "id": 7,
    "title": "Questions, Negation & Word Order",
    "icon": "❓",
    "color": "#FAB005",
    "description": "Ask useful questions and answer with yes, no, not, and no/none.",
    "lessons": [
      {
        "id": "7-1",
        "title": "Question Words",
        "xpReward": 50,
        "intro": {
          "title": "W-Fragen",
          "body": "German question words usually start with W, just like English often starts with wh.",
          "tip": "❓ wer, was, wo, wann, warum, wie."
        },
        "entries": [
          {
            "kind": "v",
            "german": "wer",
            "english": "who",
            "wrong": [
              "what",
              "where",
              "when"
            ],
            "explanation": "Wer means who."
          },
          {
            "kind": "v",
            "german": "was",
            "english": "what",
            "wrong": [
              "who",
              "why",
              "how"
            ],
            "explanation": "Was means what."
          },
          {
            "kind": "v",
            "german": "wo",
            "english": "where",
            "wrong": [
              "when",
              "why",
              "who"
            ],
            "explanation": "Wo means where."
          },
          {
            "kind": "v",
            "german": "warum",
            "english": "why",
            "wrong": [
              "where",
              "when",
              "how"
            ],
            "explanation": "Warum means why."
          },
          {
            "kind": "c",
            "prompt": "How do you ask 'Where are you?'",
            "options": [
              "Wo bist du?",
              "Wer bist du?",
              "Was bist du?",
              "Wann bist du?"
            ],
            "correct": "Wo bist du?",
            "explanation": "Wo = where."
          }
        ]
      },
      {
        "id": "7-2",
        "title": "Yes/No Questions",
        "xpReward": 50,
        "intro": {
          "title": "Verb first questions",
          "body": "German yes/no questions often start with the verb.",
          "tip": "🔁 Statement: Du bist müde. Question: Bist du müde?"
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "Which is 'Are you tired?'",
            "options": [
              "Bist du müde?",
              "Du bist müde?",
              "Müde du bist?",
              "Ist müde du?"
            ],
            "correct": "Bist du müde?",
            "explanation": "Verb comes first in yes/no questions."
          },
          {
            "kind": "c",
            "prompt": "Which is 'Do you speak German?'",
            "options": [
              "Sprichst du Deutsch?",
              "Du sprichst Deutsch?",
              "Deutsch du sprichst?",
              "Sprechen du Deutsch?"
            ],
            "correct": "Sprichst du Deutsch?",
            "explanation": "Verb-first question word order."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Do you live here?'",
            "correct": [
              "Wohnst",
              "du",
              "hier"
            ],
            "extra": [
              "ich",
              "wo"
            ],
            "explanation": "Wohnst du hier?"
          },
          {
            "kind": "f",
            "german": "___ du Kaffee?",
            "english": "Do you drink coffee?",
            "blank": "Trinkst",
            "options": [
              "Trinkst",
              "Trinke",
              "Trinkt",
              "Trinken"
            ],
            "explanation": "Du form: trinkst."
          },
          {
            "kind": "c",
            "prompt": "What is the natural answer to 'Bist du neu?'",
            "options": [
              "Ja, ich bin neu.",
              "Ja, ich neu bin.",
              "Ja, du bist neu.",
              "Nein, ich bist neu."
            ],
            "correct": "Ja, ich bin neu.",
            "explanation": "Answer returns to normal word order."
          }
        ]
      },
      {
        "id": "7-3",
        "title": "Nicht",
        "xpReward": 55,
        "intro": {
          "title": "Saying not",
          "body": "Nicht negates verbs, adjectives, and whole ideas. Placement takes practice.",
          "tip": "🚫 Ich bin nicht müde = I am not tired."
        },
        "entries": [
          {
            "kind": "v",
            "german": "nicht",
            "english": "not",
            "wrong": [
              "no",
              "never",
              "always"
            ],
            "explanation": "Nicht means not."
          },
          {
            "kind": "f",
            "german": "Ich bin ___ müde.",
            "english": "I am not tired.",
            "blank": "nicht",
            "options": [
              "nicht",
              "kein",
              "nein",
              "nie"
            ],
            "explanation": "Use nicht with adjectives."
          },
          {
            "kind": "f",
            "german": "Er kommt ___ aus Berlin.",
            "english": "He does not come from Berlin.",
            "blank": "nicht",
            "options": [
              "nicht",
              "kein",
              "nein",
              "eine"
            ],
            "explanation": "Nicht negates the phrase."
          },
          {
            "kind": "c",
            "prompt": "Which means 'I do not speak German'?",
            "options": [
              "Ich spreche nicht Deutsch.",
              "Ich nicht spreche Deutsch.",
              "Ich spreche kein Deutsch.",
              "Both 1 and 3 can work"
            ],
            "correct": "Both 1 and 3 can work",
            "explanation": "Kein Deutsch is often natural; nicht Deutsch also contrasts with another language."
          },
          {
            "kind": "b",
            "prompt": "Build: 'She is not here'",
            "correct": [
              "Sie",
              "ist",
              "nicht",
              "hier"
            ],
            "extra": [
              "kein",
              "du"
            ],
            "explanation": "Nicht usually comes before the place/adjective it negates."
          }
        ]
      },
      {
        "id": "7-4",
        "title": "Kein",
        "xpReward": 55,
        "intro": {
          "title": "No/Not a",
          "body": "Kein acts like 'not a' or 'no' before nouns.",
          "tip": "📦 Ich habe keinen Hund = I do not have a dog."
        },
        "entries": [
          {
            "kind": "v",
            "german": "kein",
            "english": "no / not a",
            "wrong": [
              "yes",
              "also",
              "always"
            ],
            "explanation": "Kein negates nouns."
          },
          {
            "kind": "f",
            "german": "Das ist ___ Problem.",
            "english": "That is not a problem.",
            "blank": "kein",
            "options": [
              "kein",
              "nicht",
              "nein",
              "keine"
            ],
            "explanation": "Problem is neuter: kein Problem."
          },
          {
            "kind": "f",
            "german": "Ich habe ___ Katze.",
            "english": "I do not have a cat.",
            "blank": "keine",
            "options": [
              "keine",
              "kein",
              "nicht",
              "nein"
            ],
            "explanation": "Katze is feminine: keine Katze."
          },
          {
            "kind": "c",
            "prompt": "Which means 'No idea'?",
            "options": [
              "Keine Ahnung",
              "Nicht Ahnung",
              "Nein Ahnung",
              "Kein Ahnung"
            ],
            "correct": "Keine Ahnung",
            "explanation": "Ahnung is feminine: keine Ahnung."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I have no time'",
            "correct": [
              "Ich",
              "habe",
              "keine",
              "Zeit"
            ],
            "extra": [
              "nicht",
              "bin"
            ],
            "explanation": "Zeit is feminine: keine Zeit."
          }
        ]
      }
    ]
  },
  {
    "id": 8,
    "title": "Family, Descriptions & Adjectives",
    "icon": "👪",
    "color": "#FF922B",
    "description": "Talk about family, personality, appearance, and simple descriptions.",
    "lessons": [
      {
        "id": "8-1",
        "title": "Family Words",
        "xpReward": 50,
        "intro": {
          "title": "People close to you",
          "body": "Family vocabulary is one of the first real-life topics in school courses.",
          "tip": "👪 Meine Mutter, mein Vater — possessives change with gender."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Mutter",
            "english": "mother",
            "wrong": [
              "father",
              "sister",
              "brother"
            ],
            "explanation": "Mutter means mother."
          },
          {
            "kind": "v",
            "german": "Vater",
            "english": "father",
            "wrong": [
              "mother",
              "daughter",
              "friend"
            ],
            "explanation": "Vater means father."
          },
          {
            "kind": "v",
            "german": "Bruder",
            "english": "brother",
            "wrong": [
              "sister",
              "mother",
              "child"
            ],
            "explanation": "Bruder means brother."
          },
          {
            "kind": "v",
            "german": "Schwester",
            "english": "sister",
            "wrong": [
              "brother",
              "father",
              "friend"
            ],
            "explanation": "Schwester means sister."
          },
          {
            "kind": "f",
            "german": "Meine ___ heißt Lisa.",
            "english": "My sister is named Lisa.",
            "blank": "Schwester",
            "options": [
              "Schwester",
              "Bruder",
              "Vater",
              "Hund"
            ],
            "explanation": "Meine Schwester = my sister."
          }
        ]
      },
      {
        "id": "8-2",
        "title": "Adjective Basics",
        "xpReward": 50,
        "intro": {
          "title": "Describing things",
          "body": "At first, use adjectives after sein: Das ist gut. Der Hund ist klein.",
          "tip": "🎨 Adjective endings come later; start with simple predicate adjectives."
        },
        "entries": [
          {
            "kind": "v",
            "german": "groß",
            "english": "big / tall",
            "wrong": [
              "small",
              "old",
              "young"
            ],
            "explanation": "Groß means big or tall."
          },
          {
            "kind": "v",
            "german": "klein",
            "english": "small",
            "wrong": [
              "big",
              "new",
              "old"
            ],
            "explanation": "Klein means small."
          },
          {
            "kind": "v",
            "german": "alt",
            "english": "old",
            "wrong": [
              "young",
              "nice",
              "fast"
            ],
            "explanation": "Alt means old."
          },
          {
            "kind": "v",
            "german": "neu",
            "english": "new",
            "wrong": [
              "old",
              "bad",
              "slow"
            ],
            "explanation": "Neu means new."
          },
          {
            "kind": "f",
            "german": "Das Haus ist ___.",
            "english": "The house is big.",
            "blank": "groß",
            "options": [
              "groß",
              "klein",
              "alt",
              "neu"
            ],
            "explanation": "Predicate adjectives do not take endings here."
          }
        ]
      },
      {
        "id": "8-3",
        "title": "Personality",
        "xpReward": 55,
        "intro": {
          "title": "People are more than nouns",
          "body": "These words make conversations more human and profile-like.",
          "tip": "😊 Nett is a very common word for nice."
        },
        "entries": [
          {
            "kind": "v",
            "german": "nett",
            "english": "nice",
            "wrong": [
              "tired",
              "small",
              "expensive"
            ],
            "explanation": "Nett means nice."
          },
          {
            "kind": "v",
            "german": "freundlich",
            "english": "friendly",
            "wrong": [
              "hungry",
              "blue",
              "cheap"
            ],
            "explanation": "Freundlich means friendly."
          },
          {
            "kind": "v",
            "german": "müde",
            "english": "tired",
            "wrong": [
              "awake",
              "nice",
              "new"
            ],
            "explanation": "Müde means tired."
          },
          {
            "kind": "v",
            "german": "glücklich",
            "english": "happy",
            "wrong": [
              "sad",
              "angry",
              "small"
            ],
            "explanation": "Glücklich means happy."
          },
          {
            "kind": "f",
            "german": "Ich bin ___.",
            "english": "I am tired.",
            "blank": "müde",
            "options": [
              "müde",
              "nett",
              "groß",
              "neu"
            ],
            "explanation": "Ich bin müde is a common sentence."
          }
        ]
      },
      {
        "id": "8-4",
        "title": "Possessives",
        "xpReward": 55,
        "intro": {
          "title": "My, your, his, her",
          "body": "Possessives are usually taught with family because they naturally fit together.",
          "tip": "🧩 mein Vater, meine Mutter, mein Kind."
        },
        "entries": [
          {
            "kind": "f",
            "german": "Das ist ___ Vater.",
            "english": "That is my father.",
            "blank": "mein",
            "options": [
              "mein",
              "meine",
              "dein",
              "deine"
            ],
            "explanation": "Vater is masculine: mein Vater."
          },
          {
            "kind": "f",
            "german": "Das ist ___ Mutter.",
            "english": "That is my mother.",
            "blank": "meine",
            "options": [
              "meine",
              "mein",
              "dein",
              "sein"
            ],
            "explanation": "Mutter is feminine: meine Mutter."
          },
          {
            "kind": "c",
            "prompt": "Which means 'your brother' informally?",
            "options": [
              "dein Bruder",
              "deine Bruder",
              "du Bruder",
              "sein Bruder"
            ],
            "correct": "dein Bruder",
            "explanation": "Bruder is masculine: dein Bruder."
          },
          {
            "kind": "c",
            "prompt": "Which means 'her sister'?",
            "options": [
              "ihre Schwester",
              "ihr Schwester",
              "sie Schwester",
              "sein Schwester"
            ],
            "correct": "ihre Schwester",
            "explanation": "Schwester is feminine: ihre Schwester."
          },
          {
            "kind": "b",
            "prompt": "Build: 'My family is nice'",
            "correct": [
              "Meine",
              "Familie",
              "ist",
              "nett"
            ],
            "extra": [
              "mein",
              "dein"
            ],
            "explanation": "Familie is feminine: meine Familie."
          }
        ]
      }
    ]
  },
  {
    "id": 9,
    "title": "Home, Daily Routine & Separable Verbs",
    "icon": "🏠",
    "color": "#20C997",
    "description": "Use room words, routine verbs, and separable verbs like aufstehen.",
    "lessons": [
      {
        "id": "9-1",
        "title": "Rooms & Objects",
        "xpReward": 55,
        "intro": {
          "title": "Around the house",
          "body": "Home vocabulary is practical and easy to visualize, which helps memory.",
          "tip": "🏠 Draw or imagine the room while answering."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Zimmer",
            "english": "room",
            "wrong": [
              "door",
              "window",
              "kitchen"
            ],
            "explanation": "Zimmer means room."
          },
          {
            "kind": "v",
            "german": "Küche",
            "english": "kitchen",
            "wrong": [
              "bathroom",
              "garden",
              "door"
            ],
            "explanation": "Küche means kitchen."
          },
          {
            "kind": "v",
            "german": "Tür",
            "english": "door",
            "wrong": [
              "window",
              "chair",
              "table"
            ],
            "explanation": "Tür means door."
          },
          {
            "kind": "v",
            "german": "Fenster",
            "english": "window",
            "wrong": [
              "door",
              "wall",
              "floor"
            ],
            "explanation": "Fenster means window."
          },
          {
            "kind": "a",
            "noun": "Wohnung",
            "english": "apartment",
            "article": "die",
            "explanation": "-ung words are usually feminine: die Wohnung."
          }
        ]
      },
      {
        "id": "9-2",
        "title": "Routine Verbs",
        "xpReward": 55,
        "intro": {
          "title": "Daily life",
          "body": "Routine verbs make it possible to describe a whole day in simple German.",
          "tip": "⏰ Many routine verbs are separable: aufstehen, einkaufen."
        },
        "entries": [
          {
            "kind": "v",
            "german": "aufstehen",
            "english": "to get up",
            "wrong": [
              "to sleep",
              "to buy",
              "to read"
            ],
            "explanation": "Aufstehen is separable."
          },
          {
            "kind": "v",
            "german": "schlafen",
            "english": "to sleep",
            "wrong": [
              "to work",
              "to eat",
              "to learn"
            ],
            "explanation": "Schlafen means to sleep."
          },
          {
            "kind": "v",
            "german": "gehen",
            "english": "to go",
            "wrong": [
              "to come",
              "to stay",
              "to see"
            ],
            "explanation": "Gehen means to go."
          },
          {
            "kind": "f",
            "german": "Ich ___ um sieben Uhr auf.",
            "english": "I get up at seven o'clock.",
            "blank": "stehe",
            "options": [
              "stehe",
              "steht",
              "stehen",
              "stehst"
            ],
            "explanation": "Separable verb: Ich stehe ... auf."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I go home'",
            "correct": [
              "Ich",
              "gehe",
              "nach",
              "Hause"
            ],
            "extra": [
              "bin",
              "auf"
            ],
            "explanation": "Nach Hause = homeward/home."
          }
        ]
      },
      {
        "id": "9-3",
        "title": "Chores & Cleanliness",
        "xpReward": 60,
        "intro": {
          "title": "Useful verbs at home",
          "body": "Classrooms often use home tasks to practice present tense and object nouns.",
          "tip": "🧹 sauber = clean, schmutzig = dirty."
        },
        "entries": [
          {
            "kind": "v",
            "german": "sauber",
            "english": "clean",
            "wrong": [
              "dirty",
              "loud",
              "small"
            ],
            "explanation": "Sauber means clean."
          },
          {
            "kind": "v",
            "german": "schmutzig",
            "english": "dirty",
            "wrong": [
              "clean",
              "quiet",
              "new"
            ],
            "explanation": "Schmutzig means dirty."
          },
          {
            "kind": "v",
            "german": "kochen",
            "english": "to cook",
            "wrong": [
              "to clean",
              "to sleep",
              "to drive"
            ],
            "explanation": "Kochen means to cook."
          },
          {
            "kind": "v",
            "german": "putzen",
            "english": "to clean",
            "wrong": [
              "to cook",
              "to learn",
              "to speak"
            ],
            "explanation": "Putzen means to clean."
          },
          {
            "kind": "f",
            "german": "Ich ___ die Küche.",
            "english": "I clean the kitchen.",
            "blank": "putze",
            "options": [
              "putze",
              "putzt",
              "putzen",
              "kocht"
            ],
            "explanation": "Ich putze."
          }
        ]
      },
      {
        "id": "9-4",
        "title": "A Simple Day",
        "xpReward": 60,
        "intro": {
          "title": "Put routine together",
          "body": "A tutor would now connect time, verbs, and household words into short sequences.",
          "tip": "🧠 Try saying the whole day as a mini story."
        },
        "entries": [
          {
            "kind": "f",
            "german": "Am Morgen ___ ich Kaffee.",
            "english": "In the morning I drink coffee.",
            "blank": "trinke",
            "options": [
              "trinke",
              "trinkst",
              "trinkt",
              "trinken"
            ],
            "explanation": "Am Morgen = in the morning."
          },
          {
            "kind": "f",
            "german": "Am Abend ___ ich Deutsch.",
            "english": "In the evening I learn German.",
            "blank": "lerne",
            "options": [
              "lerne",
              "lernst",
              "lernt",
              "lernen"
            ],
            "explanation": "Am Abend = in the evening."
          },
          {
            "kind": "c",
            "prompt": "Which sentence means 'I sleep at night'?",
            "options": [
              "Ich schlafe in der Nacht.",
              "Ich esse in der Nacht.",
              "Ich arbeite der Nacht.",
              "Ich bin Nacht."
            ],
            "correct": "Ich schlafe in der Nacht.",
            "explanation": "In der Nacht = at night."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Today I cook'",
            "correct": [
              "Heute",
              "koche",
              "ich"
            ],
            "extra": [
              "du",
              "kocht"
            ],
            "explanation": "Time words can come first; verb stays second."
          },
          {
            "kind": "c",
            "prompt": "What happens to the verb after 'Heute' starts the sentence?",
            "options": [
              "It stays in second position",
              "It goes to the end",
              "It disappears",
              "It becomes plural"
            ],
            "correct": "It stays in second position",
            "explanation": "German main clauses like the verb in position two."
          }
        ]
      }
    ]
  },
  {
    "id": 10,
    "title": "Travel, Directions & Places",
    "icon": "🚆",
    "color": "#4DABF7",
    "description": "Navigate trains, streets, hotels, and city directions.",
    "lessons": [
      {
        "id": "10-1",
        "title": "Transport Words",
        "xpReward": 60,
        "intro": {
          "title": "Getting around",
          "body": "Travel roleplays are a staple of A1/A2 classes because they are concrete and useful.",
          "tip": "🚆 Der Zug has Verspätung more often than learners expect."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Bahnhof",
            "english": "train station",
            "wrong": [
              "airport",
              "hotel",
              "street"
            ],
            "explanation": "Bahnhof means train station."
          },
          {
            "kind": "v",
            "german": "Zug",
            "english": "train",
            "wrong": [
              "bus",
              "ticket",
              "platform"
            ],
            "explanation": "Zug means train."
          },
          {
            "kind": "v",
            "german": "Bus",
            "english": "bus",
            "wrong": [
              "train",
              "bike",
              "car"
            ],
            "explanation": "Bus means bus."
          },
          {
            "kind": "v",
            "german": "Fahrkarte",
            "english": "ticket",
            "wrong": [
              "suitcase",
              "map",
              "room"
            ],
            "explanation": "Fahrkarte means travel ticket."
          },
          {
            "kind": "f",
            "german": "Der Zug hat ___.",
            "english": "The train is delayed.",
            "blank": "Verspätung",
            "options": [
              "Verspätung",
              "Hunger",
              "Zimmer",
              "Wasser"
            ],
            "explanation": "Verspätung means delay."
          }
        ]
      },
      {
        "id": "10-2",
        "title": "Directions",
        "xpReward": 60,
        "intro": {
          "title": "Where do I go?",
          "body": "Direction words help learners survive real cities and practice imperative-like chunks.",
          "tip": "➡️ links = left, rechts = right, geradeaus = straight ahead."
        },
        "entries": [
          {
            "kind": "v",
            "german": "links",
            "english": "left",
            "wrong": [
              "right",
              "straight",
              "behind"
            ],
            "explanation": "Links means left."
          },
          {
            "kind": "v",
            "german": "rechts",
            "english": "right",
            "wrong": [
              "left",
              "straight",
              "near"
            ],
            "explanation": "Rechts means right."
          },
          {
            "kind": "v",
            "german": "geradeaus",
            "english": "straight ahead",
            "wrong": [
              "left",
              "right",
              "back"
            ],
            "explanation": "Geradeaus means straight ahead."
          },
          {
            "kind": "c",
            "prompt": "How do you ask 'Where is the station?'",
            "options": [
              "Wo ist der Bahnhof?",
              "Wer ist der Bahnhof?",
              "Wie ist der Bahnhof?",
              "Warum ist der Bahnhof?"
            ],
            "correct": "Wo ist der Bahnhof?",
            "explanation": "Wo ist ...? asks where something is."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Go straight ahead'",
            "correct": [
              "Gehen",
              "Sie",
              "geradeaus"
            ],
            "extra": [
              "links",
              "ich"
            ],
            "explanation": "Polite command: Gehen Sie..."
          }
        ]
      },
      {
        "id": "10-3",
        "title": "Hotels",
        "xpReward": 65,
        "intro": {
          "title": "Checking in",
          "body": "Hotel German combines articles, polite requests, and travel nouns.",
          "tip": "🛎️ Ich habe eine Reservierung = I have a reservation."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Hotel",
            "english": "hotel",
            "wrong": [
              "station",
              "ticket",
              "room"
            ],
            "explanation": "Hotel means hotel."
          },
          {
            "kind": "v",
            "german": "Zimmer",
            "english": "room",
            "wrong": [
              "key",
              "bed",
              "door"
            ],
            "explanation": "Zimmer also means hotel room."
          },
          {
            "kind": "v",
            "german": "Schlüssel",
            "english": "key",
            "wrong": [
              "bed",
              "window",
              "bill"
            ],
            "explanation": "Schlüssel means key."
          },
          {
            "kind": "f",
            "german": "Ich habe eine ___.",
            "english": "I have a reservation.",
            "blank": "Reservierung",
            "options": [
              "Reservierung",
              "Fahrkarte",
              "Rechnung",
              "Straße"
            ],
            "explanation": "Reservierung means reservation."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I need a room'",
            "correct": [
              "Ich",
              "brauche",
              "ein",
              "Zimmer"
            ],
            "extra": [
              "habe",
              "Ticket"
            ],
            "explanation": "Brauchen means to need."
          }
        ]
      },
      {
        "id": "10-4",
        "title": "Places in Town",
        "xpReward": 65,
        "intro": {
          "title": "City nouns",
          "body": "A city map gives lots of concrete nouns and useful dative/accusative prep later.",
          "tip": "🏙️ Learn places with articles: die Apotheke, der Park, das Museum."
        },
        "entries": [
          {
            "kind": "a",
            "noun": "Park",
            "english": "park",
            "article": "der",
            "explanation": "It is der Park."
          },
          {
            "kind": "a",
            "noun": "Apotheke",
            "english": "pharmacy",
            "article": "die",
            "explanation": "Words ending in -e are often feminine."
          },
          {
            "kind": "a",
            "noun": "Museum",
            "english": "museum",
            "article": "das",
            "explanation": "It is das Museum."
          },
          {
            "kind": "v",
            "german": "Straße",
            "english": "street",
            "wrong": [
              "city",
              "station",
              "ticket"
            ],
            "explanation": "Straße means street."
          },
          {
            "kind": "f",
            "german": "Die Apotheke ist ___ links.",
            "english": "The pharmacy is on the left.",
            "blank": "links",
            "options": [
              "links",
              "rechts",
              "morgen",
              "teuer"
            ],
            "explanation": "Links and rechts are direction words."
          }
        ]
      }
    ]
  },
  {
    "id": 11,
    "title": "Shopping, Money & Dates",
    "icon": "🛒",
    "color": "#F76707",
    "description": "Ask prices, buy things, understand dates, and handle basic store interactions.",
    "lessons": [
      {
        "id": "11-1",
        "title": "Store Phrases",
        "xpReward": 60,
        "intro": {
          "title": "Im Geschäft",
          "body": "Shopping lessons teach question forms, prices, and polite interaction.",
          "tip": "💶 Was kostet das? = How much does that cost?"
        },
        "entries": [
          {
            "kind": "v",
            "german": "kaufen",
            "english": "to buy",
            "wrong": [
              "to sell",
              "to eat",
              "to open"
            ],
            "explanation": "Kaufen means to buy."
          },
          {
            "kind": "v",
            "german": "verkaufen",
            "english": "to sell",
            "wrong": [
              "to buy",
              "to drink",
              "to read"
            ],
            "explanation": "Verkaufen means to sell."
          },
          {
            "kind": "c",
            "prompt": "How do you ask 'How much does that cost?'",
            "options": [
              "Was kostet das?",
              "Wo ist das?",
              "Wer ist das?",
              "Wie heißt das?"
            ],
            "correct": "Was kostet das?",
            "explanation": "Kosten means to cost."
          },
          {
            "kind": "f",
            "german": "Ich möchte das ___.",
            "english": "I would like to buy that.",
            "blank": "kaufen",
            "options": [
              "kaufen",
              "essen",
              "trinken",
              "schlafen"
            ],
            "explanation": "Ich möchte ... kaufen."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I buy bread'",
            "correct": [
              "Ich",
              "kaufe",
              "Brot"
            ],
            "extra": [
              "verkaufe",
              "Wasser"
            ],
            "explanation": "Ich kaufe Brot."
          }
        ]
      },
      {
        "id": "11-2",
        "title": "Prices",
        "xpReward": 60,
        "intro": {
          "title": "Numbers with money",
          "body": "Teachers practice prices to reinforce numbers in a realistic setting.",
          "tip": "🪙 Euro stays mostly the same in singular/plural when naming prices."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Euro",
            "english": "euro",
            "wrong": [
              "dollar",
              "ticket",
              "number"
            ],
            "explanation": "Euro is the currency word."
          },
          {
            "kind": "v",
            "german": "Cent",
            "english": "cent",
            "wrong": [
              "bill",
              "coin",
              "street"
            ],
            "explanation": "Cent is used in prices."
          },
          {
            "kind": "v",
            "german": "teuer",
            "english": "expensive",
            "wrong": [
              "cheap",
              "free",
              "small"
            ],
            "explanation": "Teuer means expensive."
          },
          {
            "kind": "v",
            "german": "billig",
            "english": "cheap",
            "wrong": [
              "expensive",
              "new",
              "clean"
            ],
            "explanation": "Billig means cheap, sometimes low-quality."
          },
          {
            "kind": "f",
            "german": "Das kostet fünf ___.",
            "english": "That costs five euros.",
            "blank": "Euro",
            "options": [
              "Euro",
              "Cent",
              "Uhr",
              "Jahre"
            ],
            "explanation": "Prices use kostet."
          }
        ]
      },
      {
        "id": "11-3",
        "title": "Clothes",
        "xpReward": 65,
        "intro": {
          "title": "Things to buy",
          "body": "Clothing gives article practice and real shopping nouns.",
          "tip": "👕 Clothing words have mixed genders: der Mantel, die Hose, das Hemd."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Hemd",
            "english": "shirt",
            "wrong": [
              "pants",
              "coat",
              "shoe"
            ],
            "explanation": "Hemd means shirt."
          },
          {
            "kind": "v",
            "german": "Hose",
            "english": "pants",
            "wrong": [
              "shirt",
              "shoe",
              "hat"
            ],
            "explanation": "Hose means pants/trousers."
          },
          {
            "kind": "v",
            "german": "Schuhe",
            "english": "shoes",
            "wrong": [
              "shirt",
              "pants",
              "gloves"
            ],
            "explanation": "Schuhe means shoes."
          },
          {
            "kind": "a",
            "noun": "Mantel",
            "english": "coat",
            "article": "der",
            "explanation": "It is der Mantel."
          },
          {
            "kind": "f",
            "german": "Die Schuhe sind zu ___.",
            "english": "The shoes are too expensive.",
            "blank": "teuer",
            "options": [
              "teuer",
              "billig",
              "klein",
              "blau"
            ],
            "explanation": "Zu teuer = too expensive."
          }
        ]
      },
      {
        "id": "11-4",
        "title": "Days & Dates",
        "xpReward": 65,
        "intro": {
          "title": "Calendar basics",
          "body": "Dates are practical for appointments, deliveries, and school scheduling.",
          "tip": "📅 Montag, Dienstag, Mittwoch... weekdays are masculine: der Montag."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Montag",
            "english": "Monday",
            "wrong": [
              "Tuesday",
              "Sunday",
              "Friday"
            ],
            "explanation": "Montag means Monday."
          },
          {
            "kind": "v",
            "german": "Dienstag",
            "english": "Tuesday",
            "wrong": [
              "Thursday",
              "Monday",
              "Saturday"
            ],
            "explanation": "Dienstag means Tuesday."
          },
          {
            "kind": "v",
            "german": "Wochenende",
            "english": "weekend",
            "wrong": [
              "weekday",
              "month",
              "year"
            ],
            "explanation": "Wochenende means weekend."
          },
          {
            "kind": "c",
            "prompt": "What does 'heute ist Montag' mean?",
            "options": [
              "Today is Monday",
              "Tomorrow is Monday",
              "Monday is expensive",
              "I am Monday"
            ],
            "correct": "Today is Monday",
            "explanation": "Heute ist... = today is..."
          },
          {
            "kind": "b",
            "prompt": "Build: 'See you on Friday'",
            "correct": [
              "Bis",
              "Freitag"
            ],
            "extra": [
              "Hallo",
              "Montag"
            ],
            "explanation": "Bis Freitag = see you Friday."
          }
        ]
      }
    ]
  },
  {
    "id": 12,
    "title": "Cases: Accusative & Dative",
    "icon": "🏰",
    "color": "#7950F2",
    "description": "Start using German cases for objects, people, and locations.",
    "lessons": [
      {
        "id": "12-1",
        "title": "Accusative Objects",
        "xpReward": 70,
        "intro": {
          "title": "Direct objects",
          "body": "Schools introduce accusative after basic sentence confidence. Masculine article changes are the big thing.",
          "tip": "🎯 der → den in masculine accusative. Die and das stay the same."
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "What happens to 'der Hund' as a direct object?",
            "options": [
              "den Hund",
              "der Hund",
              "dem Hund",
              "die Hund"
            ],
            "correct": "den Hund",
            "explanation": "Masculine accusative changes der to den."
          },
          {
            "kind": "f",
            "german": "Ich sehe ___ Mann.",
            "english": "I see the man.",
            "blank": "den",
            "options": [
              "den",
              "der",
              "dem",
              "das"
            ],
            "explanation": "Mann is masculine direct object: den Mann."
          },
          {
            "kind": "f",
            "german": "Ich sehe ___ Frau.",
            "english": "I see the woman.",
            "blank": "die",
            "options": [
              "die",
              "der",
              "den",
              "dem"
            ],
            "explanation": "Feminine accusative stays die."
          },
          {
            "kind": "f",
            "german": "Ich sehe ___ Kind.",
            "english": "I see the child.",
            "blank": "das",
            "options": [
              "das",
              "den",
              "dem",
              "die"
            ],
            "explanation": "Neuter accusative stays das."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I have the book'",
            "correct": [
              "Ich",
              "habe",
              "das",
              "Buch"
            ],
            "extra": [
              "dem",
              "bin"
            ],
            "explanation": "Buch is neuter: das Buch."
          }
        ]
      },
      {
        "id": "12-2",
        "title": "Ein Words in Accusative",
        "xpReward": 70,
        "intro": {
          "title": "A dog, a cat, a book",
          "body": "Ein-word changes mirror article changes, especially masculine einen.",
          "tip": "🧠 ein Hund → einen Hund when it is the object."
        },
        "entries": [
          {
            "kind": "f",
            "german": "Ich habe ___ Hund.",
            "english": "I have a dog.",
            "blank": "einen",
            "options": [
              "einen",
              "ein",
              "eine",
              "einem"
            ],
            "explanation": "Masculine accusative: einen Hund."
          },
          {
            "kind": "f",
            "german": "Ich habe ___ Katze.",
            "english": "I have a cat.",
            "blank": "eine",
            "options": [
              "eine",
              "einen",
              "ein",
              "einem"
            ],
            "explanation": "Feminine accusative: eine Katze."
          },
          {
            "kind": "f",
            "german": "Ich habe ___ Auto.",
            "english": "I have a car.",
            "blank": "ein",
            "options": [
              "ein",
              "eine",
              "einen",
              "einem"
            ],
            "explanation": "Neuter accusative: ein Auto."
          },
          {
            "kind": "c",
            "prompt": "Which means 'I drink a coffee'?",
            "options": [
              "Ich trinke einen Kaffee.",
              "Ich trinke ein Kaffee.",
              "Ich trinke eine Kaffee.",
              "Ich trinke dem Kaffee."
            ],
            "correct": "Ich trinke einen Kaffee.",
            "explanation": "Kaffee is masculine: einen Kaffee."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I buy a ticket'",
            "correct": [
              "Ich",
              "kaufe",
              "eine",
              "Fahrkarte"
            ],
            "extra": [
              "einen",
              "dem"
            ],
            "explanation": "Fahrkarte is feminine: eine Fahrkarte."
          }
        ]
      },
      {
        "id": "12-3",
        "title": "Dative Basics",
        "xpReward": 75,
        "intro": {
          "title": "Indirect objects and locations",
          "body": "Dative is used after many location phrases and for indirect objects.",
          "tip": "📍 in dem = im; an dem = am."
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "Which article is masculine/neuter dative?",
            "options": [
              "dem",
              "den",
              "der",
              "das"
            ],
            "correct": "dem",
            "explanation": "Der/das become dem in dative."
          },
          {
            "kind": "f",
            "german": "Ich bin in ___ Schule.",
            "english": "I am in the school.",
            "blank": "der",
            "options": [
              "der",
              "die",
              "den",
              "dem"
            ],
            "explanation": "Schule is feminine; dative feminine is der."
          },
          {
            "kind": "f",
            "german": "Ich bin im ___.",
            "english": "I am in the house.",
            "blank": "Haus",
            "options": [
              "Haus",
              "Hause",
              "Häuser",
              "Hund"
            ],
            "explanation": "Im = in dem; das Haus becomes dem Haus."
          },
          {
            "kind": "c",
            "prompt": "What does 'mit dem Bus' mean?",
            "options": [
              "by bus / with the bus",
              "without the bus",
              "to the bus",
              "from the bus"
            ],
            "correct": "by bus / with the bus",
            "explanation": "Mit always takes dative."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I go with the friend'",
            "correct": [
              "Ich",
              "gehe",
              "mit",
              "dem",
              "Freund"
            ],
            "extra": [
              "den",
              "der"
            ],
            "explanation": "Mit takes dative: dem Freund."
          }
        ]
      },
      {
        "id": "12-4",
        "title": "Case Contrast",
        "xpReward": 75,
        "intro": {
          "title": "Seeing vs being",
          "body": "A classroom trick: accusative often answers where to/what object; dative often answers where at.",
          "tip": "🚪 Ich gehe in das Haus. Ich bin in dem Haus."
        },
        "entries": [
          {
            "kind": "f",
            "german": "Ich gehe in ___ Park.",
            "english": "I am going into the park.",
            "blank": "den",
            "options": [
              "den",
              "dem",
              "der",
              "das"
            ],
            "explanation": "Motion into masculine place uses accusative: den Park."
          },
          {
            "kind": "f",
            "german": "Ich bin in ___ Park.",
            "english": "I am in the park.",
            "blank": "dem",
            "options": [
              "dem",
              "den",
              "der",
              "das"
            ],
            "explanation": "Location in masculine place uses dative: dem Park."
          },
          {
            "kind": "c",
            "prompt": "Which means 'I see the dog'?",
            "options": [
              "Ich sehe den Hund.",
              "Ich sehe dem Hund.",
              "Ich sehe der Hund.",
              "Ich sehe das Hund."
            ],
            "correct": "Ich sehe den Hund.",
            "explanation": "Sehen takes a direct object: accusative."
          },
          {
            "kind": "c",
            "prompt": "Which means 'I help the man'?",
            "options": [
              "Ich helfe dem Mann.",
              "Ich helfe den Mann.",
              "Ich helfe der Mann.",
              "Ich helfe das Mann."
            ],
            "correct": "Ich helfe dem Mann.",
            "explanation": "Helfen takes dative."
          },
          {
            "kind": "b",
            "prompt": "Build: 'The book is on the table'",
            "correct": [
              "Das",
              "Buch",
              "ist",
              "auf",
              "dem",
              "Tisch"
            ],
            "extra": [
              "den",
              "geht"
            ],
            "explanation": "Location uses dative: auf dem Tisch."
          }
        ]
      }
    ]
  },
  {
    "id": 13,
    "title": "Modal Verbs & Plans",
    "icon": "🧭",
    "color": "#228BE6",
    "description": "Use can, must, want, should, and make plans with infinitives.",
    "lessons": [
      {
        "id": "13-1",
        "title": "Können",
        "xpReward": 65,
        "intro": {
          "title": "Can / be able to",
          "body": "Modal verbs are taught because they multiply what you can say.",
          "tip": "🧩 Modal + infinitive at end: Ich kann Deutsch sprechen."
        },
        "entries": [
          {
            "kind": "v",
            "german": "können",
            "english": "can / be able to",
            "wrong": [
              "must",
              "want",
              "should"
            ],
            "explanation": "Können means can."
          },
          {
            "kind": "f",
            "german": "Ich ___ Deutsch sprechen.",
            "english": "I can speak German.",
            "blank": "kann",
            "options": [
              "kann",
              "können",
              "kannst",
              "könnt"
            ],
            "explanation": "Ich kann."
          },
          {
            "kind": "f",
            "german": "Du ___ gut kochen.",
            "english": "You can cook well.",
            "blank": "kannst",
            "options": [
              "kannst",
              "kann",
              "können",
              "könnt"
            ],
            "explanation": "Du kannst."
          },
          {
            "kind": "c",
            "prompt": "Where does the second verb go with a modal?",
            "options": [
              "At the end",
              "In the first position",
              "Before the subject",
              "It disappears"
            ],
            "correct": "At the end",
            "explanation": "Modal sentence bracket: kann ... sprechen."
          },
          {
            "kind": "b",
            "prompt": "Build: 'We can learn German'",
            "correct": [
              "Wir",
              "können",
              "Deutsch",
              "lernen"
            ],
            "extra": [
              "kann",
              "lerne"
            ],
            "explanation": "Wir können ... lernen."
          }
        ]
      },
      {
        "id": "13-2",
        "title": "Müssen",
        "xpReward": 65,
        "intro": {
          "title": "Must / have to",
          "body": "Müssen helps express obligations and study goals.",
          "tip": "📌 Ich muss lernen = I have to study."
        },
        "entries": [
          {
            "kind": "v",
            "german": "müssen",
            "english": "must / have to",
            "wrong": [
              "can",
              "want",
              "like"
            ],
            "explanation": "Müssen means must."
          },
          {
            "kind": "f",
            "german": "Ich ___ arbeiten.",
            "english": "I have to work.",
            "blank": "muss",
            "options": [
              "muss",
              "musst",
              "müssen",
              "müsst"
            ],
            "explanation": "Ich muss."
          },
          {
            "kind": "f",
            "german": "Wir ___ gehen.",
            "english": "We have to go.",
            "blank": "müssen",
            "options": [
              "müssen",
              "muss",
              "musst",
              "müsst"
            ],
            "explanation": "Wir müssen."
          },
          {
            "kind": "c",
            "prompt": "Which means 'You have to sleep'?",
            "options": [
              "Du musst schlafen.",
              "Du muss schlafen.",
              "Du schlafen musst.",
              "Du bist schlafen."
            ],
            "correct": "Du musst schlafen.",
            "explanation": "Du musst + infinitive."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I have to buy bread'",
            "correct": [
              "Ich",
              "muss",
              "Brot",
              "kaufen"
            ],
            "extra": [
              "kaufe",
              "bin"
            ],
            "explanation": "Infinitive goes at the end."
          }
        ]
      },
      {
        "id": "13-3",
        "title": "Wollen & Sollen",
        "xpReward": 70,
        "intro": {
          "title": "Want and should",
          "body": "These modals are key for plans, advice, and goals.",
          "tip": "🎯 Ich will = I want. Ich soll = I should / am supposed to."
        },
        "entries": [
          {
            "kind": "v",
            "german": "wollen",
            "english": "to want",
            "wrong": [
              "to can",
              "to must",
              "to have"
            ],
            "explanation": "Wollen means to want."
          },
          {
            "kind": "v",
            "german": "sollen",
            "english": "should / supposed to",
            "wrong": [
              "can",
              "like",
              "buy"
            ],
            "explanation": "Sollen means should/supposed to."
          },
          {
            "kind": "f",
            "german": "Ich ___ nach Berlin fahren.",
            "english": "I want to travel to Berlin.",
            "blank": "will",
            "options": [
              "will",
              "wollen",
              "soll",
              "kann"
            ],
            "explanation": "Ich will."
          },
          {
            "kind": "f",
            "german": "Du ___ mehr üben.",
            "english": "You should practice more.",
            "blank": "sollst",
            "options": [
              "sollst",
              "soll",
              "sollen",
              "will"
            ],
            "explanation": "Du sollst."
          },
          {
            "kind": "b",
            "prompt": "Build: 'She wants to drink water'",
            "correct": [
              "Sie",
              "will",
              "Wasser",
              "trinken"
            ],
            "extra": [
              "trinkt",
              "muss"
            ],
            "explanation": "Modal + infinitive at the end."
          }
        ]
      },
      {
        "id": "13-4",
        "title": "Making Plans",
        "xpReward": 70,
        "intro": {
          "title": "Plans use modals and future words",
          "body": "Tutors often practice planning weekends because it combines time, verbs, and modal structures.",
          "tip": "📅 Morgen will ich... = Tomorrow I want to..."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Plan",
            "english": "plan",
            "wrong": [
              "problem",
              "price",
              "place"
            ],
            "explanation": "Plan means plan."
          },
          {
            "kind": "v",
            "german": "später",
            "english": "later",
            "wrong": [
              "yesterday",
              "always",
              "never"
            ],
            "explanation": "Später means later."
          },
          {
            "kind": "f",
            "german": "Morgen ___ ich lernen.",
            "english": "Tomorrow I want to study.",
            "blank": "will",
            "options": [
              "will",
              "bin",
              "habe",
              "lerne"
            ],
            "explanation": "Time first, verb second: Morgen will ich..."
          },
          {
            "kind": "c",
            "prompt": "Which sentence is correct?",
            "options": [
              "Heute muss ich arbeiten.",
              "Heute ich muss arbeiten.",
              "Heute arbeiten muss ich.",
              "Heute muss arbeiten ich."
            ],
            "correct": "Heute muss ich arbeiten.",
            "explanation": "Verb second after a time word."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Later I can go'",
            "correct": [
              "Später",
              "kann",
              "ich",
              "gehen"
            ],
            "extra": [
              "gehe",
              "du"
            ],
            "explanation": "Später kann ich gehen."
          }
        ]
      }
    ]
  },
  {
    "id": 14,
    "title": "Past Tense & Storytelling",
    "icon": "⏳",
    "color": "#15AABF",
    "description": "Talk about what happened using the conversational perfect tense.",
    "lessons": [
      {
        "id": "14-1",
        "title": "Perfect with Haben",
        "xpReward": 70,
        "intro": {
          "title": "The speaking past",
          "body": "German conversation often uses haben + past participle for the past.",
          "tip": "🔧 gemacht, gelernt, gekauft: ge- + stem + -t for many regular verbs."
        },
        "entries": [
          {
            "kind": "f",
            "german": "Ich habe Deutsch ___.",
            "english": "I learned German.",
            "blank": "gelernt",
            "options": [
              "gelernt",
              "lernen",
              "lerne",
              "lernst"
            ],
            "explanation": "Lernen → gelernt."
          },
          {
            "kind": "f",
            "german": "Wir haben Brot ___.",
            "english": "We bought bread.",
            "blank": "gekauft",
            "options": [
              "gekauft",
              "kaufen",
              "kaufe",
              "kauft"
            ],
            "explanation": "Kaufen → gekauft."
          },
          {
            "kind": "f",
            "german": "Er hat Kaffee ___.",
            "english": "He made coffee.",
            "blank": "gemacht",
            "options": [
              "gemacht",
              "machen",
              "macht",
              "machte"
            ],
            "explanation": "Machen → gemacht."
          },
          {
            "kind": "c",
            "prompt": "Which helper is common for regular past tense?",
            "options": [
              "haben",
              "sein",
              "werden",
              "können"
            ],
            "correct": "haben",
            "explanation": "Most regular verbs use haben."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I bought a ticket'",
            "correct": [
              "Ich",
              "habe",
              "eine",
              "Fahrkarte",
              "gekauft"
            ],
            "extra": [
              "bin",
              "kaufe"
            ],
            "explanation": "Haben + past participle."
          }
        ]
      },
      {
        "id": "14-2",
        "title": "Perfect with Sein",
        "xpReward": 70,
        "intro": {
          "title": "Movement and change",
          "body": "Many movement/change verbs use sein instead of haben.",
          "tip": "🚆 Ich bin gefahren. Ich bin gegangen. Ich bin gekommen."
        },
        "entries": [
          {
            "kind": "f",
            "german": "Ich bin nach Berlin ___.",
            "english": "I traveled to Berlin.",
            "blank": "gefahren",
            "options": [
              "gefahren",
              "fahren",
              "fahre",
              "fährst"
            ],
            "explanation": "Fahren often uses sein in the perfect."
          },
          {
            "kind": "f",
            "german": "Sie ist nach Hause ___.",
            "english": "She went home.",
            "blank": "gegangen",
            "options": [
              "gegangen",
              "gehen",
              "geht",
              "ging"
            ],
            "explanation": "Gehen uses sein."
          },
          {
            "kind": "f",
            "german": "Wir sind spät ___.",
            "english": "We arrived late.",
            "blank": "gekommen",
            "options": [
              "gekommen",
              "kommen",
              "kommt",
              "kam"
            ],
            "explanation": "Kommen uses sein."
          },
          {
            "kind": "c",
            "prompt": "Which sentence is correct?",
            "options": [
              "Ich bin gegangen.",
              "Ich habe gegangen.",
              "Ich gegangen bin.",
              "Ich gehen habe."
            ],
            "correct": "Ich bin gegangen.",
            "explanation": "Gehen uses sein."
          },
          {
            "kind": "b",
            "prompt": "Build: 'He came today'",
            "correct": [
              "Er",
              "ist",
              "heute",
              "gekommen"
            ],
            "extra": [
              "hat",
              "kommt"
            ],
            "explanation": "Kommen uses sein."
          }
        ]
      },
      {
        "id": "14-3",
        "title": "Irregular Participles",
        "xpReward": 75,
        "intro": {
          "title": "Strong verbs",
          "body": "Some common verbs have irregular participles. Tutors teach them through repeated chunks.",
          "tip": "📖 lesen → gelesen, essen → gegessen, trinken → getrunken."
        },
        "entries": [
          {
            "kind": "f",
            "german": "Ich habe das Buch ___.",
            "english": "I read the book.",
            "blank": "gelesen",
            "options": [
              "gelesen",
              "lesen",
              "liest",
              "las"
            ],
            "explanation": "Lesen → gelesen."
          },
          {
            "kind": "f",
            "german": "Du hast Brot ___.",
            "english": "You ate bread.",
            "blank": "gegessen",
            "options": [
              "gegessen",
              "essen",
              "isst",
              "aß"
            ],
            "explanation": "Essen → gegessen."
          },
          {
            "kind": "f",
            "german": "Er hat Wasser ___.",
            "english": "He drank water.",
            "blank": "getrunken",
            "options": [
              "getrunken",
              "trinken",
              "trinkt",
              "trank"
            ],
            "explanation": "Trinken → getrunken."
          },
          {
            "kind": "v",
            "german": "gestern",
            "english": "yesterday",
            "wrong": [
              "today",
              "tomorrow",
              "later"
            ],
            "explanation": "Gestern means yesterday."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Yesterday I ate pizza'",
            "correct": [
              "Gestern",
              "habe",
              "ich",
              "Pizza",
              "gegessen"
            ],
            "extra": [
              "esse",
              "bin"
            ],
            "explanation": "Time first, verb second."
          }
        ]
      },
      {
        "id": "14-4",
        "title": "Mini Stories",
        "xpReward": 75,
        "intro": {
          "title": "From sentences to stories",
          "body": "Real classes slowly combine sentences into short personal narratives.",
          "tip": "📘 Use time words: zuerst, dann, danach, am Ende."
        },
        "entries": [
          {
            "kind": "v",
            "german": "zuerst",
            "english": "first",
            "wrong": [
              "then",
              "finally",
              "never"
            ],
            "explanation": "Zuerst means first."
          },
          {
            "kind": "v",
            "german": "dann",
            "english": "then",
            "wrong": [
              "first",
              "because",
              "although"
            ],
            "explanation": "Dann means then."
          },
          {
            "kind": "v",
            "german": "danach",
            "english": "after that",
            "wrong": [
              "before that",
              "never",
              "maybe"
            ],
            "explanation": "Danach means after that."
          },
          {
            "kind": "c",
            "prompt": "Which means 'First I drank coffee'?",
            "options": [
              "Zuerst habe ich Kaffee getrunken.",
              "Dann Kaffee ich getrunken.",
              "Zuerst ich trinke Kaffee.",
              "Ich zuerst Kaffee bin."
            ],
            "correct": "Zuerst habe ich Kaffee getrunken.",
            "explanation": "Time word first, helper verb second."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Then I went home'",
            "correct": [
              "Dann",
              "bin",
              "ich",
              "nach",
              "Hause",
              "gegangen"
            ],
            "extra": [
              "habe",
              "gehe"
            ],
            "explanation": "Gehen uses sein in the perfect."
          }
        ]
      }
    ]
  },
  {
    "id": 15,
    "title": "Future, Goals & Invitations",
    "icon": "🎯",
    "color": "#12B886",
    "description": "Make plans, invite people, accept/decline, and talk about goals.",
    "lessons": [
      {
        "id": "15-1",
        "title": "Talking Future",
        "xpReward": 65,
        "intro": {
          "title": "Future without fear",
          "body": "German often uses present tense + future time words for near-future plans.",
          "tip": "📅 Morgen gehe ich... = Tomorrow I am going..."
        },
        "entries": [
          {
            "kind": "v",
            "german": "morgen",
            "english": "tomorrow",
            "wrong": [
              "yesterday",
              "today",
              "always"
            ],
            "explanation": "Morgen can mean tomorrow."
          },
          {
            "kind": "v",
            "german": "nächste Woche",
            "english": "next week",
            "wrong": [
              "last week",
              "today",
              "this morning"
            ],
            "explanation": "Nächste Woche means next week."
          },
          {
            "kind": "f",
            "german": "Morgen ___ ich nach Berlin.",
            "english": "Tomorrow I go/am going to Berlin.",
            "blank": "gehe",
            "options": [
              "gehe",
              "ging",
              "gegangen",
              "gehen"
            ],
            "explanation": "Present tense can express future with a time word."
          },
          {
            "kind": "c",
            "prompt": "Which is natural German for 'Tomorrow I work'?",
            "options": [
              "Morgen arbeite ich.",
              "Morgen ich arbeite.",
              "Ich morgen arbeite.",
              "Arbeite morgen ich."
            ],
            "correct": "Morgen arbeite ich.",
            "explanation": "Verb second after time word."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Next week I learn German'",
            "correct": [
              "Nächste",
              "Woche",
              "lerne",
              "ich",
              "Deutsch"
            ],
            "extra": [
              "lernst",
              "du"
            ],
            "explanation": "Nächste Woche lerne ich Deutsch."
          }
        ]
      },
      {
        "id": "15-2",
        "title": "Werden Future",
        "xpReward": 70,
        "intro": {
          "title": "Formal future",
          "body": "Werden + infinitive is the explicit future form, useful for predictions and formal statements.",
          "tip": "🔮 Ich werde Deutsch lernen = I will learn German."
        },
        "entries": [
          {
            "kind": "v",
            "german": "werden",
            "english": "will / become",
            "wrong": [
              "have",
              "be",
              "can"
            ],
            "explanation": "Werden can form the future."
          },
          {
            "kind": "f",
            "german": "Ich ___ Deutsch lernen.",
            "english": "I will learn German.",
            "blank": "werde",
            "options": [
              "werde",
              "wirst",
              "wird",
              "werden"
            ],
            "explanation": "Ich werde."
          },
          {
            "kind": "f",
            "german": "Er ___ kommen.",
            "english": "He will come.",
            "blank": "wird",
            "options": [
              "wird",
              "werde",
              "wirst",
              "werden"
            ],
            "explanation": "Er wird."
          },
          {
            "kind": "c",
            "prompt": "Where does the action verb go with werden future?",
            "options": [
              "At the end",
              "Before the subject",
              "It is removed",
              "Always first"
            ],
            "correct": "At the end",
            "explanation": "Ich werde ... lernen."
          },
          {
            "kind": "b",
            "prompt": "Build: 'We will travel tomorrow'",
            "correct": [
              "Wir",
              "werden",
              "morgen",
              "reisen"
            ],
            "extra": [
              "reisen",
              "sind"
            ],
            "explanation": "Werden + infinitive at the end."
          }
        ]
      },
      {
        "id": "15-3",
        "title": "Invitations",
        "xpReward": 70,
        "intro": {
          "title": "Social German",
          "body": "Inviting and responding turns grammar into interaction, which is how tutors keep it meaningful.",
          "tip": "🙋 Möchtest du...? = Would you like to...?"
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "How do you ask 'Would you like to come?'",
            "options": [
              "Möchtest du kommen?",
              "Willkommen du?",
              "Kommst möchten du?",
              "Du möchtest?"
            ],
            "correct": "Möchtest du kommen?",
            "explanation": "Möchtest du...? is a polite invitation."
          },
          {
            "kind": "v",
            "german": "einladen",
            "english": "to invite",
            "wrong": [
              "to arrive",
              "to buy",
              "to answer"
            ],
            "explanation": "Einladen means to invite."
          },
          {
            "kind": "f",
            "german": "Ich lade dich ___.",
            "english": "I invite you.",
            "blank": "ein",
            "options": [
              "ein",
              "aus",
              "auf",
              "mit"
            ],
            "explanation": "Einladen is separable: ich lade ... ein."
          },
          {
            "kind": "c",
            "prompt": "How do you accept casually?",
            "options": [
              "Ja, gern!",
              "Nein, danke.",
              "Vielleicht nicht.",
              "Ich muss gehen."
            ],
            "correct": "Ja, gern!",
            "explanation": "Ja, gern = yes, gladly."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Do you want to eat pizza?'",
            "correct": [
              "Willst",
              "du",
              "Pizza",
              "essen"
            ],
            "extra": [
              "ich",
              "isst"
            ],
            "explanation": "Willst du ... essen?"
          }
        ]
      },
      {
        "id": "15-4",
        "title": "Goals",
        "xpReward": 70,
        "intro": {
          "title": "Long-term motivation",
          "body": "Goal language connects learning with personal reasons, just like tutors ask why you study.",
          "tip": "🏁 Ziel = goal. Ich möchte fließend sprechen."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Ziel",
            "english": "goal",
            "wrong": [
              "time",
              "mistake",
              "ticket"
            ],
            "explanation": "Ziel means goal."
          },
          {
            "kind": "v",
            "german": "üben",
            "english": "to practice",
            "wrong": [
              "to forget",
              "to sleep",
              "to cost"
            ],
            "explanation": "Üben means to practice."
          },
          {
            "kind": "f",
            "german": "Ich möchte jeden Tag ___.",
            "english": "I would like to practice every day.",
            "blank": "üben",
            "options": [
              "üben",
              "schlafen",
              "kosten",
              "sein"
            ],
            "explanation": "Ich möchte + infinitive."
          },
          {
            "kind": "c",
            "prompt": "What does 'fließend' mean for a language?",
            "options": [
              "fluent",
              "expensive",
              "late",
              "empty"
            ],
            "correct": "fluent",
            "explanation": "Fließend sprechen = speak fluently."
          },
          {
            "kind": "b",
            "prompt": "Build: 'My goal is German'",
            "correct": [
              "Mein",
              "Ziel",
              "ist",
              "Deutsch"
            ],
            "extra": [
              "meine",
              "bin"
            ],
            "explanation": "Mein Ziel ist Deutsch."
          }
        ]
      }
    ]
  },
  {
    "id": 16,
    "title": "Opinions, Reasons & Subordinate Clauses",
    "icon": "💬",
    "color": "#364FC7",
    "description": "Explain what you think, why you think it, and connect ideas with weil/obwohl/dass.",
    "lessons": [
      {
        "id": "16-1",
        "title": "Opinions",
        "xpReward": 75,
        "intro": {
          "title": "Sound like yourself",
          "body": "Opinion phrases make German personal and prepare learners for longer speaking tasks.",
          "tip": "💬 Ich finde... = I think/find..."
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "How do you say 'I think that is good'?",
            "options": [
              "Ich finde das gut.",
              "Ich bin das gut.",
              "Ich habe das gut.",
              "Ich gehe das gut."
            ],
            "correct": "Ich finde das gut.",
            "explanation": "Ich finde... is a natural opinion phrase."
          },
          {
            "kind": "v",
            "german": "Meinung",
            "english": "opinion",
            "wrong": [
              "meal",
              "morning",
              "mistake"
            ],
            "explanation": "Meinung means opinion."
          },
          {
            "kind": "c",
            "prompt": "What does 'Meiner Meinung nach' mean?",
            "options": [
              "In my opinion",
              "After my meal",
              "At my house",
              "With my friend"
            ],
            "correct": "In my opinion",
            "explanation": "A common opinion starter."
          },
          {
            "kind": "f",
            "german": "Ich finde Deutsch ___.",
            "english": "I think German is interesting.",
            "blank": "interessant",
            "options": [
              "interessant",
              "teuer",
              "links",
              "gestern"
            ],
            "explanation": "Ich finde + object/adjective."
          },
          {
            "kind": "b",
            "prompt": "Build: 'In my opinion German is fun'",
            "correct": [
              "Meiner",
              "Meinung",
              "nach",
              "ist",
              "Deutsch",
              "lustig"
            ],
            "extra": [
              "weil",
              "aber"
            ],
            "explanation": "Meiner Meinung nach... causes verb-second order after the phrase."
          }
        ]
      },
      {
        "id": "16-2",
        "title": "Weil",
        "xpReward": 75,
        "intro": {
          "title": "Because",
          "body": "Weil introduces a subordinate clause and sends the verb to the end.",
          "tip": "🧠 Ich lerne Deutsch, weil es nützlich ist."
        },
        "entries": [
          {
            "kind": "v",
            "german": "weil",
            "english": "because",
            "wrong": [
              "although",
              "but",
              "or"
            ],
            "explanation": "Weil means because."
          },
          {
            "kind": "f",
            "german": "Ich lerne Deutsch, ___ es Spaß macht.",
            "english": "I learn German because it is fun.",
            "blank": "weil",
            "options": [
              "weil",
              "aber",
              "und",
              "oder"
            ],
            "explanation": "Weil introduces a reason."
          },
          {
            "kind": "c",
            "prompt": "Where does the verb go after weil?",
            "options": [
              "To the end",
              "Always first",
              "It disappears",
              "Before weil"
            ],
            "correct": "To the end",
            "explanation": "Weil sends the conjugated verb to the end."
          },
          {
            "kind": "c",
            "prompt": "Which is correct?",
            "options": [
              "weil ich müde bin",
              "weil ich bin müde",
              "weil bin ich müde",
              "weil müde ich bin"
            ],
            "correct": "weil ich müde bin",
            "explanation": "Verb at the end: bin."
          },
          {
            "kind": "b",
            "prompt": "Build: 'because I have time'",
            "correct": [
              "weil",
              "ich",
              "Zeit",
              "habe"
            ],
            "extra": [
              "bin",
              "nicht"
            ],
            "explanation": "Verb at the end in subordinate clauses."
          }
        ]
      },
      {
        "id": "16-3",
        "title": "Dass",
        "xpReward": 80,
        "intro": {
          "title": "That clauses",
          "body": "Dass is common for thoughts, hopes, and statements.",
          "tip": "💭 Ich denke, dass Deutsch schön ist."
        },
        "entries": [
          {
            "kind": "v",
            "german": "dass",
            "english": "that",
            "wrong": [
              "because",
              "although",
              "when"
            ],
            "explanation": "Dass introduces a that-clause."
          },
          {
            "kind": "c",
            "prompt": "Which is correct?",
            "options": [
              "Ich denke, dass es gut ist.",
              "Ich denke, dass es ist gut.",
              "Ich denke, es dass gut ist.",
              "Ich denke, dass gut ist es."
            ],
            "correct": "Ich denke, dass es gut ist.",
            "explanation": "Verb at the end after dass."
          },
          {
            "kind": "f",
            "german": "Ich hoffe, ___ du kommst.",
            "english": "I hope that you are coming.",
            "blank": "dass",
            "options": [
              "dass",
              "weil",
              "aber",
              "oder"
            ],
            "explanation": "Ich hoffe, dass..."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I know that he is here'",
            "correct": [
              "Ich",
              "weiß",
              "dass",
              "er",
              "hier",
              "ist"
            ],
            "extra": [
              "bin",
              "weil"
            ],
            "explanation": "Dass sends ist to the end."
          },
          {
            "kind": "c",
            "prompt": "What does 'Ich glaube' mean?",
            "options": [
              "I believe / think",
              "I buy",
              "I need",
              "I travel"
            ],
            "correct": "I believe / think",
            "explanation": "Glauben often introduces dass clauses."
          }
        ]
      },
      {
        "id": "16-4",
        "title": "Obwohl & Trotzdem",
        "xpReward": 80,
        "intro": {
          "title": "Contrast",
          "body": "Intermediate lessons add contrast to make speech more natural.",
          "tip": "⚖️ obwohl = although; trotzdem = nevertheless."
        },
        "entries": [
          {
            "kind": "v",
            "german": "obwohl",
            "english": "although",
            "wrong": [
              "because",
              "therefore",
              "never"
            ],
            "explanation": "Obwohl means although."
          },
          {
            "kind": "v",
            "german": "trotzdem",
            "english": "nevertheless",
            "wrong": [
              "because",
              "where",
              "always"
            ],
            "explanation": "Trotzdem means nevertheless/still."
          },
          {
            "kind": "c",
            "prompt": "Which is correct after obwohl?",
            "options": [
              "obwohl es regnet",
              "obwohl regnet es",
              "obwohl es regnet ist",
              "obwohl es ist regnet"
            ],
            "correct": "obwohl es regnet",
            "explanation": "Verb goes to the end if there is a finite verb; here regnet is at end of short clause."
          },
          {
            "kind": "f",
            "german": "Es regnet. ___ gehe ich spazieren.",
            "english": "It is raining. Nevertheless I go for a walk.",
            "blank": "Trotzdem",
            "options": [
              "Trotzdem",
              "Weil",
              "Dass",
              "Oder"
            ],
            "explanation": "Trotzdem starts a main clause, verb second after it."
          },
          {
            "kind": "b",
            "prompt": "Build: 'although I am tired'",
            "correct": [
              "obwohl",
              "ich",
              "müde",
              "bin"
            ],
            "extra": [
              "aber",
              "ist"
            ],
            "explanation": "Obwohl sends bin to the end."
          }
        ]
      }
    ]
  },
  {
    "id": 17,
    "title": "School, Work & Appointments",
    "icon": "🎒",
    "color": "#868E96",
    "description": "Handle school/work vocabulary, jobs, schedules, and simple appointments.",
    "lessons": [
      {
        "id": "17-1",
        "title": "School Words",
        "xpReward": 70,
        "intro": {
          "title": "Learning spaces",
          "body": "School vocabulary doubles as app vocabulary and real-life learner language.",
          "tip": "📚 Der Unterricht = class/lesson."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Unterricht",
            "english": "class / lesson",
            "wrong": [
              "teacher",
              "homework",
              "break"
            ],
            "explanation": "Unterricht means class or lesson."
          },
          {
            "kind": "v",
            "german": "Hausaufgaben",
            "english": "homework",
            "wrong": [
              "class",
              "school",
              "book"
            ],
            "explanation": "Hausaufgaben means homework."
          },
          {
            "kind": "v",
            "german": "Lehrer",
            "english": "teacher",
            "wrong": [
              "student",
              "doctor",
              "friend"
            ],
            "explanation": "Lehrer means male teacher/general teacher."
          },
          {
            "kind": "v",
            "german": "Schüler",
            "english": "student / pupil",
            "wrong": [
              "teacher",
              "worker",
              "driver"
            ],
            "explanation": "Schüler means school student."
          },
          {
            "kind": "f",
            "german": "Ich mache meine ___.",
            "english": "I do my homework.",
            "blank": "Hausaufgaben",
            "options": [
              "Hausaufgaben",
              "Schule",
              "Zeit",
              "Freunde"
            ],
            "explanation": "Hausaufgaben is usually plural."
          }
        ]
      },
      {
        "id": "17-2",
        "title": "Work Words",
        "xpReward": 70,
        "intro": {
          "title": "Jobs and workplace",
          "body": "A1 exams and real tutors often ask about profession and workplace.",
          "tip": "💼 For jobs, German often omits ein/eine: Ich bin Lehrer."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Arbeit",
            "english": "work",
            "wrong": [
              "school",
              "home",
              "food"
            ],
            "explanation": "Arbeit means work."
          },
          {
            "kind": "v",
            "german": "Beruf",
            "english": "profession",
            "wrong": [
              "hobby",
              "city",
              "ticket"
            ],
            "explanation": "Beruf means profession/job."
          },
          {
            "kind": "v",
            "german": "Büro",
            "english": "office",
            "wrong": [
              "factory",
              "school",
              "shop"
            ],
            "explanation": "Büro means office."
          },
          {
            "kind": "c",
            "prompt": "How do you say 'I am a teacher' naturally?",
            "options": [
              "Ich bin Lehrer.",
              "Ich bin ein Lehrer always.",
              "Ich habe Lehrer.",
              "Ich arbeite Lehrer."
            ],
            "correct": "Ich bin Lehrer.",
            "explanation": "German often omits ein/eine with professions."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I work in an office'",
            "correct": [
              "Ich",
              "arbeite",
              "in",
              "einem",
              "Büro"
            ],
            "extra": [
              "eine",
              "bin"
            ],
            "explanation": "In einem Büro uses dative."
          }
        ]
      },
      {
        "id": "17-3",
        "title": "Appointments",
        "xpReward": 75,
        "intro": {
          "title": "Making plans formally",
          "body": "Appointment language prepares learners for doctors, schools, offices, and everyday scheduling.",
          "tip": "📅 Termin = appointment."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Termin",
            "english": "appointment",
            "wrong": [
              "ticket",
              "mistake",
              "sentence"
            ],
            "explanation": "Termin means appointment."
          },
          {
            "kind": "v",
            "german": "spät",
            "english": "late",
            "wrong": [
              "early",
              "cheap",
              "tired"
            ],
            "explanation": "Spät means late."
          },
          {
            "kind": "v",
            "german": "früh",
            "english": "early",
            "wrong": [
              "late",
              "expensive",
              "wrong"
            ],
            "explanation": "Früh means early."
          },
          {
            "kind": "c",
            "prompt": "How do you say 'I have an appointment'?",
            "options": [
              "Ich habe einen Termin.",
              "Ich bin einen Termin.",
              "Ich gehe Termin.",
              "Ich mache spät."
            ],
            "correct": "Ich habe einen Termin.",
            "explanation": "Termin is masculine: einen Termin."
          },
          {
            "kind": "f",
            "german": "Der Termin ist um ___ Uhr.",
            "english": "The appointment is at three o'clock.",
            "blank": "drei",
            "options": [
              "drei",
              "spät",
              "früh",
              "Tag"
            ],
            "explanation": "Um drei Uhr = at three o'clock."
          }
        ]
      },
      {
        "id": "17-4",
        "title": "Emails & Messages",
        "xpReward": 75,
        "intro": {
          "title": "Modern communication",
          "body": "Tutors increasingly practice short messages because learners need them in real life.",
          "tip": "✉️ Keep German messages direct and polite."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Nachricht",
            "english": "message",
            "wrong": [
              "appointment",
              "question",
              "answer"
            ],
            "explanation": "Nachricht means message."
          },
          {
            "kind": "v",
            "german": "E-Mail",
            "english": "email",
            "wrong": [
              "letter",
              "book",
              "phone"
            ],
            "explanation": "E-Mail is used in German too."
          },
          {
            "kind": "v",
            "german": "antworten",
            "english": "to answer",
            "wrong": [
              "to ask",
              "to write",
              "to buy"
            ],
            "explanation": "Antworten means to answer/reply."
          },
          {
            "kind": "f",
            "german": "Bitte ___ Sie mir.",
            "english": "Please reply to me.",
            "blank": "antworten",
            "options": [
              "antworten",
              "kaufen",
              "schlafen",
              "essen"
            ],
            "explanation": "Polite command with Sie."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I write an email'",
            "correct": [
              "Ich",
              "schreibe",
              "eine",
              "E-Mail"
            ],
            "extra": [
              "einen",
              "bin"
            ],
            "explanation": "E-Mail is feminine: eine E-Mail."
          }
        ]
      }
    ]
  },
  {
    "id": 18,
    "title": "Health, Feelings & Emergencies",
    "icon": "🏥",
    "color": "#FA5252",
    "description": "Say how you feel, describe problems, and ask for help.",
    "lessons": [
      {
        "id": "18-1",
        "title": "Body & Health",
        "xpReward": 75,
        "intro": {
          "title": "Important survival language",
          "body": "Health vocabulary is practical and high-stakes, so schools introduce key phrases early.",
          "tip": "🆘 Hilfe! = Help!"
        },
        "entries": [
          {
            "kind": "v",
            "german": "Kopf",
            "english": "head",
            "wrong": [
              "hand",
              "foot",
              "back"
            ],
            "explanation": "Kopf means head."
          },
          {
            "kind": "v",
            "german": "Hand",
            "english": "hand",
            "wrong": [
              "head",
              "leg",
              "eye"
            ],
            "explanation": "Hand means hand."
          },
          {
            "kind": "v",
            "german": "Bauch",
            "english": "stomach",
            "wrong": [
              "head",
              "mouth",
              "back"
            ],
            "explanation": "Bauch means stomach/belly."
          },
          {
            "kind": "c",
            "prompt": "What does 'Hilfe!' mean?",
            "options": [
              "Help!",
              "Hello!",
              "Sorry!",
              "Wait!"
            ],
            "correct": "Help!",
            "explanation": "Hilfe means help."
          },
          {
            "kind": "f",
            "german": "Ich habe ___ Kopfschmerzen.",
            "english": "I have a headache.",
            "blank": "Kopfschmerzen",
            "options": [
              "Kopfschmerzen",
              "Kaffee",
              "Zimmer",
              "Fahrkarte"
            ],
            "explanation": "Kopfschmerzen literally head pains."
          }
        ]
      },
      {
        "id": "18-2",
        "title": "Feeling Sick",
        "xpReward": 75,
        "intro": {
          "title": "Symptoms",
          "body": "Doctors and pharmacies require simple direct sentences.",
          "tip": "🤒 Mir ist schlecht = I feel sick/nauseous."
        },
        "entries": [
          {
            "kind": "v",
            "german": "krank",
            "english": "sick / ill",
            "wrong": [
              "healthy",
              "tired",
              "hungry"
            ],
            "explanation": "Krank means sick."
          },
          {
            "kind": "v",
            "german": "gesund",
            "english": "healthy",
            "wrong": [
              "sick",
              "sad",
              "late"
            ],
            "explanation": "Gesund means healthy."
          },
          {
            "kind": "f",
            "german": "Ich bin ___.",
            "english": "I am sick.",
            "blank": "krank",
            "options": [
              "krank",
              "gesund",
              "billig",
              "links"
            ],
            "explanation": "Ich bin krank."
          },
          {
            "kind": "c",
            "prompt": "What does 'Mir ist schlecht' mean?",
            "options": [
              "I feel sick",
              "I am cheap",
              "I am late",
              "I am German"
            ],
            "correct": "I feel sick",
            "explanation": "A common phrase for nausea/unwellness."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I need a doctor'",
            "correct": [
              "Ich",
              "brauche",
              "einen",
              "Arzt"
            ],
            "extra": [
              "eine",
              "bin"
            ],
            "explanation": "Arzt is masculine direct object: einen Arzt."
          }
        ]
      },
      {
        "id": "18-3",
        "title": "Emotions",
        "xpReward": 80,
        "intro": {
          "title": "Feelings in conversation",
          "body": "Emotion words make learner speech more personal and realistic.",
          "tip": "🙂 Ich bin froh = I am glad."
        },
        "entries": [
          {
            "kind": "v",
            "german": "traurig",
            "english": "sad",
            "wrong": [
              "happy",
              "angry",
              "tired"
            ],
            "explanation": "Traurig means sad."
          },
          {
            "kind": "v",
            "german": "wütend",
            "english": "angry",
            "wrong": [
              "happy",
              "sick",
              "small"
            ],
            "explanation": "Wütend means angry."
          },
          {
            "kind": "v",
            "german": "nervös",
            "english": "nervous",
            "wrong": [
              "calm",
              "cheap",
              "early"
            ],
            "explanation": "Nervös means nervous."
          },
          {
            "kind": "f",
            "german": "Ich bin sehr ___.",
            "english": "I am very nervous.",
            "blank": "nervös",
            "options": [
              "nervös",
              "krank",
              "gesund",
              "billig"
            ],
            "explanation": "Sehr means very."
          },
          {
            "kind": "c",
            "prompt": "Which means 'I am happy'?",
            "options": [
              "Ich bin glücklich.",
              "Ich habe glücklich.",
              "Ich gehe glücklich.",
              "Ich mache glücklich."
            ],
            "correct": "Ich bin glücklich.",
            "explanation": "Use sein with emotions."
          }
        ]
      },
      {
        "id": "18-4",
        "title": "Pharmacy & Help",
        "xpReward": 80,
        "intro": {
          "title": "Asking for help",
          "body": "This unit uses polite requests, needs, and health nouns together.",
          "tip": "💊 Apotheke = pharmacy, not apothecary in daily English."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Apotheke",
            "english": "pharmacy",
            "wrong": [
              "hospital",
              "school",
              "station"
            ],
            "explanation": "Apotheke means pharmacy."
          },
          {
            "kind": "v",
            "german": "Medizin",
            "english": "medicine",
            "wrong": [
              "doctor",
              "pain",
              "water"
            ],
            "explanation": "Medizin means medicine."
          },
          {
            "kind": "c",
            "prompt": "How do you ask 'Where is the pharmacy?'",
            "options": [
              "Wo ist die Apotheke?",
              "Wer ist die Apotheke?",
              "Was kostet Apotheke?",
              "Wann Apotheke?"
            ],
            "correct": "Wo ist die Apotheke?",
            "explanation": "Apotheke is feminine."
          },
          {
            "kind": "f",
            "german": "Ich brauche ___.",
            "english": "I need medicine.",
            "blank": "Medizin",
            "options": [
              "Medizin",
              "krank",
              "gesund",
              "Termin"
            ],
            "explanation": "Ich brauche + noun."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Please call a doctor'",
            "correct": [
              "Rufen",
              "Sie",
              "bitte",
              "einen",
              "Arzt"
            ],
            "extra": [
              "eine",
              "Hallo"
            ],
            "explanation": "Polite imperative: Rufen Sie bitte..."
          }
        ]
      }
    ]
  },
  {
    "id": 19,
    "title": "Culture, Slang & Natural German",
    "icon": "🥨",
    "color": "#D9480F",
    "description": "Learn natural phrases, cultural context, and expressions German speakers actually use.",
    "lessons": [
      {
        "id": "19-1",
        "title": "Everyday Reactions",
        "xpReward": 80,
        "intro": {
          "title": "Sound natural",
          "body": "Teachers and tutors add reaction phrases so learners can respond without freezing.",
          "tip": "👍 Genau is everywhere in German conversation."
        },
        "entries": [
          {
            "kind": "v",
            "german": "genau",
            "english": "exactly",
            "wrong": [
              "never",
              "maybe",
              "sorry"
            ],
            "explanation": "Genau means exactly/right."
          },
          {
            "kind": "v",
            "german": "klar",
            "english": "clear / sure",
            "wrong": [
              "dark",
              "late",
              "wrong"
            ],
            "explanation": "Klar can mean sure/of course."
          },
          {
            "kind": "v",
            "german": "stimmt",
            "english": "that's right",
            "wrong": [
              "that's wrong",
              "maybe",
              "never"
            ],
            "explanation": "Stimmt means that's right."
          },
          {
            "kind": "c",
            "prompt": "How do you casually say 'No problem'?",
            "options": [
              "Kein Problem",
              "Nicht Problem",
              "Nein Problem",
              "Ohne Problem"
            ],
            "correct": "Kein Problem",
            "explanation": "Problem is neuter: kein Problem."
          },
          {
            "kind": "f",
            "german": "Ja, ___!",
            "english": "Yes, exactly!",
            "blank": "genau",
            "options": [
              "genau",
              "nein",
              "spät",
              "krank"
            ],
            "explanation": "Ja, genau is a natural response."
          }
        ]
      },
      {
        "id": "19-2",
        "title": "Common Small Talk",
        "xpReward": 80,
        "intro": {
          "title": "Small talk scripts",
          "body": "Real-world learners benefit from memorized scripts they can adapt.",
          "tip": "☔ Weather is boring until it saves a conversation."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Wetter",
            "english": "weather",
            "wrong": [
              "weekend",
              "work",
              "world"
            ],
            "explanation": "Wetter means weather."
          },
          {
            "kind": "v",
            "german": "schön",
            "english": "beautiful / nice",
            "wrong": [
              "ugly",
              "late",
              "sad"
            ],
            "explanation": "Schön can mean beautiful or nice."
          },
          {
            "kind": "v",
            "german": "regnen",
            "english": "to rain",
            "wrong": [
              "to snow",
              "to work",
              "to buy"
            ],
            "explanation": "Regnen means to rain."
          },
          {
            "kind": "f",
            "german": "Das Wetter ist ___.",
            "english": "The weather is nice.",
            "blank": "schön",
            "options": [
              "schön",
              "teuer",
              "krank",
              "links"
            ],
            "explanation": "Das Wetter ist schön."
          },
          {
            "kind": "c",
            "prompt": "What does 'Wie läuft's?' roughly mean?",
            "options": [
              "How's it going?",
              "Where are you running?",
              "What costs it?",
              "Who is there?"
            ],
            "correct": "How's it going?",
            "explanation": "A casual phrase similar to Wie geht's?"
          }
        ]
      },
      {
        "id": "19-3",
        "title": "German Culture Words",
        "xpReward": 85,
        "intro": {
          "title": "Cultural anchors",
          "body": "Culture words make the language feel like a place, not just a flashcard deck.",
          "tip": "🥨 Weihnachtsmarkt = Christmas market."
        },
        "entries": [
          {
            "kind": "v",
            "german": "Brezel",
            "english": "pretzel",
            "wrong": [
              "cake",
              "bread",
              "sausage"
            ],
            "explanation": "Brezel means pretzel."
          },
          {
            "kind": "v",
            "german": "Feierabend",
            "english": "end of the workday",
            "wrong": [
              "holiday",
              "breakfast",
              "homework"
            ],
            "explanation": "Feierabend is the feeling/time after work ends."
          },
          {
            "kind": "v",
            "german": "Weihnachtsmarkt",
            "english": "Christmas market",
            "wrong": [
              "train station",
              "pharmacy",
              "office"
            ],
            "explanation": "Weihnachtsmarkt means Christmas market."
          },
          {
            "kind": "c",
            "prompt": "What does 'Guten Rutsch!' relate to?",
            "options": [
              "New Year",
              "Birthday",
              "Breakfast",
              "Train travel"
            ],
            "correct": "New Year",
            "explanation": "It is a New Year's greeting."
          },
          {
            "kind": "b",
            "prompt": "Build: 'The pretzel is good'",
            "correct": [
              "Die",
              "Brezel",
              "ist",
              "gut"
            ],
            "extra": [
              "der",
              "bin"
            ],
            "explanation": "Brezel is feminine in many standard uses: die Brezel."
          }
        ]
      },
      {
        "id": "19-4",
        "title": "Softening Your German",
        "xpReward": 85,
        "intro": {
          "title": "Polite and natural",
          "body": "Words like mal, bitte, vielleicht soften sentences so you sound less robotic.",
          "tip": "🧊 'Kannst du mal...' is softer than a bare command."
        },
        "entries": [
          {
            "kind": "v",
            "german": "mal",
            "english": "once / just",
            "wrong": [
              "never",
              "always",
              "there"
            ],
            "explanation": "Mal often softens a request."
          },
          {
            "kind": "v",
            "german": "vielleicht",
            "english": "maybe",
            "wrong": [
              "exactly",
              "never",
              "because"
            ],
            "explanation": "Vielleicht means maybe."
          },
          {
            "kind": "c",
            "prompt": "Which is a softer request?",
            "options": [
              "Kannst du mir mal helfen?",
              "Hilf mir!",
              "Du hilfst mir jetzt.",
              "Helfen du mir."
            ],
            "correct": "Kannst du mir mal helfen?",
            "explanation": "Kannst du ...? makes it a request."
          },
          {
            "kind": "f",
            "german": "Kannst du mir ___ helfen?",
            "english": "Can you help me for a moment?",
            "blank": "mal",
            "options": [
              "mal",
              "nie",
              "weil",
              "den"
            ],
            "explanation": "Mal softens the request."
          },
          {
            "kind": "b",
            "prompt": "Build: 'Maybe tomorrow'",
            "correct": [
              "Vielleicht",
              "morgen"
            ],
            "extra": [
              "gestern",
              "weil"
            ],
            "explanation": "Vielleicht morgen = maybe tomorrow."
          }
        ]
      }
    ]
  },
  {
    "id": 20,
    "title": "Fluency Frontier",
    "icon": "🌌",
    "color": "#5C7CFA",
    "description": "Longer sentences, mixed review, and challenge material that can keep growing forever.",
    "lessons": [
      {
        "id": "20-1",
        "title": "Longer Sentence Chains",
        "xpReward": 90,
        "intro": {
          "title": "Beyond one sentence",
          "body": "Intermediate teaching uses chaining: add time, reason, place, and opinion step by step.",
          "tip": "🧱 Build with chunks: Heute + verb + subject + object + place."
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "Which sentence has correct verb-second order?",
            "options": [
              "Heute lerne ich Deutsch im Café.",
              "Heute ich lerne Deutsch im Café.",
              "Heute Deutsch ich lerne im Café.",
              "Heute im Café ich Deutsch lerne."
            ],
            "correct": "Heute lerne ich Deutsch im Café.",
            "explanation": "Verb second after Heute."
          },
          {
            "kind": "f",
            "german": "Am Wochenende ___ ich meine Freunde.",
            "english": "On the weekend I meet my friends.",
            "blank": "treffe",
            "options": [
              "treffe",
              "trifft",
              "treffen",
              "getroffen"
            ],
            "explanation": "Treffen means to meet."
          },
          {
            "kind": "v",
            "german": "deshalb",
            "english": "therefore / that's why",
            "wrong": [
              "although",
              "before",
              "never"
            ],
            "explanation": "Deshalb connects cause to result."
          },
          {
            "kind": "c",
            "prompt": "What happens after 'deshalb' starts a clause?",
            "options": [
              "Verb comes second",
              "Verb goes to the end",
              "Subject must disappear",
              "Sentence becomes a question"
            ],
            "correct": "Verb comes second",
            "explanation": "Deshalb starts a main clause."
          },
          {
            "kind": "b",
            "prompt": "Build: 'That is why I learn German'",
            "correct": [
              "Deshalb",
              "lerne",
              "ich",
              "Deutsch"
            ],
            "extra": [
              "weil",
              "bin"
            ],
            "explanation": "Deshalb + verb second."
          }
        ]
      },
      {
        "id": "20-2",
        "title": "Mixed Case Review",
        "xpReward": 90,
        "intro": {
          "title": "Case agility",
          "body": "A strong learner starts choosing cases by meaning, not memorized isolated phrases.",
          "tip": "🎯 See object? Accusative. Static location? Dative."
        },
        "entries": [
          {
            "kind": "f",
            "german": "Ich sehe ___ Bahnhof.",
            "english": "I see the train station.",
            "blank": "den",
            "options": [
              "den",
              "dem",
              "der",
              "das"
            ],
            "explanation": "Bahnhof is masculine direct object: den."
          },
          {
            "kind": "f",
            "german": "Ich bin an ___ Bahnhof.",
            "english": "I am at the train station.",
            "blank": "dem",
            "options": [
              "dem",
              "den",
              "der",
              "die"
            ],
            "explanation": "Static location: dative dem Bahnhof."
          },
          {
            "kind": "f",
            "german": "Ich helfe ___ Frau.",
            "english": "I help the woman.",
            "blank": "der",
            "options": [
              "der",
              "die",
              "den",
              "das"
            ],
            "explanation": "Helfen takes dative; feminine dative is der."
          },
          {
            "kind": "c",
            "prompt": "Which is correct?",
            "options": [
              "Ich kaufe einen Kaffee.",
              "Ich kaufe ein Kaffee.",
              "Ich kaufe einem Kaffee.",
              "Ich kaufe der Kaffee."
            ],
            "correct": "Ich kaufe einen Kaffee.",
            "explanation": "Kaffee is masculine direct object."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I go with my friend'",
            "correct": [
              "Ich",
              "gehe",
              "mit",
              "meinem",
              "Freund"
            ],
            "extra": [
              "meinen",
              "mein"
            ],
            "explanation": "Mit takes dative: meinem Freund."
          }
        ]
      },
      {
        "id": "20-3",
        "title": "Reading Tiny Texts",
        "xpReward": 95,
        "intro": {
          "title": "Mini reading",
          "body": "Real schools test comprehension with short practical texts, not just single words.",
          "tip": "📖 Read for the main idea first, then details."
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "Text: 'Heute ist Montag. Ich arbeite im Büro.' Where is the person?",
            "options": [
              "At the office",
              "At school",
              "At the station",
              "At home"
            ],
            "correct": "At the office",
            "explanation": "Im Büro means at/in the office."
          },
          {
            "kind": "c",
            "prompt": "Text: 'Der Zug hat Verspätung.' What is the problem?",
            "options": [
              "The train is delayed",
              "The hotel is expensive",
              "The coffee is cold",
              "The shop is closed"
            ],
            "correct": "The train is delayed",
            "explanation": "Verspätung means delay."
          },
          {
            "kind": "c",
            "prompt": "Text: 'Ich bin krank und brauche Medizin.' What does the person need?",
            "options": [
              "Medicine",
              "A ticket",
              "A room",
              "A book"
            ],
            "correct": "Medicine",
            "explanation": "Medizin means medicine."
          },
          {
            "kind": "c",
            "prompt": "Text: 'Morgen fahre ich nach Berlin.' When is the trip?",
            "options": [
              "Tomorrow",
              "Yesterday",
              "Today",
              "Next year"
            ],
            "correct": "Tomorrow",
            "explanation": "Morgen means tomorrow here."
          },
          {
            "kind": "c",
            "prompt": "Text: 'Ich finde Deutsch schwer, aber interessant.' What is the opinion?",
            "options": [
              "German is hard but interesting",
              "German is cheap",
              "German is only boring",
              "German is impossible"
            ],
            "correct": "German is hard but interesting",
            "explanation": "Schwer = hard, interessant = interesting."
          }
        ]
      },
      {
        "id": "20-4",
        "title": "Open-Ended Practice",
        "xpReward": 95,
        "intro": {
          "title": "Toward real fluency",
          "body": "The endgame should keep mixing skills: translation, reading, grammar, and practical scenarios.",
          "tip": "🚀 This unit is designed to expand forever with new challenge lessons later."
        },
        "entries": [
          {
            "kind": "c",
            "prompt": "Choose the most natural sentence.",
            "options": [
              "Ich möchte einen Kaffee, bitte.",
              "Ich bin Kaffee bitte.",
              "Ich möchte eine Kaffee bitte.",
              "Ich Kaffee möchte bitte."
            ],
            "correct": "Ich möchte einen Kaffee, bitte.",
            "explanation": "Polite order with accusative einen Kaffee."
          },
          {
            "kind": "f",
            "german": "Obwohl ich müde bin, ___ ich Deutsch.",
            "english": "Although I am tired, I am learning German.",
            "blank": "lerne",
            "options": [
              "lerne",
              "lernen",
              "gelernt",
              "bin"
            ],
            "explanation": "After the subordinate clause, the main clause begins with the verb."
          },
          {
            "kind": "c",
            "prompt": "Which phrase is best for 'In my opinion'?",
            "options": [
              "Meiner Meinung nach",
              "Meinem Essen nach",
              "Meine Meinung ist nach",
              "Nach ich Meinung"
            ],
            "correct": "Meiner Meinung nach",
            "explanation": "Meiner Meinung nach is a common phrase."
          },
          {
            "kind": "b",
            "prompt": "Build: 'I hope that I can speak fluently'",
            "correct": [
              "Ich",
              "hoffe",
              "dass",
              "ich",
              "fließend",
              "sprechen",
              "kann"
            ],
            "extra": [
              "weil",
              "bin"
            ],
            "explanation": "Dass sends kann to the end."
          },
          {
            "kind": "c",
            "prompt": "What is the best study strategy?",
            "options": [
              "Practice a little every day",
              "Memorize once and stop",
              "Only learn nouns without articles",
              "Avoid making mistakes"
            ],
            "correct": "Practice a little every day",
            "explanation": "Spaced, repeated practice is the whole point of Sprak."
          }
        ]
      }
    ]
  }
];
const UNITS = CURRICULUM_SPECS.map(withReviewAndCheckup);


// Flatten questions with unit/lesson info for quick lookup
const ALL_QUESTIONS = [];
UNITS.forEach(u => u.lessons.forEach(l => l.questions.forEach(q => {
  ALL_QUESTIONS.push({ ...q, unitId: u.id, lessonId: l.id, unitColor: u.color });
})));

const PLACEMENT_QUESTIONS = [
  { id:"p1", type:"mc", prompt:"What does 'Hallo' mean?", options:["Hello","Goodbye","Please","Thank you"], correct:"Hello", explanation:"'Hallo' = Hello. The most basic German greeting." },
  { id:"p2", type:"article", german:"Hund", english:"dog", prompt:"Which article goes with 'Hund' (dog)?", options:["der","die","das"], correct:"der", explanation:"'der Hund' — dog is masculine in German." },
  { id:"p3", type:"fill", german:"Ich ___ müde.", english:"I am tired.", blank:"bin", options:["bin","ist","sind","bist"], explanation:"'Ich bin' = I am. First person of 'sein'." },
  { id:"p4", type:"mc", prompt:"How do you say 'I speak German'?", options:["Ich spreche Deutsch","Ich lerne Deutsch","Ich esse Deutsch","Ich trinke Deutsch"], correct:"Ich spreche Deutsch", explanation:"'Ich spreche Deutsch' = I speak German." },
  { id:"p5", type:"mc", prompt:"What does 'Frühstück' mean?", options:["Lunch","Dinner","Breakfast","Supper"], correct:"Breakfast", explanation:"'Frühstück' = breakfast." },
  { id:"p6", type:"fill", german:"Wir ___ Freunde.", english:"We are friends.", blank:"sind", options:["bin","bist","ist","sind"], explanation:"'Wir sind' = We are." },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function xpForLevel(l) { return l * 100; }
function calcLevel(totalXp) {
  let level = 1, rem = totalXp;
  while (rem >= xpForLevel(level)) { rem -= xpForLevel(level); level++; }
  return { level, xpInLevel: rem, xpNeeded: xpForLevel(level) };
}
function totalXpForLevel(level) {
  let t = 0; for (let l = 1; l < level; l++) t += xpForLevel(l); return t;
}
function getDailyKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function getDailyQuestions() {
  const seed = getDailyKey(); let hash = 0;
  for (const c of seed) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  const pool = [...ALL_QUESTIONS]; const result = []; let h = Math.abs(hash);
  while (result.length < 5 && pool.length > 0) {
    const i = h % pool.length; result.push(pool.splice(i, 1)[0]);
    h = Math.abs(Math.floor(h * 1.6180339));
  }
  return result;
}
function checkAchievements(user) {
  const earned = new Set(user.achievements || []);
  const stats = user.stats || {};
  if ((stats.lessonsCompleted || 0) >= 1) earned.add("first_lesson");
  if ((stats.puzzlesCompleted || 0) >= 1) earned.add("first_puzzle");
  if ((user.streak || 0) >= 3) earned.add("streak_3");
  if ((user.streak || 0) >= 7) earned.add("streak_7");
  if (calcLevel(user.xp || 0).level >= 5) earned.add("level_5");
  if (calcLevel(user.xp || 0).level >= 10) earned.add("level_10");
  if ((stats.totalAnswered || 0) >= 100) earned.add("questions_100");
  if ((stats.perfectLessons || 0) >= 1) earned.add("perfect_lesson");
  return [...earned];
}

function getLocalGameData(uid) { try { return JSON.parse(localStorage.getItem(`sprak_game_${uid}`) || "null"); } catch { return null; } }
function saveLocalGameData(uid, data) { try { localStorage.setItem(`sprak_game_${uid}`, JSON.stringify(data)); } catch {} }
function cleanForFirestore(data) { return JSON.parse(JSON.stringify(data || {})); }
function publicProfileFromData(data) {
  return {
    uid: data.uid,
    username: data.username || "learner",
    usernameLower: (data.username || "learner").toLowerCase(),
    displayName: data.displayName || "Learner",
    displayNameLower: (data.displayName || "Learner").toLowerCase(),
    avatar: data.avatar || "bear",
    xp: data.xp || 0,
    weeklyXp: data.weeklyXp || 0,
    streak: data.streak || 0,
    marks: data.marks || 0,
    achievements: data.achievements || [],
    stats: data.stats || {},
    friends: data.friends || [],
    incomingFriendRequests: data.incomingFriendRequests || [],
    sentFriendRequests: data.sentFriendRequests || [],
    equipped: data.equipped || {},
    inventory: data.inventory || [],
    updatedAt: Date.now(),
  };
}
async function loadCloudGameData(uid) {
  try { const snap = await getDoc(doc(db, "users", uid)); return snap.exists() ? snap.data() : null; }
  catch (err) { console.warn("Cloud load failed:", err); return null; }
}
async function saveCloudGameData(uid, data) {
  try { await setDoc(doc(db, "users", uid), cleanForFirestore({ ...data, ...publicProfileFromData(data), lastCloudSave: Date.now() }), { merge: true }); }
  catch (err) { console.warn("Cloud save failed:", err); }
}
function getGameData(uid) { return getLocalGameData(uid); }
function saveGameData(uid, data) { saveLocalGameData(uid, data); if (uid) saveCloudGameData(uid, data); }
function makeDefaultGameData(uid, extra = {}) {
  const baseName = extra.displayName || "Learner";
  const baseUsername = (extra.username || baseName || "learner").toString().replace(/[^a-zA-Z0-9_]/g, "").slice(0,18) || "learner";
  return { uid, username: baseUsername, displayName: baseName, avatar: "bear", xp: 0, weeklyXp: 0, marks: 250, streak: 0, lastActiveDate: null,
    friends: [], incomingFriendRequests: [], sentFriendRequests: [],
    achievements: [], stats: { lessonsCompleted: 0, puzzlesCompleted: 0, totalAnswered: 0, totalCorrect: 0, perfectLessons: 0, giftsSent: 0, giftsReceived: 0 },
    inventory: [], equipped: { title: "New Learner", border: "Starter Frame", banner: "Sprak Starter", decoration: "" },
    completedLessons: {}, wrongAnswers: {}, dailyCompletions: {}, createdAt: Date.now(), ...extra };
}
function firebaseErr(code) {
  const m = { "auth/email-already-in-use":"That email is already registered.", "auth/invalid-email":"Please enter a valid email address.", "auth/weak-password":"Password must be at least 6 characters.", "auth/invalid-credential":"Incorrect email or password.", "auth/too-many-requests":"Too many attempts. Try again later.", "auth/network-request-failed":"Network error. Check your connection." };
  return m[code] || "Something went wrong. Please try again.";
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',sans-serif;background:#FEFAE0;color:#1a1a1a;min-height:100vh;}
:root{
  --green:#1B4332;--gmid:#2D6A4F;--glight:#52B788;
  --cream:#FEFAE0;--cdark:#F0EAC8;
  --gold:#F4A261;--gdark:#E76F51;
  --blue:#74C0FC;--bdark:#339AF0;
  --red:#FF6B6B;--white:#fff;
  --text:#1a1a1a;--muted:#666;
  --r:16px;--rs:8px;
  --shadow:0 4px 20px rgba(27,67,50,.12);--ssm:0 2px 8px rgba(27,67,50,.08);
}
.app{min-height:100vh;}

/* NAV */
.nav{background:var(--green);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(0,0,0,.2);}
.nav-logo{font-family:'Fredoka One',cursive;font-size:26px;color:var(--gold);letter-spacing:1px;cursor:pointer;}
.nav-logo span{color:#fff;}
.nav-right{display:flex;align-items:center;gap:10px;}
.nav-user{display:flex;align-items:center;gap:6px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;padding:6px 10px;border-radius:12px;transition:background .2s;}
.nav-user:hover{background:rgba(255,255,255,.1);}
.nav-streak{background:var(--gold);color:var(--green);padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;}
.btn-nav{background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:10px;padding:7px 14px;font-weight:600;font-size:13px;cursor:pointer;transition:all .2s;}
.btn-nav:hover{background:rgba(255,255,255,.25);}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 26px;border-radius:var(--r);border:none;font-family:'Inter',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;}
.btn-primary{background:var(--green);color:#fff;box-shadow:0 4px 0 #0f2d1e;}
.btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 0 #0f2d1e;}
.btn-primary:active:not(:disabled){transform:translateY(2px);box-shadow:0 2px 0 #0f2d1e;}
.btn-gold{background:var(--gold);color:var(--green);box-shadow:0 4px 0 #c4722a;}
.btn-gold:hover:not(:disabled){transform:translateY(-2px);background:var(--gdark);color:#fff;box-shadow:0 6px 0 #c4722a;}
.btn-ghost{background:transparent;color:var(--green);border:2px solid var(--green);}
.btn-ghost:hover:not(:disabled){background:var(--green);color:#fff;}
.btn-sm{padding:8px 16px;font-size:13px;}
.btn-lg{padding:16px 36px;font-size:17px;}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.btn-full{width:100%;margin-top:8px;}

/* LANDING */
.landing{min-height:100vh;}
.hero{background:var(--green);color:#fff;padding:80px 24px 60px;text-align:center;position:relative;overflow:hidden;}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 30% 50%,rgba(82,183,136,.3),transparent 60%),radial-gradient(circle at 70% 50%,rgba(244,162,97,.2),transparent 60%);}
.hero-inner{position:relative;z-index:1;max-width:700px;margin:0 auto;}
.hero-logo{font-family:'Fredoka One',cursive;font-size:80px;color:var(--gold);line-height:1;margin-bottom:8px;text-shadow:0 4px 0 rgba(0,0,0,.2);}
.hero-tag{font-size:24px;color:rgba(255,255,255,.9);font-weight:600;margin-bottom:40px;line-height:1.4;}
.hero-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
.mascots{display:flex;justify-content:center;gap:16px;font-size:44px;margin-top:48px;}
.mascots span{animation:float 3s ease-in-out infinite;display:inline-block;}
.mascots span:nth-child(2){animation-delay:.5s;}
.mascots span:nth-child(3){animation-delay:1s;}
.mascots span:nth-child(4){animation-delay:1.5s;}
.mascots span:nth-child(5){animation-delay:2s;}
.mascots span:nth-child(6){animation-delay:2.5s;}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-12px);}}
.feat-grid{padding:60px 24px;max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;}
.feat-card{background:var(--white);border-radius:var(--r);padding:26px;box-shadow:var(--shadow);text-align:center;border-top:4px solid var(--glight);transition:transform .2s;}
.feat-card:hover{transform:translateY(-4px);}
.feat-icon{font-size:44px;margin-bottom:12px;}
.feat-title{font-family:'Fredoka One',cursive;font-size:20px;color:var(--green);margin-bottom:8px;}
.feat-desc{color:var(--muted);line-height:1.6;font-size:14px;}
.landing-cta{background:var(--cdark);padding:60px 24px;text-align:center;}
.landing-cta h2{font-family:'Fredoka One',cursive;font-size:34px;color:var(--green);margin-bottom:12px;}
.landing-cta p{color:var(--muted);margin-bottom:28px;font-size:17px;}

/* AUTH */
.auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--cream);}
.auth-card{background:var(--white);border-radius:24px;padding:36px;width:100%;max-width:420px;box-shadow:var(--shadow);}
.auth-title{font-family:'Fredoka One',cursive;font-size:30px;color:var(--green);text-align:center;margin-bottom:6px;}
.auth-sub{text-align:center;color:var(--muted);margin-bottom:22px;font-size:14px;}
.privacy{background:rgba(82,183,136,.1);border:1px solid rgba(82,183,136,.3);border-radius:var(--rs);padding:10px 14px;margin-bottom:18px;font-size:12px;color:var(--gmid);display:flex;gap:8px;line-height:1.5;}
.fg{margin-bottom:16px;}
.fl{display:block;font-weight:600;font-size:13px;color:var(--text);margin-bottom:5px;}
.fi{width:100%;padding:11px 14px;border:2px solid var(--cdark);border-radius:var(--rs);font-size:14px;font-family:'Inter',sans-serif;background:var(--cream);transition:border-color .2s;color:var(--text);}
.fi:focus{outline:none;border-color:var(--glight);background:#fff;}
.frow{display:flex;gap:10px;}
.frow .fg{flex:1;}
.auth-switch{text-align:center;margin-top:18px;color:var(--muted);font-size:13px;}
.auth-switch button{background:none;border:none;color:var(--gmid);font-weight:700;cursor:pointer;font-size:13px;text-decoration:underline;}
.err{background:#fff0f0;border:1px solid var(--red);color:#c0392b;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:14px;}

/* AVATAR / LEVEL */
.av-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px;}
.av-btn{border:3px solid var(--cdark);border-radius:var(--rs);padding:12px 6px;background:var(--cream);cursor:pointer;transition:all .2s;text-align:center;display:flex;flex-direction:column;align-items:center;gap:5px;}
.av-btn:hover{border-color:var(--glight);background:#fff;}
.av-btn.sel{border-color:var(--green);background:rgba(27,67,50,.08);}
.av-emoji{font-size:28px;}
.av-lbl{font-size:11px;font-weight:600;color:var(--muted);}
.lvl-opts{display:flex;flex-direction:column;gap:8px;margin-top:8px;}
.lvl-opt{border:2px solid var(--cdark);border-radius:var(--rs);padding:12px 16px;background:var(--cream);cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:12px;}
.lvl-opt:hover{border-color:var(--glight);background:#fff;}
.lvl-opt.sel{border-color:var(--green);background:rgba(27,67,50,.06);}
.lvl-opt-icon{font-size:22px;}
.lvl-info h4{font-weight:700;color:var(--text);font-size:14px;}
.lvl-info p{font-size:12px;color:var(--muted);}

/* DASHBOARD */
.dash{max-width:960px;margin:0 auto;padding:28px 20px;}
.dash-head{display:flex;align-items:center;gap:18px;margin-bottom:28px;}
.dash-av{font-size:56px;background:var(--cdark);width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid var(--green);flex-shrink:0;}
.dash-info{flex:1;}
.dash-info h2{font-family:'Fredoka One',cursive;font-size:24px;color:var(--green);}
.dash-info p{color:var(--muted);font-size:13px;}
.lvl-badge{display:inline-flex;align-items:center;gap:5px;background:var(--green);color:#fff;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;margin-top:5px;}
.xp-wrap{margin-top:8px;}
.xp-lbl{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px;}
.xp-bar{background:var(--cdark);border-radius:99px;height:12px;overflow:hidden;}
.xp-fill{background:linear-gradient(90deg,var(--gold),var(--gdark));height:100%;border-radius:99px;transition:width .6s cubic-bezier(.34,1.56,.64,1);}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px;}
.stat-card{background:var(--white);border-radius:var(--r);padding:16px;box-shadow:var(--ssm);text-align:center;}
.stat-val{font-family:'Fredoka One',cursive;font-size:28px;color:var(--green);}
.stat-lbl{font-size:11px;color:var(--muted);font-weight:600;margin-top:2px;}
.dash-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px;}
.action-card{background:var(--white);border-radius:var(--r);padding:20px;box-shadow:var(--shadow);cursor:pointer;transition:all .2s;border:2px solid transparent;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;}
.action-card:hover{border-color:var(--glight);transform:translateY(-3px);box-shadow:0 8px 30px rgba(27,67,50,.15);}
.action-card.disabled{opacity:.6;cursor:default;}
.action-card.disabled:hover{transform:none;border-color:transparent;}
.action-icon{font-size:40px;}
.action-title{font-family:'Fredoka One',cursive;font-size:18px;color:var(--green);}
.action-desc{font-size:12px;color:var(--muted);}
.badge{background:var(--gold);color:var(--green);padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;}
.badge-done{background:var(--cdark);color:var(--muted);padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;}
.ach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;}
.ach-card{background:var(--white);border-radius:var(--rs);padding:12px;box-shadow:var(--ssm);display:flex;align-items:center;gap:10px;}
.ach-card.ok{border-left:4px solid var(--glight);}
.ach-card.lock{opacity:.4;filter:grayscale(1);}
.ach-icon{font-size:24px;}
.ach-info h4{font-size:12px;font-weight:700;}
.ach-info p{font-size:11px;color:var(--muted);}
.sec-title{font-family:'Fredoka One',cursive;font-size:20px;color:var(--green);margin-bottom:14px;}

/* ROADMAP */
.roadmap{max-width:680px;margin:0 auto;padding:28px 20px;}
.roadmap-title{font-family:'Fredoka One',cursive;font-size:28px;color:var(--green);margin-bottom:6px;text-align:center;}
.roadmap-sub{text-align:center;color:var(--muted);font-size:14px;margin-bottom:32px;}
.unit-row{margin-bottom:20px;}
.unit-card{border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow);}
.unit-head{padding:18px 20px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:filter .2s;}
.unit-head.locked{filter:brightness(.7);cursor:default;}
.unit-icon-box{width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;}
.unit-text{flex:1;}
.unit-name{font-family:'Fredoka One',cursive;font-size:18px;color:#fff;}
.unit-desc{font-size:12px;color:rgba(255,255,255,.8);margin-top:2px;}
.unit-status{font-size:22px;}
.lessons-list{background:var(--white);border-top:2px solid rgba(0,0,0,.06);}
.lesson-row{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--cdark);cursor:pointer;transition:background .15s;}
.lesson-row:last-child{border-bottom:none;}
.lesson-row:hover:not(.lesson-locked){background:var(--cream);}
.lesson-row.lesson-locked{opacity:.5;cursor:default;}
.lesson-dot{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;border:2px solid currentColor;}
.lesson-dot.done{background:var(--glight);border-color:var(--glight);color:#fff;}
.lesson-dot.current{background:var(--gold);border-color:var(--gold);color:var(--green);}
.lesson-dot.locked{background:var(--cdark);border-color:var(--cdark);color:var(--muted);}
.lesson-info{flex:1;}
.lesson-name{font-weight:700;font-size:14px;color:var(--text);}
.lesson-meta{font-size:12px;color:var(--muted);margin-top:2px;}
.lesson-xp{font-size:12px;font-weight:700;color:var(--gdark);}

/* LESSON / QUIZ */
.lesson-page{max-width:620px;margin:0 auto;padding:28px 20px;}
.lesson-hdr{margin-bottom:24px;}
.lesson-title{font-family:'Fredoka One',cursive;font-size:24px;color:var(--green);margin-bottom:4px;}
.lesson-sub{color:var(--muted);font-size:13px;}
.progress-row{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
.progress-bar{background:var(--cdark);border-radius:99px;height:10px;flex:1;overflow:hidden;}
.progress-fill{background:linear-gradient(90deg,var(--glight),var(--green));height:100%;border-radius:99px;transition:width .4s ease;}
.q-num{font-size:12px;color:var(--muted);font-weight:600;}

/* INTRO CARD */
.intro-card{background:var(--white);border-radius:var(--r);padding:28px;box-shadow:var(--shadow);margin-bottom:20px;}
.intro-icon{font-size:48px;text-align:center;margin-bottom:12px;}
.intro-title{font-family:'Fredoka One',cursive;font-size:22px;color:var(--green);margin-bottom:10px;}
.intro-body{font-size:15px;line-height:1.7;color:var(--text);white-space:pre-line;}
.intro-tip{background:rgba(82,183,136,.1);border-left:4px solid var(--glight);border-radius:0 var(--rs) var(--rs) 0;padding:12px 16px;margin-top:16px;font-size:13px;color:var(--gmid);line-height:1.6;white-space:pre-line;}

/* WORD CARD */
.word-card{background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:var(--r);padding:28px;text-align:center;margin-bottom:20px;box-shadow:var(--shadow);}
.word-de{font-family:'Fredoka One',cursive;font-size:48px;color:var(--gold);margin-bottom:4px;}
.word-en{font-size:14px;color:rgba(255,255,255,.7);font-style:italic;}
.word-category{font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}

/* QUESTION */
.q-card{background:var(--white);border-radius:var(--r);padding:24px;box-shadow:var(--shadow);}
.q-prompt{font-size:18px;font-weight:700;color:var(--text);margin-bottom:20px;line-height:1.4;}
.opts{display:flex;flex-direction:column;gap:10px;}
.opt{border:2.5px solid var(--cdark);border-radius:var(--r);padding:14px 18px;background:var(--white);cursor:pointer;transition:all .15s;font-size:15px;font-weight:500;text-align:left;position:relative;overflow:hidden;}
.opt:hover:not(:disabled):not(.opt-correct):not(.opt-wrong){border-color:var(--glight);background:var(--cream);transform:translateX(3px);}
.opt:disabled{cursor:default;}
.opt-correct{border-color:var(--glight)!important;background:rgba(82,183,136,.15)!important;color:var(--green)!important;animation:pulse-green .3s ease;}
.opt-wrong{border-color:var(--red)!important;background:rgba(255,107,107,.12)!important;color:#c0392b!important;animation:shake .3s ease;}
.opt-reveal{border-color:var(--glight)!important;background:rgba(82,183,136,.08)!important;}
@keyframes pulse-green{0%,100%{transform:scale(1);}50%{transform:scale(1.02);}}
@keyframes shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-6px);}75%{transform:translateX(6px);}}

/* FILL IN BLANK */
.fill-sentence{font-size:20px;font-weight:600;color:var(--text);text-align:center;margin-bottom:6px;line-height:1.5;}
.fill-english{font-size:14px;color:var(--muted);text-align:center;margin-bottom:20px;font-style:italic;}
.fill-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;}

/* TAP BUILD */
.tap-target{min-height:54px;border:2.5px dashed var(--cdark);border-radius:var(--rs);padding:10px 14px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:8px;background:var(--cream);cursor:pointer;}
.tap-word{background:var(--white);border:2px solid var(--cdark);border-radius:8px;padding:8px 14px;font-size:15px;font-weight:600;cursor:pointer;transition:all .15s;color:var(--text);box-shadow:0 2px 0 #d4c89a;}
.tap-word:hover{border-color:var(--green);color:var(--green);transform:translateY(-1px);}
.tap-word.used{opacity:.3;cursor:default;}
.tap-word.placed{background:var(--green);color:#fff;border-color:var(--green);box-shadow:0 2px 0 #0f2d1e;}
.word-bank{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}

/* ARTICLE */
.article-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.article-opt{border:3px solid var(--cdark);border-radius:var(--r);padding:20px;background:var(--white);cursor:pointer;transition:all .15s;font-family:'Fredoka One',cursive;font-size:28px;text-align:center;color:var(--text);}
.article-opt:hover:not(:disabled){border-color:var(--glight);background:var(--cream);transform:translateY(-2px);}
.article-opt:disabled{cursor:default;}
.article-opt.opt-correct{border-color:var(--glight)!important;background:rgba(82,183,136,.15)!important;color:var(--green)!important;}
.article-opt.opt-wrong{border-color:var(--red)!important;background:rgba(255,107,107,.12)!important;color:#c0392b!important;}

/* FEEDBACK */
.feedback{border-radius:var(--rs);padding:14px 18px;margin-top:16px;font-weight:600;font-size:15px;display:flex;align-items:flex-start;gap:10px;animation:slideUp .2s ease;}
@keyframes slideUp{from{transform:translateY(6px);opacity:0;}to{transform:translateY(0);opacity:1;}}
.fb-ok{background:rgba(82,183,136,.12);color:#155724;border:2px solid var(--glight);}
.fb-no{background:rgba(255,107,107,.1);color:#721c24;border:2px solid var(--red);}
.fb-icon{font-size:20px;flex-shrink:0;}
.fb-text{flex:1;}
.fb-exp{font-size:13px;font-weight:400;margin-top:4px;opacity:.85;}
.next-btn{margin-top:16px;width:100%;}

/* LESSON COMPLETE */
.lc{text-align:center;padding:48px 20px;max-width:480px;margin:0 auto;}
.lc-icon{font-size:80px;margin-bottom:12px;animation:popIn .4s cubic-bezier(.34,1.56,.64,1);}
@keyframes popIn{from{transform:scale(0.5);opacity:0;}to{transform:scale(1);opacity:1;}}
.lc h2{font-family:'Fredoka One',cursive;font-size:30px;color:var(--green);margin-bottom:8px;}
.lc-stats{display:flex;justify-content:center;gap:22px;margin:20px 0 28px;}
.lcs{text-align:center;}
.lcs-val{font-family:'Fredoka One',cursive;font-size:30px;color:var(--green);}
.lcs-lbl{font-size:12px;color:var(--muted);}

/* PLACEMENT QUIZ RESULT */
.quiz-result{text-align:center;padding:60px 24px;max-width:500px;margin:0 auto;}
.quiz-result-icon{font-size:80px;margin-bottom:16px;}
.quiz-result h2{font-family:'Fredoka One',cursive;font-size:32px;color:var(--green);margin-bottom:8px;}
.quiz-result-level{font-family:'Fredoka One',cursive;font-size:64px;color:var(--gold);line-height:1;}
.quiz-result p{color:var(--muted);margin:12px 0 32px;font-size:18px;}

/* OVERLAYS */
.overlay{position:fixed;inset:0;background:rgba(27,67,50,.85);display:flex;align-items:center;justify-content:center;z-index:999;animation:fadeIn .3s;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
.overlay-card{background:var(--white);border-radius:28px;padding:44px 36px;text-align:center;max-width:380px;width:90%;animation:popIn .4s cubic-bezier(.34,1.56,.64,1);}
.ov-emoji{font-size:68px;margin-bottom:8px;}
.ov-title{font-family:'Fredoka One',cursive;font-size:34px;color:var(--green);margin-bottom:4px;}
.ov-num{font-family:'Fredoka One',cursive;font-size:76px;color:var(--gold);line-height:1;}
.ov-sub{color:var(--muted);font-size:15px;margin:10px 0 24px;}

/* TOASTS */
.xp-toast{position:fixed;top:72px;right:20px;background:var(--green);color:var(--gold);font-family:'Fredoka One',cursive;font-size:20px;padding:8px 18px;border-radius:99px;z-index:200;animation:toastPop 2s ease forwards;pointer-events:none;}
@keyframes toastPop{0%{transform:translateY(-16px) scale(.8);opacity:0;}15%{transform:translateY(0) scale(1.1);opacity:1;}30%{transform:scale(1);}70%{opacity:1;}100%{transform:translateY(-8px);opacity:0;}}

.loading-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--cream);}
.loading-logo{font-family:'Fredoka One',cursive;font-size:56px;color:var(--gold);animation:pulse 1.5s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.5;}}


/* SOCIAL / SHOP / PROFILE */
.social-page,.shop-page,.profile-page{max-width:1000px;margin:0 auto;padding:28px 20px;}
.page-top{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:22px;flex-wrap:wrap;}
.page-title{font-family:'Fredoka One',cursive;font-size:28px;color:var(--green);}
.page-sub{font-size:13px;color:var(--muted);margin-top:4px;}
.social-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;}
.panel{background:var(--white);border-radius:var(--r);box-shadow:var(--shadow);padding:18px;}
.panel-title{font-family:'Fredoka One',cursive;font-size:19px;color:var(--green);margin-bottom:12px;display:flex;align-items:center;gap:8px;}
.league-card{background:linear-gradient(135deg,var(--green),var(--gmid));color:#fff;border-radius:var(--r);padding:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;}
.league-icon{font-size:42px;}
.league-name{font-family:'Fredoka One',cursive;font-size:22px;color:var(--gold);}
.reset-pill{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);padding:6px 10px;border-radius:99px;font-size:12px;font-weight:700;}
.rank-row,.friend-row,.gift-row{display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;border:1px solid var(--cdark);background:var(--cream);margin-bottom:10px;}
.rank-num{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--green);color:#fff;font-weight:800;font-size:12px;flex-shrink:0;}
.rank-me{border-color:var(--gold);background:rgba(244,162,97,.15);}
.mini-avatar{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;border:2px solid var(--cdark);font-size:24px;flex-shrink:0;}
.row-main{flex:1;min-width:0;}
.row-name{font-weight:800;font-size:14px;color:var(--text);}
.row-meta{font-size:12px;color:var(--muted);margin-top:2px;}
.row-score{font-family:'Fredoka One',cursive;color:var(--green);font-size:18px;white-space:nowrap;}
.currency-pill{background:var(--gold);color:var(--green);padding:7px 12px;border-radius:99px;font-weight:800;display:inline-flex;align-items:center;gap:6px;}
.shop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;}
.shop-card{background:var(--white);border-radius:var(--r);box-shadow:var(--shadow);padding:18px;border:2px solid transparent;display:flex;flex-direction:column;gap:10px;}
.shop-card.owned{opacity:.65;background:var(--cream);}
.shop-icon{font-size:42px;text-align:center;}
.shop-name{font-weight:900;color:var(--text);text-align:center;}
.shop-rarity{text-align:center;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--gdark);}
.shop-price{text-align:center;font-family:'Fredoka One',cursive;font-size:20px;color:var(--green);}
.profile-card{background:linear-gradient(135deg,var(--green),var(--gmid));color:#fff;border-radius:24px;box-shadow:var(--shadow);padding:26px;position:relative;overflow:hidden;}
.profile-card::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 80% 20%,rgba(244,162,97,.25),transparent 40%);}
.profile-inner{position:relative;z-index:1;display:flex;align-items:center;gap:20px;flex-wrap:wrap;}
.profile-big-av{width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.14);border:4px solid var(--gold);display:flex;align-items:center;justify-content:center;font-size:62px;}
.profile-name{font-family:'Fredoka One',cursive;font-size:30px;color:var(--gold);}
.profile-title{display:inline-flex;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);border-radius:99px;padding:5px 12px;margin:8px 0;font-size:13px;font-weight:800;}
.cosmetic-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:14px;}
.cosmetic-card{background:var(--white);border-radius:var(--rs);box-shadow:var(--ssm);padding:14px;border-left:4px solid var(--glight);}
.cosmetic-type{font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:800;}
.cosmetic-name{font-weight:800;margin-top:3px;}
@media(max-width:760px){.social-grid{grid-template-columns:1fr}.page-top{align-items:flex-start}.nav-right{gap:5px}.nav-user{font-size:12px;padding:5px 7px}}

@media(max-width:640px){
  .stats-row{grid-template-columns:repeat(2,1fr);}
  .dash-actions{grid-template-columns:1fr;}
  .hero-logo{font-size:56px;}
  .hero-tag{font-size:17px;}
  .fill-opts{grid-template-columns:1fr;}
  .article-opts{grid-template-columns:repeat(3,1fr);}
}
`;

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function XpToast({ xp }) { return <div className="xp-toast">+{xp} XP ✨</div>; }

function LevelUpOverlay({ level, onContinue }) {
  useEffect(() => { SFX.levelup(); }, []);
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="ov-emoji">🎉</div>
        <div className="ov-title">Level Up!</div>
        <div className="ov-num">{level}</div>
        <div className="ov-sub">Incredible progress! Keep going!</div>
        <button className="btn btn-gold btn-lg" onClick={onContinue}>Continue 🚀</button>
      </div>
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="privacy">
      <span>🔒</span>
      <span>Sign-in is powered by Google Firebase — your password is never seen by us. Learning progress is saved only in your browser. We don't sell data, run ads, or use your info for AI training.</span>
    </div>
  );
}

function Nav({ user, onLogout, onNavigate }) {
  const av = AVATARS.find(a => a.id === user.avatar);
  const { level } = calcLevel(user.xp || 0);
  return (
    <nav className="nav">
      <div className="nav-logo" onClick={() => onNavigate("dashboard")}>Spr<span>ak</span></div>
      <div className="nav-right">
        <div className="nav-streak">🔥 {user.streak || 0}</div>
        <div className="nav-streak">{CURRENCY.icon} {user.marks || 0}</div>
        <div className="nav-user" onClick={() => onNavigate("roadmap")}>🗺️ Roadmap</div>
        <div className="nav-user" onClick={() => onNavigate("social")}>🏆 Social</div>
        <div className="nav-user" onClick={() => onNavigate("shop")}>🛍️ Shop</div>
        <div className="nav-user" onClick={() => onNavigate("profile")}>{av?.emoji || "🐻"} {user.displayName} <span style={{opacity:.6}}>Lv{level}</span></div>
        <button className="btn-nav" onClick={onLogout}>Logout</button>
      </div>
    </nav>
  );
}

function Landing({ onNavigate }) {
  return (
    <div className="landing">
      <div className="hero">
        <div className="hero-inner">
          <div className="hero-logo">Sprak</div>
          <div className="hero-tag">Learn German like it's a game.</div>
          <div className="hero-btns">
            <button className="btn btn-gold btn-lg" onClick={() => { SFX.click(); onNavigate("signup"); }}>Start for Free</button>
            <button className="btn btn-ghost btn-lg" style={{color:"#fff",borderColor:"rgba(255,255,255,.5)"}} onClick={() => onNavigate("login")}>Log In</button>
          </div>
          <div className="mascots">{AVATARS.map(a => <span key={a.id}>{a.emoji}</span>)}</div>
        </div>
      </div>
      <div className="feat-grid">
        {[
          {icon:"🗺️",title:"Learning Roadmap",desc:"Structured units from greetings to full conversations. See your path ahead."},
          {icon:"🧩",title:"Daily Puzzles",desc:"Fresh German challenges every day. Build your streak, earn XP."},
          {icon:"🔊",title:"Sound Feedback",desc:"Satisfying chimes for correct answers, gentle nudges for wrong ones."},
          {icon:"📚",title:"Real German Tutoring",desc:"Learn the way real tutors teach — with context, tips, and explanations."},
          {icon:"⚡",title:"Review Weak Spots",desc:"Sprak tracks what you miss and drills it again until it sticks."},
          {icon:"🏆",title:"Levels & Achievements",desc:"Gain XP, unlock achievements, and watch your level climb."},
        ].map(f => (
          <div className="feat-card" key={f.title}>
            <div className="feat-icon">{f.icon}</div>
            <div className="feat-title">{f.title}</div>
            <div className="feat-desc">{f.desc}</div>
          </div>
        ))}
      </div>
      <div className="landing-cta">
        <h2>Bereit? Let's go.</h2>
        <p>Join Sprak and make German actually fun.</p>
        <button className="btn btn-primary btn-lg" onClick={() => onNavigate("signup")}>Create Free Account</button>
        <div className="privacy" style={{maxWidth:580,margin:"28px auto 0",textAlign:"left"}}>
          <span>🛡️</span><span>No ads, no data selling, no AI training on your account. Just German.</span>
        </div>
      </div>
    </div>
  );
}

function Signup({ onNavigate, onComplete }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({username:"",displayName:"",email:"",password:""});
  const [avatar, setAvatar] = useState("");
  const [lvlChoice, setLvlChoice] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const lvlOpts = [
    {id:"none",icon:"🌱",label:"None",desc:"Starting from zero"},
    {id:"beginner",icon:"🌿",label:"Beginner",desc:"I know a few words"},
    {id:"intermediate",icon:"🌳",label:"Intermediate",desc:"I can hold basic conversations"},
    {id:"advanced",icon:"🌲",label:"Advanced",desc:"I'm fairly fluent"},
  ];

  const step1 = e => {
    e.preventDefault();
    if (!form.username.trim()||!form.displayName.trim()||!form.email.trim()||!form.password) { setErr("Please fill in all fields."); return; }
    if (form.password.length < 6) { setErr("Password needs at least 6 characters."); return; }
    setErr(""); setStep(2);
  };

  const step2 = async e => {
    e.preventDefault();
    if (!avatar) { setErr("Pick an avatar!"); return; }
    if (!lvlChoice) { setErr("Tell us your German level."); return; }
    setErr(""); setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const uid = cred.user.uid;
      const gd = makeDefaultGameData(uid, { username: form.username.trim(), displayName: form.displayName.trim(), avatar });
      saveGameData(uid, gd);
      onComplete(gd, lvlChoice);
    } catch(err) { setErr(firebaseErr(err.code)); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">Join Sprak</div>
        <div className="auth-sub">{step===1?"Create your account":"Set up your profile"}</div>
        <PrivacyNote />
        {err && <div className="err">{err}</div>}
        {step===1 && (
          <form onSubmit={step1}>
            <div className="frow">
              <div className="fg"><label className="fl">Username</label><input className="fi" placeholder="FoxLearner" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} /></div>
              <div className="fg"><label className="fl">Display Name</label><input className="fi" placeholder="Your name" value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})} /></div>
            </div>
            <div className="fg"><label className="fl">Email</label><input className="fi" type="email" placeholder="you@example.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="fg"><label className="fl">Password</label><input className="fi" type="password" placeholder="At least 6 characters" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
            <button className="btn btn-primary btn-full" type="submit">Next →</button>
          </form>
        )}
        {step===2 && (
          <form onSubmit={step2}>
            <div className="fg">
              <label className="fl">Pick your avatar</label>
              <div className="av-grid">
                {AVATARS.map(a => <button type="button" key={a.id} className={`av-btn ${avatar===a.id?"sel":""}`} onClick={()=>setAvatar(a.id)}><span className="av-emoji">{a.emoji}</span><span className="av-lbl">{a.label}</span></button>)}
              </div>
            </div>
            <div className="fg">
              <label className="fl">How much German do you know?</label>
              <div className="lvl-opts">
                {lvlOpts.map(o => <div key={o.id} className={`lvl-opt ${lvlChoice===o.id?"sel":""}`} onClick={()=>setLvlChoice(o.id)}><span className="lvl-opt-icon">{o.icon}</span><div className="lvl-info"><h4>{o.label}</h4><p>{o.desc}</p></div></div>)}
              </div>
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading?"Creating…":lvlChoice==="none"?"Start Learning! 🚀":"Take Placement Quiz →"}</button>
          </form>
        )}
        <div className="auth-switch">Already have an account? <button onClick={()=>onNavigate("login")}>Log in</button></div>
      </div>
    </div>
  );
}

function Login({ onNavigate, onLogin }) {
  const [form, setForm] = useState({email:"",password:""});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [gloading, setGloading] = useState(false);

  const finish = async (uid, fallbackName="Learner") => {
    let gd = await loadCloudGameData(uid) || getGameData(uid);
    if (!gd) { gd = makeDefaultGameData(uid,{displayName:fallbackName,username:fallbackName.toLowerCase().replace(/[^a-z0-9_]/g,"") || "learner"}); saveGameData(uid,gd); }
    const today = getDailyKey();
    if (gd.lastActiveDate !== today) {
      const d = new Date(); d.setDate(d.getDate()-1);
      const yest = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (gd.lastActiveDate !== yest) gd.streak = 0;
      saveGameData(uid,gd);
    }
    saveLocalGameData(uid, gd);
    onLogin(gd);
  };

  const submit = async e => {
    e.preventDefault();
    if (!form.email.trim()||!form.password) { setErr("Please fill in all fields."); return; }
    setErr(""); setLoading(true);
    try { const cred = await signInWithEmailAndPassword(auth,form.email.trim(),form.password); await finish(cred.user.uid, form.email.split("@")[0]); }
    catch(err) { setErr(firebaseErr(err.code)); }
    finally { setLoading(false); }
  };

  const guest = async () => {
    setErr(""); setGloading(true);
    try { const cred = await signInAnonymously(auth); await finish(cred.user.uid, "Guest"); }
    catch(err) { setErr(firebaseErr(err.code)); }
    finally { setGloading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">Willkommen zurück!</div>
        <div className="auth-sub">Log in to continue your journey</div>
        <PrivacyNote />
        {err && <div className="err">{err}</div>}
        <form onSubmit={submit}>
          <div className="fg"><label className="fl">Email</label><input className="fi" type="email" placeholder="you@example.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div className="fg"><label className="fl">Password</label><input className="fi" type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
          <button className="btn btn-primary btn-full" type="submit" disabled={loading||gloading}>{loading?"Logging in…":"Log In"}</button>
        </form>
        <button className="btn btn-ghost btn-full" onClick={guest} disabled={loading||gloading} style={{marginTop:8}}>{gloading?"Starting…":"Continue as Guest"}</button>
        <p style={{fontSize:12,color:"var(--muted)",textAlign:"center",marginTop:10,lineHeight:1.5}}>Guest progress saves on this device only.</p>
        <div className="auth-switch">No account? <button onClick={()=>onNavigate("signup")}>Sign up free</button></div>
      </div>
    </div>
  );
}

function PlacementQuiz({ onComplete }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [locked, setLocked] = useState(false);
  const [done, setDone] = useState(false);
  const q = PLACEMENT_QUESTIONS[idx];

  const pick = opt => {
    if (locked) return;
    setLocked(true); setSelected(opt);
    const correct = opt === (q.correct || q.blank);
    if (correct) { SFX.correct(); setScore(s=>s+1); } else { SFX.wrong(); }
    setTimeout(() => {
      if (idx+1 >= PLACEMENT_QUESTIONS.length) setDone(true);
      else { setIdx(i=>i+1); setSelected(null); setLocked(false); }
    }, 1400);
  };

  const startLevel = score <= 1 ? 1 : score <= 2 ? 5 : score <= 4 ? 15 : 31;

  if (done) return (
    <div className="auth-page">
      <div className="quiz-result">
        <div className="quiz-result-icon">🎓</div>
        <h2>Quiz Complete!</h2>
        <div style={{color:"var(--muted)",marginBottom:8}}>Your Sprak journey begins at</div>
        <div className="quiz-result-level">Level {startLevel}</div>
        <p>{score}/{PLACEMENT_QUESTIONS.length} correct</p>
        <button className="btn btn-gold btn-lg" onClick={()=>onComplete(startLevel)}>Let's Go! 🚀</button>
      </div>
    </div>
  );

  const pct = idx/PLACEMENT_QUESTIONS.length*100;
  const isCorrect = opt => opt === (q.correct||q.blank);

  return (
    <div className="auth-page" style={{alignItems:"flex-start",paddingTop:40}}>
      <div style={{width:"100%",maxWidth:560}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Fredoka One',cursive",fontSize:26,color:"var(--green)"}}>Placement Quiz</div>
          <div style={{color:"var(--muted)",fontSize:13}}>Let's find your level</div>
        </div>
        <div className="progress-bar" style={{marginBottom:24,height:10,background:"var(--cdark)",borderRadius:99,overflow:"hidden"}}><div style={{width:pct+"%",background:"var(--glight)",height:"100%",borderRadius:99,transition:"width .4s"}}/></div>
        {q.german && <div className="word-card"><div className="word-de">{q.german}</div></div>}
        <div className="q-card">
          <div className="q-prompt">{q.prompt}</div>
          <div className="opts">
            {q.options.map(opt => {
              const cls = locked ? (isCorrect(opt) ? "opt-correct" : opt===selected ? "opt-wrong" : "") : "";
              return <button key={opt} className={`opt ${cls}`} disabled={locked} onClick={()=>pick(opt)}>{opt}</button>;
            })}
          </div>
          {locked && <div className={`feedback ${isCorrect(selected)?"fb-ok":"fb-no"}`}>
            <div className="fb-icon">{isCorrect(selected)?"✓":"✗"}</div>
            <div className="fb-text">{isCorrect(selected)?"Correct!":"Incorrect"}<div className="fb-exp">{q.explanation}</div></div>
          </div>}
        </div>
      </div>
    </div>
  );
}

// ─── QUESTION RENDERER ───────────────────────────────────────────────────────

function QuestionRenderer({ q, onAnswer }) {
  const [selected, setSelected] = useState(null);
  const [locked, setLocked] = useState(false);
  const [tapPlaced, setTapPlaced] = useState([]);
  const [tapUsed, setTapUsed] = useState([]);

  const correct = q.correct || q.blank;
  const isTapCorrect = JSON.stringify(tapPlaced) === JSON.stringify(q.correct || []);
  const isCorrect = q.type === "tap_build" ? isTapCorrect : selected === correct;

  const handleMC = opt => {
    if (locked) return;
    setLocked(true);
    setSelected(opt);
    const ok = opt === correct;
    if (ok) SFX.correct(); else SFX.wrong();
  };

  const handleTapWord = word => {
    if (locked || tapUsed.includes(word)) return;
    SFX.click();
    setTapPlaced(p => [...p, word]);
    setTapUsed(u => [...u, word]);
  };

  const handleTapRemove = idx => {
    if (locked) return;
    const word = tapPlaced[idx];
    setTapPlaced(p => p.filter((_,i)=>i!==idx));
    setTapUsed(u => { const copy=[...u]; const wi=copy.indexOf(word); if(wi>-1) copy.splice(wi,1); return copy; });
  };

  const checkTap = () => {
    if (locked || tapPlaced.length === 0) return;
    setLocked(true);
    const ok = JSON.stringify(tapPlaced) === JSON.stringify(q.correct);
    if (ok) SFX.correct(); else SFX.wrong();
  };

  const goNext = () => {
    onAnswer(isCorrect, q.type === "tap_build" ? tapPlaced.join(" ") : selected, q);
  };

  const showWordCard = q.german && q.type === "mc";

  return (
    <div>
      {showWordCard && (
        <div className="word-card">
          <div className="word-category">{q.category || ""}</div>
          <div className="word-de">{q.german}</div>
          
        </div>
      )}
      <div className="q-card">
        {q.type === "mc" && (
          <>
            <div className="q-prompt">{q.prompt}</div>
            <div className="opts">
              {q.options.map(opt => {
                const cls = locked ? (opt===correct?"opt-correct":opt===selected?"opt-wrong":"") : "";
                return <button key={opt} className={`opt ${cls}`} disabled={locked} onClick={()=>handleMC(opt)}>{opt}</button>;
              })}
            </div>
          </>
        )}
        {q.type === "article" && (
          <>
            <div className="q-prompt">{q.prompt}</div>
            <div className="article-opts">
              {q.options.map(opt => {
                const cls = locked ? (opt===correct?"opt-correct":opt===selected?"opt-wrong":"") : "";
                return <button key={opt} className={`article-opt ${cls}`} disabled={locked} onClick={()=>handleMC(opt)}>{opt}</button>;
              })}
            </div>
          </>
        )}
        {q.type === "fill" && (
          <>
            <div className="fill-sentence">{q.german?.replace("___","______")}</div>
            <div className="fill-english">{q.english}</div>
            <div className="fill-opts">
              {q.options.map(opt => {
                const cls = locked ? (opt===correct?"opt-correct":opt===selected?"opt-wrong":"") : "";
                return <button key={opt} className={`opt ${cls}`} disabled={locked} onClick={()=>handleMC(opt)}>{opt}</button>;
              })}
            </div>
          </>
        )}
        {q.type === "tap_build" && (
          <>
            <div className="q-prompt">{q.prompt}</div>
            <div className="tap-target">
              {tapPlaced.map((w,i) => <span key={i} className="tap-word placed" onClick={()=>!locked&&handleTapRemove(i)}>{w}</span>)}
              {tapPlaced.length===0 && <span style={{color:"var(--muted)",fontSize:13,fontStyle:"italic"}}>Tap words below to build the phrase…</span>}
            </div>
            <div className="word-bank">
              {q.words.map((w,i) => <span key={i} className={`tap-word ${tapUsed.includes(w)&&tapPlaced.includes(w)?"used":""}`} onClick={()=>handleTapWord(w)}>{w}</span>)}
            </div>
            {!locked && tapPlaced.length > 0 && <button className="btn btn-primary next-btn" onClick={checkTap}>Check ✓</button>}
          </>
        )}

        {locked && (
          <>
            <div className={`feedback ${isCorrect?"fb-ok":"fb-no"}`}>
              <div className="fb-icon">{isCorrect?"✓":"✗"}</div>
              <div className="fb-text">
                {isCorrect ? "Correct!" : q.type === "tap_build" ? <span>Incorrect — correct answer: <strong>{q.correct.join(" ")}</strong></span> : q.type === "article" ? <span>The correct article is <strong>{correct}</strong>.</span> : q.type === "fill" ? <span>The missing word is <strong>{correct}</strong>.</span> : <span>The correct answer is <strong>{correct}</strong>.</span>}
                <div className="fb-exp">{q.explanation}</div>
              </div>
            </div>
            <button className="btn btn-primary next-btn" onClick={goNext}>Next →</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── LESSON RUNNER ───────────────────────────────────────────────────────────

function LessonRunner({ lesson, unit, mode, user, onComplete, onBack }) {
  const questions = useMemo(() => {
    if (mode === "puzzle") return getDailyQuestions();
    if (mode === "review") {
      const wrong = user.wrongAnswers || {};
      const wrongIds = Object.keys(wrong).filter(id => wrong[id] > 0);
      const pool = ALL_QUESTIONS.filter(q => wrongIds.includes(q.id));
      if (pool.length < 5) {
        const extra = ALL_QUESTIONS.filter(q => !wrongIds.includes(q.id)).slice(0, 10-pool.length);
        return [...pool, ...extra].slice(0,10).sort(()=>Math.random()-.5);
      }
      return pool.sort(()=>Math.random()-.5).slice(0,10);
    }
    return lesson?.questions || [];
  }, []);

  const [idx, setIdx] = useState(-1);
  const [results, setResults] = useState([]);
  const [xpEarned, setXpEarned] = useState(0);
  const [answerStreak, setAnswerStreak] = useState(0);
  const [bestAnswerStreak, setBestAnswerStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  const showIntro = mode !== "puzzle" && mode !== "review" && lesson?.intro;

  const handleAnswer = useCallback((correct, answer, q) => {
    const nextStreak = correct ? answerStreak + 1 : 0;
    const streakBonus = correct && [3,5,10].includes(nextStreak) ? nextStreak * 2 : 0;
    const xp = (correct ? 10 : 2) + streakBonus;
    setAnswerStreak(nextStreak);
    setBestAnswerStreak(b => Math.max(b, nextStreak));
    setXpEarned(e => e + xp);
    setResults(r => [...r, correct]);
    if (streakBonus > 0) SFX.streak(); else if (correct) SFX.xp();
    setToast(xp);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(()=>setToast(null), 2000);

    if (idx+1 >= questions.length) {
      const all = results.length+1 === questions.length && correct && results.every(Boolean);
      const bonus = all ? (mode==="puzzle"?50:25) : 0;
      if (bonus > 0) SFX.streak();
      setXpEarned(e => e+bonus);
      setDone(true);
    } else {
      setIdx(i=>i+1);
    }
  }, [idx, questions.length, results, mode, answerStreak]);

  const correctCount = results.filter(Boolean).length;

  if (done) {
    const perfect = correctCount === questions.length;
    return (
      <div className="lesson-page">
        <div className="lc">
          <div className="lc-icon">{perfect?"🌟":"✅"}</div>
          <h2>{perfect?"Perfect!":"Lesson Complete!"}</h2>
          {perfect && <p style={{color:"var(--muted)",marginBottom:16}}>You got every single one right!</p>}
          <div className="lc-stats">
            <div className="lcs"><div className="lcs-val">{correctCount}/{questions.length}</div><div className="lcs-lbl">Correct</div></div>
            <div className="lcs"><div className="lcs-val" style={{color:"var(--gold)"}}>+{xpEarned}</div><div className="lcs-lbl">XP Earned</div></div>
            <div className="lcs"><div className="lcs-val">🔥 {bestAnswerStreak}</div><div className="lcs-lbl">Best Streak</div></div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={()=>onComplete(xpEarned,correctCount,questions.length,mode,lesson?.id,perfect)}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const totalSteps = questions.length;
  const currentStep = Math.max(0, idx);
  const pct = currentStep / totalSteps * 100;

  return (
    <div className="lesson-page">
      {toast && <XpToast xp={toast} />}
      <div className="lesson-hdr">
        <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:14}}>← Back</button>
        <div className="lesson-title">{mode==="puzzle"?"🧩 Daily Puzzle":mode==="review"?"⚡ Review Session":`${unit?.icon||"📖"} ${lesson?.title}`}</div>
        <div className="lesson-sub">{mode==="puzzle"?"Today's challenge":mode==="review"?"Practice what gave you trouble":"Learn, answer, then press Next when you're ready."}</div>
      </div>

      {showIntro && idx === -1 ? (
        <div>
          <div className="intro-card">
            <div className="intro-icon">{unit?.icon}</div>
            <div className="intro-title">{lesson.intro.title}</div>
            <div className="intro-body">{lesson.intro.body}</div>
            <div className="intro-tip">{lesson.intro.tip}</div>
          </div>
          <button className="btn btn-primary btn-lg" style={{width:"100%"}} onClick={()=>setIdx(0)}>Start Lesson →</button>
        </div>
      ) : (
        <>
          {idx === -1 && setIdx(0)}
          <div className="progress-row">
            <div className="progress-bar"><div className="progress-fill" style={{width:pct+"%"}}/></div>
            <span className="q-num">{idx+1}/{totalSteps}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:10}}>
            <div className="badge">🔥 Correct Streak: {answerStreak}</div>
            {[3,5,10].includes(answerStreak) && <div className="badge" style={{background:"var(--green)",color:"#fff"}}>Streak Bonus!</div>}
          </div>
          {questions[idx] && <QuestionRenderer key={questions[idx].id} q={questions[idx]} onAnswer={handleAnswer} />}
        </>
      )}
    </div>
  );
}

// ─── ROADMAP ────────────────────────────────────────────────────────────────

function Roadmap({ user, onBack, onStartLesson }) {
  const completed = user.completedLessons || {};
  const completedCount = Object.keys(completed).filter(k => completed[k]).length;

  function unitUnlocked(unitIndex) {
    if (unitIndex === 0) return true;
    const previous = UNITS[unitIndex - 1];
    return previous.lessons.every(l => completed[l.id]);
  }

  function lessonUnlocked(unitIndex, lessonIndex) {
    if (!unitUnlocked(unitIndex)) return false;
    if (lessonIndex === 0) return true;
    return !!completed[UNITS[unitIndex].lessons[lessonIndex - 1].id];
  }

  return (
    <div className="roadmap">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:18}}>← Dashboard</button>
      <div className="roadmap-title">Sprak Roadmap</div>
      <div className="roadmap-sub">Complete lessons, guided reviews, and end-of-unit checkups. {completedCount} assignments completed.</div>
      {UNITS.map((unit, unitIndex) => {
        const unlocked = unitUnlocked(unitIndex);
        const unitDone = unit.lessons.every(l => completed[l.id]);
        return (
          <div className="unit-row" key={unit.id}>
            <div className="unit-card">
              <div className={`unit-head ${!unlocked ? "locked" : ""}`} style={{background: unit.color || "var(--green)"}}>
                <div className="unit-icon-box">{unit.icon}</div>
                <div className="unit-text">
                  <div className="unit-name">Unit {unit.id}: {unit.title}</div>
                  <div className="unit-desc">{unit.description}</div>
                </div>
                <div className="unit-status">{unitDone ? "✅" : unlocked ? "▶️" : "🔒"}</div>
              </div>
              <div className="lessons-list">
                {unit.lessons.map((lesson, lessonIndex) => {
                  const lDone = !!completed[lesson.id];
                  const lUnlocked = lessonUnlocked(unitIndex, lessonIndex);
                  return (
                    <div key={lesson.id} className={`lesson-row ${!lUnlocked ? "lesson-locked" : ""}`} onClick={() => lUnlocked && onStartLesson(unit, lesson)}>
                      <div className={`lesson-dot ${lDone ? "done" : lUnlocked ? "current" : "locked"}`}>{lDone ? "✓" : lUnlocked ? "▶" : "🔒"}</div>
                      <div className="lesson-info">
                        <div className="lesson-name">{lesson.title}</div>
                        <div className="lesson-meta">{lesson.questions.length} questions · {lesson.intro?.title || "German practice"}</div>
                      </div>
                      <div className="lesson-xp">+{lesson.xpReward || 30} XP</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── SOCIAL / SHOP / PROFILE ────────────────────────────────────────────────

function leagueRowsFromPlayers(players, user) {
  const byUid = new Map();
  [...(players || []), publicProfileFromData(user)].forEach(p => byUid.set(p.uid || p.username, p));
  return [...byUid.values()].sort((a,b)=>(b.weeklyXp||0)-(a.weeklyXp||0));
}

function SocialPage({ user, onNavigate, onUpdate, currentUid }) {
  const [players, setPlayers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [msg, setMsg] = useState("");

  const league = getWeeklyLeague(user.xp || 0);

  const refreshSocial = useCallback(async () => {
    try {
      const qTop = query(collection(db, "users"), orderBy("weeklyXp", "desc"), limit(25));
      const topSnap = await getDocs(qTop);
      setPlayers(topSnap.docs.map(d => d.data()));

      const friendIds = user.friends || [];
      if (friendIds.length > 0) {
        const friendDocs = await Promise.all(friendIds.slice(0, 20).map(uid => getDoc(doc(db, "users", uid))));
        setFriends(friendDocs.filter(d => d.exists()).map(d => d.data()));
      } else setFriends([]);

      const requestIds = user.incomingFriendRequests || [];
      if (requestIds.length > 0) {
        const reqDocs = await Promise.all(requestIds.slice(0, 20).map(uid => getDoc(doc(db, "users", uid))));
        setRequests(reqDocs.filter(d => d.exists()).map(d => d.data()));
      } else setRequests([]);
    } catch (err) {
      console.warn(err);
      setMsg("Could not load cloud social data. Check Firestore rules in Firebase.");
    }
  }, [user.friends, user.incomingFriendRequests, user.xp]);

  useEffect(() => { refreshSocial(); }, [refreshSocial]);

  const runSearch = async (e) => {
    e?.preventDefault?.();
    const term = search.trim().toLowerCase().replace(/^@/, "");
    if (!term) { setSearchResults([]); return; }
    setLoadingSearch(true); setMsg("");
    try {
      const qUsers = query(collection(db, "users"), where("usernameLower", ">=", term), where("usernameLower", "<=", term + "\uf8ff"), limit(10));
      const snap = await getDocs(qUsers);
      setSearchResults(snap.docs.map(d => d.data()).filter(p => p.uid !== currentUid));
    } catch (err) {
      console.warn(err);
      setMsg("Search failed. Firestore may need an index/rules update.");
    } finally { setLoadingSearch(false); }
  };

  const addFriend = async (target) => {
    if (!target?.uid || target.uid === currentUid) return;
    setMsg("");
    try {
      await updateDoc(doc(db, "users", currentUid), { sentFriendRequests: arrayUnion(target.uid) });
      await updateDoc(doc(db, "users", target.uid), { incomingFriendRequests: arrayUnion(currentUid) });
      const sentFriendRequests = [...new Set([...(user.sentFriendRequests || []), target.uid])];
      onUpdate({ sentFriendRequests });
      setMsg(`Friend request sent to @${target.username}.`);
    } catch (err) { console.warn(err); setMsg("Could not send friend request. Check Firestore rules."); }
  };

  const acceptFriend = async (target) => {
    if (!target?.uid) return;
    try {
      await updateDoc(doc(db, "users", currentUid), { friends: arrayUnion(target.uid), incomingFriendRequests: arrayRemove(target.uid) });
      await updateDoc(doc(db, "users", target.uid), { friends: arrayUnion(currentUid), sentFriendRequests: arrayRemove(currentUid) });
      const friendsNew = [...new Set([...(user.friends || []), target.uid])];
      const incoming = (user.incomingFriendRequests || []).filter(id => id !== target.uid);
      onUpdate({ friends: friendsNew, incomingFriendRequests: incoming });
      setRequests(reqs => reqs.filter(r => r.uid !== target.uid));
      setMsg(`You and @${target.username} are now friends.`);
    } catch (err) { console.warn(err); setMsg("Could not accept request. Check Firestore rules."); }
  };

  const sendGift = async (friend) => {
    if ((user.marks || 0) < 25) return alert("You need 25 Marks to send a gift.");
    try {
      await updateDoc(doc(db, "users", friend.uid), { marks: (friend.marks || 0) + 25, "stats.giftsReceived": (friend.stats?.giftsReceived || 0) + 1 });
    } catch (err) { console.warn("Gift cloud update failed", err); }
    const stats = { ...(user.stats || {}), giftsSent: (user.stats?.giftsSent || 0) + 1 };
    onUpdate({ marks: (user.marks || 0) - 25, stats });
    alert(`Sent @${friend.username} 25 Marks! 🎁`);
  };

  const rows = leagueRowsFromPlayers(players, user);
  const friendIds = new Set(user.friends || []);
  const sentIds = new Set(user.sentFriendRequests || []);

  return (
    <div className="social-page">
      <div className="page-top">
        <div><div className="page-title">Social Hub</div><div className="page-sub">Real player search, friends, gifts, weekly leagues, and public progress.</div></div>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNavigate("dashboard")}>← Dashboard</button>
      </div>
      {msg && <div className="privacy"><span>ℹ️</span><span>{msg}</span></div>}
      <div className="league-card">
        <div style={{display:"flex",alignItems:"center",gap:14}}><div className="league-icon">{league.icon}</div><div><div className="league-name">{league.name} League</div><div style={{opacity:.8,fontSize:13}}>Earn weekly XP to climb and unlock rewards.</div></div></div>
        <div className="reset-pill">Resets Monday</div>
      </div>
      <div className="social-grid">
        <div className="panel">
          <div className="panel-title">🔎 Find Players</div>
          <form onSubmit={runSearch} className="search-row">
            <input className="fi" placeholder="Search @username" value={search} onChange={e=>setSearch(e.target.value)} />
            <button className="btn btn-primary btn-sm" disabled={loadingSearch}>{loadingSearch ? "..." : "Search"}</button>
          </form>
          {searchResults.map(p => {
            const av = AVATARS.find(a=>a.id===p.avatar);
            const already = friendIds.has(p.uid);
            const sent = sentIds.has(p.uid);
            return <div key={p.uid} className="friend-row">
              <div className="mini-avatar">{av?.emoji || "🐻"}</div>
              <div className="row-main"><div className="row-name">{p.displayName}</div><div className="row-meta">@{p.username} · Lv {calcLevel(p.xp||0).level} · 🔥 {p.streak||0}</div></div>
              <button className="btn btn-gold btn-sm" disabled={already || sent} onClick={()=>addFriend(p)}>{already ? "Friends" : sent ? "Sent" : "Add"}</button>
            </div>
          })}
        </div>
        <div className="panel">
          <div className="panel-title">📨 Friend Requests</div>
          {requests.length === 0 && <div className="row-meta">No incoming requests yet.</div>}
          {requests.map(p => {
            const av = AVATARS.find(a=>a.id===p.avatar);
            return <div key={p.uid} className="friend-row"><div className="mini-avatar">{av?.emoji || "🐻"}</div><div className="row-main"><div className="row-name">{p.displayName}</div><div className="row-meta">@{p.username}</div></div><button className="btn btn-primary btn-sm" onClick={()=>acceptFriend(p)}>Accept</button></div>
          })}
        </div>
        <div className="panel">
          <div className="panel-title">🏆 Weekly Leaderboard</div>
          {rows.map((p,i)=>{
            const av = AVATARS.find(a=>a.id===p.avatar);
            const isMe = p.uid === currentUid;
            return <div key={p.uid || p.username} className={`rank-row ${isMe?"rank-me":""}`}>
              <div className="rank-num">#{i+1}</div><div className="mini-avatar">{av?.emoji || "🐻"}</div>
              <div className="row-main"><div className="row-name">{p.displayName} {isMe&&"(You)"}</div><div className="row-meta">@{p.username} · 🔥 {p.streak||0} streak</div></div>
              <div className="row-score">{p.weeklyXp||0} XP</div>
            </div>
          })}
        </div>
        <div className="panel">
          <div className="panel-title">👥 Friends</div>
          {friends.length === 0 && <div className="privacy" style={{marginBottom:0}}><span>👋</span><span>No friends yet. Search for a username and send a request.</span></div>}
          {friends.map(f=>{
            const av = AVATARS.find(a=>a.id===f.avatar);
            return <div className="friend-row" key={f.uid}>
              <div className="mini-avatar">{av?.emoji || "🐻"}</div>
              <div className="row-main"><div className="row-name">{f.displayName}</div><div className="row-meta">@{f.username} · Lv {calcLevel(f.xp||0).level} · 🔥 {f.streak||0}</div></div>
              <button className="btn btn-gold btn-sm" onClick={()=>sendGift(f)}>🎁 25</button>
            </div>
          })}
        </div>
      </div>
    </div>
  );
}

function ShopPage({ user, onNavigate, onUpdate }) {
  const items = getShopRotation();
  const owned = new Set(user.inventory || []);
  const buy = item => {
    if (owned.has(item.id)) return;
    if ((user.marks || 0) < item.price) return alert(`Not enough ${CURRENCY.name}.`);
    const inventory = [...(user.inventory || []), item.id];
    const equipped = { ...(user.equipped || {}) };
    if (["title","border","banner","decoration"].includes(item.type)) equipped[item.type] = item.name;
    if (item.type === "avatar") equipped.decoration = item.name;
    onUpdate({ marks: (user.marks || 0) - item.price, inventory, equipped });
    SFX.streak();
  };
  return (
    <div className="shop-page">
      <div className="page-top">
        <div><div className="page-title">Daily Shop</div><div className="page-sub">Rotating cosmetics and profile items. Inventory changes every day.</div></div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}><div className="currency-pill">{CURRENCY.icon} {user.marks || 0} {CURRENCY.name}</div><button className="btn btn-ghost btn-sm" onClick={()=>onNavigate("dashboard")}>← Dashboard</button></div>
      </div>
      <div className="shop-grid">
        {items.map(item=><div key={item.id} className={`shop-card ${owned.has(item.id)?"owned":""}`}>
          <div className="shop-icon">{item.icon}</div><div className="shop-name">{item.name}</div><div className="shop-rarity">{item.rarity} · {item.type}</div><div className="shop-price">{CURRENCY.icon} {item.price}</div>
          <button className="btn btn-primary btn-full" disabled={owned.has(item.id)} onClick={()=>buy(item)}>{owned.has(item.id)?"Owned ✓":"Buy"}</button>
        </div>)}
      </div>
    </div>
  );
}

function ProfilePage({ user, onNavigate, onUpdate }) {
  const av = AVATARS.find(a=>a.id===user.avatar);
  const { level } = calcLevel(user.xp || 0);
  const stats = user.stats || {};
  const ownedItems = SHOP_ITEMS.filter(i => (user.inventory || []).includes(i.id));
  return (
    <div className="profile-page">
      <div className="page-top"><div><div className="page-title">Public Profile</div><div className="page-sub">What other Sprak players would see.</div></div><button className="btn btn-ghost btn-sm" onClick={()=>onNavigate("dashboard")}>← Dashboard</button></div>
      <div className="profile-card">
        <div className="profile-inner">
          <div className="profile-big-av">{av?.emoji || "🐻"}</div>
          <div style={{flex:1}}>
            <div className="profile-name">{user.displayName}</div>
            <div style={{opacity:.8}}>@{user.username}</div>
            <div className="profile-title">{user.equipped?.title || "New Learner"}</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:13,opacity:.9}}>
              <span>⭐ Level {level}</span><span>🔥 {user.streak || 0} streak</span><span>{CURRENCY.icon} {user.marks || 0}</span><span>🏆 {getWeeklyLeague(user.xp||0).name}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="stats-row" style={{marginTop:18}}>
        <div className="stat-card"><div className="stat-val">{stats.lessonsCompleted||0}</div><div className="stat-lbl">Lessons</div></div>
        <div className="stat-card"><div className="stat-val">{stats.totalAnswered||0}</div><div className="stat-lbl">Questions</div></div>
        <div className="stat-card"><div className="stat-val">{stats.perfectLessons||0}</div><div className="stat-lbl">Perfect</div></div>
        <div className="stat-card"><div className="stat-val">{stats.giftsSent||0}</div><div className="stat-lbl">Gifts Sent</div></div>
      </div>
      <div className="panel">
        <div className="panel-title">🎨 Cosmetics</div>
        {ownedItems.length === 0 ? <div className="privacy"><span>🛍️</span><span>No cosmetics yet. Visit the Daily Shop and spend Marks to customize your profile.</span></div> : <div className="cosmetic-grid">{ownedItems.map(i=><div key={i.id} className="cosmetic-card"><div className="shop-icon" style={{textAlign:"left",fontSize:28}}>{i.icon}</div><div className="cosmetic-type">{i.type} · {i.rarity}</div><div className="cosmetic-name">{i.name}</div></div>)}</div>}
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function Dashboard({ user, onNavigate }) {
  const av = AVATARS.find(a=>a.id===user.avatar);
  const { level, xpInLevel, xpNeeded } = calcLevel(user.xp||0);
  const xpPct = Math.round(xpInLevel/xpNeeded*100);
  const today = getDailyKey();
  const puzzleDone = user.dailyCompletions?.[today]?.completed;
  const stats = user.stats||{};
  const acc = stats.totalAnswered>0 ? Math.round(stats.totalCorrect/stats.totalAnswered*100) : 0;
  const userAch = new Set(user.achievements||[]);
  const wrongCount = Object.values(user.wrongAnswers||{}).filter(v=>v>0).length;

  return (
    <div className="dash">
      <div className="dash-head">
        <div className="dash-av">{av?.emoji||"🐻"}</div>
        <div className="dash-info">
          <h2>{user.displayName}</h2>
          <p>@{user.username}</p>
          <div className="lvl-badge">⭐ Level {level}</div>
          <div className="xp-wrap">
            <div className="xp-lbl"><span>XP</span><span>{xpInLevel}/{xpNeeded}</span></div>
            <div className="xp-bar"><div className="xp-fill" style={{width:xpPct+"%"}}/></div>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-val">🔥 {user.streak||0}</div><div className="stat-lbl">Streak</div></div>
        <div className="stat-card"><div className="stat-val">{CURRENCY.icon} {user.marks||0}</div><div className="stat-lbl">Marks</div></div>
        <div className="stat-card"><div className="stat-val">{acc}%</div><div className="stat-lbl">Accuracy</div></div>
        <div className="stat-card"><div className="stat-val">{stats.totalAnswered||0}</div><div className="stat-lbl">Questions</div></div>
      </div>

      <div className="dash-actions">
        <div className={`action-card ${puzzleDone?"disabled":""}`} onClick={()=>!puzzleDone&&onNavigate("puzzle")}>
          <div className="action-icon">🧩</div>
          <div className="action-title">Daily Puzzle</div>
          <div className="action-desc">5 questions, new every day</div>
          {puzzleDone ? <div className="badge-done">✓ Done today</div> : <div className="badge">+50 XP</div>}
        </div>
        <div className="action-card" onClick={()=>onNavigate("roadmap")}>
          <div className="action-icon">🗺️</div>
          <div className="action-title">Roadmap</div>
          <div className="action-desc">Structured lessons, unit by unit</div>
          <div className="badge">Learn</div>
        </div>
        <div className={`action-card ${wrongCount===0?"disabled":""}`} onClick={()=>wrongCount>0&&onNavigate("review")}>
          <div className="action-icon">⚡</div>
          <div className="action-title">Review</div>
          <div className="action-desc">{wrongCount>0?`${wrongCount} questions to practice`:"Complete lessons first"}</div>
          {wrongCount>0 ? <div className="badge">Fix {wrongCount}</div> : <div className="badge-done">All good!</div>}
        </div>
        <div className="action-card" onClick={()=>onNavigate("social")}>
          <div className="action-icon">🏆</div>
          <div className="action-title">Social Hub</div>
          <div className="action-desc">Leaderboards, friends, and weekly leagues</div>
          <div className="badge">{getWeeklyLeague(user.xp||0).name}</div>
        </div>
        <div className="action-card" onClick={()=>onNavigate("shop")}>
          <div className="action-icon">🛍️</div>
          <div className="action-title">Daily Shop</div>
          <div className="action-desc">Rotating cosmetics and profile items</div>
          <div className="badge">{CURRENCY.icon} Spend Marks</div>
        </div>
        <div className="action-card" onClick={()=>onNavigate("profile")}>
          <div className="action-icon">🎨</div>
          <div className="action-title">Profile</div>
          <div className="action-desc">Public profile and cosmetics</div>
          <div className="badge">Customize</div>
        </div>
      </div>

      <div style={{marginBottom:24}}>
        <div className="sec-title">Achievements</div>
        <div className="ach-grid">
          {ACHIEVEMENTS.map(a => (
            <div key={a.id} className={`ach-card ${userAch.has(a.id)?"ok":"lock"}`}>
              <div className="ach-icon">{a.icon}</div>
              <div className="ach-info"><h4>{a.name}</h4><p>{a.description}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("loading");
  const [user, setUser] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null); // {unit, lesson}
  const uidRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, fbUser => {
      (async () => {
        if (fbUser) {
          uidRef.current = fbUser.uid;
          const cloud = await loadCloudGameData(fbUser.uid);
          const local = getGameData(fbUser.uid);
          const gd = cloud || local;
          if (gd) { saveLocalGameData(fbUser.uid, gd); setUser(gd); setPage("dashboard"); }
          else {
            const fresh = makeDefaultGameData(fbUser.uid, { displayName: fbUser.email?.split("@")[0]||"Learner", username: (fbUser.email?.split("@")[0]||"learner") });
            saveGameData(fbUser.uid, fresh); setUser(fresh); setPage("dashboard");
          }
        } else { uidRef.current = null; setUser(null); setPage("landing"); }
      })();
    });
    return ()=>unsub();
  }, []);

  const updateUser = updates => {
    const u = { ...user, ...updates };
    u.achievements = checkAchievements(u);
    setUser(u); saveGameData(uidRef.current, u); return u;
  };

  const nav = p => setPage(p);

  const handleSignupComplete = (gd, lvlChoice) => {
    uidRef.current = gd.uid; setUser(gd);
    if (lvlChoice === "none") setPage("dashboard");
    else setPage("quiz");
  };

  const handlePlacementComplete = startLevel => {
    updateUser({ xp: totalXpForLevel(startLevel) });
    setPage("dashboard");
  };

  const handleLogin = gd => { uidRef.current = gd.uid; setUser(gd); setPage("dashboard"); };
  const handleLogout = async () => { await signOut(auth); uidRef.current = null; setUser(null); setPage("landing"); };

  const handleLessonComplete = (xpEarned, correct, total, mode, lessonId, perfect) => {
    const today = getDailyKey();
    const stats = { ...(user.stats||{}) };
    stats.totalAnswered = (stats.totalAnswered||0) + total;
    stats.totalCorrect = (stats.totalCorrect||0) + correct;
    if (mode==="puzzle") stats.puzzlesCompleted = (stats.puzzlesCompleted||0)+1;
    else { stats.lessonsCompleted = (stats.lessonsCompleted||0)+1; if (perfect) stats.perfectLessons = (stats.perfectLessons||0)+1; }

    const prevXp = user.xp||0, newXp = prevXp+xpEarned;
    const prevLvl = calcLevel(prevXp).level, newLvl = calcLevel(newXp).level;

    let streak = user.streak||0;
    if (user.lastActiveDate !== today) {
      const d = new Date(); d.setDate(d.getDate()-1);
      const yest = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      streak = user.lastActiveDate===yest ? streak+1 : 1;
      if (streak > 0 && streak % 3 === 0) SFX.streak();
    }

    const daily = { ...(user.dailyCompletions||{}) };
    if (mode==="puzzle") daily[today] = { completed:true, xpEarned };

    const completedLessons = { ...(user.completedLessons||{}) };
    if (lessonId && mode!=="puzzle" && mode!=="review") completedLessons[lessonId] = true;

    const marksEarned = Math.max(10, Math.round(xpEarned / 2)) + (perfect ? 25 : 0);
    updateUser({ xp:newXp, weeklyXp:(user.weeklyXp||0)+xpEarned, marks:(user.marks||0)+marksEarned, stats, streak, lastActiveDate:today, dailyCompletions:daily, completedLessons });
    setActiveLesson(null);
    if (newLvl > prevLvl) setLevelUp(newLvl);
    else nav("dashboard");
  };

  const handleAnswer_trackWrong = (q, correct) => {
    // track wrong answers
    const wrong = { ...(user.wrongAnswers||{}) };
    if (!correct) wrong[q.id] = (wrong[q.id]||0)+1;
    else if (wrong[q.id]) wrong[q.id] = Math.max(0, wrong[q.id]-1);
    updateUser({ wrongAnswers: wrong });
  };

  if (page === "loading") return (
    <div className="app"><style>{CSS}</style>
      <div className="loading-screen"><div className="loading-logo">Sprak</div></div>
    </div>
  );

  const showNav = user && !["landing","login","signup","quiz"].includes(page);

  return (
    <div className="app">
      <style>{CSS}</style>
      {showNav && <Nav user={user} onLogout={handleLogout} onNavigate={nav} />}
      {levelUp && <LevelUpOverlay level={levelUp} onContinue={()=>{setLevelUp(null);nav("dashboard");}} />}

      {page==="landing" && <Landing onNavigate={nav} />}
      {page==="signup" && <Signup onNavigate={nav} onComplete={handleSignupComplete} />}
      {page==="login" && <Login onNavigate={nav} onLogin={handleLogin} />}
      {page==="quiz" && <PlacementQuiz onComplete={handlePlacementComplete} />}
      {page==="dashboard" && user && <Dashboard user={user} onNavigate={nav} />}
      {page==="social" && user && <SocialPage user={user} currentUid={uidRef.current} onNavigate={nav} onUpdate={updateUser} />}
      {page==="shop" && user && <ShopPage user={user} onNavigate={nav} onUpdate={updateUser} />}
      {page==="profile" && user && <ProfilePage user={user} onNavigate={nav} onUpdate={updateUser} />}

      {page==="roadmap" && user && (
        <Roadmap user={user} onBack={()=>nav("dashboard")}
          onStartLesson={(unit,lesson)=>{ setActiveLesson({unit,lesson}); nav("lesson"); }} />
      )}
      {page==="lesson" && user && activeLesson && (
        <LessonRunner key={activeLesson.lesson.id}
          lesson={activeLesson.lesson} unit={activeLesson.unit}
          mode="lesson" user={user}
          onComplete={handleLessonComplete}
          onBack={()=>nav("roadmap")} />
      )}
      {page==="puzzle" && user && (
        <LessonRunner key={"puzzle-"+getDailyKey()}
          mode="puzzle" user={user}
          onComplete={handleLessonComplete}
          onBack={()=>nav("dashboard")} />
      )}
      {page==="review" && user && (
        <LessonRunner key={"review-"+Date.now()}
          mode="review" user={user}
          onComplete={handleLessonComplete}
          onBack={()=>nav("dashboard")} />
      )}
    </div>
  );
}
