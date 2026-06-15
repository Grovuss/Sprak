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
// Each unit has lessons, each lesson has questions
// Question types: mc (multiple choice), article, tap_build (tap words to build sentence), match (match pairs)
const UNITS = [
  {
    id: 1, title: "Greetings & Basics", icon: "👋", color: "#52B788",
    description: "Start your German journey with everyday greetings and polite phrases.",
    lessons: [
      {
        id: "1-1", title: "Saying Hello", xpReward: 30,
        intro: { title: "Saying Hello in German", body: "Germans greet each other warmly. The most common greeting is 'Hallo' (informal) or 'Guten Tag' (formal, meaning 'Good day'). Let's learn the basics!", tip: "🕐 'Guten Morgen' is used before noon, 'Guten Tag' during the day, 'Guten Abend' in the evening." },
        questions: [
          { id:"q1", type:"mc", german:"Hallo", english:"Hello", prompt:"What does 'Hallo' mean?", options:["Hello","Goodbye","Please","Thanks"], correct:"Hello", explanation:"'Hallo' is the standard informal greeting in German — just like 'Hello' in English!" },
          { id:"q2", type:"mc", prompt:"How do you say 'Good morning' in German?", options:["Guten Morgen","Guten Tag","Guten Abend","Gute Nacht"], correct:"Guten Morgen", explanation:"'Guten Morgen' = Good morning. 'Morgen' means morning." },
          { id:"q3", type:"mc", german:"Tschüss", english:"Bye", prompt:"What does 'Tschüss' mean?", options:["Hello","See you later","Bye","Good night"], correct:"Bye", explanation:"'Tschüss' is the casual way to say goodbye — perfect for friends and family." },
          { id:"q4", type:"mc", prompt:"A German colleague greets you formally. What do they say?", options:["Hallo!","Tschüss!","Guten Tag!","Gute Nacht!"], correct:"Guten Tag!", explanation:"'Guten Tag' (Good day) is the standard formal greeting used in professional settings." },
          { id:"q5", type:"tap_build", prompt:"Build the phrase: 'Good evening'", words:["Guten","Abend","Morgen","Tag"], correct:["Guten","Abend"], explanation:"'Guten Abend' = Good evening. 'Abend' means evening." },
        ]
      },
      {
        id: "1-2", title: "Polite Phrases", xpReward: 30,
        intro: { title: "Please, Thank You & Sorry", body: "Politeness goes a long way! These phrases are used constantly in German daily life.", tip: "💡 'Bitte' does double duty — it means both 'please' AND 'you're welcome'!" },
        questions: [
          { id:"q6", type:"mc", german:"Danke", english:"Thank you", prompt:"What does 'Danke' mean?", options:["Please","Sorry","Thank you","Welcome"], correct:"Thank you", explanation:"'Danke' means thank you. 'Danke schön' (Thank you very much) is even more polite!" },
          { id:"q7", type:"mc", german:"Bitte", english:"Please / You're welcome", prompt:"What does 'Bitte' mean?", options:["Please","Please or You're welcome","Sorry","No problem"], correct:"Please or You're welcome", explanation:"'Bitte' is flexible — it means 'please' when asking, and 'you're welcome' when responding to 'Danke'." },
          { id:"q8", type:"mc", prompt:"Someone says 'Danke!' to you. What's the natural response?", options:["Hallo!","Tschüss!","Bitte!","Ja!"], correct:"Bitte!", explanation:"'Bitte' as a response to 'Danke' means 'You're welcome'. Very common in everyday German." },
          { id:"q9", type:"mc", german:"Entschuldigung", english:"Excuse me / Sorry", prompt:"What does 'Entschuldigung' mean?", options:["Hello","Goodbye","Excuse me / Sorry","Please"], correct:"Excuse me / Sorry", explanation:"'Entschuldigung' is used to apologize OR to get someone's attention — like 'Excuse me' in English." },
          { id:"q10", type:"tap_build", prompt:"Build: 'Thank you very much'", words:["Danke","schön","Bitte","Hallo"], correct:["Danke","schön"], explanation:"'Danke schön' = Thank you very much. 'Schön' means 'beautiful/nice'." },
        ]
      }
    ]
  },
  {
    id: 2, title: "Numbers & Colors", icon: "🔢", color: "#74C0FC",
    description: "Count, tell time, and describe the world around you.",
    lessons: [
      {
        id: "2-1", title: "Numbers 1–10", xpReward: 35,
        intro: { title: "Counting in German", body: "German numbers follow logical patterns. Once you learn 1–12, you can build any number! Let's start with the basics.", tip: "🎵 Many German children learn numbers through songs — try counting out loud as you go!" },
        questions: [
          { id:"q11", type:"mc", german:"eins", english:"one", prompt:"What number is 'eins'?", options:["One","Two","Three","Four"], correct:"One", explanation:"'Eins' = 1. In phone numbers and counting, Germans say 'eins' for 1." },
          { id:"q12", type:"mc", german:"drei", english:"three", prompt:"What number is 'drei'?", options:["Two","Three","Four","Five"], correct:"Three", explanation:"'Drei' = 3. Notice it sounds a bit like 'dry' — a fun way to remember it!" },
          { id:"q13", type:"mc", prompt:"How do you say 'five' in German?", options:["vier","fünf","sechs","sieben"], correct:"fünf", explanation:"'Fünf' = 5. The 'ü' is an umlaut — a uniquely German vowel sound." },
          { id:"q14", type:"mc", german:"zehn", english:"ten", prompt:"What does 'zehn' mean?", options:["Six","Eight","Nine","Ten"], correct:"Ten", explanation:"'Zehn' = 10. Germans count 'eins, zwei, drei, vier, fünf, sechs, sieben, acht, neun, zehn'." },
          { id:"q15", type:"mc", prompt:"You want to order 2 coffees. What do you say?", options:["Zwei Kaffee, bitte!","Drei Kaffee, bitte!","Eins Kaffee, bitte!","Vier Kaffee, bitte!"], correct:"Zwei Kaffee, bitte!", explanation:"'Zwei' = 2, 'Kaffee' = coffee, 'bitte' = please. Perfect café German!" },
        ]
      },
      {
        id: "2-2", title: "Colors", xpReward: 35,
        intro: { title: "Colors in German", body: "Colors (Farben) in German are adjectives — they change slightly depending on what noun they describe. For now, let's just learn the basic words!", tip: "🎨 'Lieblingsfarbe' means 'favorite color' — a very common German conversation starter!" },
        questions: [
          { id:"q16", type:"mc", german:"rot", english:"red", prompt:"What color is 'rot'?", options:["Blue","Green","Red","Yellow"], correct:"Red", explanation:"'Rot' = red. Think of 'rouge' in French — both come from Latin 'rubrum'." },
          { id:"q17", type:"mc", german:"blau", english:"blue", prompt:"What color is 'blau'?", options:["Blue","Green","Yellow","Black"], correct:"Blue", explanation:"'Blau' = blue. This one is easy — it sounds very similar to 'blue'!" },
          { id:"q18", type:"mc", prompt:"How do you say 'green' in German?", options:["gelb","schwarz","grün","weiß"], correct:"grün", explanation:"'Grün' = green. The umlaut 'ü' gives it that distinctly German sound." },
          { id:"q19", type:"mc", german:"schwarz", english:"black", prompt:"What color is 'schwarz'?", options:["White","Grey","Black","Brown"], correct:"Black", explanation:"'Schwarz' = black. Germany's famous Black Forest is 'Schwarzwald' — literally 'black forest'." },
          { id:"q20", type:"mc", prompt:"Das Gras ist ___. (The grass is green.)", options:["rot","blau","grün","gelb"], correct:"grün", explanation:"'Grün' fits perfectly here. German grass is just as green as English grass!" },
        ]
      }
    ]
  },
  {
    id: 3, title: "Articles & Gender", icon: "📝", color: "#F4A261",
    description: "Master der, die, das — the trickiest part of German for English speakers.",
    lessons: [
      {
        id: "3-1", title: "Introducing Articles", xpReward: 40,
        intro: { title: "The Famous der, die, das", body: "Every German noun has a grammatical gender: masculine (der), feminine (die), or neuter (das). Unlike English, there's no shortcut — you need to memorize each noun with its article.", tip: "🧠 A tutor trick: always learn nouns WITH their article. Don't say 'Hund', say 'der Hund'. It becomes automatic over time!" },
        questions: [
          { id:"q21", type:"article", german:"Hund", english:"dog", prompt:"Which article goes with 'Hund' (dog)?", options:["der","die","das"], correct:"der", explanation:"'der Hund' — dog is masculine in German. Male animals are often masculine, but not always!" },
          { id:"q22", type:"article", german:"Katze", english:"cat", prompt:"Which article goes with 'Katze' (cat)?", options:["der","die","das"], correct:"die", explanation:"'die Katze' — cat is feminine. Nouns ending in '-e' are very often feminine in German." },
          { id:"q23", type:"article", german:"Haus", english:"house", prompt:"Which article goes with 'Haus' (house)?", options:["der","die","das"], correct:"das", explanation:"'das Haus' — house is neuter. Diminutives and many buildings use 'das'." },
          { id:"q24", type:"article", german:"Frau", english:"woman", prompt:"Which article goes with 'Frau' (woman)?", options:["der","die","das"], correct:"die", explanation:"'die Frau' — woman is feminine, as you'd expect. 'Frau' also means 'Mrs.' or 'Ms.'." },
          { id:"q25", type:"article", german:"Mann", english:"man", prompt:"Which article goes with 'Mann' (man)?", options:["der","die","das"], correct:"der", explanation:"'der Mann' — man is masculine. 'Mann' also means 'husband'." },
        ]
      },
      {
        id: "3-2", title: "More Articles", xpReward: 40,
        intro: { title: "Practice Makes Perfect", body: "Let's drill more nouns. Remember the trick: nouns ending in '-ung', '-heit', '-keit', '-schaft' are almost always feminine (die). Nouns ending in '-chen' or '-lein' are always neuter (das).", tip: "💡 'Das Mädchen' (the girl) is neuter — confusing! That's because '-chen' always makes das, even for people." },
        questions: [
          { id:"q26", type:"article", german:"Kind", english:"child", prompt:"Which article goes with 'Kind' (child)?", options:["der","die","das"], correct:"das", explanation:"'das Kind' — child is neuter. Children are neuter in German grammar (don't take it personally!)" },
          { id:"q27", type:"article", german:"Buch", english:"book", prompt:"Which article goes with 'Buch' (book)?", options:["der","die","das"], correct:"das", explanation:"'das Buch' — book is neuter. Many everyday objects like 'das Haus', 'das Auto', 'das Buch' are neuter." },
          { id:"q28", type:"article", german:"Schule", english:"school", prompt:"Which article goes with 'Schule' (school)?", options:["der","die","das"], correct:"die", explanation:"'die Schule' — school is feminine. Words ending in '-e' are often feminine." },
          { id:"q29", type:"mc", prompt:"A German tutor tip: nouns ending in '-ung' are almost always...?", options:["masculine (der)","feminine (die)","neuter (das)","any gender"], correct:"feminine (die)", explanation:"Words like 'die Zeitung' (newspaper), 'die Wohnung' (apartment), 'die Meinung' (opinion) — all '-ung' = die!" },
          { id:"q30", type:"tap_build", prompt:"Build: 'the dog' (masculine)", words:["der","die","das","Hund","Katze","Haus"], correct:["der","Hund"], explanation:"'der Hund' — 'der' for masculine nouns. Always learn the article with the noun!" },
        ]
      }
    ]
  },
  {
    id: 4, title: "Food & Drink", icon: "🍕", color: "#E76F51",
    description: "Order food, talk about meals, and survive a German café.",
    lessons: [
      {
        id: "4-1", title: "At the Café", xpReward: 40,
        intro: { title: "Kaffeepause! ☕", body: "Germany has a strong café culture. Knowing how to order food and drink is essential — and impresses locals! German cafés often have Kuchen (cake) as a staple.", tip: "🗣️ In a German café, you'd say: 'Ich hätte gern einen Kaffee, bitte.' (I'd like a coffee, please.) Very polite!" },
        questions: [
          { id:"q31", type:"mc", german:"Kaffee", english:"coffee", prompt:"What is 'Kaffee'?", options:["Tea","Coffee","Juice","Water"], correct:"Coffee", explanation:"'Kaffee' = coffee. Germany is one of the world's biggest coffee consumers!" },
          { id:"q32", type:"mc", german:"Wasser", english:"water", prompt:"What is 'Wasser'?", options:["Juice","Wine","Water","Milk"], correct:"Water", explanation:"'Wasser' = water. In German restaurants, sparkling water ('Sprudelwasser') is the default unless you ask for 'still'." },
          { id:"q33", type:"mc", prompt:"How do you say 'I drink coffee' in German?", options:["Ich esse Kaffee","Ich trinke Kaffee","Ich habe Kaffee","Ich mag Kaffee"], correct:"Ich trinke Kaffee", explanation:"'Trinken' = to drink. 'Essen' = to eat. Important distinction — you drink Kaffee, you eat Kuchen!" },
          { id:"q34", type:"mc", german:"Brot", english:"bread", prompt:"What is 'Brot'?", options:["Cake","Bread","Butter","Cheese"], correct:"Bread", explanation:"'das Brot' = bread. Germany has over 300 types of bread — it's a national obsession!" },
          { id:"q35", type:"tap_build", prompt:"Build: 'I eat bread'", words:["Ich","esse","trinke","Brot","Wasser"], correct:["Ich","esse","Brot"], explanation:"'Ich esse Brot' — 'ich' = I, 'esse' = eat (first person of 'essen'), 'Brot' = bread." },
        ]
      },
      {
        id: "4-2", title: "Meals & Food Words", xpReward: 40,
        intro: { title: "Mahlzeiten! 🍽️", body: "Germans take their meals seriously. 'Frühstück' (breakfast) is often a big spread, 'Mittagessen' (lunch) is the main meal, and 'Abendessen' (dinner) tends to be lighter.", tip: "🥨 The famous German pretzel is 'Brezel'. When you see someone eating one, you can say 'Guten Appetit!' (Enjoy your meal!)" },
        questions: [
          { id:"q36", type:"mc", german:"Frühstück", english:"breakfast", prompt:"What is 'Frühstück'?", options:["Lunch","Dinner","Breakfast","Snack"], correct:"Breakfast", explanation:"'Frühstück' = breakfast. 'Früh' = early, 'Stück' = piece — so literally an 'early piece'. Clever!" },
          { id:"q37", type:"mc", german:"Mittagessen", english:"lunch", prompt:"What is 'Mittagessen'?", options:["Breakfast","Lunch","Dinner","Snack"], correct:"Lunch", explanation:"'Mittagessen' = lunch. 'Mittag' = midday + 'essen' = eat/food. The midday meal!" },
          { id:"q38", type:"mc", prompt:"It's 7pm in Germany. You sit down to eat. What meal is it?", options:["Frühstück","Mittagessen","Abendessen","Kaffee"], correct:"Abendessen", explanation:"'Abendessen' = dinner/evening meal. 'Abend' = evening + 'essen' = food. Germans often eat dinner early." },
          { id:"q39", type:"mc", german:"Milch", english:"milk", prompt:"What is 'Milch'?", options:["Water","Juice","Milk","Wine"], correct:"Milk", explanation:"'die Milch' = milk. Very similar to English! German and English share many food words." },
          { id:"q40", type:"mc", prompt:"'Guten Appetit!' is said to someone who is...?", options:["Sleeping","About to eat","Greeting you","Leaving"], correct:"About to eat", explanation:"'Guten Appetit' = Enjoy your meal! It's said before eating, similar to the French 'Bon appétit'." },
        ]
      }
    ]
  },
  {
    id: 5, title: "Verbs & Action", icon: "⚡", color: "#339AF0",
    description: "Learn essential German verbs and how to conjugate them.",
    lessons: [
      {
        id: "5-1", title: "To Be: sein", xpReward: 45,
        intro: { title: "The Most Important Verb: sein", body: "'Sein' (to be) is the most used verb in German. It's irregular — meaning you can't just add a simple ending. You have to memorize the forms.", tip: "📋 'Sein' forms:\n• ich bin (I am)\n• du bist (you are)\n• er/sie/es ist (he/she/it is)\n• wir sind (we are)\n• ihr seid (you all are)\n• sie sind (they are)" },
        questions: [
          { id:"q41", type:"fill", german:"Ich ___ müde.", english:"I am tired.", blank:"bin", options:["bin","ist","sind","bist"], explanation:"'Ich bin' = I am. First person singular of 'sein' (to be)." },
          { id:"q42", type:"fill", german:"Du ___ nett.", english:"You are nice.", blank:"bist", options:["bin","bist","ist","sind"], explanation:"'Du bist' = You are (informal singular). Used with friends, family, and children." },
          { id:"q43", type:"fill", german:"Er ___ Arzt.", english:"He is a doctor.", blank:"ist", options:["bin","bist","ist","sind"], explanation:"'Er ist' = He is. The same form is used for 'sie ist' (she is) and 'es ist' (it is)." },
          { id:"q44", type:"fill", german:"Wir ___ Freunde.", english:"We are friends.", blank:"sind", options:["bin","ist","sind","seid"], explanation:"'Wir sind' = We are. 'Freunde' = friends (plural of 'Freund')." },
          { id:"q45", type:"mc", prompt:"'Sie ___ aus Deutschland.' How do you say 'She is from Germany'?", options:["She sind","She ist","She bin","She bist"], correct:"She ist", explanation:"'Sie ist' = She is. In context: 'Sie ist aus Deutschland' = She is from Germany." },
        ]
      },
      {
        id: "5-2", title: "Common Verbs", xpReward: 45,
        intro: { title: "Action Words 🎬", body: "German verbs follow patterns for conjugation. Regular verbs add endings to the stem: -e, -st, -t, -en, -t, -en. Let's learn some essential verbs first!", tip: "🎯 Tip from German tutors: learn verbs in the 'ich' (I) form first, since that's what you'll use most in daily conversation." },
        questions: [
          { id:"q46", type:"mc", german:"sprechen", english:"to speak", prompt:"What does 'sprechen' mean?", options:["to listen","to speak","to write","to read"], correct:"to speak", explanation:"'Sprechen' = to speak. 'Ich spreche Deutsch' = I speak German. A very useful phrase!" },
          { id:"q47", type:"fill", german:"Wir ___ Deutsch.", english:"We speak German.", blank:"sprechen", options:["spreche","sprichst","spricht","sprechen"], explanation:"'Wir sprechen' = We speak. 'Sprechen' is a stem-changing verb — 'spreche, sprichst, spricht, sprechen'." },
          { id:"q48", type:"mc", german:"wohnen", english:"to live (reside)", prompt:"What does 'wohnen' mean?", options:["to live (be alive)","to work","to live (reside)","to travel"], correct:"to live (reside)", explanation:"'Wohnen' = to reside somewhere. 'Ich wohne in Berlin' = I live in Berlin. Regular verb!" },
          { id:"q49", type:"fill", german:"Er ___ in München.", english:"He lives in Munich.", blank:"wohnt", options:["wohne","wohnst","wohnt","wohnen"], explanation:"'Er wohnt' = He lives. Regular verbs: take the stem (wonh-) and add -t for er/sie/es." },
          { id:"q50", type:"tap_build", prompt:"Build: 'I speak German'", words:["Ich","spreche","sprichst","Deutsch","Englisch"], correct:["Ich","spreche","Deutsch"], explanation:"'Ich spreche Deutsch' — the essential phrase for every German learner!" },
        ]
      }
    ]
  },
  {
    id: 6, title: "Conversations", icon: "💬", color: "#9775FA",
    description: "Put it all together with real German conversation scenarios.",
    lessons: [
      {
        id: "6-1", title: "Introducing Yourself", xpReward: 50,
        intro: { title: "Meeting Someone New 🤝", body: "One of the first things you'll do in Germany is introduce yourself. Learn how to say your name, where you're from, and what you do.", tip: "🗣️ A typical German intro:\n'Hallo, ich bin [Name]. Ich komme aus [country]. Ich bin [job/student].\nNice to meet you!'" },
        questions: [
          { id:"q51", type:"mc", prompt:"How do you say 'My name is Max' in German?", options:["Ich heiße Max","Ich bin Max heißt","Mein Name ist heißt Max","Ich Max heiße"], correct:"Ich heiße Max", explanation:"'Ich heiße...' = My name is... Literally 'I am called...'. Very natural German intro!" },
          { id:"q52", type:"mc", german:"Woher kommst du?", english:"Where are you from?", prompt:"What does 'Woher kommst du?' mean?", options:["What do you do?","Where are you going?","Where are you from?","How old are you?"], correct:"Where are you from?", explanation:"'Woher' = from where, 'kommst' = come (you), 'du' = you. A very common question when meeting someone!" },
          { id:"q53", type:"mc", prompt:"You're from the US. How do you say 'I come from America'?", options:["Ich komme aus Amerika","Ich bin Amerika","Ich gehe nach Amerika","Ich lebe Amerika"], correct:"Ich komme aus Amerika", explanation:"'Ich komme aus...' = I come from... 'Aus' means 'from' when talking about your origin." },
          { id:"q54", type:"mc", german:"Wie geht's?", english:"How are you? (informal)", prompt:"What does 'Wie geht's?' mean?", options:["What's your name?","How are you?","Where are you from?","How old are you?"], correct:"How are you?", explanation:"'Wie geht's?' = How's it going? Short for 'Wie geht es dir?' Very common casual greeting between friends." },
          { id:"q55", type:"tap_build", prompt:"Build: 'I am a student'", words:["Ich","bin","bist","Student","Lehrer","Arzt"], correct:["Ich","bin","Student"], explanation:"'Ich bin Student' = I am a student. Simple! Note: no 'ein' needed for professions in German." },
        ]
      }
    ]
  }
];


UNITS.push(
  {
    id: 7, title: "Travel Germany", icon: "🚆", color: "#20C997",
    description: "Navigate stations, hotels, directions, and everyday travel moments.",
    lessons: [
      { id:"7-1", title:"Train Station", xpReward:55, intro:{title:"At the Bahnhof",body:"German train stations are full of useful words: Gleis (platform), Zug (train), Fahrkarte (ticket), and Verspätung (delay).",tip:"🚆 'Wo ist Gleis drei?' means 'Where is platform three?'"}, questions:[
        {id:"q701",type:"mc",german:"Bahnhof",english:"train station",prompt:"What does 'Bahnhof' mean?",options:["airport","train station","hotel","street"],correct:"train station",explanation:"'der Bahnhof' is the train station."},
        {id:"q702",type:"mc",german:"Fahrkarte",english:"ticket",prompt:"What is a 'Fahrkarte'?",options:["ticket","suitcase","platform","map"],correct:"ticket",explanation:"'die Fahrkarte' is a travel ticket."},
        {id:"q703",type:"fill",german:"Der Zug hat ___.",english:"The train is delayed.",blank:"Verspätung",options:["Verspätung","Hunger","Zimmer","Wasser"],explanation:"'Verspätung' means delay."},
        {id:"q704",type:"mc",prompt:"How do you ask 'Where is platform three?'",options:["Wo ist Gleis drei?","Wann ist Gleis drei?","Was kostet Gleis drei?","Ich bin Gleis drei."],correct:"Wo ist Gleis drei?",explanation:"'Wo ist...' asks where something is."},
        {id:"q705",type:"tap_build",prompt:"Build: 'Where is the train?'",words:["Wo","ist","der","Zug","die","Straße"],correct:["Wo","ist","der","Zug"],explanation:"'Wo ist der Zug?' = Where is the train?"}
      ]},
      { id:"7-2", title:"Hotels & Directions", xpReward:55, intro:{title:"Finding Your Way",body:"Travel German is practical and forgiving. Focus on simple questions: where, how much, and I need.",tip:"🧭 'Ich suche...' means 'I am looking for...'"}, questions:[
        {id:"q706",type:"mc",german:"Zimmer",english:"room",prompt:"What does 'Zimmer' mean?",options:["room","key","bed","door"],correct:"room",explanation:"'das Zimmer' means room."},
        {id:"q707",type:"article",german:"Hotel",english:"hotel",prompt:"Which article goes with 'Hotel'?",options:["der","die","das"],correct:"das",explanation:"It's 'das Hotel'."},
        {id:"q708",type:"fill",german:"Ich suche ___ Hotel.",english:"I am looking for the hotel.",blank:"das",options:["der","die","das","den"],explanation:"Hotel is neuter: das Hotel."},
        {id:"q709",type:"mc",prompt:"What does 'links' mean?",options:["left","right","straight ahead","behind"],correct:"left",explanation:"'links' = left; 'rechts' = right."},
        {id:"q710",type:"mc",prompt:"What does 'geradeaus' mean?",options:["straight ahead","left","right","nearby"],correct:"straight ahead",explanation:"'geradeaus' is a key direction word."}
      ]}
    ]
  },
  {
    id: 8, title: "Daily Life", icon: "🏠", color: "#845EF7",
    description: "Talk about routines, chores, home, and what you do every day.",
    lessons: [
      { id:"8-1", title:"Morning Routine", xpReward:60, intro:{title:"Everyday German",body:"Routines help you learn verbs naturally: wake up, eat, work, learn, sleep.",tip:"⏰ 'Ich stehe auf' means 'I get up.' The verb splits!"}, questions:[
        {id:"q801",type:"mc",german:"aufstehen",english:"to get up",prompt:"What does 'aufstehen' mean?",options:["to get up","to eat","to sleep","to buy"],correct:"to get up",explanation:"'aufstehen' is a separable verb."},
        {id:"q802",type:"fill",german:"Ich ___ um sieben Uhr auf.",english:"I get up at seven o'clock.",blank:"stehe",options:["stehe","steht","stehen","stehst"],explanation:"'Ich stehe ... auf' = I get up."},
        {id:"q803",type:"mc",german:"arbeiten",english:"to work",prompt:"What does 'arbeiten' mean?",options:["to work","to live","to drink","to learn"],correct:"to work",explanation:"'arbeiten' = to work."},
        {id:"q804",type:"tap_build",prompt:"Build: 'I learn German'",words:["Ich","lerne","Deutsch","du","lernst"],correct:["Ich","lerne","Deutsch"],explanation:"'Ich lerne Deutsch.'"},
        {id:"q805",type:"mc",prompt:"What does 'jeden Tag' mean?",options:["every day","tonight","never","later"],correct:"every day",explanation:"'jeden Tag' = every day."}
      ]},
      { id:"8-2", title:"Home Words", xpReward:60, intro:{title:"Around the House",body:"House vocabulary is extremely useful because it shows up constantly in basic conversation.",tip:"🏠 Rooms often use 'das': das Zimmer, das Bad, das Wohnzimmer."}, questions:[
        {id:"q806",type:"mc",german:"Küche",english:"kitchen",prompt:"What is 'Küche'?",options:["kitchen","bedroom","bathroom","garden"],correct:"kitchen",explanation:"'die Küche' = kitchen."},
        {id:"q807",type:"article",german:"Tür",english:"door",prompt:"Which article goes with 'Tür'?",options:["der","die","das"],correct:"die",explanation:"'die Tür' = the door."},
        {id:"q808",type:"mc",german:"Fenster",english:"window",prompt:"What does 'Fenster' mean?",options:["window","floor","wall","chair"],correct:"window",explanation:"'das Fenster' = window."},
        {id:"q809",type:"fill",german:"Das ___ ist offen.",english:"The window is open.",blank:"Fenster",options:["Fenster","Tür","Tisch","Stuhl"],explanation:"'Das Fenster ist offen.'"},
        {id:"q810",type:"mc",prompt:"What does 'sauber' mean?",options:["clean","dirty","loud","small"],correct:"clean",explanation:"'sauber' = clean."}
      ]}
    ]
  },
  {
    id: 9, title: "Questions & Answers", icon: "❓", color: "#FAB005",
    description: "Ask better questions and understand common answers.",
    lessons: [
      { id:"9-1", title:"Question Words", xpReward:65, intro:{title:"W-Fragen",body:"German question words often start with W: wer, was, wo, wann, warum, wie.",tip:"❓ 'Warum?' is 'Why?' — one of the most useful words in any language."}, questions:[
        {id:"q901",type:"mc",german:"wer",english:"who",prompt:"What does 'wer' mean?",options:["who","what","where","when"],correct:"who",explanation:"'Wer?' = Who?"},
        {id:"q902",type:"mc",german:"warum",english:"why",prompt:"What does 'warum' mean?",options:["why","where","when","how"],correct:"why",explanation:"'Warum?' = Why?"},
        {id:"q903",type:"mc",prompt:"How do you ask 'Where are you?'",options:["Wo bist du?","Wer bist du?","Was bist du?","Wann bist du?"],correct:"Wo bist du?",explanation:"'Wo' means where."},
        {id:"q904",type:"tap_build",prompt:"Build: 'What is that?'",words:["Was","ist","das","wer","wo"],correct:["Was","ist","das"],explanation:"'Was ist das?' = What is that?"},
        {id:"q905",type:"fill",german:"___ kommst du?",english:"Where are you from?",blank:"Woher",options:["Woher","Warum","Wer","Wann"],explanation:"'Woher' = from where."}
      ]},
      { id:"9-2", title:"Yes, No, Maybe", xpReward:65, intro:{title:"Answering Naturally",body:"Simple answers make conversations possible, even with limited vocabulary.",tip:"👍 'Genau' means 'exactly' and Germans use it constantly."}, questions:[
        {id:"q906",type:"mc",german:"ja",english:"yes",prompt:"What does 'ja' mean?",options:["yes","no","maybe","never"],correct:"yes",explanation:"'ja' = yes."},
        {id:"q907",type:"mc",german:"nein",english:"no",prompt:"What does 'nein' mean?",options:["yes","no","thanks","please"],correct:"no",explanation:"'nein' = no."},
        {id:"q908",type:"mc",german:"vielleicht",english:"maybe",prompt:"What does 'vielleicht' mean?",options:["maybe","always","never","soon"],correct:"maybe",explanation:"'vielleicht' = maybe."},
        {id:"q909",type:"mc",prompt:"What does 'genau' mean in conversation?",options:["exactly","sorry","goodbye","hungry"],correct:"exactly",explanation:"'Genau' = exactly / right."},
        {id:"q910",type:"fill",german:"Ja, ___!",english:"Yes, exactly!",blank:"genau",options:["genau","nein","bitte","tschüss"],explanation:"'Ja, genau!' is a very natural response."}
      ]}
    ]
  },
  {
    id: 10, title: "Shopping & Money", icon: "🛒", color: "#F76707",
    description: "Buy items, ask prices, and understand store phrases.",
    lessons: [
      { id:"10-1", title:"At the Store", xpReward:70, intro:{title:"Im Geschäft",body:"Shopping German is practical: ask how much something costs, say what you want, and understand common store words.",tip:"💶 'Was kostet das?' means 'How much does that cost?'"}, questions:[
        {id:"q1001",type:"mc",german:"kaufen",english:"to buy",prompt:"What does 'kaufen' mean?",options:["to buy","to sell","to eat","to open"],correct:"to buy",explanation:"'kaufen' = to buy."},
        {id:"q1002",type:"mc",prompt:"How do you ask 'How much does that cost?'",options:["Was kostet das?","Wo ist das?","Wer ist das?","Wie heißt das?"],correct:"Was kostet das?",explanation:"'kosten' means to cost."},
        {id:"q1003",type:"fill",german:"Ich möchte das ___.",english:"I would like to buy that.",blank:"kaufen",options:["kaufen","essen","trinken","schlafen"],explanation:"'Ich möchte ... kaufen.'"},
        {id:"q1004",type:"mc",german:"teuer",english:"expensive",prompt:"What does 'teuer' mean?",options:["expensive","cheap","small","new"],correct:"expensive",explanation:"'teuer' = expensive."},
        {id:"q1005",type:"mc",german:"billig",english:"cheap",prompt:"What does 'billig' mean?",options:["cheap","expensive","free","broken"],correct:"cheap",explanation:"'billig' = cheap, sometimes low-quality depending on context."}
      ]}
    ]
  },
  {
    id: 11, title: "Past & Future", icon: "⏳", color: "#15AABF",
    description: "Talk about what happened and what will happen next.",
    lessons: [
      { id:"11-1", title:"Perfect Tense", xpReward:75, intro:{title:"Talking About the Past",body:"German often uses the perfect tense in conversation: ich habe gemacht, ich bin gegangen.",tip:"⏳ Most verbs use 'haben' + past participle. Movement verbs often use 'sein'."}, questions:[
        {id:"q1101",type:"fill",german:"Ich habe Brot ___.",english:"I ate bread.",blank:"gegessen",options:["gegessen","essen","isst","esse"],explanation:"Perfect tense of essen: gegessen."},
        {id:"q1102",type:"fill",german:"Er hat das Buch ___.",english:"He read the book.",blank:"gelesen",options:["gelesen","lesen","liest","las"],explanation:"Perfect tense of lesen: gelesen."},
        {id:"q1103",type:"mc",prompt:"Which helper verb often goes with movement verbs?",options:["sein","haben","machen","werden"],correct:"sein",explanation:"Movement/change of state often uses sein."},
        {id:"q1104",type:"fill",german:"Ich bin nach Berlin ___.",english:"I went/traveled to Berlin.",blank:"gefahren",options:["gefahren","fahren","fahre","fährst"],explanation:"'Ich bin ... gefahren.'"},
        {id:"q1105",type:"mc",german:"gestern",english:"yesterday",prompt:"What does 'gestern' mean?",options:["yesterday","today","tomorrow","later"],correct:"yesterday",explanation:"'gestern' = yesterday."}
      ]}
    ]
  },
  {
    id: 12, title: "Fluency Frontier", icon: "🌌", color: "#364FC7",
    description: "Mixed advanced practice, idioms, opinions, and longer sentence patterns.",
    lessons: [
      { id:"12-1", title:"Opinions", xpReward:90, intro:{title:"Sound More Natural",body:"Once you can share opinions, German starts feeling like real conversation instead of vocabulary drills.",tip:"💬 'Ich finde...' means 'I think/find...' and is used constantly for opinions."}, questions:[
        {id:"q1201",type:"mc",prompt:"How do you say 'I think that is good' naturally?",options:["Ich finde das gut","Ich bin das gut","Ich habe das gut","Ich gehe das gut"],correct:"Ich finde das gut",explanation:"'Ich finde das gut' is a natural opinion phrase."},
        {id:"q1202",type:"mc",german:"trotzdem",english:"nevertheless",prompt:"What does 'trotzdem' mean?",options:["nevertheless","because","although","before"],correct:"nevertheless",explanation:"'trotzdem' = nevertheless / still."},
        {id:"q1203",type:"fill",german:"Ich lerne Deutsch, ___ es schwer ist.",english:"I am learning German because it is hard.",blank:"weil",options:["weil","aber","und","oder"],explanation:"'weil' means because and sends the verb to the end."},
        {id:"q1204",type:"mc",prompt:"What does 'Meiner Meinung nach' mean?",options:["In my opinion","After my meal","At my house","With my friend"],correct:"In my opinion",explanation:"A useful phrase for advanced conversation."},
        {id:"q1205",type:"tap_build",prompt:"Build: 'In my opinion, German is fun'",words:["Meiner","Meinung","nach","ist","Deutsch","lustig"],correct:["Meiner","Meinung","nach","ist","Deutsch","lustig"],explanation:"'Meiner Meinung nach...' = In my opinion..."}
      ]}
    ]
  }
);

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
        {q.german && <div className="word-card"><div className="word-de">{q.german}</div>{q.english&&<div className="word-en">{q.english}</div>}</div>}
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

  const showWordCard = q.german && (q.type === "mc" || q.type === "fill");

  return (
    <div>
      {showWordCard && (
        <div className="word-card">
          <div className="word-category">{q.category || ""}</div>
          <div className="word-de">{q.german}</div>
          {q.english && <div className="word-en">{q.english}</div>}
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
      <div className="roadmap-sub">Complete lessons, unlock new units, and turn German into a long-term adventure. {completedCount} lessons completed.</div>
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
