import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ─── FIREBASE ────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyBejVYv-lIcdnzo58GG7wDclfvr2hgKse0",
  authDomain: "sprak-f7649.firebaseapp.com",
  projectId: "sprak-f7649",
  storageBucket: "sprak-f7649.firebasestorage.app",
  messagingSenderId: "589172963892",
  appId: "1:589172963892:web:82373424a3d71d1190a861",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const AVATARS = [
  { id: "bear", emoji: "🐻", label: "Bear" },
  { id: "fox", emoji: "🦊", label: "Fox" },
  { id: "frog", emoji: "🐸", label: "Frog" },
  { id: "owl", emoji: "🦉", label: "Owl" },
  { id: "bee", emoji: "🐝", label: "Bee" },
  { id: "cat", emoji: "🐱", label: "Cat" },
];

const ACHIEVEMENTS = [
  { id: "first_lesson", name: "First Steps", description: "Complete your first lesson", icon: "📖" },
  { id: "first_puzzle", name: "Puzzle Solver", description: "Complete your first daily puzzle", icon: "🧩" },
  { id: "streak_3", name: "On Fire!", description: "3 day streak", icon: "🔥" },
  { id: "streak_7", name: "Week Warrior", description: "7 day streak", icon: "⚡" },
  { id: "level_5", name: "Level 5", description: "Reach level 5", icon: "⭐" },
  { id: "level_10", name: "Level 10", description: "Reach level 10", icon: "🌟" },
  { id: "questions_100", name: "Century", description: "Answer 100 questions", icon: "💯" },
];

const QUESTION_BANK = [
  { id: 1, type: "translate_de_en", prompt: "Was bedeutet 'Hund'?", correctAnswer: "Dog", options: ["Dog", "Cat", "Horse", "Bird"], difficulty: 1, category: "Animals", grammarTag: "nouns", explanation: "'Hund' means dog. It's a masculine noun (der Hund)." },
  { id: 2, type: "article", prompt: "Which article goes with 'Katze' (cat)?", correctAnswer: "die", options: ["der", "die", "das"], difficulty: 1, category: "Animals", grammarTag: "articles", explanation: "Katze is feminine, so it uses 'die'." },
  { id: 3, type: "translate_de_en", prompt: "Was bedeutet 'Brot'?", correctAnswer: "Bread", options: ["Bread", "Water", "Milk", "Butter"], difficulty: 1, category: "Food", grammarTag: "nouns", explanation: "'Brot' means bread. It's neuter (das Brot)." },
  { id: 4, type: "translate_en_de", prompt: "How do you say 'Hello' in German?", correctAnswer: "Hallo", options: ["Hallo", "Tschüss", "Danke", "Bitte"], difficulty: 1, category: "Greetings", grammarTag: "greetings", explanation: "'Hallo' is the standard German greeting." },
  { id: 5, type: "article", prompt: "Which article goes with 'Kind' (child)?", correctAnswer: "das", options: ["der", "die", "das"], difficulty: 1, category: "Basic nouns", grammarTag: "articles", explanation: "Kind is neuter, so it uses 'das'." },
  { id: 6, type: "translate_de_en", prompt: "Was bedeutet 'Wasser'?", correctAnswer: "Water", options: ["Juice", "Water", "Milk", "Wine"], difficulty: 1, category: "Food", grammarTag: "nouns", explanation: "'Wasser' means water." },
  { id: 7, type: "translate_en_de", prompt: "How do you say 'Thank you' in German?", correctAnswer: "Danke", options: ["Bitte", "Danke", "Hallo", "Ja"], difficulty: 1, category: "Greetings", grammarTag: "greetings", explanation: "'Danke' means thank you." },
  { id: 8, type: "article", prompt: "Which article goes with 'Mann' (man)?", correctAnswer: "der", options: ["der", "die", "das"], difficulty: 2, category: "Basic nouns", grammarTag: "articles", explanation: "Mann is masculine, so it uses 'der'." },
  { id: 9, type: "translate_de_en", prompt: "Was bedeutet 'Schule'?", correctAnswer: "School", options: ["House", "School", "City", "Park"], difficulty: 2, category: "Basic nouns", grammarTag: "nouns", explanation: "'Schule' means school." },
  { id: 10, type: "fill_blank", prompt: "Ich ___ müde. (I am tired.)", correctAnswer: "bin", options: ["bin", "ist", "sind", "hat"], difficulty: 2, category: "Verbs", grammarTag: "conjugation", explanation: "'Ich bin' means 'I am'. 'Bin' is the first-person singular of 'sein' (to be)." },
  { id: 11, type: "translate_de_en", prompt: "Was bedeutet 'Haus'?", correctAnswer: "House", options: ["House", "Garden", "Street", "Room"], difficulty: 2, category: "Basic nouns", grammarTag: "nouns", explanation: "'Haus' means house. It's neuter (das Haus)." },
  { id: 12, type: "translate_en_de", prompt: "How do you say 'Please' in German?", correctAnswer: "Bitte", options: ["Danke", "Bitte", "Ja", "Nein"], difficulty: 1, category: "Greetings", grammarTag: "greetings", explanation: "'Bitte' means please (and also 'you're welcome')." },
  { id: 13, type: "fill_blank", prompt: "Er ___ in Berlin. (He lives in Berlin.)", correctAnswer: "wohnt", options: ["wohnt", "wohne", "wohnen", "wohnst"], difficulty: 3, category: "Verbs", grammarTag: "conjugation", explanation: "'Wohnen' means to live. Third person singular: er/sie/es wohnt." },
  { id: 14, type: "translate_de_en", prompt: "Was bedeutet 'Arbeit'?", correctAnswer: "Work", options: ["Work", "Play", "Sleep", "Eat"], difficulty: 3, category: "Basic nouns", grammarTag: "nouns", explanation: "'Arbeit' means work or labor." },
  { id: 15, type: "translate_en_de", prompt: "How do you say 'I eat bread' in German?", correctAnswer: "Ich esse Brot", options: ["Ich esse Brot", "Ich trinke Wasser", "Ich habe Brot", "Ich will Brot"], difficulty: 3, category: "Simple sentences", grammarTag: "sentences", explanation: "'Essen' means to eat. 'Ich esse' = I eat." },
  { id: 16, type: "article", prompt: "Which article goes with 'Frau' (woman)?", correctAnswer: "die", options: ["der", "die", "das"], difficulty: 2, category: "Basic nouns", grammarTag: "articles", explanation: "Frau is feminine, so it uses 'die'." },
  { id: 17, type: "translate_de_en", prompt: "Was bedeutet 'sprechen'?", correctAnswer: "To speak", options: ["To speak", "To hear", "To see", "To know"], difficulty: 3, category: "Verbs", grammarTag: "verbs", explanation: "'Sprechen' means to speak." },
  { id: 18, type: "fill_blank", prompt: "Wir ___ Deutsch. (We speak German.)", correctAnswer: "sprechen", options: ["sprechen", "sprichst", "spricht", "sprich"], difficulty: 4, category: "Verbs", grammarTag: "conjugation", explanation: "First person plural (wir) uses the infinitive form: sprechen." },
  { id: 19, type: "translate_de_en", prompt: "Was bedeutet 'Frühstück'?", correctAnswer: "Breakfast", options: ["Breakfast", "Lunch", "Dinner", "Snack"], difficulty: 4, category: "Food", grammarTag: "nouns", explanation: "'Frühstück' means breakfast. Literally 'early piece'." },
  { id: 20, type: "translate_en_de", prompt: "How do you say 'I drink coffee' in German?", correctAnswer: "Ich trinke Kaffee", options: ["Ich trinke Kaffee", "Ich esse Kaffee", "Ich habe Kaffee", "Ich mag Kaffee"], difficulty: 4, category: "Simple sentences", grammarTag: "sentences", explanation: "'Trinken' means to drink. 'Ich trinke' = I drink." },
  { id: 21, type: "fill_blank", prompt: "Er hat das Buch ___. (He has read the book.)", correctAnswer: "gelesen", options: ["gelesen", "lesen", "las", "liest"], difficulty: 5, category: "Verbs", grammarTag: "perfect-tense", explanation: "Perfect tense: haben + past participle. 'Lesen' → 'gelesen'." },
  { id: 22, type: "translate_de_en", prompt: "Was bedeutet 'Vergangenheit'?", correctAnswer: "The past", options: ["The past", "The future", "The present", "The time"], difficulty: 5, category: "Basic nouns", grammarTag: "nouns", explanation: "'Vergangenheit' means the past tense / past time." },
  { id: 23, type: "translate_en_de", prompt: "How do you say 'I would like to go' in German?", correctAnswer: "Ich möchte gehen", options: ["Ich möchte gehen", "Ich will gehen", "Ich kann gehen", "Ich muss gehen"], difficulty: 5, category: "Verbs", grammarTag: "modal-verbs", explanation: "'Möchte' is the polite/subjunctive form of 'mögen', used for 'would like to'." },
  { id: 24, type: "fill_blank", prompt: "Obwohl es regnet, ___ wir spazieren. (Although it rains, we walk.)", correctAnswer: "gehen", options: ["gehen", "geht", "gehe", "gegangen"], difficulty: 6, category: "Simple sentences", grammarTag: "subordinate-clauses", explanation: "After 'obwohl' (although), the verb goes to the end. The main clause verb is 'gehen'." },
];

const PLACEMENT_QUESTIONS = [
  { id: "p1", type: "translate_de_en", prompt: "Was bedeutet 'Hund'?", correctAnswer: "Dog", options: ["Dog", "Cat", "House", "Tree"], difficulty: 1, category: "Animals", grammarTag: "nouns", explanation: "'Hund' means dog." },
  { id: "p2", type: "article", prompt: "Which article goes with 'Buch' (book)?", correctAnswer: "das", options: ["der", "die", "das"], difficulty: 2, category: "Basic nouns", grammarTag: "articles", explanation: "Buch is neuter: das Buch." },
  { id: "p3", type: "fill_blank", prompt: "Ich ___ Student. (I am a student.)", correctAnswer: "bin", options: ["bin", "ist", "sind", "bist"], difficulty: 2, category: "Verbs", grammarTag: "conjugation", explanation: "'Ich bin' = I am." },
  { id: "p4", type: "translate_en_de", prompt: "How do you say 'I speak German' in German?", correctAnswer: "Ich spreche Deutsch", options: ["Ich spreche Deutsch", "Ich lerne Deutsch", "Ich verstehe Deutsch", "Ich höre Deutsch"], difficulty: 3, category: "Simple sentences", grammarTag: "sentences", explanation: "'Ich spreche Deutsch' = I speak German." },
  { id: "p5", type: "fill_blank", prompt: "Er hat das Buch ___. (He read the book.)", correctAnswer: "gelesen", options: ["gelesen", "lesen", "las", "liest"], difficulty: 5, category: "Verbs", grammarTag: "perfect-tense", explanation: "Perfect tense uses haben + past participle: gelesen." },
  { id: "p6", type: "translate_de_en", prompt: "Was bedeutet 'Konjunktiv'?", correctAnswer: "Subjunctive mood", options: ["Subjunctive mood", "Plural form", "Past tense", "Adjective ending"], difficulty: 6, category: "Basic nouns", grammarTag: "grammar", explanation: "'Konjunktiv' is the subjunctive mood in German grammar." },
];

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #FEFAE0; color: #1a1a1a; min-height: 100vh; }
  :root {
    --green: #1B4332; --green-mid: #2D6A4F; --green-light: #52B788;
    --cream: #FEFAE0; --cream-dark: #F0EAC8; --gold: #F4A261; --gold-dark: #E76F51;
    --blue: #74C0FC; --blue-dark: #339AF0; --red: #FF6B6B; --white: #FFFFFF;
    --text: #1a1a1a; --text-muted: #666;
    --radius: 16px; --radius-sm: 8px;
    --shadow: 0 4px 20px rgba(27,67,50,0.12); --shadow-sm: 0 2px 8px rgba(27,67,50,0.08);
  }
  .app { min-height: 100vh; }

  /* NAV */
  .nav { background: var(--green); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 12px rgba(0,0,0,0.2); }
  .nav-logo { font-family: 'Fredoka One', cursive; font-size: 28px; color: var(--gold); letter-spacing: 1px; }
  .nav-logo span { color: #fff; }
  .nav-right { display: flex; align-items: center; gap: 12px; }
  .nav-user { display: flex; align-items: center; gap: 8px; color: #fff; font-weight: 600; font-size: 14px; cursor: pointer; }
  .nav-avatar { font-size: 24px; }
  .nav-streak { background: var(--gold); color: var(--green); padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 700; }
  .btn-nav { background: var(--gold); color: var(--green); border: none; border-radius: 12px; padding: 8px 18px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; }
  .btn-nav:hover { background: var(--gold-dark); color: #fff; transform: translateY(-1px); }

  /* BUTTONS */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 28px; border-radius: var(--radius); border: none; font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; text-decoration: none; }
  .btn-primary { background: var(--green); color: #fff; box-shadow: 0 4px 0 #0f2d1e; }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #0f2d1e; }
  .btn-primary:active { transform: translateY(2px); box-shadow: 0 2px 0 #0f2d1e; }
  .btn-gold { background: var(--gold); color: var(--green); box-shadow: 0 4px 0 #c4722a; }
  .btn-gold:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #c4722a; background: var(--gold-dark); color: #fff; }
  .btn-gold:active { transform: translateY(2px); box-shadow: 0 2px 0 #c4722a; }
  .btn-ghost { background: transparent; color: var(--green); border: 2px solid var(--green); }
  .btn-ghost:hover { background: var(--green); color: #fff; }
  .btn-sm { padding: 8px 18px; font-size: 14px; }
  .btn-lg { padding: 18px 40px; font-size: 18px; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
  .btn-full { width: 100%; margin-top: 8px; }

  /* LANDING */
  .landing { min-height: 100vh; }
  .landing-hero { background: var(--green); color: #fff; padding: 80px 24px 60px; text-align: center; position: relative; overflow: hidden; }
  .landing-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 30% 50%, rgba(82,183,136,0.3) 0%, transparent 60%), radial-gradient(circle at 70% 50%, rgba(244,162,97,0.2) 0%, transparent 60%); }
  .hero-content { position: relative; z-index: 1; max-width: 700px; margin: 0 auto; }
  .hero-logo { font-family: 'Fredoka One', cursive; font-size: 80px; color: var(--gold); line-height: 1; margin-bottom: 8px; text-shadow: 0 4px 0 rgba(0,0,0,0.2); }
  .hero-tagline { font-size: 26px; color: rgba(255,255,255,0.9); font-weight: 600; margin-bottom: 40px; line-height: 1.4; }
  .hero-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .hero-mascots { display: flex; justify-content: center; gap: 16px; font-size: 48px; margin-top: 48px; }
  .hero-mascots span { animation: float 3s ease-in-out infinite; display: inline-block; }
  .hero-mascots span:nth-child(2) { animation-delay: 0.5s; }
  .hero-mascots span:nth-child(3) { animation-delay: 1s; }
  .hero-mascots span:nth-child(4) { animation-delay: 1.5s; }
  .hero-mascots span:nth-child(5) { animation-delay: 2s; }
  .hero-mascots span:nth-child(6) { animation-delay: 2.5s; }
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
  .landing-features { padding: 60px 24px; max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
  .feature-card { background: var(--white); border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); text-align: center; border-top: 4px solid var(--green-light); transition: transform 0.2s; }
  .feature-card:hover { transform: translateY(-4px); }
  .feature-icon { font-size: 48px; margin-bottom: 12px; }
  .feature-title { font-family: 'Fredoka One', cursive; font-size: 22px; color: var(--green); margin-bottom: 8px; }
  .feature-desc { color: var(--text-muted); line-height: 1.6; }
  .landing-cta { background: var(--cream-dark); padding: 60px 24px; text-align: center; }
  .landing-cta h2 { font-family: 'Fredoka One', cursive; font-size: 36px; color: var(--green); margin-bottom: 12px; }
  .landing-cta p { color: var(--text-muted); margin-bottom: 32px; font-size: 18px; }

  /* AUTH */
  .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--cream); }
  .auth-card { background: var(--white); border-radius: 24px; padding: 40px; width: 100%; max-width: 440px; box-shadow: var(--shadow); }
  .auth-title { font-family: 'Fredoka One', cursive; font-size: 32px; color: var(--green); text-align: center; margin-bottom: 8px; }
  .auth-subtitle { text-align: center; color: var(--text-muted); margin-bottom: 28px; font-size: 15px; }
  .privacy-note { background: rgba(82,183,136,0.1); border: 1px solid rgba(82,183,136,0.3); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: var(--green-mid); display: flex; align-items: flex-start; gap: 8px; line-height: 1.5; }
  .privacy-note-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
  .form-group { margin-bottom: 18px; }
  .form-label { display: block; font-weight: 600; font-size: 14px; color: var(--text); margin-bottom: 6px; }
  .form-input { width: 100%; padding: 12px 16px; border: 2px solid var(--cream-dark); border-radius: var(--radius-sm); font-size: 15px; font-family: 'Inter', sans-serif; background: var(--cream); transition: border-color 0.2s; color: var(--text); }
  .form-input:focus { outline: none; border-color: var(--green-light); background: #fff; }
  .form-row { display: flex; gap: 12px; }
  .form-row .form-group { flex: 1; }
  .auth-switch { text-align: center; margin-top: 20px; color: var(--text-muted); font-size: 14px; }
  .auth-switch button { background: none; border: none; color: var(--green-mid); font-weight: 700; cursor: pointer; font-size: 14px; text-decoration: underline; }
  .error-msg { background: #fff0f0; border: 1px solid var(--red); color: #c0392b; padding: 10px 14px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }

  /* AVATAR / LEVEL PICKER */
  .avatar-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 8px; }
  .avatar-btn { border: 3px solid var(--cream-dark); border-radius: var(--radius-sm); padding: 14px 8px; background: var(--cream); cursor: pointer; transition: all 0.2s; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .avatar-btn:hover { border-color: var(--green-light); background: #fff; }
  .avatar-btn.selected { border-color: var(--green); background: rgba(27,67,50,0.08); }
  .avatar-emoji { font-size: 32px; }
  .avatar-label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
  .level-options { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
  .level-option { border: 2px solid var(--cream-dark); border-radius: var(--radius-sm); padding: 14px 18px; background: var(--cream); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 14px; }
  .level-option:hover { border-color: var(--green-light); background: #fff; }
  .level-option.selected { border-color: var(--green); background: rgba(27,67,50,0.06); }
  .level-option-icon { font-size: 24px; }
  .level-option-info h4 { font-weight: 700; color: var(--text); }
  .level-option-info p { font-size: 13px; color: var(--text-muted); }

  /* QUIZ */
  .quiz-progress { background: var(--cream-dark); border-radius: 99px; height: 10px; margin-bottom: 32px; overflow: hidden; }
  .quiz-progress-fill { background: linear-gradient(90deg, var(--green-light), var(--green)); height: 100%; border-radius: 99px; transition: width 0.4s ease; }
  .quiz-q-num { font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
  .quiz-prompt { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 28px; line-height: 1.4; }
  .quiz-options { display: flex; flex-direction: column; gap: 12px; }
  .quiz-option { border: 2.5px solid var(--cream-dark); border-radius: var(--radius); padding: 16px 20px; background: var(--white); cursor: pointer; transition: all 0.2s; font-size: 16px; font-weight: 500; text-align: left; }
  .quiz-option:hover:not(:disabled) { border-color: var(--green-light); background: var(--cream); }
  .quiz-option.correct { border-color: var(--green-light); background: rgba(82,183,136,0.15); color: var(--green); }
  .quiz-option.wrong { border-color: var(--red); background: rgba(255,107,107,0.12); color: #c0392b; }
  .quiz-option:disabled { cursor: default; }
  .quiz-explanation { background: var(--cream); border-radius: var(--radius-sm); padding: 14px 18px; margin-top: 16px; border-left: 4px solid var(--green-light); font-size: 14px; color: var(--text-muted); line-height: 1.5; }
  .quiz-result { text-align: center; padding: 60px 24px; max-width: 500px; margin: 0 auto; }
  .quiz-result-icon { font-size: 80px; margin-bottom: 16px; }
  .quiz-result h2 { font-family: 'Fredoka One', cursive; font-size: 32px; color: var(--green); margin-bottom: 8px; }
  .quiz-result-level { font-family: 'Fredoka One', cursive; font-size: 64px; color: var(--gold); line-height: 1; }
  .quiz-result p { color: var(--text-muted); margin: 12px 0 32px; font-size: 18px; }

  /* DASHBOARD */
  .dashboard { max-width: 1000px; margin: 0 auto; padding: 32px 24px; }
  .dash-header { display: flex; align-items: center; gap: 20px; margin-bottom: 32px; }
  .dash-avatar { font-size: 64px; background: var(--cream-dark); width: 90px; height: 90px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid var(--green); flex-shrink: 0; }
  .dash-info h2 { font-family: 'Fredoka One', cursive; font-size: 26px; color: var(--green); }
  .dash-info p { color: var(--text-muted); font-size: 14px; }
  .level-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--green); color: #fff; padding: 4px 12px; border-radius: 99px; font-size: 13px; font-weight: 700; margin-top: 6px; }
  .xp-bar-wrap { margin-top: 10px; }
  .xp-bar-label { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
  .xp-bar { background: var(--cream-dark); border-radius: 99px; height: 14px; overflow: hidden; }
  .xp-bar-fill { background: linear-gradient(90deg, var(--gold), var(--gold-dark)); height: 100%; border-radius: 99px; transition: width 0.6s cubic-bezier(.34,1.56,.64,1); position: relative; }
  .xp-bar-fill::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 8px; background: rgba(255,255,255,0.5); border-radius: 0 99px 99px 0; animation: shimmer 2s ease-in-out infinite; }
  @keyframes shimmer { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
  .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .dash-action-card { background: var(--white); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow); cursor: pointer; transition: all 0.2s; border: 2px solid transparent; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; }
  .dash-action-card:hover { border-color: var(--green-light); transform: translateY(-3px); box-shadow: 0 8px 30px rgba(27,67,50,0.15); }
  .dash-action-icon { font-size: 48px; }
  .dash-action-title { font-family: 'Fredoka One', cursive; font-size: 20px; color: var(--green); }
  .dash-action-desc { font-size: 13px; color: var(--text-muted); }
  .dash-action-badge { background: var(--gold); color: var(--green); padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 700; }
  .dash-action-done { background: var(--cream-dark); color: var(--text-muted); padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
  .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
  .stat-card { background: var(--white); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow-sm); text-align: center; }
  .stat-val { font-family: 'Fredoka One', cursive; font-size: 32px; color: var(--green); }
  .stat-lbl { font-size: 12px; color: var(--text-muted); font-weight: 600; margin-top: 2px; }
  .achievements-section { margin-top: 24px; }
  .section-title { font-family: 'Fredoka One', cursive; font-size: 22px; color: var(--green); margin-bottom: 16px; }
  .achievements-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .achievement-card { background: var(--white); border-radius: var(--radius-sm); padding: 14px; box-shadow: var(--shadow-sm); display: flex; align-items: center; gap: 12px; }
  .achievement-card.unlocked { border-left: 4px solid var(--green-light); }
  .achievement-card.locked { opacity: 0.45; filter: grayscale(1); }
  .achievement-icon { font-size: 28px; }
  .achievement-info h4 { font-size: 13px; font-weight: 700; color: var(--text); }
  .achievement-info p { font-size: 12px; color: var(--text-muted); }

  /* LESSON */
  .lesson-page { max-width: 640px; margin: 0 auto; padding: 32px 24px; }
  .lesson-header { margin-bottom: 28px; }
  .lesson-title { font-family: 'Fredoka One', cursive; font-size: 26px; color: var(--green); margin-bottom: 4px; }
  .lesson-sub { color: var(--text-muted); font-size: 14px; }
  .lesson-progress-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .feedback-banner { border-radius: var(--radius-sm); padding: 14px 18px; margin-top: 20px; font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 10px; }
  .feedback-banner.correct { background: rgba(82,183,136,0.15); color: #155724; border: 2px solid var(--green-light); }
  .feedback-banner.wrong { background: rgba(255,107,107,0.12); color: #721c24; border: 2px solid var(--red); }
  .lesson-complete { text-align: center; padding: 48px 24px; max-width: 480px; margin: 0 auto; }
  .lesson-complete-icon { font-size: 80px; margin-bottom: 12px; }
  .lesson-complete h2 { font-family: 'Fredoka One', cursive; font-size: 30px; color: var(--green); margin-bottom: 8px; }
  .lesson-complete-stats { display: flex; justify-content: center; gap: 24px; margin: 24px 0 32px; }
  .ls-stat { text-align: center; }
  .ls-val { font-family: 'Fredoka One', cursive; font-size: 32px; color: var(--green); }
  .ls-lbl { font-size: 13px; color: var(--text-muted); }

  /* OVERLAYS */
  .level-up-overlay { position: fixed; inset: 0; background: rgba(27,67,50,0.85); display: flex; align-items: center; justify-content: center; z-index: 999; animation: fadeIn 0.3s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .level-up-card { background: var(--white); border-radius: 28px; padding: 48px 40px; text-align: center; max-width: 400px; width: 90%; animation: popUp 0.4s cubic-bezier(.34,1.56,.64,1); }
  @keyframes popUp { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .level-up-emoji { font-size: 72px; margin-bottom: 8px; }
  .level-up-title { font-family: 'Fredoka One', cursive; font-size: 36px; color: var(--green); margin-bottom: 4px; }
  .level-up-num { font-family: 'Fredoka One', cursive; font-size: 80px; color: var(--gold); line-height: 1; }
  .level-up-sub { color: var(--text-muted); font-size: 16px; margin: 12px 0 28px; }

  .xp-toast { position: fixed; top: 80px; right: 24px; background: var(--green); color: var(--gold); font-family: 'Fredoka One', cursive; font-size: 22px; padding: 10px 20px; border-radius: 99px; z-index: 200; animation: toastPop 2s ease forwards; pointer-events: none; }
  @keyframes toastPop { 0% { transform: translateY(-20px) scale(0.8); opacity: 0; } 15% { transform: translateY(0) scale(1.1); opacity: 1; } 30% { transform: scale(1); } 70% { opacity: 1; } 100% { transform: translateY(-10px); opacity: 0; } }

  /* LOADING */
  .loading-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--cream); }
  .loading-logo { font-family: 'Fredoka One', cursive; font-size: 56px; color: var(--gold); animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  @media (max-width: 600px) {
    .dash-grid { grid-template-columns: 1fr; }
    .hero-logo { font-size: 56px; }
    .hero-tagline { font-size: 18px; }
    .achievements-grid { grid-template-columns: 1fr 1fr; }
  }
`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function xpForLevel(level) { return level * 100; }
function totalXpForLevel(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForLevel(l);
  return total;
}
function calcLevel(totalXp) {
  let level = 1, remaining = totalXp;
  while (remaining >= xpForLevel(level)) { remaining -= xpForLevel(level); level++; }
  return { level, xpInLevel: remaining, xpNeeded: xpForLevel(level) };
}
function getDailyKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function getDailyQuestions() {
  const seed = getDailyKey();
  let hash = 0;
  for (const c of seed) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  const pool = [...QUESTION_BANK];
  const result = [];
  let h = Math.abs(hash);
  while (result.length < 5 && pool.length > 0) {
    const i = h % pool.length;
    result.push(pool.splice(i, 1)[0]);
    h = Math.abs(Math.floor(h * 1.6180339));
  }
  return result;
}
function getLessonQuestions(level) {
  const diff = Math.min(Math.ceil(level / 5), 6);
  const pool = QUESTION_BANK.filter(q => Math.abs(q.difficulty - diff) <= 2);
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
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
  return [...earned];
}

// ─── LOCAL STORAGE (game data only, keyed by Firebase UID) ──────────────────

function getGameData(uid) {
  try { return JSON.parse(localStorage.getItem(`sprak_game_${uid}`) || "null"); }
  catch { return null; }
}
function saveGameData(uid, data) {
  localStorage.setItem(`sprak_game_${uid}`, JSON.stringify(data));
}
function makeDefaultGameData(uid, extra = {}) {
  return {
    uid,
    username: extra.username || "",
    displayName: extra.displayName || "",
    avatar: extra.avatar || "bear",
    xp: 0,
    streak: 0,
    lastActiveDate: null,
    achievements: [],
    stats: { lessonsCompleted: 0, puzzlesCompleted: 0, totalAnswered: 0, totalCorrect: 0 },
    questionProgress: {},
    dailyCompletions: {},
    createdAt: Date.now(),
    ...extra,
  };
}
function firebaseErrorMessage(code) {
  const map = {
    "auth/email-already-in-use": "That email is already registered.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/admin-restricted-operation": "Anonymous sign-in is not enabled for this Firebase project.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function XpToast({ xp }) {
  return <div className="xp-toast">+{xp} XP</div>;
}

function LevelUpOverlay({ level, onContinue }) {
  return (
    <div className="level-up-overlay">
      <div className="level-up-card">
        <div className="level-up-emoji">🎉</div>
        <div className="level-up-title">Level Up!</div>
        <div className="level-up-num">{level}</div>
        <div className="level-up-sub">Amazing progress! Keep it up!</div>
        <button className="btn btn-gold btn-lg" onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}

function Nav({ user, onLogout, onNavigate }) {
  const avatar = AVATARS.find(a => a.id === user.avatar);
  const { level } = calcLevel(user.xp || 0);
  return (
    <nav className="nav">
      <div className="nav-logo">Spr<span>ak</span></div>
      <div className="nav-right">
        <div className="nav-streak">🔥 {user.streak || 0}</div>
        <div className="nav-user" onClick={() => onNavigate("dashboard")}>
          <span className="nav-avatar">{avatar?.emoji || "🐻"}</span>
          <span>{user.displayName}</span>
          <span style={{ opacity: 0.7 }}>Lv.{level}</span>
        </div>
        <button className="btn btn-nav" onClick={onLogout}>Logout</button>
      </div>
    </nav>
  );
}

function PrivacyNote() {
  return (
    <div className="privacy-note">
      <span className="privacy-note-icon">🔒</span>
      <span>Sprak uses Google Firebase for secure sign-in, so your password is never visible to us. For this prototype, learning progress is stored only in your browser under your Firebase user ID. We don't sell your data, use it for AI training, or collect unnecessary personal information.</span>
    </div>
  );
}

function Landing({ onNavigate }) {
  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="hero-content">
          <div className="hero-logo">Sprak</div>
          <div className="hero-tagline">Learn German like it's a game.</div>
          <div className="hero-btns">
            <button className="btn btn-gold btn-lg" onClick={() => onNavigate("signup")}>Start for Free</button>
            <button className="btn btn-ghost btn-lg" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.5)" }} onClick={() => onNavigate("login")}>Log In</button>
          </div>
          <div className="hero-mascots">
            {AVATARS.map(a => <span key={a.id}>{a.emoji}</span>)}
          </div>
        </div>
      </div>
      <div className="landing-features">
        {[
          { icon: "🧩", title: "Daily Puzzles", desc: "Fresh German challenges every day. Build your streak and earn XP." },
          { icon: "⬆️", title: "Level Up", desc: "Answer questions, earn XP, and rise through the ranks." },
          { icon: "🔥", title: "Streaks", desc: "Stay consistent. Every day you practice, your streak grows." },
          { icon: "📚", title: "Smart Lessons", desc: "Adaptive lessons generated around your current level — no two sessions are the same." },
          { icon: "🏆", title: "Achievements", desc: "Unlock badges and milestones as you grow your German." },
          { icon: "🐻", title: "Pick Your Avatar", desc: "Choose your companion for the journey. Bear? Fox? Owl? You decide." },
        ].map(f => (
          <div className="feature-card" key={f.title}>
            <div className="feature-icon">{f.icon}</div>
            <div className="feature-title">{f.title}</div>
            <div className="feature-desc">{f.desc}</div>
          </div>
        ))}
      </div>
      <div className="landing-cta">
        <h2>Bereit? Let's go.</h2>
        <p>Join Sprak and make German actually fun.</p>
        <button className="btn btn-primary btn-lg" onClick={() => onNavigate("signup")}>Create Free Account</button>
        <div className="privacy-note" style={{ maxWidth: 620, margin: "32px auto 0", textAlign: "left" }}>
          <span className="privacy-note-icon">🛡️</span>
          <span>No ads, no selling your data, and no AI training on your account or learning progress. Just German practice.</span>
        </div>
      </div>
    </div>
  );
}

function Signup({ onNavigate, onSignupComplete }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username: "", displayName: "", email: "", password: "" });
  const [avatar, setAvatar] = useState("");
  const [levelChoice, setLevelChoice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const levelOptions = [
    { id: "none", icon: "🌱", label: "None", desc: "I'm starting from zero" },
    { id: "beginner", icon: "🌿", label: "Beginner", desc: "I know a few words" },
    { id: "intermediate", icon: "🌳", label: "Intermediate", desc: "I can hold basic conversations" },
    { id: "advanced", icon: "🌲", label: "Advanced", desc: "I'm fairly fluent" },
  ];

  const handleStep1 = (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.displayName.trim() || !form.email.trim() || !form.password) {
      setError("Please fill in all fields."); return;
    }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError(""); setStep(2);
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    if (!avatar) { setError("Pick an avatar!"); return; }
    if (!levelChoice) { setError("Tell us your German level."); return; }
    setError(""); setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const uid = cred.user.uid;
      const gameData = makeDefaultGameData(uid, {
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        avatar,
      });
      saveGameData(uid, gameData);
      onSignupComplete(gameData, levelChoice);
    } catch (err) {
      setError(firebaseErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">Join Sprak</div>
        <div className="auth-subtitle">{step === 1 ? "Create your account" : "Set up your profile"}</div>
        <PrivacyNote />
        {error && <div className="error-msg">{error}</div>}
        {step === 1 && (
          <form onSubmit={handleStep1}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" placeholder="e.g. FoxLearner" value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input className="form-input" placeholder="Your name" value={form.displayName}
                  onChange={e => setForm({ ...form, displayName: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="At least 6 characters" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <button className="btn btn-primary btn-full" type="submit">Next →</button>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", marginTop: "12px", lineHeight: "1.5" }}>
              🔒 Secure Firebase sign-in. No ads, no data selling, and no AI training on your information.
            </p>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={handleStep2}>
            <div className="form-group">
              <label className="form-label">Pick your avatar</label>
              <div className="avatar-grid">
                {AVATARS.map(a => (
                  <button type="button" key={a.id}
                    className={`avatar-btn ${avatar === a.id ? "selected" : ""}`}
                    onClick={() => setAvatar(a.id)}>
                    <span className="avatar-emoji">{a.emoji}</span>
                    <span className="avatar-label">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">How much German do you know?</label>
              <div className="level-options">
                {levelOptions.map(o => (
                  <div key={o.id}
                    className={`level-option ${levelChoice === o.id ? "selected" : ""}`}
                    onClick={() => setLevelChoice(o.id)}>
                    <span className="level-option-icon">{o.icon}</span>
                    <div className="level-option-info">
                      <h4>{o.label}</h4>
                      <p>{o.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? "Creating account…" : levelChoice === "none" ? "Start Learning! 🚀" : "Take Placement Quiz →"}
            </button>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", marginTop: "12px", lineHeight: "1.5" }}>
              Your profile choices and learning progress stay tied to your Firebase account ID for this prototype.
            </p>
          </form>
        )}
        <div className="auth-switch">
          Already have an account? <button onClick={() => onNavigate("login")}>Log in</button>
        </div>
      </div>
    </div>
  );
}

function Login({ onNavigate, onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const finishLogin = (uid, fallbackName = "Learner") => {
    let gameData = getGameData(uid);
    if (!gameData) {
      gameData = makeDefaultGameData(uid, {
        username: fallbackName.toLowerCase().replace(/[^a-z0-9]/g, "") || "learner",
        displayName: fallbackName,
        avatar: "bear",
      });
      saveGameData(uid, gameData);
    }

    // streak logic
    const today = getDailyKey();
    if (gameData.lastActiveDate !== today) {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const yesterday = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (gameData.lastActiveDate !== yesterday) gameData.streak = 0;
    }

    saveGameData(uid, gameData);
    onLogin(gameData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password) { setError("Please fill in all fields."); return; }
    setError(""); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      finishLogin(cred.user.uid, form.email.split("@")[0]);
    } catch (err) {
      setError(firebaseErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError(""); setGuestLoading(true);
    try {
      const cred = await signInAnonymously(auth);
      const uid = cred.user.uid;
      let gameData = getGameData(uid);
      if (!gameData) {
        gameData = makeDefaultGameData(uid, {
          username: "guest",
          displayName: "Guest Learner",
          avatar: "bear",
          isGuest: true,
        });
        saveGameData(uid, gameData);
      }
      onLogin(gameData);
    } catch (err) {
      setError(firebaseErrorMessage(err.code));
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">Willkommen zurück!</div>
        <div className="auth-subtitle">Log in to continue your journey</div>
        <PrivacyNote />
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="btn btn-primary btn-full" type="submit" disabled={loading || guestLoading}>
            {loading ? "Logging in…" : "Log In"}
          </button>
        </form>
        <button className="btn btn-ghost btn-full" type="button" disabled={loading || guestLoading} onClick={handleGuestLogin}>
          {guestLoading ? "Starting guest session…" : "Continue as Guest"}
        </button>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", marginTop: "12px", lineHeight: "1.5" }}>
          Guest progress is saved on this device. Create an email account if you want a more permanent login.
        </p>
        <div className="auth-switch">
          No account? <button onClick={() => onNavigate("signup")}>Sign up for free</button>
        </div>
      </div>
    </div>
  );
}

function PlacementQuiz({ onComplete }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [done, setDone] = useState(false);
  const q = PLACEMENT_QUESTIONS[idx];

  const pick = (opt) => {
    if (showFeedback) return;
    setSelected(opt);
    setShowFeedback(true);
    if (opt === q.correctAnswer) setScore(s => s + 1);
  };
  const next = () => {
    if (idx + 1 >= PLACEMENT_QUESTIONS.length) setDone(true);
    else { setIdx(i => i + 1); setSelected(null); setShowFeedback(false); }
  };

  const startLevel = score <= 1 ? 1 : score <= 2 ? 5 : score <= 4 ? 15 : 31;

  if (done) return (
    <div className="auth-page">
      <div className="quiz-result">
        <div className="quiz-result-icon">🎓</div>
        <h2>Quiz Complete!</h2>
        <div style={{ color: "var(--text-muted)", marginBottom: 8 }}>Your Sprak journey begins at</div>
        <div className="quiz-result-level">Level {startLevel}</div>
        <p>{score}/{PLACEMENT_QUESTIONS.length} correct</p>
        <button className="btn btn-gold btn-lg" onClick={() => onComplete(startLevel)}>Let's Go! 🚀</button>
      </div>
    </div>
  );

  return (
    <div className="auth-page" style={{ alignItems: "flex-start", paddingTop: 40 }}>
      <div style={{ width: "100%", maxWidth: 580 }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 28, color: "var(--green)" }}>Placement Quiz</div>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Let's find your level</div>
        </div>
        <div className="quiz-progress">
          <div className="quiz-progress-fill" style={{ width: (idx / PLACEMENT_QUESTIONS.length * 100) + "%" }} />
        </div>
        <div className="quiz-q-num">Question {idx + 1} of {PLACEMENT_QUESTIONS.length}</div>
        <div className="quiz-prompt">{q.prompt}</div>
        <div className="quiz-options">
          {q.options.map(opt => (
            <button key={opt} disabled={showFeedback}
              className={`quiz-option ${showFeedback && opt === q.correctAnswer ? "correct" : ""} ${showFeedback && opt === selected && opt !== q.correctAnswer ? "wrong" : ""}`}
              onClick={() => pick(opt)}>{opt}</button>
          ))}
        </div>
        {showFeedback && (
          <>
            <div className="quiz-explanation">💡 {q.explanation}</div>
            <button className="btn btn-primary" style={{ marginTop: 20, width: "100%" }} onClick={next}>
              {idx + 1 >= PLACEMENT_QUESTIONS.length ? "See Results" : "Next →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard({ user, onNavigate }) {
  const avatar = AVATARS.find(a => a.id === user.avatar);
  const { level, xpInLevel, xpNeeded } = calcLevel(user.xp || 0);
  const xpPct = Math.round((xpInLevel / xpNeeded) * 100);
  const today = getDailyKey();
  const puzzleDone = user.dailyCompletions?.[today]?.completed;
  const stats = user.stats || {};
  const accuracy = stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;
  const userAchievements = new Set(user.achievements || []);

  return (
    <div className="dashboard">
      <div className="dash-header">
        <div className="dash-avatar">{avatar?.emoji || "🐻"}</div>
        <div className="dash-info" style={{ flex: 1 }}>
          <h2>{user.displayName}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>@{user.username}</p>
          <div className="level-badge">⭐ Level {level}</div>
          <div className="xp-bar-wrap">
            <div className="xp-bar-label">
              <span>XP Progress</span>
              <span>{xpInLevel} / {xpNeeded} XP</span>
            </div>
            <div className="xp-bar"><div className="xp-bar-fill" style={{ width: xpPct + "%" }} /></div>
          </div>
        </div>
      </div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-val">🔥 {user.streak || 0}</div><div className="stat-lbl">Day Streak</div></div>
        <div className="stat-card"><div className="stat-val">{stats.lessonsCompleted || 0}</div><div className="stat-lbl">Lessons</div></div>
        <div className="stat-card"><div className="stat-val">{accuracy}%</div><div className="stat-lbl">Accuracy</div></div>
      </div>
      <div className="dash-grid">
        <div className="dash-action-card" onClick={() => !puzzleDone && onNavigate("puzzle")}>
          <div className="dash-action-icon">🧩</div>
          <div className="dash-action-title">Daily Puzzle</div>
          <div className="dash-action-desc">5 new questions every day</div>
          {puzzleDone ? <div className="dash-action-done">✓ Done today</div> : <div className="dash-action-badge">+50 XP</div>}
        </div>
        <div className="dash-action-card" onClick={() => onNavigate("lesson")}>
          <div className="dash-action-icon">📖</div>
          <div className="dash-action-title">Continue Learning</div>
          <div className="dash-action-desc">10 questions at your level</div>
          <div className="dash-action-badge">+XP</div>
        </div>
      </div>
      <div className="achievements-section">
        <div className="section-title">Achievements</div>
        <div className="achievements-grid">
          {ACHIEVEMENTS.map(a => (
            <div key={a.id} className={`achievement-card ${userAchievements.has(a.id) ? "unlocked" : "locked"}`}>
              <div className="achievement-icon">{a.icon}</div>
              <div className="achievement-info"><h4>{a.name}</h4><p>{a.description}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionCard({ question, onAnswer, questionNum, total }) {
  const [selected, setSelected] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const pick = (opt) => {
    if (showFeedback) return;
    setSelected(opt);
    setShowFeedback(true);
    onAnswer(opt === question.correctAnswer);
  };

  return (
    <div>
      <div className="lesson-progress-row">
        <div className="quiz-progress" style={{ flex: 1 }}>
          <div className="quiz-progress-fill" style={{ width: ((questionNum - 1) / total * 100) + "%" }} />
        </div>
        <span style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{questionNum}/{total}</span>
      </div>
      <div className="quiz-q-num">{question.category} · {question.type === "article" ? "Article" : question.type === "fill_blank" ? "Fill in the blank" : "Translation"}</div>
      <div className="quiz-prompt">{question.prompt}</div>
      <div className="quiz-options">
        {question.options.map(opt => (
          <button key={opt} disabled={showFeedback}
            className={`quiz-option ${showFeedback && opt === question.correctAnswer ? "correct" : ""} ${showFeedback && opt === selected && opt !== question.correctAnswer ? "wrong" : ""}`}
            onClick={() => pick(opt)}>{opt}</button>
        ))}
      </div>
      {showFeedback && (
        <div className={`feedback-banner ${selected === question.correctAnswer ? "correct" : "wrong"}`}>
          {selected === question.correctAnswer ? "✓ Correct!" : "✗ Incorrect"}
          {question.explanation && <span style={{ fontWeight: 400, fontSize: 13 }}> — {question.explanation}</span>}
        </div>
      )}
    </div>
  );
}

function LessonPage({ user, onComplete, mode }) {
  const questions = mode === "puzzle" ? getDailyQuestions() : getLessonQuestions(calcLevel(user.xp || 0).level);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const handleAnswer = useCallback((correct) => {
    const xp = correct ? 10 : 2;
    setXpEarned(e => e + xp);
    const newResults = [...results, correct];
    setResults(newResults);
    setToast(xp);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
    setTimeout(() => {
      if (idx + 1 >= questions.length) {
        const allCorrect = newResults.every(Boolean) && correct;
        const bonus = allCorrect ? (mode === "puzzle" ? 50 : 25) : 0;
        setXpEarned(e => e + bonus);
        setDone(true);
      } else {
        setIdx(i => i + 1);
      }
    }, 1200);
  }, [idx, questions.length, results, mode]);

  const correctCount = results.filter(Boolean).length;

  if (done) {
    const bonus = correctCount === questions.length;
    return (
      <div className="lesson-page">
        <div className="lesson-complete">
          <div className="lesson-complete-icon">{bonus ? "🌟" : "✅"}</div>
          <h2>{bonus ? "Perfect!" : "Lesson Complete!"}</h2>
          <div className="lesson-complete-stats">
            <div className="ls-stat"><div className="ls-val">{correctCount}/{questions.length}</div><div className="ls-lbl">Correct</div></div>
            <div className="ls-stat"><div className="ls-val" style={{ color: "var(--gold)" }}>+{xpEarned}</div><div className="ls-lbl">XP Earned</div></div>
            <div className="ls-stat"><div className="ls-val">{Math.round(correctCount / questions.length * 100)}%</div><div className="ls-lbl">Accuracy</div></div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => onComplete(xpEarned, correctCount, questions.length, mode)}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-page">
      {toast && <XpToast xp={toast} />}
      <div className="lesson-header">
        <div className="lesson-title">{mode === "puzzle" ? "🧩 Daily Puzzle" : "📖 Learn German"}</div>
        <div className="lesson-sub">{mode === "puzzle" ? "Today's challenge" : "Keep it up — every answer counts!"}</div>
      </div>
      <QuestionCard key={idx} question={questions[idx]} onAnswer={handleAnswer} questionNum={idx + 1} total={questions.length} />
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("loading");
  const [user, setUser] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const firebaseUid = useRef(null);

  // Listen to Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        firebaseUid.current = fbUser.uid;
        const gameData = getGameData(fbUser.uid);
        if (gameData) {
          setUser(gameData);
          setPage("dashboard");
        } else {
          // Signed in but no game data (e.g. after clearing localStorage) — re-onboard
          const fresh = makeDefaultGameData(fbUser.uid, { displayName: fbUser.email?.split("@")[0] || "Learner" });
          saveGameData(fbUser.uid, fresh);
          setUser(fresh);
          setPage("dashboard");
        }
      } else {
        firebaseUid.current = null;
        setUser(null);
        setPage("landing");
      }
    });
    return () => unsub();
  }, []);

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    updated.achievements = checkAchievements(updated);
    setUser(updated);
    saveGameData(firebaseUid.current, updated);
    return updated;
  };

  const navigate = (p) => setPage(p);

  const handleSignupComplete = (gameData, levelChoice) => {
    firebaseUid.current = gameData.uid;
    setUser(gameData);
    if (levelChoice === "none") {
      setPage("dashboard");
    } else {
      setPage("quiz");
    }
  };

  const handlePlacementComplete = (startLevel) => {
    const startXp = totalXpForLevel(startLevel);
    updateUser({ xp: startXp });
    setPage("dashboard");
  };

  const handleLogin = (gameData) => {
    firebaseUid.current = gameData.uid;
    setUser(gameData);
    setPage("dashboard");
  };

  const handleLogout = async () => {
    await signOut(auth);
    firebaseUid.current = null;
    setUser(null);
    setPage("landing");
  };

  const handleLessonComplete = (xpEarned, correct, total, mode) => {
    const today = getDailyKey();
    const stats = { ...(user.stats || {}) };
    stats.totalAnswered = (stats.totalAnswered || 0) + total;
    stats.totalCorrect = (stats.totalCorrect || 0) + correct;
    if (mode === "puzzle") stats.puzzlesCompleted = (stats.puzzlesCompleted || 0) + 1;
    else stats.lessonsCompleted = (stats.lessonsCompleted || 0) + 1;

    const prevXp = user.xp || 0;
    const newXp = prevXp + xpEarned;
    const { level: prevLvl } = calcLevel(prevXp);
    const { level: newLvl } = calcLevel(newXp);

    let streak = user.streak || 0;
    if (user.lastActiveDate !== today) {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const yesterday = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      streak = user.lastActiveDate === yesterday ? streak + 1 : 1;
    }

    const dailyCompletions = { ...(user.dailyCompletions || {}) };
    if (mode === "puzzle") dailyCompletions[today] = { completed: true, xpEarned };

    updateUser({ xp: newXp, stats, streak, lastActiveDate: today, dailyCompletions });

    if (newLvl > prevLvl) setLevelUp(newLvl);
    else navigate("dashboard");
  };

  if (page === "loading") {
    return (
      <div className="app">
        <style>{styles}</style>
        <div className="loading-screen">
          <div className="loading-logo">Sprak</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <style>{styles}</style>
      {user && page !== "landing" && <Nav user={user} onLogout={handleLogout} onNavigate={navigate} />}
      {levelUp && <LevelUpOverlay level={levelUp} onContinue={() => { setLevelUp(null); navigate("dashboard"); }} />}
      {page === "landing" && <Landing onNavigate={navigate} />}
      {page === "signup" && <Signup onNavigate={navigate} onSignupComplete={handleSignupComplete} />}
      {page === "login" && <Login onNavigate={navigate} onLogin={handleLogin} />}
      {page === "quiz" && <PlacementQuiz onComplete={handlePlacementComplete} />}
      {page === "dashboard" && user && <Dashboard user={user} onNavigate={navigate} />}
      {page === "lesson" && user && <LessonPage user={user} mode="lesson" onComplete={handleLessonComplete} key={"lesson-" + Date.now()} />}
      {page === "puzzle" && user && <LessonPage user={user} mode="puzzle" onComplete={handleLessonComplete} key={"puzzle-" + Date.now()} />}
    </div>
  );
}
