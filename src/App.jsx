import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowRight, Sparkles, Download, LogOut, Plus,
  ChevronRight, Loader2, X, Check, FileText, Share2, BarChart3, Flame, Trophy, Target, PenLine, Lightbulb, CalendarDays, TrendingUp, Brain, BookOpen, Clock, GitCompare, UserRound, HelpCircle, History, ListTree, Library, Search, Trash2, Copy, Eye, EyeOff, Settings, Upload, Palette, MessageCircle, HeartPulse, SearchCheck, Quote, Link2, GraduationCap, FileSearch, Wand2, SlidersHorizontal, UserCircle,
} from "lucide-react";

/* ---------------------------------------------------------------
   Marginal — writes like you would've, if you'd had more time.
--------------------------------------------------------------- */

const DEFAULT_TRAITS = {
  formality: 50,
  sentenceVariety: 50,
  vocabularyComplexity: 50,
  warmth: 50,
  directness: 50,
};

const TRAIT_LABELS = {
  formality: ["Loose", "Formal"],
  sentenceVariety: ["Steady", "Varied"],
  vocabularyComplexity: ["Plain", "Rich"],
  warmth: ["Cool", "Warm"],
  directness: ["Roundabout", "Direct"],
};

const TONE_OPTIONS = [
  { id: "auto", label: "My voice" },
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
];

function countWords(text = "") {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function diffWords(oldText = "", newText = "") {
  const a = oldText.trim().split(/\s+/).filter(Boolean);
  const b = newText.trim().split(/\s+/).filter(Boolean);
  if (a.length > 1400 || b.length > 1400) {
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    let endA = a.length - 1, endB = b.length - 1;
    while (endA >= start && endB >= start && a[endA] === b[endB]) { endA--; endB--; }
    return [
      ...a.slice(0, start).map(w => ({ type: "same", text: w })),
      ...a.slice(start, endA + 1).map(w => ({ type: "removed", text: w })),
      ...b.slice(start, endB + 1).map(w => ({ type: "added", text: w })),
      ...a.slice(endA + 1).map(w => ({ type: "same", text: w })),
    ];
  }
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
    }
  }
  const out = []; let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ type: "same", text: a[i] }); i++; j++; }
    else if (dp[i+1][j] >= dp[i][j+1]) out.push({ type: "removed", text: a[i++] });
    else out.push({ type: "added", text: b[j++] });
  }
  while (i < a.length) out.push({ type: "removed", text: a[i++] });
  while (j < b.length) out.push({ type: "added", text: b[j++] });
  return out;
}

/* ---------------- multi-voice helpers ----------------
   The original onboarding voice lives at the top level of the profile
   (profile.styleProfile / profile.weights / profile.samples) and is
   always called "default" here. Any additional named voices live in
   profile.extraVoices, each shaped like { id, name, styleProfile, weights, samples }. */
function allVoices(profile) {
  return [
    { id: "default", name: "My voice", styleProfile: profile.styleProfile, weights: profile.weights, samples: profile.samples },
    ...(profile.extraVoices || []),
  ];
}

function getVoice(profile, voiceId) {
  return allVoices(profile).find((v) => v.id === voiceId) || allVoices(profile)[0];
}

/* ---------------- writing stats helper ---------------- */
function computeStats(profile) {
  const drafts = profile.drafts || [];
  const totalWords = drafts.reduce((sum, d) => {
    const text = (d.content || "").trim();
    return sum + (text ? text.split(/\s+/).length : 0);
  }, 0);
  const totalAccepted = drafts.reduce((s, d) => s + (d.accepted || []).length, 0);
  const totalRejected = drafts.reduce((s, d) => s + (d.rejected || []).length, 0);
  const totalSuggestions = totalAccepted + totalRejected;
  const acceptanceRate = totalSuggestions > 0 ? Math.round((totalAccepted / totalSuggestions) * 100) : null;

  const activity = {};
  drafts.forEach((d) => {
    const timestamps = [d.createdAt, d.updatedAt].filter(Boolean);
    timestamps.forEach((t) => {
      const key = new Date(t).toISOString().slice(0, 10);
      if (!activity[key]) activity[key] = { words: 0, drafts: new Set() };
      activity[key].drafts.add(d.id);
    });
    const key = d.updatedAt ? new Date(d.updatedAt).toISOString().slice(0, 10) : null;
    if (key) {
      if (!activity[key]) activity[key] = { words: 0, drafts: new Set() };
      const text = (d.content || '').trim();
      activity[key].words += text ? text.split(/\s+/).length : 0;
    }
  });

  const activeDays = Object.keys(activity).filter((k) => activity[k].drafts.size > 0).sort();
  let streak = 0;
  let cursor = new Date();
  const todayKey = cursor.toISOString().slice(0, 10);
  if (!activity[todayKey]) cursor.setDate(cursor.getDate() - 1);
  while (activity[cursor.toISOString().slice(0, 10)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const longestStreak = (() => {
    let best = 0, run = 0, prev = null;
    activeDays.forEach((key) => {
      const d = new Date(`${key}T00:00:00`);
      if (prev && (d - prev) / 86400000 === 1) run++;
      else run = 1;
      best = Math.max(best, run);
      prev = d;
    });
    return best;
  })();

  const paperTypes = {};
  drafts.forEach((d) => {
    const type = d.paperType || 'general';
    if (!paperTypes[type]) paperTypes[type] = { drafts: 0, words: 0 };
    paperTypes[type].drafts++;
    const text = (d.content || '').trim();
    paperTypes[type].words += text ? text.split(/\s+/).length : 0;
  });

  const longestDraft = drafts.reduce((best, d) => {
    const words = (d.content || '').trim() ? d.content.trim().split(/\s+/).length : 0;
    return words > (best?.words || 0) ? { title: d.title || 'Untitled', words } : best;
  }, null);
  const mostProductiveDay = Object.entries(activity).reduce((best, [date, v]) => v.words > (best?.words || 0) ? { date, words: v.words } : best, null);
  const mostActiveType = Object.entries(paperTypes).reduce((best, [type, v]) => v.words > (best?.words || 0) ? { type, ...v } : best, null);
  const averageDraftWords = drafts.length ? Math.round(totalWords / drafts.length) : 0;
  const nonEmptyDrafts = drafts.filter(d => (d.content || '').trim()).length;

  const recent = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    recent.push({ date: key, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), words: activity[key]?.words || 0, active: !!activity[key] });
  }

  const voiceTraits = profile.styleProfile?.traits || profile.weights || {};
  return {
    totalWords, totalDrafts: drafts.length, totalAccepted, totalRejected, acceptanceRate, streak, longestStreak,
    totalSuggestions, activity, recent, paperTypes, longestDraft, mostProductiveDay, mostActiveType, voiceTraits, averageDraftWords, nonEmptyDrafts,
  };
}

/* ---------------- backend API helper ---------------- */

async function apiRequest(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new Error(data.error || "Something went wrong talking to the server.");
  return data;
}

async function callGemini(system, userContent, token, { json = false } = {}) {
  const data = await apiRequest("/gemini", {
    method: "POST",
    token,
    body: { system, messages: [{ role: "user", content: userContent }] },
  });
  const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("");
  if (json) {
    let cleaned = text.replace(/```json|```/g, "").trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) cleaned = m[0];
    return JSON.parse(cleaned);
  }
  return text;
}

/* ---------------- little marginalia SVG marks ---------------- */

const Squiggle = ({ color = "var(--mgn-coral)", w = 60 }) => (
  <svg width={w} height="10" viewBox="0 0 60 10" fill="none">
    <path d="M1 6 Q6 1 11 6 T21 6 T31 6 T41 6 T51 6 T60 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const Caret = ({ color = "var(--mgn-mint)" }) => (
  <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
    <path d="M1 11L7 1L13 11" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ================================================================
   ROOT APP
================================================================ */
export default function App() {
  const [page, setPage] = useState("landing");
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [bootChecked, setBootChecked] = useState(false);

  // Resume a saved session on load
  useEffect(() => {
    const savedToken = localStorage.getItem("mgn_token");
    const savedUsername = localStorage.getItem("mgn_username");
    if (savedToken && savedUsername) {
      apiRequest("/profile", { token: savedToken })
        .then(({ profile }) => {
          setToken(savedToken);
          setCurrentUser(savedUsername);
          setProfile(profile);
          setPage(profile.styleProfile ? "dashboard" : "onboarding");
        })
        .catch(() => {
          localStorage.removeItem("mgn_token");
          localStorage.removeItem("mgn_username");
        })
        .finally(() => setBootChecked(true));
    } else {
      setBootChecked(true);
    }
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  async function persist(p) {
    setProfile(p);
    try {
      await apiRequest("/profile", { method: "PUT", token, body: { profile: p } });
    } catch {
      showToast("Couldn't save just now — check that the server is running.");
    }
  }

  async function handleAuth(mode, username, password) {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const data = await apiRequest(`/${mode}`, { method: "POST", body: { username, password } });
      localStorage.setItem("mgn_token", data.token);
      localStorage.setItem("mgn_username", data.username);
      setToken(data.token);
      setCurrentUser(data.username);
      setProfile(data.profile);
      setPage(data.profile.styleProfile ? "dashboard" : "onboarding");
    } catch (e) {
      setAuthError(e.message);
    }
    setAuthLoading(false);
  }

  function handleLogout() {
    localStorage.removeItem("mgn_token");
    localStorage.removeItem("mgn_username");
    setToken(null);
    setCurrentUser(null);
    setProfile(null);
    setActiveDraftId(null);
    setPage("landing");
  }

  if (!bootChecked) return <div className="mgn-app" />;

  return (
    <div className="mgn-app" style={{"--mgn-accent": profile?.settings?.accentColor || "#7567F8"}}>
      <GlobalStyle />
      {toast && <div className="mgn-toast">{toast}</div>}
      {page === "landing" && (
        <Landing
          onLogin={() => setPage("login")}
          onStart={() => setPage("login")}
          isAuthed={!!token && !!profile}
          onDashboard={() => setPage(profile?.styleProfile ? "dashboard" : "onboarding")}
          onLogout={handleLogout}
        />
      )}
      {page === "login" && (
        <Login
          onAuth={handleAuth}
          error={authError}
          loading={authLoading}
          onBack={() => setPage("landing")}
        />
      )}
      {page === "onboarding" && profile && (
        <Onboarding
          profile={profile}
          token={token}
          onDone={async (styleProfile, samples) => {
            const p = { ...profile, styleProfile, samples, weights: { ...styleProfile.traits } };
            await persist(p);
            setPage("dashboard");
            showToast(`Marginal has your voice now, ${currentUser}.`);
          }}
        />
      )}
      {page === "dashboard" && profile && (
        <Dashboard
          userName={currentUser}
          profile={profile}
          token={token}
          onUpdate={persist}
          onLogout={handleLogout}
          onHome={() => setPage("landing")}
          onOpenDraft={(id) => {
            setActiveDraftId(id);
            setPage("editor");
          }}
          onNewDraft={async () => {
            const draft = {
              id: Date.now().toString(),
              title: "Untitled",
              content: "",
              tone: "auto",
              paperType: "ap-lang",
              createdAt: Date.now(),
              updatedAt: Date.now(),
              accepted: [],
              rejected: [],
              versions: [],
            };
            const p = { ...profile, drafts: [draft, ...profile.drafts] };
            await persist(p);
            setActiveDraftId(draft.id);
            setPage("editor");
          }}
          showToast={showToast}
          onSettings={() => setPage("settings")}
          onResearch={() => setPage("research")}
          onStats={() => setPage("stats")}
          onLibrary={() => setPage("library")}
          onOutline={() => setPage("outline")}
          onProfile={() => setPage("profile")}
          onRewrite={() => setPage("rewrite")}
        />
      )}
      {page === "stats" && profile && (
        <StatsPage userName={currentUser} profile={profile} onUpdate={persist} onLogout={handleLogout} onHome={() => setPage("landing")} onDashboard={() => setPage("dashboard")} onLibrary={() => setPage("library")} onOutline={() => setPage("outline")} onProfile={() => setPage("profile")} onSettings={() => setPage("settings")} onResearch={() => setPage("research")} onRewrite={() => setPage("rewrite")} />
      )}
      {page === "library" && profile && (
        <LibraryPage
          userName={currentUser}
          profile={profile}
          onLogout={handleLogout}
          onHome={() => setPage("landing")}
          onDashboard={() => setPage("dashboard")}
          onStats={() => setPage("stats")}
          onOutline={() => setPage("outline")}
          onProfile={() => setPage("profile")}
          onSettings={() => setPage("settings")}
          onResearch={() => setPage("research")}
          onOpenDraft={(id) => { setActiveDraftId(id); setPage("editor"); }}
          onNewDraft={async () => {
            const draft = { id: Date.now().toString(), title: "Untitled", content: "", tone: "auto", paperType: "ap-lang", createdAt: Date.now(), updatedAt: Date.now(), accepted: [], rejected: [], versions: [] };
            await persist({ ...profile, drafts: [draft, ...profile.drafts] });
            setActiveDraftId(draft.id); setPage("editor");
          }}
          onDeleteDraft={async (id) => {
            await persist({ ...profile, drafts: profile.drafts.filter(d => d.id !== id) });
            showToast("Draft moved out of your library.");
          }}
          onRewrite={() => setPage("rewrite")}
        />
      )}
      {page === "outline" && profile && (
        <OutlineBuilderPage
          userName={currentUser}
          profile={profile}
          onUpdate={persist}
          onLogout={handleLogout}
          onHome={() => setPage("landing")}
          onDashboard={() => setPage("dashboard")}
          onStats={() => setPage("stats")}
          onLibrary={() => setPage("library")}
          onProfile={() => setPage("profile")}
          onSettings={() => setPage("settings")}
          onResearch={() => setPage("research")}
          onOpenDraft={(id) => { setActiveDraftId(id); setPage("editor"); }}
          showToast={showToast}
          onRewrite={() => setPage("rewrite")}
        />
      )}
      {page === "profile" && profile && (
        <WritingProfilePage
          userName={currentUser}
          profile={profile}
          onUpdate={persist}
          onLogout={handleLogout}
          onHome={() => setPage("landing")}
          onDashboard={() => setPage("dashboard")}
          onStats={() => setPage("stats")}
          onLibrary={() => setPage("library")}
          onOutline={() => setPage("outline")}
          onSettings={() => setPage("settings")}
          onResearch={() => setPage("research")}
          onRewrite={() => setPage("rewrite")}
        />
      )}
      {page === "settings" && profile && (
        <SettingsPage userName={currentUser} profile={profile} token={token} onUpdate={persist} onLogout={handleLogout} onHome={() => setPage("landing")} onDashboard={() => setPage("dashboard")} onStats={() => setPage("stats")} onLibrary={() => setPage("library")} onOutline={() => setPage("outline")} onProfile={() => setPage("profile")} onResearch={() => setPage("research")} showToast={showToast} onRewrite={() => setPage("rewrite")} />
      )}
      {page === "research" && profile && (
        <ResearchWorkspacePage userName={currentUser} profile={profile} token={token} onUpdate={persist} onLogout={handleLogout} onHome={() => setPage("landing")} onDashboard={() => setPage("dashboard")} onStats={() => setPage("stats")} onLibrary={() => setPage("library")} onOutline={() => setPage("outline")} onProfile={() => setPage("profile")} onSettings={() => setPage("settings")} showToast={showToast} onRewrite={() => setPage("rewrite")} />
      )}
      {page === "rewrite" && profile && (
        <RewritePage
          userName={currentUser}
          profile={profile}
          token={token}
          onUpdate={persist}
          onLogout={handleLogout}
          onHome={() => setPage("landing")}
          onDashboard={() => setPage("dashboard")}
          onStats={() => setPage("stats")}
          onLibrary={() => setPage("library")}
          onOutline={() => setPage("outline")}
          onProfile={() => setPage("profile")}
          onSettings={() => setPage("settings")}
          onResearch={() => setPage("research")}
          onOpenDraft={(id) => { setActiveDraftId(id); setPage("editor"); }}
          showToast={showToast}
        />
      )}
      {page === "editor" && profile && (
        <Editor
          profile={profile}
          token={token}
          draftId={activeDraftId}
          onUpdate={persist}
          onBack={() => setPage("dashboard")}
          showToast={showToast}
        />
      )}
    </div>
  );
}

/* ================================================================
   LANDING
================================================================ */
function Landing({ onLogin, onStart, isAuthed, onDashboard, onLogout }) {
  const script = "I've been thinking about how the best ideas arrive";
  const ghost = " sideways, not head-on.";
  const [shown, setShown] = useState(0);
  const [ghostVisible, setGhostVisible] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let i = 0;
    let t;
    function typeStep() {
      if (i <= script.length) {
        setShown(i);
        i++;
        t = setTimeout(typeStep, 28);
      } else {
        setGhostVisible(true);
        setTimeout(() => setAccepted(true), 1100);
        setTimeout(() => {
          setAccepted(false);
          setGhostVisible(false);
          setShown(0);
          i = 0;
          t = setTimeout(typeStep, 700);
        }, 2600);
      }
    }
    typeStep();
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mgn-landing">
      <nav className="mgn-nav">
        <div className="mgn-logo">Marginal</div>
        <div className="mgn-nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="mgn-nav-actions">
          {isAuthed ? (
            <>
              <button className="mgn-btn-ghost" onClick={onLogout}>Log out</button>
              <button className="mgn-btn-primary" onClick={onDashboard}>Go to dashboard</button>
            </>
          ) : (
            <>
              <button className="mgn-btn-ghost" onClick={onLogin}>Log in</button>
              <button className="mgn-btn-primary" onClick={onStart}>Get started</button>
            </>
          )}
        </div>
      </nav>

      <header className="mgn-hero">
        <div className="mgn-hero-copy">
          <h1 className="mgn-h1">
            Finish that
            <br />
            thought.
          </h1>
          <p className="mgn-lede">
            Feed Marginal ten things you've written. It learns your rhythm,
            your words, your little tics — then keeps going with you, one
            pause at a time.
          </p>
          <button className="mgn-btn-primary mgn-btn-lg" onClick={onStart}>
            Start writing <ArrowRight size={18} />
          </button>
        </div>

        <div className="mgn-demo-card">
          <div className="mgn-demo-dots">
            <span /><span /><span />
          </div>
          <div className="mgn-demo-text">
            {script.slice(0, shown)}
            {ghostVisible && (
              <span className={"mgn-demo-ghost" + (accepted ? " mgn-demo-ghost-accepted" : "")}>
                {ghost}
              </span>
            )}
            <span className="mgn-caret-blink">|</span>
          </div>
          {ghostVisible && !accepted && (
            <div className="mgn-key-chip">
              <kbd>tab</kbd> to keep it
            </div>
          )}
        </div>
      </header>

      <section className="mgn-notes" id="features">
        <h2 className="mgn-section-title">Built to feel like your own hand</h2>
        <MarginNote rotate={-2} color="coral">
          <Squiggle /> <strong>Learns your rhythm</strong> — not just your
          vocabulary. Sentence length, tone, the way you open a paragraph.
        </MarginNote>
        <MarginNote rotate={1.5} color="yellow">
          <strong>Dial it in.</strong> Nudge it more formal, more varied,
          more you — with sliders, not settings menus.
        </MarginNote>
        <MarginNote rotate={-1} color="mint">
          <Caret /> <strong>Remembers what you reject.</strong> Wave off a
          suggestion and it learns to stop offering that kind.
        </MarginNote>
        <MarginNote rotate={2} color="lilac">
          <strong>Two voices, one you.</strong> Flip between your
          professional voice and your casual one, mid-draft.
        </MarginNote>
      </section>

      <section className="mgn-how" id="how-it-works">
        <h2 className="mgn-section-title">How it works</h2>
        <div className="mgn-how-grid">
          <div className="mgn-how-step">
            <div className="mgn-how-num">1</div>
            <h3>Feed it your writing</h3>
            <p>Paste in a handful of things you've already written — emails, essays, notes. No editing required.</p>
          </div>
          <div className="mgn-how-step">
            <div className="mgn-how-num">2</div>
            <h3>Marginal learns your voice</h3>
            <p>It reads for rhythm, tone, and the small habits that make your writing sound like you — not a template.</p>
          </div>
          <div className="mgn-how-step">
            <div className="mgn-how-num">3</div>
            <h3>Write, with company</h3>
            <p>Start typing anywhere. Marginal offers a few words at a time, in your voice, whenever you pause.</p>
          </div>
        </div>
      </section>

      <section className="mgn-quotes">
        <blockquote className="mgn-quote">
          "It's the first writing tool that didn't make my emails sound like everyone else's."
        </blockquote>
        <blockquote className="mgn-quote">
          "I stopped fighting the blank page. It just picks up where I left off."
        </blockquote>
        <blockquote className="mgn-quote">
          "Feels less like autocomplete and more like a co-writer who's read everything I've ever sent."
        </blockquote>
      </section>

      <section className="mgn-faq" id="faq">
        <h2 className="mgn-section-title">Questions, answered</h2>
        <div className="mgn-faq-list">
          <details className="mgn-faq-item">
            <summary>Does Marginal write for me, or with me?</summary>
            <p>With you. It never writes more than a sentence at a time, and every suggestion is something you choose to accept or skip.</p>
          </details>
          <details className="mgn-faq-item">
            <summary>How many writing samples do I need?</summary>
            <p>Three is enough to get started, though ten or more gives it a clearer picture. You can always add more later from your dashboard.</p>
          </details>
          <details className="mgn-faq-item">
            <summary>Can I have more than one voice?</summary>
            <p>Yes — flip between a professional and a casual tone mid-draft, and Marginal adjusts on the fly.</p>
          </details>
          <details className="mgn-faq-item">
            <summary>Where does my writing go?</summary>
            <p>Your samples and drafts live in your own account and are only used to build your personal style profile.</p>
          </details>
        </div>
      </section>

      <footer className="mgn-footer-full">
        <div className="mgn-footer-top">
          <div className="mgn-footer-brand">
            <div className="mgn-logo">Marginal</div>
            <p className="mgn-muted">The space between what you typed and what you meant.</p>
          </div>
          <div className="mgn-footer-col">
            <div className="mgn-footer-heading">Product</div>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="mgn-footer-col">
            <div className="mgn-footer-heading">Get started</div>
            <button className="mgn-footer-link" onClick={onStart}>Create an account</button>
            <button className="mgn-footer-link" onClick={onLogin}>Log in</button>
          </div>
        </div>
        <div className="mgn-footer-bottom">
          © {new Date().getFullYear()} Marginal.
        </div>
      </footer>
    </div>
  );
}

function MarginNote({ children, rotate, color }) {
  return (
    <div className={`mgn-note mgn-note-${color}`} style={{ transform: `rotate(${rotate}deg)` }}>
      {children}
    </div>
  );
}

/* ================================================================
   LOGIN / SIGNUP — real authentication against the backend
================================================================ */
function Login({ onAuth, error, loading, onBack }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit = username.trim().length > 0 && password.length >= 6 && !loading;

  function submit() {
    if (!canSubmit) return;
    onAuth(mode, username.trim(), password);
  }

  function handleKey(e) {
    if (e.key === "Enter") submit();
  }

  return (
    <div className="mgn-center-page">
      <button className="mgn-btn-ghost mgn-back" onClick={onBack}>← Back</button>
      <div className="mgn-panel">
        <h2 className="mgn-h2">{mode === "login" ? "Welcome back." : "Create your account."}</h2>
        <p className="mgn-muted">
          {mode === "login"
            ? "Log in to load your voice."
            : "Pick a username and password — this keeps your style profile yours, on your own machine."}
        </p>

        <div className="mgn-tone-toggle mgn-mode-toggle">
          <button
            className={"mgn-tone-pill" + (mode === "login" ? " mgn-tone-pill-active" : "")}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
          <button
            className={"mgn-tone-pill" + (mode === "signup" ? " mgn-tone-pill-active" : "")}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        <div className="mgn-auth-form">
          <input
            className="mgn-input"
            placeholder="Username"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKey}
          />
          <input
            className="mgn-input"
            type="password"
            placeholder="Password (6+ characters)"
            value={password}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKey}
          />
          {error && <div className="mgn-error">{error}</div>}
          <button className="mgn-btn-primary mgn-btn-lg" onClick={submit} disabled={!canSubmit}>
            {loading ? (
              <Loader2 className="mgn-spin" size={17} />
            ) : mode === "login" ? (
              "Log in"
            ) : (
              "Create account"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   ONBOARDING — feed in writing samples, analyze style
================================================================ */
function Onboarding({ profile, token, onDone }) {
  const [samples, setSamples] = useState(
    profile.samples.length ? profile.samples : ["", "", ""]
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const filled = samples.filter((s) => s.trim().length > 40);

  function update(i, val) {
    const next = [...samples];
    next[i] = val;
    setSamples(next);
  }

  async function analyze() {
    setError(null);
    setAnalyzing(true);
    try {
      const joined = filled
        .map((s, i) => `--- SAMPLE ${i + 1} ---\n${s.trim()}`)
        .join("\n\n");
      const result = await callGemini(
        `You are a literary style analyst for Marginal, a writing app. Given writing samples from one person, produce a JSON style profile. Return ONLY valid JSON, no prose, no markdown fences, with this exact shape:
{
  "summary": "2-3 sentence description of this person's voice, written warmly and specifically",
  "traits": { "formality": 0-100, "sentenceVariety": 0-100, "vocabularyComplexity": 0-100, "warmth": 0-100, "directness": 0-100 },
  "avgSentenceLength": number,
  "commonPhrases": ["up to 6 short recurring words/phrases or tics"],
  "quirks": ["up to 5 short stylistic observations, e.g. 'opens paragraphs with a question'"],
  "sampleOpeners": ["up to 3 short phrases showing how they typically start a sentence"]
}`,
        joined,
        token,
        { json: true }
      );
      onDone(result, samples);
    } catch (e) {
      setError("Couldn't analyze that batch — try trimming a sample or two and running it again.");
    }
    setAnalyzing(false);
  }

  return (
    <div className="mgn-onboarding">
      <div className="mgn-onboard-head">
        <h2 className="mgn-h2">Show Marginal how you write.</h2>
        <p className="mgn-muted">
          Paste in 3–10 pieces — emails, essays, journal entries, anything.
          One page or ten, doesn't matter. The more varied, the better it learns.
        </p>
      </div>

      <div className="mgn-sample-grid">
        {samples.map((s, i) => (
          <div className="mgn-sample-box" key={i}>
            <div className="mgn-sample-label">
              Sample {i + 1}
              {s.trim().length > 40 && <Check size={14} color="var(--mgn-mint)" />}
            </div>
            <textarea
              className="mgn-sample-textarea"
              placeholder="Paste writing here…"
              value={s}
              onChange={(e) => update(i, e.target.value)}
            />
          </div>
        ))}
        {samples.length < 10 && (
          <button className="mgn-add-sample" onClick={() => setSamples([...samples, ""])}>
            <Plus size={18} /> Add another
          </button>
        )}
      </div>

      {error && <div className="mgn-error">{error}</div>}

      <div className="mgn-onboard-footer">
        <span className="mgn-muted">{filled.length} of {samples.length} samples ready (40+ characters each)</span>
        <button
          className="mgn-btn-primary mgn-btn-lg"
          disabled={filled.length < 2 || analyzing}
          onClick={analyze}
        >
          {analyzing ? <><Loader2 className="mgn-spin" size={18} /> Reading your voice…</> : <>Analyze my style <Sparkles size={18} /></>}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   DASHBOARD
================================================================ */
function Dashboard({ userName, profile, token, onUpdate, onLogout, onHome, onOpenDraft, onNewDraft, showToast, onStats, onLibrary, onOutline, onProfile, onSettings, onResearch, onRewrite }) {
  const [showDeep, setShowDeep] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [showAddVoice, setShowAddVoice] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const sp = profile.styleProfile;
  const stats = computeStats(profile);
  const voices = allVoices(profile);

  function setWeight(key, val) {
    onUpdate({ ...profile, weights: { ...profile.weights, [key]: val } });
  }

  function removeVoice(id) {
    onUpdate({ ...profile, extraVoices: (profile.extraVoices || []).filter((v) => v.id !== id) });
    showToast("Voice removed.");
  }

  return (
    <div className="mgn-dash">
      <TopBar userName={userName} avatar={profile.avatar} onLogout={onLogout} onHome={onHome} onStats={onStats} onLibrary={onLibrary} onOutline={onOutline} onProfile={onProfile} onSettings={onSettings} onResearch={onResearch} onRewrite={onRewrite} />

      <div className="mgn-quick-actions"><button className="mgn-quick-action primary" onClick={onNewDraft}><PenLine/><span><strong>Write</strong><small>Start a new draft</small></span><ArrowRight/></button><button className="mgn-quick-action" onClick={onOutline}><ListTree/><span><strong>Plan</strong><small>Build an outline</small></span><ArrowRight/></button><button className="mgn-quick-action" onClick={onRewrite}><Wand2/><span><strong>Rewrite</strong><small>Paste text, get it in your voice</small></span><ArrowRight/></button><button className="mgn-quick-action" onClick={onResearch}><FileSearch/><span><strong>Research</strong><small>Collect sources</small></span><ArrowRight/></button><button className="mgn-quick-action" onClick={onStats}><TrendingUp/><span><strong>Improve</strong><small>See your writing trends</small></span><ArrowRight/></button></div>

        <div className="mgn-dash-grid">
        <section className="mgn-card mgn-style-card">
          <div className="mgn-card-head">
            <h3>Your voice</h3>
            <span className="mgn-pill-soft">{profile.accepted.length} kept · {profile.rejected.length} passed on</span>
          </div>
          <p className="mgn-voice-summary">{sp.summary}</p>

          {sp.quirks?.length > 0 && (
            <div className="mgn-tags">
              {sp.quirks.map((q, i) => (
                <span className="mgn-tag" key={i}>{q}</span>
              ))}
            </div>
          )}

          <div className="mgn-sliders">
            {Object.keys(profile.weights).map((k) => (
              <div className="mgn-slider-row" key={k}>
                <div className="mgn-slider-labels">
                  <span>{TRAIT_LABELS[k][0]}</span>
                  <span>{TRAIT_LABELS[k][1]}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={profile.weights[k]}
                  onChange={(e) => setWeight(k, Number(e.target.value))}
                  className="mgn-slider"
                />
              </div>
            ))}
          </div>

          <button className="mgn-btn-ghost mgn-deep-btn" onClick={() => setShowProfile(true)}>
            <UserRound size={16} /> View my writing profile
          </button>
          <button className="mgn-btn-ghost mgn-deep-btn" onClick={() => setShowDeep(true)}>
            <FileText size={16} /> Run deep analysis on a longer document
          </button>
          <button className="mgn-btn-ghost mgn-deep-btn" onClick={() => setShowSamples(true)}>
            <Plus size={16} /> Add more writing samples
          </button>
          <button className="mgn-btn-ghost mgn-deep-btn" onClick={() => setShowShareCard(true)}>
            <Share2 size={16} /> Share my voice
          </button>

          <div className="mgn-voices-block">
            <div className="mgn-insights-label">Voices</div>
            <div className="mgn-voice-chips">
              {voices.map((v) => (
                <span className="mgn-voice-chip" key={v.id}>
                  {v.name}
                  {v.id !== "default" && (
                    <button className="mgn-icon-btn mgn-voice-chip-x" onClick={() => removeVoice(v.id)} title="Remove voice">
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
              <button className="mgn-voice-chip mgn-voice-chip-add" onClick={() => setShowAddVoice(true)}>
                <Plus size={13} /> New voice
              </button>
            </div>
          </div>

          {profile.insights.length > 0 && (
            <div className="mgn-insights">
              <div className="mgn-insights-label">Recent insights</div>
              {profile.insights.slice(0, 3).map((ins, i) => (
                <div className="mgn-insight-row" key={i}>· {ins}</div>
              ))}
            </div>
          )}
        </section>

        <section className="mgn-card mgn-stats-card">
          <div className="mgn-card-head">
            <h3>Your stats</h3>
          </div>
          <div className="mgn-stats-grid">
            <div className="mgn-stat">
              <div className="mgn-stat-num">{stats.totalWords.toLocaleString()}</div>
              <div className="mgn-stat-label">words written</div>
            </div>
            <div className="mgn-stat">
              <div className="mgn-stat-num">{stats.totalDrafts}</div>
              <div className="mgn-stat-label">drafts</div>
            </div>
            <div className="mgn-stat">
              <div className="mgn-stat-num">{stats.acceptanceRate === null ? "—" : `${stats.acceptanceRate}%`}</div>
              <div className="mgn-stat-label">suggestions kept</div>
            </div>
            <div className="mgn-stat">
              <div className="mgn-stat-num">{stats.streak}</div>
              <div className="mgn-stat-label">day streak</div>
            </div>
          </div>
          <div className="mgn-stats-sub">{stats.totalAccepted} accepted · {stats.totalRejected} passed on</div>
        </section>

        <section className="mgn-card mgn-drafts-card">
          <div className="mgn-card-head">
            <h3>Your drafts</h3>
            <button className="mgn-btn-primary mgn-btn-sm" onClick={onNewDraft}>
              <Plus size={16} /> New draft
            </button>
          </div>
          {profile.drafts.length === 0 && (
            <div className="mgn-empty">Nothing yet. Start a draft and Marginal will write alongside you.</div>
          )}
          <div className="mgn-draft-list">
            {profile.drafts.map((d) => (
              <button className="mgn-draft-row" key={d.id} onClick={() => onOpenDraft(d.id)}>
                <div className="mgn-draft-title">{d.title || "Untitled"}</div>
                <div className="mgn-draft-snippet">{d.content.slice(0, 90) || "Empty draft"}</div>
                <div className="mgn-draft-meta">
                  {new Date(d.updatedAt).toLocaleDateString()} · {getVoice(profile, d.voiceId || "default").name}
                  {d.tone && d.tone !== "auto" ? ` · ${d.tone}` : ""}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {showProfile && <WritingProfileModal profile={profile} onClose={() => setShowProfile(false)} />}

      {showDeep && (
        <DeepAnalysisModal
          profile={profile}
          token={token}
          onClose={() => setShowDeep(false)}
          onApply={(updatedProfile) => {
            onUpdate(updatedProfile);
            setShowDeep(false);
            showToast("Style profile refined from that document.");
          }}
        />
      )}

      {showSamples && (
        <ManageSamplesModal
          profile={profile}
          token={token}
          onClose={() => setShowSamples(false)}
          onApply={(updatedProfile) => {
            onUpdate(updatedProfile);
            setShowSamples(false);
            showToast("Added those samples — your voice profile is updated.");
          }}
        />
      )}

      {showAddVoice && (
        <AddVoiceModal
          token={token}
          onClose={() => setShowAddVoice(false)}
          onCreate={(voice) => {
            onUpdate({ ...profile, extraVoices: [...(profile.extraVoices || []), voice] });
            setShowAddVoice(false);
            showToast(`"${voice.name}" is ready to use in the editor.`);
          }}
        />
      )}

      {showShareCard && (
        <ShareCardModal
          userName={userName}
          profile={profile}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </div>
  );
}

function TopBar({ userName, avatar, onLogout, onHome, onStats, onLibrary, onOutline, onProfile, onSettings, onResearch, onRewrite }) {
  return (
    <div className="mgn-topbar">
      <button className="mgn-logo mgn-logo-sm mgn-logo-btn" onClick={onHome} title="Back to homepage">Marginal</button>
      <div className="mgn-topbar-user">
        {onLibrary && <button className="mgn-topbar-link" onClick={onLibrary}><Library size={15} /> Library</button>}
        {onOutline && <button className="mgn-topbar-link" onClick={onOutline}><ListTree size={15} /> Outline</button>}
        {onRewrite && <button className="mgn-topbar-link" onClick={onRewrite}><Wand2 size={15} /> Rewrite</button>}
        {onProfile && <button className="mgn-topbar-link" onClick={onProfile}><UserRound size={15} /> Profile</button>}
        {onResearch && <button className="mgn-topbar-link" onClick={onResearch}><FileSearch size={15} /> Research</button>}
        {onStats && <button className="mgn-topbar-link" onClick={onStats}><BarChart3 size={15} /> Stats</button>}
        {onSettings && <button className="mgn-topbar-link" onClick={onSettings} title="Settings"><Settings size={15} /></button>}
        <span className="mgn-avatar">{avatar ? <img src={avatar} alt=""/> : userName?.[0]?.toUpperCase()}</span>
        {userName}
        <button className="mgn-icon-btn" onClick={onLogout} title="Log out"><LogOut size={16} /></button>
      </div>
    </div>
  );
}


const PAPER_TYPE_LABELS = {
  'ap-lang': 'AP Language', research: 'Research Paper', 'ap-seminar': 'AP Seminar', 'literary-analysis': 'Literary Analysis', general: 'General Academic',
};

function StatsPage({ userName, profile, onUpdate, onLogout, onHome, onDashboard, onLibrary, onOutline, onSettings, onResearch, onProfile, onRewrite }) {
  const stats = computeStats(profile);
  const [goal, setGoal] = useState(() => profile.statsGoal || 3000);
  const [range, setRange] = useState('30');
  const recent = range === '7' ? stats.recent.slice(-7) : stats.recent;
  const weeklyWords = stats.recent.slice(-7).reduce((s, d) => s + d.words, 0);
  const goalProgress = Math.min(100, Math.round((weeklyWords / Math.max(1, goal)) * 100));
  const maxWords = Math.max(1, ...recent.map((d) => d.words));
  const heatDays = [];
  const start = new Date();
  start.setHours(0,0,0,0);
  start.setDate(start.getDate() - 83);
  for (let i = 0; i < 84; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0,10);
    heatDays.push({ key, words: stats.activity[key]?.words || 0 });
  }
  const maxHeat = Math.max(1, ...heatDays.map(d => d.words));
  const traitRows = [
    ['Formality', stats.voiceTraits.formality], ['Sentence variety', stats.voiceTraits.sentenceVariety], ['Vocabulary', stats.voiceTraits.vocabularyComplexity], ['Warmth', stats.voiceTraits.warmth], ['Directness', stats.voiceTraits.directness]
  ].filter(([,v]) => typeof v === 'number');

  return <div className="mgn-app"><GlobalStyle />
    <div className="mgn-topbar">
      <button className="mgn-logo mgn-logo-sm mgn-logo-btn" onClick={onHome}>Marginal</button>
      <div className="mgn-stats-nav"><button className="mgn-topbar-link" onClick={onDashboard}>← Dashboard</button>{onLibrary&&<button className="mgn-topbar-link" onClick={onLibrary}><Library size={15}/> Library</button>}{onOutline&&<button className="mgn-topbar-link" onClick={onOutline}><ListTree size={15}/> Outline</button>}{onProfile&&<button className="mgn-topbar-link" onClick={onProfile}><UserRound size={15}/> Profile</button>}{onResearch&&<button className="mgn-topbar-link" onClick={onResearch}><FileSearch size={15}/> Research</button>}{onSettings&&<button className="mgn-topbar-link" onClick={onSettings}><Settings size={15}/></button>}<div className="mgn-topbar-user"><span className="mgn-avatar">{avatar ? <img src={avatar} alt=""/> : userName?.[0]?.toUpperCase()}</span>{userName}<button className="mgn-icon-btn" onClick={onLogout}><LogOut size={16}/></button></div></div>
    </div>
    <main className="mgn-stats-page">
      <div className="mgn-stats-hero">
        <div><div className="mgn-eyebrow">Your writing</div><h1>Writing stats</h1><p>See how much you've written, how Marginal fits into your process, and how your writing habits are developing.</p></div>
        <div className="mgn-stats-hero-icon"><PenLine size={30}/></div>
      </div>

      <section className="mgn-big-stat-grid">
        <div className="mgn-big-stat coral"><PenLine/><strong>{stats.totalWords.toLocaleString()}</strong><span>words written</span></div>
        <div className="mgn-big-stat mint"><BookOpen/><strong>{stats.totalDrafts}</strong><span>drafts</span></div>
        <div className="mgn-big-stat lilac"><Lightbulb/><strong>{stats.totalAccepted.toLocaleString()}</strong><span>suggestions accepted</span></div>
        <div className="mgn-big-stat gold"><Flame/><strong>{stats.streak}</strong><span>day current streak</span></div>
        <div className="mgn-big-stat blue"><Target/><strong>{stats.acceptanceRate == null ? '—' : `${stats.acceptanceRate}%`}</strong><span>suggestion acceptance</span></div>
        <div className="mgn-big-stat rose"><CalendarDays/><strong>{Object.keys(stats.activity).length}</strong><span>active writing days</span></div>
      </section>

      <div className="mgn-stats-layout">
        <section className="mgn-card mgn-chart-card">
          <div className="mgn-card-head"><div><h3>Writing activity</h3><p className="mgn-card-sub">Words recorded by writing day.</p></div><div className="mgn-range"><button className={range==='7'?'active':''} onClick={()=>setRange('7')}>7 days</button><button className={range==='30'?'active':''} onClick={()=>setRange('30')}>30 days</button></div></div>
          <div className="mgn-bar-chart">{recent.map((d)=><div className="mgn-bar-col" key={d.date} title={`${d.label}: ${d.words.toLocaleString()} words`}><div className="mgn-bar" style={{height:`${Math.max(4,(d.words/maxWords)*100)}%`}}></div><span>{d.label.split(' ')[1]}</span></div>)}</div>
        </section>

        <section className="mgn-card mgn-goal-card">
          <div className="mgn-card-head"><div><h3>Weekly goal</h3><p className="mgn-card-sub">A gentle target, not a grade.</p></div><Target size={20}/></div>
          <div className="mgn-goal-number">{Math.min(weeklyWords, goal).toLocaleString()} <span>/ {goal.toLocaleString()}</span></div>
          <div className="mgn-progress"><div style={{width:`${goalProgress}%`}}/></div>
          <div className="mgn-goal-foot"><span>{goalProgress}% complete</span><input type="number" min="100" step="100" value={goal} onChange={e=>setGoal(Math.max(100,Number(e.target.value)||100))} onBlur={()=>onUpdate({...profile, statsGoal: goal})}/></div>
        </section>
      </div>

      <div className="mgn-stats-layout">
        <section className="mgn-card"><div className="mgn-card-head"><div><h3>Writing streak</h3><p className="mgn-card-sub">Your longest streak is {stats.longestStreak} day{stats.longestStreak===1?'':'s'}.</p></div><Flame size={20}/></div><div className="mgn-heatmap">{heatDays.map(d=><div key={d.key} className="mgn-heat" title={`${d.key}: ${d.words} words`} style={{opacity:d.words ? .25 + .75*(d.words/maxHeat) : .12}}/> )}</div><div className="mgn-heat-legend"><span>Less</span><i/><i/><i/><i/><span>More</span></div></section>
        <section className="mgn-card"><div className="mgn-card-head"><div><h3>Suggestions</h3><p className="mgn-card-sub">How you interact with Marginal's suggestions.</p></div><Lightbulb size={20}/></div><div className="mgn-suggestion-meter"><div className="mgn-meter-track"><div className="accepted" style={{width:`${stats.acceptanceRate||0}%`}}/></div><div className="mgn-meter-labels"><span>{stats.totalAccepted.toLocaleString()} accepted</span><span>{stats.totalRejected.toLocaleString()} skipped</span></div></div><div className="mgn-suggestion-big">{stats.acceptanceRate == null ? 'No suggestion data yet.' : `${stats.acceptanceRate}%`}<small> acceptance rate</small></div></section>
      </div>

      <section className="mgn-card"><div className="mgn-card-head"><div><h3>What you've been writing</h3><p className="mgn-card-sub">Words and drafts by paper type.</p></div><FileText size={20}/></div><div className="mgn-type-list">{Object.keys(PAPER_TYPE_LABELS).map(type=>{const v=stats.paperTypes[type]||{drafts:0,words:0}; const pct=stats.totalWords?Math.round(v.words/stats.totalWords*100):0; return <div className="mgn-type-row" key={type}><div className="mgn-type-name"><span>{PAPER_TYPE_LABELS[type]}</span><small>{v.drafts} draft{v.drafts===1?'':'s'} · {v.words.toLocaleString()} words</small></div><div className="mgn-type-track"><div style={{width:`${pct}%`}}/></div><strong>{pct}%</strong></div>})}</div></section>

      <div className="mgn-stats-layout">
        <section className="mgn-card"><div className="mgn-card-head"><div><h3>Personal records</h3><p className="mgn-card-sub">Your best moments so far.</p></div><Trophy size={20}/></div><div className="mgn-record-grid"><div><Trophy/><b>{stats.longestDraft?.words?.toLocaleString() || 0}</b><span>longest draft words</span></div><div><Flame/><b>{stats.longestStreak}</b><span>longest streak</span></div><div><TrendingUp/><b>{stats.mostProductiveDay?.words?.toLocaleString() || 0}</b><span>most words on one day</span></div><div><BookOpen/><b>{stats.mostActiveType ? PAPER_TYPE_LABELS[stats.mostActiveType.type] : '—'}</b><span>most active type</span></div><div><PenLine/><b>{stats.averageDraftWords.toLocaleString()}</b><span>average words per draft</span></div><div><FileText/><b>{stats.nonEmptyDrafts}</b><span>drafts with writing</span></div></div></section>
        <section className="mgn-card"><div className="mgn-card-head"><div><h3>Your voice</h3><p className="mgn-card-sub">A snapshot of the style Marginal has learned.</p></div><Brain size={20}/></div><div className="mgn-trait-list">{traitRows.map(([label,val])=><div className="mgn-trait-stat" key={label}><div><span>{label}</span><b>{Math.round(val)}%</b></div><div className="mgn-trait-track"><div style={{width:`${val}%`}}/></div></div>)}</div></section>
      </div>

      <section className="mgn-card mgn-insight-banner"><Brain size={22}/><div><h3>Keep an eye on your habits</h3><p>Stats are descriptive, not a judgment of writing quality. Use them to notice patterns, experiment, and find a writing rhythm that works for you.</p></div></section>
    </main>
  </div>;
}

function DeepAnalysisModal({ profile, token, onClose, onApply }) {
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const result = await callGemini(
        `You refine an existing writing-style profile using a new, longer document from the same author. Current profile JSON: ${JSON.stringify(profile.styleProfile)}. Return ONLY JSON with the SAME shape as the input (summary, traits, avgSentenceLength, commonPhrases, quirks, sampleOpeners), lightly updated to reflect anything new or reinforced by this longer sample. Also include a field "newInsights": an array of 1-3 short strings describing what this document revealed that wasn't obvious before.`,
        doc,
        token,
        { json: true }
      );
      const { newInsights, ...rest } = result;
      onApply({
        ...profile,
        styleProfile: rest,
        insights: [...(newInsights || []), ...profile.insights].slice(0, 10),
      });
    } catch {
      setError("Couldn't analyze that document — try again.");
    }
    setLoading(false);
  }

  return (
    <div className="mgn-modal-backdrop" onClick={onClose}>
      <div className="mgn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mgn-modal-head">
          <h3>Deep analysis</h3>
          <button className="mgn-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="mgn-muted">
          Paste a longer document — a full essay, a chapter, a report. Marginal
          will look for patterns a short sample can't show.
        </p>
        <textarea
          className="mgn-modal-textarea"
          placeholder="Paste your document here…"
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
        />
        {error && <div className="mgn-error">{error}</div>}
        <button className="mgn-btn-primary mgn-btn-lg" disabled={doc.trim().length < 200 || loading} onClick={run}>
          {loading ? <><Loader2 className="mgn-spin" size={18} /> Reading…</> : "Analyze document"}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   MANAGE SAMPLES — add more writing samples after onboarding
================================================================ */
function ManageSamplesModal({ profile, token, onClose, onApply }) {
  const [samples, setSamples] = useState([...profile.samples, ""]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const filled = samples.filter((s) => s.trim().length > 40);

  function update(i, val) {
    const next = [...samples];
    next[i] = val;
    setSamples(next);
  }

  function removeSample(i) {
    setSamples(samples.filter((_, idx) => idx !== i));
  }

  async function reanalyze() {
    setError(null);
    setAnalyzing(true);
    try {
      const joined = filled
        .map((s, i) => `--- SAMPLE ${i + 1} ---\n${s.trim()}`)
        .join("\n\n");
      const result = await callGemini(
        `You are a literary style analyst for Marginal, a writing app. Given writing samples from one person, produce a JSON style profile. Return ONLY valid JSON, no prose, no markdown fences, with this exact shape:
{
  "summary": "2-3 sentence description of this person's voice, written warmly and specifically",
  "traits": { "formality": 0-100, "sentenceVariety": 0-100, "vocabularyComplexity": 0-100, "warmth": 0-100, "directness": 0-100 },
  "avgSentenceLength": number,
  "commonPhrases": ["up to 6 short recurring words/phrases or tics"],
  "quirks": ["up to 5 short stylistic observations, e.g. 'opens paragraphs with a question'"],
  "sampleOpeners": ["up to 3 short phrases showing how they typically start a sentence"]
}`,
        joined,
        token,
        { json: true }
      );
      onApply({
        ...profile,
        samples: filled,
        styleProfile: result,
        weights: { ...profile.weights, ...result.traits },
      });
    } catch {
      setError("Couldn't re-analyze that batch — try trimming a sample or two and running it again.");
    }
    setAnalyzing(false);
  }

  return (
    <div className="mgn-modal-backdrop" onClick={onClose}>
      <div className="mgn-modal mgn-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="mgn-modal-head">
          <h3>Add more writing samples</h3>
          <button className="mgn-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="mgn-muted">
          Add anything new you've written since setting up Marginal. Re-analyzing
          updates your voice profile using everything below.
        </p>

        <div className="mgn-sample-grid">
          {samples.map((s, i) => (
            <div className="mgn-sample-box" key={i}>
              <div className="mgn-sample-label">
                Sample {i + 1}
                {s.trim().length > 40 && <Check size={14} color="var(--mgn-mint)" />}
                {samples.length > 1 && (
                  <button className="mgn-icon-btn mgn-sample-remove" onClick={() => removeSample(i)} title="Remove">
                    <X size={13} />
                  </button>
                )}
              </div>
              <textarea
                className="mgn-sample-textarea"
                placeholder="Paste writing here…"
                value={s}
                onChange={(e) => update(i, e.target.value)}
              />
            </div>
          ))}
          {samples.length < 15 && (
            <button className="mgn-add-sample" onClick={() => setSamples([...samples, ""])}>
              <Plus size={18} /> Add another
            </button>
          )}
        </div>

        {error && <div className="mgn-error">{error}</div>}

        <button
          className="mgn-btn-primary mgn-btn-lg"
          disabled={filled.length < 2 || analyzing}
          onClick={reanalyze}
        >
          {analyzing ? <><Loader2 className="mgn-spin" size={18} /> Re-reading your voice…</> : <>Re-analyze my style <Sparkles size={18} /></>}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   ADD VOICE — create a new named voice (e.g. "Work Slack", "Newsletter")
================================================================ */
function AddVoiceModal({ token, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [samples, setSamples] = useState(["", "", ""]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const filled = samples.filter((s) => s.trim().length > 40);

  function update(i, val) {
    const next = [...samples];
    next[i] = val;
    setSamples(next);
  }

  async function create() {
    if (!name.trim()) {
      setError("Give this voice a name first — e.g. 'Work Slack' or 'Newsletter'.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      const joined = filled
        .map((s, i) => `--- SAMPLE ${i + 1} ---\n${s.trim()}`)
        .join("\n\n");
      const result = await callGemini(
        `You are a literary style analyst for Marginal, a writing app. Given writing samples from one person, produce a JSON style profile. Return ONLY valid JSON, no prose, no markdown fences, with this exact shape:
{
  "summary": "2-3 sentence description of this person's voice, written warmly and specifically",
  "traits": { "formality": 0-100, "sentenceVariety": 0-100, "vocabularyComplexity": 0-100, "warmth": 0-100, "directness": 0-100 },
  "avgSentenceLength": number,
  "commonPhrases": ["up to 6 short recurring words/phrases or tics"],
  "quirks": ["up to 5 short stylistic observations, e.g. 'opens paragraphs with a question'"],
  "sampleOpeners": ["up to 3 short phrases showing how they typically start a sentence"]
}`,
        joined,
        token,
        { json: true }
      );
      onCreate({
        id: `voice-${Date.now()}`,
        name: name.trim(),
        styleProfile: result,
        weights: { ...result.traits },
        samples: filled,
      });
    } catch {
      setError("Couldn't analyze that batch — try trimming a sample or two and running it again.");
    }
    setAnalyzing(false);
  }

  return (
    <div className="mgn-modal-backdrop" onClick={onClose}>
      <div className="mgn-modal mgn-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="mgn-modal-head">
          <h3>New voice</h3>
          <button className="mgn-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="mgn-muted">
          Give it a name for a context you write in differently — "Work Slack",
          "Newsletter", "Grad school apps" — then paste a few samples of that voice.
        </p>

        <input
          className="mgn-input"
          placeholder="Voice name (e.g. Work Slack)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        <div className="mgn-sample-grid">
          {samples.map((s, i) => (
            <div className="mgn-sample-box" key={i}>
              <div className="mgn-sample-label">
                Sample {i + 1}
                {s.trim().length > 40 && <Check size={14} color="var(--mgn-mint)" />}
              </div>
              <textarea
                className="mgn-sample-textarea"
                placeholder="Paste writing here…"
                value={s}
                onChange={(e) => update(i, e.target.value)}
              />
            </div>
          ))}
          {samples.length < 10 && (
            <button className="mgn-add-sample" onClick={() => setSamples([...samples, ""])}>
              <Plus size={18} /> Add another
            </button>
          )}
        </div>

        {error && <div className="mgn-error">{error}</div>}

        <button
          className="mgn-btn-primary mgn-btn-lg"
          disabled={filled.length < 2 || analyzing}
          onClick={create}
        >
          {analyzing ? <><Loader2 className="mgn-spin" size={18} /> Reading this voice…</> : <>Create voice <Sparkles size={18} /></>}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   SHARE CARD — a downloadable summary of your writing voice
================================================================ */
function ShareCardModal({ userName, profile, onClose }) {
  const voices = allVoices(profile);
  const [voiceId, setVoiceId] = useState("default");
  const voice = getVoice(profile, voiceId) || voices[0];
  const svgRef = useRef(null);

  const topTraits = Object.entries(voice.weights || {})
    .map(([k, v]) => ({ key: k, value: v, label: v >= 50 ? TRAIT_LABELS[k][1] : TRAIT_LABELS[k][0] }))
    .sort((a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50))
    .slice(0, 3);

  function buildSvg() {
    const w = 600, h = 760;
    const summary = wrapText(voice.styleProfile?.summary || "", 40).slice(0, 5);
    const quirks = (voice.styleProfile?.quirks || []).slice(0, 3);
    const barsY = 300 + summary.length * 26;

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" rx="24" fill="#1B1D2A"/>
  <text x="48" y="70" font-family="Georgia, serif" font-size="26" fill="#FF4D6D" font-weight="600">Marginal</text>
  <text x="48" y="140" font-family="Georgia, serif" font-size="34" fill="#FCFBF8" font-weight="600">${escapeXml(userName || "Someone")}'s voice</text>
  <text x="48" y="172" font-family="Arial, sans-serif" font-size="15" fill="#7C6FF0">${escapeXml(voice.name)}</text>
  ${summary.map((line, i) => `<text x="48" y="${220 + i * 26}" font-family="Georgia, serif" font-size="19" fill="#F3F1EA">${escapeXml(line)}</text>`).join("\n  ")}
  ${topTraits.map((t, i) => `
  <text x="48" y="${barsY + i * 46}" font-family="Arial, sans-serif" font-size="13" fill="#5A5C6B">${escapeXml(t.label)}</text>
  <rect x="48" y="${barsY + i * 46 + 10}" width="504" height="8" rx="4" fill="#3A3C4A"/>
  <rect x="48" y="${barsY + i * 46 + 10}" width="${5.04 * t.value}" height="8" rx="4" fill="#17B890"/>`).join("\n  ")}
  ${quirks.length ? `<text x="48" y="${barsY + topTraits.length * 46 + 30}" font-family="Arial, sans-serif" font-size="13" fill="#5A5C6B">${escapeXml(quirks.join("  ·  "))}</text>` : ""}
  <text x="48" y="${h - 36}" font-family="Arial, sans-serif" font-size="12" fill="#5A5C6B">made with marginal</text>
</svg>`.trim();
  }

  function wrapText(text, maxChars) {
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > maxChars) {
        lines.push(cur.trim());
        cur = w;
      } else {
        cur += " " + w;
      }
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines;
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  }

  const svgString = buildSvg();
  const svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

  function downloadSvg() {
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marginal-voice-card.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPng() {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "marginal-voice-card.png";
        a.click();
        URL.revokeObjectURL(url);
      });
    };
    img.src = svgDataUrl;
  }

  return (
    <div className="mgn-modal-backdrop" onClick={onClose}>
      <div className="mgn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mgn-modal-head">
          <h3>Share your voice</h3>
          <button className="mgn-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {voices.length > 1 && (
          <div className="mgn-tone-toggle mgn-mode-toggle" style={{ marginBottom: 16 }}>
            {voices.map((v) => (
              <button
                key={v.id}
                className={"mgn-tone-pill" + (voiceId === v.id ? " mgn-tone-pill-active" : "")}
                onClick={() => setVoiceId(v.id)}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="mgn-share-preview" ref={svgRef} dangerouslySetInnerHTML={{ __html: svgString }} />

        <div className="mgn-share-actions">
          <button className="mgn-btn-ghost" onClick={downloadSvg}><Download size={16} /> Download SVG</button>
          <button className="mgn-btn-primary" onClick={downloadPng}><Download size={16} /> Download PNG</button>
        </div>
      </div>
    </div>
  );
}

const PAPER_GUIDES = {
  "ap-lang": {
    label: "AP Language",
    subtitle: "Build the essay while tracking the 6-point rubric.",
    steps: [
      ["1. Understand the prompt", "Identify the rhetorical situation, task, and what you must argue or analyze."],
      ["2. Set up the introduction", "Give only the context the reader needs. Establish the situation or issue, then move toward the central argument."],
      ["3. Write the thesis", "End the introduction with a defensible claim that directly responds to the prompt. For argument/synthesis, take a clear position; for rhetorical analysis, identify what the writer does and why it matters."],
      ["4. Build a line of reasoning", "Each body paragraph should make a supporting claim that advances the thesis. Claims should work together rather than become a list."],
      ["5. Use specific evidence", "Choose concrete details, examples, source material, or rhetorical choices. Evidence should prove the paragraph's claim."],
      ["6. Add commentary", "Explain how and why the evidence supports the claim and advances the argument. Do not stop at summary."],
      ["7. Develop sophistication", "Show genuine complexity through qualification, tension, limitations, connections, or broader implications. Do not force fancy wording."],
      ["8. Conclude with purpose", "Do more than repeat the thesis. Clarify the larger implication or significance when the essay naturally calls for it."]
    ],
    scoring: [
      ["Thesis", "1 point", "A defensible thesis responds directly to the prompt and establishes what you are arguing."],
      ["Evidence & Commentary", "0–4 points", "A 4 requires specific evidence supporting the claims in a line of reasoning and consistent commentary explaining how the evidence supports that reasoning. For rhetorical analysis, explain how multiple rhetorical choices contribute to the writer's argument, purpose, or message."],
      ["Sophistication", "1 point", "Show a genuinely complex understanding through qualification, tension, implications, or consistently nuanced reasoning—not vocabulary alone."]
    ],
    note: "AP Lang free-response rubric: 1 Thesis + 4 Evidence & Commentary + 1 Sophistication = 6 points."
  },
  "ap-lang-argument": { label: "AP Lang — Argument", subtitle: "Build a defensible position with evidence, reasoning, and purposeful complexity.", steps: [["1. Frame the issue","Establish the situation and the tension the prompt asks you to address."],["2. Write a defensible thesis","Take a clear position that directly answers the prompt."],["3. Build a line of reasoning","Each body paragraph should advance a distinct subclaim."],["4. Use specific evidence","Use concrete examples, facts, or experiences that prove the claim."],["5. Explain the evidence","Show why the evidence proves the point instead of merely summarizing it."],["6. Address complexity","Qualify, complicate, or acknowledge limits when it genuinely strengthens the argument."],["7. Conclude","Synthesize the argument and explain why the issue matters."]], scoring: [["Thesis","1 point","A defensible position directly responds to the prompt."],["Evidence & Commentary","0–4 points","Specific evidence and consistent commentary build a line of reasoning."],["Sophistication","1 point","The response demonstrates a genuinely complex understanding."]], note: "Use the official assignment prompt and rubric as the final authority." },
  "ap-lang-rhetorical": { label: "AP Lang — Rhetorical Analysis", subtitle: "Explain what the writer does, how those choices work, and why they matter.", steps: [["1. Identify the rhetorical situation","Consider speaker, audience, purpose, context, and constraints."],["2. Write the thesis","Name the rhetorical choices and explain how they advance the writer's purpose."],["3. Make analytical claims","Each paragraph should focus on a meaningful rhetorical choice."],["4. Introduce evidence","Quote or describe precise moments from the text."],["5. Analyze the choice","Explain how diction, syntax, imagery, structure, appeals, or tone affect the audience."],["6. Connect to purpose","Show how the choice contributes to the writer's argument or message."],["7. Conclude","Synthesize what the rhetorical choices reveal about the writer's strategy."]], scoring: [["Thesis","1 point","Identifies rhetorical choices and their relationship to purpose."],["Evidence & Commentary","0–4 points","Uses specific evidence and explains how choices advance the argument or purpose."],["Sophistication","1 point","Demonstrates a complex understanding of the rhetorical situation."]], note: "Focus on how and why choices work, not just naming devices." },
  "ap-lang-synthesis": { label: "AP Lang — Synthesis", subtitle: "Use multiple sources to develop one coherent, defensible argument.", steps: [["1. Frame the conversation","Explain the issue and why the sources are in conversation."],["2. Write the thesis","Take a defensible position that answers the prompt."],["3. Build source-based claims","Organize body paragraphs around your reasoning, not around individual sources."],["4. Integrate sources","Introduce sources and select evidence that directly supports the claim."],["5. Synthesize","Put sources into conversation by comparing, connecting, or qualifying them."],["6. Add your reasoning","Your commentary should explain what the sources mean for your argument."],["7. Conclude","Return to the central argument and its broader significance."]], scoring: [["Thesis","1 point","Makes a defensible claim in response to the prompt."],["Evidence & Commentary","0–4 points","Uses source evidence and commentary to develop a line of reasoning."],["Sophistication","1 point","Demonstrates a nuanced understanding of the issue and source conversation."]], note: "Use the source set and prompt requirements provided with your assignment." },
  "research": {
    label: "Research Paper",
    subtitle: "Move from a research question to a defensible, sourced argument.",
    steps: [
      ["1. Define the research question", "Make the question focused enough to investigate and open enough to require evidence."],
      ["2. Establish context", "Explain the background the reader needs and define important terms."],
      ["3. State the thesis", "Answer the research question with a specific, arguable claim and preview the reasoning."],
      ["4. Organize claims", "Build sections around distinct subclaims. Each section should contribute to the thesis."],
      ["5. Integrate sources", "Introduce sources, use relevant evidence, and explain what each source contributes."],
      ["6. Synthesize", "Put sources into conversation by comparing findings, agreements, disagreements, methods, or implications."],
      ["7. Address limitations", "Acknowledge gaps, uncertainty, counterevidence, or limitations when they affect the conclusion."],
      ["8. Conclude", "Answer the research question at a higher level and explain what the evidence means or what should happen next."]
    ],
    scoring: [
      ["Research Question", "Core", "Focused, researchable, and meaningful."],
      ["Argument", "Core", "Specific thesis, logical claims, and a consistent line of reasoning."],
      ["Evidence & Sources", "Core", "Credible, relevant evidence that is accurately integrated and analyzed."],
      ["Synthesis", "Core", "Sources are connected to produce a conclusion rather than summarized one at a time."]
    ],
    note: "Research rubrics vary by assignment, so this guide focuses on transferable research-writing practices."
  },
  "ap-seminar": {
    label: "AP Seminar",
    subtitle: "Build an evidence-based argument that accounts for perspectives and complexity.",
    steps: [
      ["1. Frame the issue", "Define the problem and explain why it matters. Establish the needed context."],
      ["2. Establish the research question", "Ask a focused question that can be investigated through multiple perspectives and credible evidence."],
      ["3. Present your thesis", "Answer the question with a defensible claim that previews the direction of your reasoning."],
      ["4. Develop claims", "Use multiple claims that logically build toward the thesis and make their relationships visible."],
      ["5. Evaluate and use evidence", "Select credible, relevant evidence and explain why it supports the claim. Consider source limitations."],
      ["6. Engage perspectives", "Compare perspectives fairly, explain conflicts or overlaps, and show what each reveals."],
      ["7. Address counterarguments", "Anticipate reasonable objections or competing interpretations and respond with evidence and reasoning."],
      ["8. Explain implications", "Show what your conclusion means, what it changes, and what questions remain."]
    ],
    scoring: [
      ["Argument", "Key", "A clear thesis and claims connected by logical reasoning."],
      ["Evidence", "Key", "Credible, relevant evidence is selected, evaluated, and connected to claims."],
      ["Perspectives", "Key", "Multiple perspectives are understood and used to deepen the argument."],
      ["Implications", "Key", "The conclusion addresses significance, consequences, or unresolved complexity."]
    ],
    note: "AP Seminar scoring depends on the specific task and performance component. Match this workflow to your assignment rubric."
  },
  "literary": {
    label: "Literary Analysis",
    subtitle: "Make an interpretation, prove it with the text, and analyze how the writing creates meaning.",
    steps: [
      ["1. Identify the question", "Determine what you need to interpret: character, theme, imagery, structure, symbolism, narration, conflict, or another choice."],
      ["2. Build an interpretation", "Decide what the text means and why. Make the interpretation specific enough to prove."],
      ["3. Write the thesis", "Make an arguable interpretation and indicate the major textual features that support it."],
      ["4. Make analytical claims", "Each paragraph should explain how the text creates meaning, not merely what happens."],
      ["5. Use textual evidence", "Select short, precise passages or details and introduce them with enough context."],
      ["6. Analyze the evidence", "Zoom in on diction, imagery, syntax, symbolism, structure, characterization, or other choices."],
      ["7. Connect back to the whole", "Show how individual details contribute to the larger theme, character arc, conflict, or interpretation."],
      ["8. Conclude", "Return to the interpretation at a deeper level and explain what the analysis reveals about the text."]
    ],
    scoring: [
      ["Interpretation", "Core", "A defensible, specific interpretation of the text."],
      ["Evidence", "Core", "Precise textual evidence that directly supports the interpretation."],
      ["Analysis", "Core", "Explains how the author's choices create meaning rather than summarizing events."],
      ["Organization", "Core", "Paragraphs build logically toward the central interpretation."]
    ],
    note: "Literary-analysis grading varies by assignment. Strong papers consistently explain how textual choices create meaning."
  },
  "academic": {
    label: "General Academic",
    subtitle: "A flexible structure for essays when no specific course rubric applies.",
    steps: [
      ["1. Understand the task", "Identify the question, audience, purpose, and required evidence."],
      ["2. Plan the argument", "Choose a central answer and the main reasons that will support it."],
      ["3. Write the introduction", "Give relevant context, narrow toward the topic, and end with a clear thesis."],
      ["4. Develop body paragraphs", "Use a claim → evidence → explanation pattern and make each paragraph advance the thesis."],
      ["5. Address complexity", "Consider exceptions, counterarguments, limitations, or implications when they strengthen the argument."],
      ["6. Conclude", "Synthesize the argument and explain its significance instead of simply repeating the introduction."]
    ],
    scoring: [
      ["Thesis", "Core", "Answers the task with a specific, arguable claim."],
      ["Evidence", "Core", "Uses relevant, specific support."],
      ["Reasoning", "Core", "Explains how evidence supports the claims."],
      ["Organization", "Core", "Creates a clear progression of ideas."]
    ],
    note: "Use your teacher's assignment rubric whenever one is provided; this is a general-purpose framework."
  }
};

function WritingGuide({ paperType, onChange }) {
  const [open, setOpen] = useState(true);
  const guide = PAPER_GUIDES[paperType] || PAPER_GUIDES.academic;
  return <aside className={"mgn-writing-guide" + (open ? "" : " mgn-writing-guide-collapsed")}>
    <div className="mgn-guide-header">
      {open && <div><div className="mgn-guide-kicker">Writing guide</div><div className="mgn-guide-title">{guide.label}</div></div>}
      <button className="mgn-guide-toggle" onClick={() => setOpen(v => !v)}>{open ? "Hide" : "Guide"}</button>
    </div>
    {open && <div className="mgn-guide-content">
      <select className="mgn-paper-select" value={paperType} onChange={e => onChange(e.target.value)}>
        {Object.entries(PAPER_GUIDES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
      </select>
      <p className="mgn-guide-subtitle">{guide.subtitle}</p>
      <div className="mgn-guide-section-title">Essay structure</div>
      <div className="mgn-guide-steps">{guide.steps.map(([title, body]) => <div className="mgn-guide-step" key={title}><div className="mgn-guide-step-title">{title}</div><div className="mgn-guide-step-body">{body}</div></div>)}</div>
      <div className="mgn-guide-section-title">How to earn marks</div>
      <div className="mgn-guide-score-list">{guide.scoring.map(([title, points, body]) => <div className="mgn-guide-score" key={title}><div className="mgn-guide-score-top"><strong>{title}</strong><span>{points}</span></div><div className="mgn-guide-step-body">{body}</div></div>)}</div>
      <div className="mgn-guide-note">{guide.note}</div>
    </div>}
  </aside>;
}

/* ================================================================
   EDITOR — the ghost-text autocomplete surface
================================================================ */
function Editor({ profile, token, draftId, onUpdate, onBack, showToast }) {
  const draft = profile.drafts.find((d) => d.id === draftId);
  const [title, setTitle] = useState(draft.title);
  const [text, setText] = useState(draft.content);
  const [tone, setTone] = useState(draft.tone || "auto");
  const [paperType, setPaperType] = useState(draft.paperType || "ap-lang");
  const [voiceId, setVoiceId] = useState(draft.voiceId || "default");
  const [suggestions, setSuggestions] = useState([]);
  const [ghostIdx, setGhostIdx] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [startingLine, setStartingLine] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [versionA, setVersionA] = useState(null);
  const [versionB, setVersionB] = useState(null);
  const [suggestionWhy, setSuggestionWhy] = useState("");
  const [whyLoading, setWhyLoading] = useState(false);

  const activeVoice = getVoice(profile, voiceId);
  const voices = allVoices(profile);

  const textareaRef = useRef(null);
  const overlayRef = useRef(null);
  const debounceRef = useRef(null);
  const sessionAccepted = useRef([]);
  const sessionRejected = useRef([]);
  const saveTimer = useRef(null);

  const ghost = suggestions[ghostIdx] || "";

  const fetchSuggestions = useCallback(
    (currentText) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (!currentText.trim()) return;
        setFetching(true);
        try {
          const weightLines = Object.entries(activeVoice.weights)
            .map(([k, v]) => `${k}: ${v}/100 (${v < 40 ? TRAIT_LABELS[k][0] : v > 60 ? TRAIT_LABELS[k][1] : "balanced"})`)
            .join("\n");
          const toneLine =
            tone === "professional"
              ? "Write this continuation in their PROFESSIONAL voice — more polished, fewer contractions."
              : tone === "casual"
              ? "Write this continuation in their CASUAL voice — relaxed, contractions fine."
              : "Write this continuation in their natural, default voice.";
          const recentRejects = [...profile.rejected, ...sessionRejected.current].slice(-8);
          const result = await callGemini(
            `You are Marginal's autocomplete engine. You continue a person's writing in their own established voice, a few words at a time — never a full paragraph. Given their style profile, trait weights, tone instruction, and the text so far, return ONLY JSON: {"suggestions": ["...", "...", "..."]} with exactly 3 short alternative continuations (2 to 12 words each). Each must pick up exactly where the text left off — include a leading space if it starts a new word, and don't repeat words already at the end of the text. Vary the 3 options in direction, not just wording. Avoid phrasing similar to these previously rejected continuations: ${JSON.stringify(recentRejects)}.

PAPER TYPE: ${PAPER_GUIDES[paperType]?.label || "General Academic"}
WRITING GUIDE: ${PAPER_GUIDES[paperType]?.subtitle || ""}
STYLE PROFILE: ${JSON.stringify(activeVoice.styleProfile)}
TRAIT DIALS:
${weightLines}
PAPER TYPE: ${PAPER_GUIDES[paperType]?.label || "General Academic"}
WRITING GUIDE: ${PAPER_GUIDES[paperType]?.subtitle || ""}
TONE: ${toneLine}`,
            `TEXT SO FAR (continue from the very end of this):\n${currentText.slice(-800)}`,
            token,
            { json: true }
          );
          setSuggestions(result.suggestions || []);
          setGhostIdx(0);
        } catch {
          /* silent fail, no ghost shown */
        }
        setFetching(false);
      }, 550);
    },
    [activeVoice.weights, activeVoice.styleProfile, profile.rejected, tone, paperType, token]
  );

  function atEnd() {
    const ta = textareaRef.current;
    return ta && ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length;
  }

  function handleChange(e) {
    const val = e.target.value;
    setText(val);
    setSuggestions([]);
    if (atEnd()) fetchSuggestions(val);
    scheduleSave(val);
  }

  function scheduleSave(val) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistDraft(val), 1200);
  }

  async function persistDraft(val) {
    const now = Date.now();
    const drafts = profile.drafts.map((d) => {
      if (d.id !== draftId) return d;
      const versions = [...(d.versions || [])];
      const latest = versions[versions.length - 1];
      if (val !== d.content && (!latest || latest.content !== val)) {
        versions.push({
          id: `${now}-${versions.length}`,
          content: val,
          title,
          wordCount: countWords(val),
          savedAt: now,
        });
      }
      return {
        ...d,
        content: val,
        title,
        tone,
        paperType,
        voiceId,
        updatedAt: now,
        accepted: [...(d.accepted || []), ...sessionAccepted.current],
        rejected: [...(d.rejected || []), ...sessionRejected.current],
        versions: versions.slice(-30),
      };
    });
    await onUpdate({
      ...profile,
      drafts,
      accepted: [...profile.accepted, ...sessionAccepted.current].slice(-100),
      rejected: [...profile.rejected, ...sessionRejected.current].slice(-100),
    });
    sessionAccepted.current = [];
    sessionRejected.current = [];
  }

  function acceptGhost() {
    if (!ghost) return;
    const next = text + ghost;
    sessionAccepted.current.push(ghost.trim());
    setText(next);
    setSuggestions([]);
    scheduleSave(next);
    fetchSuggestions(next);
  }

  function rejectGhost() {
    if (ghost) sessionRejected.current.push(ghost.trim());
    setSuggestions([]);
  }

  async function explainSuggestion() {
    if (!ghost || whyLoading) return;
    setWhyLoading(true);
    setSuggestionWhy("");
    try {
      const explanation = await callGemini(
        `You explain Marginal autocomplete suggestions. In 1-2 concise sentences, explain why the suggested continuation fits this writer's established style. Base the explanation on the provided style profile, trait dials, and immediate context. Do not claim certainty or invent personal facts. Do not evaluate the writing as good or bad. Return only the explanation.

STYLE PROFILE: ${JSON.stringify(activeVoice.styleProfile)}
TRAIT DIALS: ${JSON.stringify(activeVoice.weights)}`,
        `TEXT SO FAR: ${text.slice(-500)}\nSUGGESTED CONTINUATION: ${ghost}`,
        token
      );
      setSuggestionWhy(explanation.trim());
    } catch {
      setSuggestionWhy("Marginal couldn't explain this suggestion right now.");
    }
    setWhyLoading(false);
  }

  function cycle(dir) {
    if (suggestions.length === 0) return;
    setGhostIdx((i) => (i + dir + suggestions.length) % suggestions.length);
  }

  function changeVoice(id) {
    setVoiceId(id);
    setSuggestions([]);
    const drafts = profile.drafts.map((d) => (d.id === draftId ? { ...d, voiceId: id, updatedAt: Date.now() } : d));
    onUpdate({ ...profile, drafts });
  }

  async function suggestOpening() {
    if (!title.trim() && !text.trim()) {
      showToast("Add a title or a topic sentence first, so Marginal has something to go on.");
      return;
    }
    setStartingLine(true);
    try {
      const weightLines = Object.entries(activeVoice.weights)
        .map(([k, v]) => `${k}: ${v}/100 (${v < 40 ? TRAIT_LABELS[k][0] : v > 60 ? TRAIT_LABELS[k][1] : "balanced"})`)
        .join("\n");
      const result = await callGemini(
        `You are Marginal's opening-line assistant. Given a title and/or a topic sentence the person has already written, and their style profile, propose ways to START or CONTINUE their piece in their own voice. If TEXT SO FAR is empty, propose full opening sentences. If TEXT SO FAR is not empty, propose short continuations that pick up exactly where it ends (include a leading space, don't repeat trailing words). Return ONLY JSON: {"suggestions": ["...", "...", "..."]} with exactly 3 varied options.

STYLE PROFILE: ${JSON.stringify(activeVoice.styleProfile)}
TRAIT DIALS:
${weightLines}`,
        `TITLE: ${title || "(untitled)"}\nTEXT SO FAR: ${text.slice(-800)}`,
        token,
        { json: true }
      );
      setSuggestions(result.suggestions || []);
      setGhostIdx(0);
    } catch {
      showToast("Couldn't come up with an opening just now — try again in a moment.");
    }
    setStartingLine(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      acceptGhost();
      return;
    }
    if (e.ctrlKey && e.key === "ArrowRight") {
      e.preventDefault();
      cycle(1);
      return;
    }
    if (e.ctrlKey && e.key === "ArrowLeft") {
      e.preventDefault();
      cycle(-1);
      return;
    }
    if (e.key === "Escape") {
      rejectGhost();
      return;
    }
    // any normal printable key while a ghost is showing: treat as a soft reject
    if (ghost && e.key.length === 1) {
      const expected = ghost.trimStart()[0];
      if (e.key !== expected) rejectGhost();
    }
  }

  function handleScroll(e) {
    if (overlayRef.current) overlayRef.current.scrollTop = e.target.scrollTop;
  }

  function exportDraft() {
    const lines = [
      `# ${title || "Untitled"}`,
      `_Exported from Marginal on ${new Date().toLocaleString()}_`,
      "",
      text,
      "",
      "---",
      "## Suggestion history",
      `Accepted: ${(draft.accepted || []).length + sessionAccepted.current.length}`,
      `Passed on: ${(draft.rejected || []).length + sessionRejected.current.length}`,
      "",
      "Accepted phrases:",
      ...[...(draft.accepted || []), ...sessionAccepted.current].map((a) => `- "${a}"`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "untitled").replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Draft exported.");
  }

  async function goBack() {
    await persistDraft(text);
    onBack();
  }

  return (
    <div className="mgn-editor">
      <div className="mgn-editor-top">
        <button className="mgn-btn-ghost" onClick={goBack}>← Dashboard</button>
        <input
          className="mgn-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
        />
        <select
          className="mgn-paper-select-top"
          value={paperType}
          onChange={(e) => {
            const next = e.target.value;
            setPaperType(next);
            setSuggestions([]);
            const drafts = profile.drafts.map((d) => (d.id === draftId ? { ...d, paperType: next, updatedAt: Date.now() } : d));
            onUpdate({ ...profile, drafts });
          }}
          title="Choose the writing format"
        >
          {Object.entries(PAPER_GUIDES).map(([id, item]) => <option key={id} value={item.label === "AP Language" ? id : id}>{item.label}</option>)}
        </select>
        {voices.length > 1 && (
          <select
            className="mgn-voice-select"
            value={voiceId}
            onChange={(e) => changeVoice(e.target.value)}
            title="Choose which voice to write in"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        )}
        <div className="mgn-tone-toggle">
          {TONE_OPTIONS.map((t) => (
            <button
              key={t.id}
              className={"mgn-tone-pill" + (tone === t.id ? " mgn-tone-pill-active" : "")}
              onClick={() => setTone(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="mgn-btn-ghost" onClick={suggestOpening} disabled={startingLine}>
          {startingLine ? <Loader2 className="mgn-spin" size={16} /> : <Sparkles size={16} />}
          {text.trim() ? "AI: continue from here" : "AI: start my sentence"}
        </button>
        <button className="mgn-btn-ghost" onClick={() => setShowCoach(true)}><MessageCircle size={16}/> Coach</button>
        <button className="mgn-btn-ghost" onClick={() => setShowHealth(true)}><HeartPulse size={16}/> Essay health</button>
        <button className="mgn-btn-ghost" onClick={() => setShowVersions(true)}>
          <History size={16} /> Versions
        </button>
        <button className="mgn-btn-ghost" onClick={exportDraft}>
          <Download size={16} /> Export
        </button>
      </div>

      <div className="mgn-editor-body">
        <div className="mgn-editor-main">
        <div className="mgn-write-area">
          <div className="mgn-overlay" ref={overlayRef}>
            <span className="mgn-typed">{text}</span>
            {ghost && <span className="mgn-ghost">{ghost}</span>}
          </div>
          <textarea
            ref={textareaRef}
            className="mgn-textarea"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            onClick={() => setSuggestions([])}
            placeholder="Start writing. Marginal will pick up your rhythm as you go…"
            spellCheck="false"
          />
        </div>

        <div className="mgn-editor-hint">
          <span><kbd>Tab</kbd> keep suggestion</span>
          <span><kbd>Ctrl</kbd>+<kbd>→</kbd> next alternative</span>
          <span><kbd>Esc</kbd> dismiss</span>
          {fetching && <span className="mgn-thinking"><Loader2 className="mgn-spin" size={13} /> thinking in your voice…</span>}
          {!fetching && suggestions.length > 1 && (
            <span className="mgn-alt-count">{ghostIdx + 1} / {suggestions.length} alternatives</span>
          )}
          {ghost && <button className="mgn-why-btn" onClick={explainSuggestion} disabled={whyLoading}><HelpCircle size={13}/> {whyLoading ? "Explaining…" : "Why this?"}</button>}
        </div>
        {suggestionWhy && (
          <div className="mgn-suggestion-why"><HelpCircle size={16}/><div><strong>Why Marginal suggested this</strong><p>{suggestionWhy}</p></div><button className="mgn-icon-btn" onClick={() => setSuggestionWhy("")}><X size={14}/></button></div>
        )}
        </div>
        <WritingGuide
          paperType={paperType}
          onChange={(next) => {
            setPaperType(next);
            setSuggestions([]);
            const drafts = profile.drafts.map((d) => (d.id === draftId ? { ...d, paperType: next, updatedAt: Date.now() } : d));
            onUpdate({ ...profile, drafts });
          }}
        />
      </div>
      {showVersions && <VersionModal draft={draft} currentText={text} onClose={() => setShowVersions(false)} />}
      {showCoach && <WritingCoachModal profile={profile} token={token} text={text} paperType={paperType} onClose={() => setShowCoach(false)} />}
      {showHealth && <EssayHealthModal text={text} paperType={paperType} onClose={() => setShowHealth(false)} />}
    </div>
  );
}

/* ================================================================
   MARGINAL LIBRARY
================================================================ */
function LibraryPage({ userName, profile, onLogout, onHome, onDashboard, onStats, onOutline, onProfile, onSettings, onResearch, onOpenDraft, onNewDraft, onDeleteDraft, onRewrite }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const drafts = (profile.drafts || []).filter(d => {
    const q = query.trim().toLowerCase();
    const matches = !q || `${d.title || ""} ${d.content || ""}`.toLowerCase().includes(q);
    return matches && (filter === "all" || (d.paperType || "general") === filter);
  });
  const sorted = [...drafts].sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const totalWords = sorted.reduce((n,d)=>n+countWords(d.content),0);
  return <div className="mgn-library-page">
    <TopBar userName={userName} avatar={profile.avatar} onLogout={onLogout} onHome={onHome} onStats={onStats} onLibrary={()=>{}} onOutline={onOutline} onProfile={onProfile} onRewrite={onRewrite}/>
    <main className="mgn-library-main">
      <div className="mgn-page-hero"><div><div className="mgn-eyebrow">Your writing archive</div><h1>Marginal Library</h1><p>Everything you've written in one place. Search, organize, revisit, and keep building your voice.</p></div><button className="mgn-btn-primary" onClick={onNewDraft}><Plus size={17}/> New draft</button></div>
      <div className="mgn-library-toolbar"><div className="mgn-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search drafts…"/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All writing</option>{Object.entries(PAPER_GUIDES).map(([id,g])=><option key={id} value={id}>{g.label}</option>)}</select><span className="mgn-library-count">{sorted.length} drafts · {totalWords.toLocaleString()} words</span></div>
      {sorted.length === 0 ? <div className="mgn-card mgn-empty-state"><Library size={34}/><h3>{query ? "Nothing matched" : "Your library is empty"}</h3><p>{query ? "Try a different search." : "Start a draft and it will appear here."}</p></div> : <div className="mgn-library-grid">{sorted.map(d=><article className="mgn-library-card" key={d.id}>
        <button className="mgn-library-open" onClick={()=>onOpenDraft(d.id)}><div className="mgn-library-card-top"><span className="mgn-library-type">{PAPER_GUIDES[d.paperType || "general"]?.label || "General Academic"}</span><span>{countWords(d.content).toLocaleString()} words</span></div><h3>{d.title || "Untitled"}</h3><p>{d.content?.trim() || "Empty draft — start writing."}</p><div className="mgn-library-meta">Updated {d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : "—"} · {getVoice(profile,d.voiceId || "default").name}</div></button>
        <div className="mgn-library-actions"><button onClick={()=>onOpenDraft(d.id)}><Eye size={14}/> Open</button><button onClick={()=>navigator.clipboard?.writeText(d.content || "")}><Copy size={14}/> Copy</button><button className="danger" onClick={()=>onDeleteDraft(d.id)}><Trash2 size={14}/> Delete</button></div>
      </article>)}</div>}
    </main>
  </div>;
}

/* ================================================================
   OUTLINE BUILDER
================================================================ */
const DEFAULT_OUTLINE = {
  title:"Untitled outline",
  paperType:"ap-lang",
  thesis:"",
  introduction:{context:"",issue:"",claim:""},
  bodyParagraphs:[
    {title:"Body Paragraph 1",topicSentence:"",contextEvidence:"",analysis:"",transition:""},
    {title:"Body Paragraph 2",topicSentence:"",contextEvidence:"",analysis:"",transition:""},
    {title:"Body Paragraph 3",topicSentence:"",contextEvidence:"",analysis:"",transition:""}
  ],
  conclusion:{restatedIdea:"",summary:"",finalThought:""}
};

function normalizeOutline(raw){
  if(!raw) return DEFAULT_OUTLINE;
  if(raw.bodyParagraphs || raw.introduction || raw.conclusion) return { ...DEFAULT_OUTLINE, ...raw, introduction:{...DEFAULT_OUTLINE.introduction,...(raw.introduction||{})}, conclusion:{...DEFAULT_OUTLINE.conclusion,...(raw.conclusion||{})}, bodyParagraphs:(raw.bodyParagraphs?.length ? raw.bodyParagraphs : DEFAULT_OUTLINE.bodyParagraphs).map((p,i)=>({...DEFAULT_OUTLINE.bodyParagraphs[Math.min(i,2)],...p})) };
  const oldSections = raw.sections || [];
  const intro = oldSections.find(s=>/intro/i.test(s.title||""));
  const conclusion = oldSections.find(s=>/concl/i.test(s.title||""));
  const bodies = oldSections.filter(s=>s!==intro && s!==conclusion);
  return { ...DEFAULT_OUTLINE, title:raw.title||DEFAULT_OUTLINE.title, paperType:raw.paperType||DEFAULT_OUTLINE.paperType, thesis:raw.thesis||"", introduction:{context:intro?.purpose||"",issue:intro?.bullets?.[0]||"",claim:raw.thesis||""}, bodyParagraphs:(bodies.length?bodies:DEFAULT_OUTLINE.bodyParagraphs).map((s,i)=>({title:s.title||`Body Paragraph ${i+1}`,topicSentence:s.purpose||"",contextEvidence:s.bullets?.[0]||"",analysis:s.bullets?.[1]||"",transition:s.bullets?.[2]||""})), conclusion:{restatedIdea:conclusion?.purpose||"",summary:conclusion?.bullets?.[0]||"",finalThought:conclusion?.bullets?.[1]||""} };
}
function OutlineField({label,help,value,onChange,large=false}) {
  return <label className={`mgn-outline-detail-field ${large?"large":""}`}>
    <span className="mgn-outline-field-label">{label}</span>
    {help&&<small>{help}</small>}
    {large ? <textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder="Write your planning notes…"/> : <input value={value||""} onChange={e=>onChange(e.target.value)} placeholder="Add a concise planning note…"/>}
  </label>;
}

function OutlineBuilderPage({ userName, profile, onUpdate, onLogout, onHome, onDashboard, onStats, onLibrary, onProfile, onSettings, onResearch, onOpenDraft, showToast, onRewrite }) {
  const [outline, setOutline] = useState(() => normalizeOutline(profile.outline));
  const update = (next) => setOutline(next);
  function addBody(){ update({...outline,bodyParagraphs:[...outline.bodyParagraphs,{title:`Body Paragraph ${outline.bodyParagraphs.length+1}`,topicSentence:"",contextEvidence:"",analysis:"",transition:""}]}); }
  function removeBody(i){ update({...outline,bodyParagraphs:outline.bodyParagraphs.filter((_,idx)=>idx!==i)}); }
  function setIntro(key,value){ update({...outline,introduction:{...outline.introduction,[key]:value}}); }
  function setConclusion(key,value){ update({...outline,conclusion:{...outline.conclusion,[key]:value}}); }
  function setBody(i,key,value){ update({...outline,bodyParagraphs:outline.bodyParagraphs.map((p,idx)=>idx===i?{...p,[key]:value}:p)}); }
  async function save(){ await onUpdate({...profile,outline}); showToast("Outline saved."); }
  const [generating, setGenerating] = useState(false);
  async function generatePlan(){
    if(!outline.thesis.trim() && !outline.title.trim()){ showToast("Add a title or thesis first."); return; }
    setGenerating(true);
    try{
      const result=await callGemini(`You are Marginal's outline coach. Build a planning outline, not a finished essay. Return ONLY JSON with shape {introduction:{context,issue,claim},bodyParagraphs:[{title,topicSentence,contextEvidence,analysis,transition}],conclusion:{restatedIdea,summary,finalThought}}. Create 3 body paragraphs. Keep each field concise and useful as planning guidance. Paper type: ${PAPER_GUIDES[outline.paperType]?.label||outline.paperType}.`, `TITLE: ${outline.title}
THESIS: ${outline.thesis}`, token, {json:true});
      update({...outline,introduction:{...outline.introduction,...(result.introduction||{}),claim:result.introduction?.claim||outline.thesis},bodyParagraphs:(result.bodyParagraphs||[]).slice(0,6).map((p,i)=>({...DEFAULT_OUTLINE.bodyParagraphs[Math.min(i,2)],...p,title:p.title||`Body Paragraph ${i+1}`})),conclusion:{...outline.conclusion,...(result.conclusion||{})}});
      showToast("Marginal built a planning outline. Edit it to make it yours.");
    }catch{ showToast("Couldn't build the outline right now."); }
    setGenerating(false);
  }
  async function createDraft(){
    const content=[
      outline.introduction.context && `INTRODUCTION\nContext: ${outline.introduction.context}\nSituation / Issue: ${outline.introduction.issue}\nCentral Claim: ${outline.introduction.claim || outline.thesis}`,
      ...outline.bodyParagraphs.map(p=>`${p.title.toUpperCase()}\nTopic Sentence: ${p.topicSentence}\nContext and Evidence: ${p.contextEvidence}\nAnalysis / Explanation: ${p.analysis}\nConcluding / Transition Sentence: ${p.transition}`),
      `CONCLUSION\nRestated Main Idea: ${outline.conclusion.restatedIdea}\nSummary of Main Points: ${outline.conclusion.summary}\nFinal Thought / Mic Drop: ${outline.conclusion.finalThought}`
    ].filter(Boolean).join("\n\n");
    const draft={id:Date.now().toString(),title:outline.title||"Untitled",content,tone:"auto",paperType:outline.paperType,createdAt:Date.now(),updatedAt:Date.now(),accepted:[],rejected:[],versions:[],outline};
    await onUpdate({...profile,drafts:[draft,...profile.drafts],outline}); onOpenDraft(draft.id);
  }
  const Field=OutlineField;
  return <div className="mgn-outline-page"><TopBar userName={userName} avatar={profile.avatar} onLogout={onLogout} onHome={onHome} onStats={onStats} onLibrary={onLibrary} onOutline={()=>{}} onProfile={onProfile} onSettings={onSettings} onResearch={onResearch} onRewrite={onRewrite}/><main className="mgn-outline-main">
    <div className="mgn-page-hero"><div><div className="mgn-eyebrow">Plan before you draft</div><h1>Outline Builder</h1><p>Build the reasoning structure first. Each section tells you what the paragraph needs to accomplish.</p></div><div className="mgn-outline-actions"><button className="mgn-btn-ghost" onClick={generatePlan} disabled={generating}>{generating?<Loader2 className="mgn-spin" size={16}/>:<Wand2 size={16}/>} {generating?"Building…":"Build with Marginal"}</button><button className="mgn-btn-ghost" onClick={save}><Check size={16}/> Save outline</button><button className="mgn-btn-primary" onClick={createDraft}><PenLine size={16}/> Build draft from outline</button></div></div>
    <section className="mgn-outline-shell"><div className="mgn-outline-form">
      <div className="mgn-outline-field-row"><input className="mgn-input" value={outline.title} onChange={e=>update({...outline,title:e.target.value})} placeholder="Outline title"/><select value={outline.paperType} onChange={e=>update({...outline,paperType:e.target.value})}>{Object.entries(PAPER_GUIDES).map(([id,g])=><option key={id} value={id}>{g.label}</option>)}</select></div>
      <div className="mgn-outline-card mgn-outline-intro"><div className="mgn-outline-section-title"><span className="mgn-outline-step">01</span><div><h3>Introduction</h3><p>Move from the situation to the argument. End with a defensible claim that responds directly to the prompt.</p></div></div><div className="mgn-outline-fields"><Field label="Context" help="Establish the background or situation." value={outline.introduction.context} onChange={v=>setIntro("context",v)} large/><Field label="Establish the situation or issue" help="Explain the problem, debate, or rhetorical situation that leads into your argument." value={outline.introduction.issue} onChange={v=>setIntro("issue",v)} large/><Field label="Defensible claim / thesis" help="For argument or synthesis, take a clear position. For rhetorical analysis, identify what the writer does and why it matters." value={outline.introduction.claim} onChange={v=>{setIntro("claim",v);update({...outline,thesis:v,introduction:{...outline.introduction,claim:v}})}} large/></div></div>
      <div className="mgn-outline-body-header"><div><div className="mgn-outline-step">02</div><div><h3>Body Paragraphs</h3><p>Every paragraph should prove part of the thesis through evidence and analysis.</p></div></div><button className="mgn-btn-ghost" onClick={addBody}><Plus size={15}/> Add paragraph</button></div>
      {outline.bodyParagraphs.map((p,i)=><div className="mgn-outline-card mgn-outline-body-card" key={i}><div className="mgn-outline-card-top"><div><span className="mgn-outline-kicker">Body Paragraph {i+1}</span><input className="mgn-outline-title-input" value={p.title} onChange={e=>setBody(i,"title",e.target.value)}/></div>{outline.bodyParagraphs.length>1&&<button className="mgn-icon-btn" onClick={()=>removeBody(i)} title="Remove paragraph"><Trash2 size={15}/></button>}</div><div className="mgn-outline-fields"><Field label="Topic Sentence" help="State the paragraph's main point or sub-claim and tie it to the thesis." value={p.topicSentence} onChange={v=>setBody(i,"topicSentence",v)} large/><Field label="Context and Evidence" help="Introduce concrete facts, quotes, data, or examples from reliable sources." value={p.contextEvidence} onChange={v=>setBody(i,"contextEvidence",v)} large/><Field label="Analysis / Explanation" help="Explain why the evidence matters and connect it back to what you are trying to prove." value={p.analysis} onChange={v=>setBody(i,"analysis",v)} large/><Field label="Concluding / Transition Sentence" help="Wrap up the takeaway or create a smooth path into the next point." value={p.transition} onChange={v=>setBody(i,"transition",v)} large/></div></div>)}
      <div className="mgn-outline-card mgn-outline-conclusion"><div className="mgn-outline-section-title"><span className="mgn-outline-step">03</span><div><h3>Conclusion</h3><p>Close the argument without introducing new evidence.</p></div></div><div className="mgn-outline-fields"><Field label="Restate the main idea" help="Say your main idea again using new words—not a direct copy." value={outline.conclusion.restatedIdea} onChange={v=>setConclusion("restatedIdea",v)} large/><Field label="Summarize main points" help="Remind readers of your core arguments without adding new evidence." value={outline.conclusion.summary} onChange={v=>setConclusion("summary",v)} large/><Field label={'Final thought / “mic drop”'} help="End with a broad statement, call to action, or final insight about why the topic matters." value={outline.conclusion.finalThought} onChange={v=>setConclusion("finalThought",v)} large/></div></div>
    </div><aside className="mgn-outline-preview"><div className="mgn-card-head"><div><h3>Live preview</h3><p className="mgn-card-sub">Your argument at a glance.</p></div><ListTree size={19}/></div><div className="mgn-outline-tree"><div className="root">{outline.title}</div><div className="branch"><b>Introduction</b><span>{outline.introduction.context||"Context"}</span><span>{outline.introduction.issue||"Situation / issue"}</span><span>{outline.introduction.claim||"Defensible claim / thesis"}</span></div>{outline.bodyParagraphs.map((p,i)=><div className="branch" key={i}><b>{p.title}</b><span>{p.topicSentence||"Topic sentence"}</span><span>{p.contextEvidence||"Context + evidence"}</span><span>{p.analysis||"Analysis / explanation"}</span><span>{p.transition||"Concluding / transition"}</span></div>)}<div className="branch"><b>Conclusion</b><span>{outline.conclusion.restatedIdea||"Restated main idea"}</span><span>{outline.conclusion.summary||"Summary of main points"}</span><span>{outline.conclusion.finalThought||"Final thought / mic drop"}</span></div></div></aside></section></main></div>;
}

/* ================================================================
   PERSONAL WRITING PROFILE PAGE
================================================================ */
function WritingProfilePage({ userName, profile, onUpdate, onLogout, onHome, onDashboard, onStats, onLibrary, onOutline, onSettings, onResearch, onRewrite }) {
  const voice=profile.styleProfile||{}; const traits=voice.traits||profile.weights||{};
  return <div className="mgn-profile-page"><TopBar userName={userName} avatar={profile.avatar} onLogout={onLogout} onHome={onHome} onStats={onStats} onLibrary={onLibrary} onOutline={onOutline} onProfile={()=>{}} onSettings={onSettings} onResearch={onResearch} onRewrite={onRewrite}/><main className="mgn-profile-main"><div className="mgn-page-hero"><div><div className="mgn-eyebrow">Your voice model</div><h1>Personal Writing Profile</h1><p>See the patterns Marginal has learned from your writing—and adjust the dials when you want a different feel.</p></div><Brain className="mgn-page-hero-art" size={42}/></div><section className="mgn-profile-page-grid"><div className="mgn-card"><h3>Your voice</h3><p className="mgn-profile-summary">{voice.summary||"Your profile is still developing. Add more writing samples to give Marginal more to learn from."}</p><div className="mgn-profile-traits">{[["Formality","formality"],["Sentence variety","sentenceVariety"],["Vocabulary complexity","vocabularyComplexity"],["Warmth","warmth"],["Directness","directness"]].map(([label,key])=>{const v=Number(traits[key]??50);return <div className="mgn-profile-trait" key={key}><div><span>{label}</span><b>{Math.round(v)}%</b></div><div className="mgn-trait-track"><div style={{width:`${v}%`}}/></div><small>{v<40?TRAIT_LABELS[key][0]:v>60?TRAIT_LABELS[key][1]:"Balanced"}</small></div>})}</div></div><div className="mgn-card"><h3>What Marginal notices</h3><div className="mgn-profile-columns"><div><h4>Recurring language</h4>{voice.commonPhrases?.length?<div className="mgn-tags">{voice.commonPhrases.map((x,i)=><span className="mgn-tag" key={i}>{x}</span>)}</div>:<p className="mgn-muted">Not enough data yet.</p>}</div><div><h4>Style habits</h4>{voice.quirks?.length?<ul>{voice.quirks.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p className="mgn-muted">Not enough data yet.</p>}</div></div><div className="mgn-profile-openers"><h4>Typical sentence starts</h4>{voice.sampleOpeners?.length?voice.sampleOpeners.map((x,i)=><span key={i}>“{x}”</span>):<p className="mgn-muted">No patterns yet.</p>}</div></div></section></main></div>;
}

/* ================================================================
   WRITING PROFILE
================================================================ */
function WritingProfileModal({ profile, onClose }) {
  const voice = profile.styleProfile || {};
  const traits = voice.traits || profile.weights || {};
  const traitItems = [
    ["Formality", traits.formality], ["Sentence variety", traits.sentenceVariety],
    ["Vocabulary complexity", traits.vocabularyComplexity], ["Warmth", traits.warmth], ["Directness", traits.directness],
  ].filter(([, value]) => typeof value === "number");
  return <div className="mgn-modal-backdrop" onClick={onClose}>
    <div className="mgn-modal mgn-profile-modal" onClick={e => e.stopPropagation()}>
      <div className="mgn-modal-head"><div><div className="mgn-eyebrow">Your writing profile</div><h3>How Marginal sees your voice</h3></div><button className="mgn-icon-btn" onClick={onClose}><X size={18}/></button></div>
      <p className="mgn-profile-summary">{voice.summary || "Your voice profile is still developing."}</p>
      <div className="mgn-profile-traits">{traitItems.map(([label, value]) => <div key={label} className="mgn-profile-trait"><div><span>{label}</span><b>{Math.round(value)}%</b></div><div className="mgn-trait-track"><div style={{width:`${value}%`}}/></div><small>{value < 40 ? "More restrained" : value > 60 ? "More pronounced" : "Balanced"}</small></div>)}</div>
      <div className="mgn-profile-columns">
        <div><h4>Recurring language</h4>{(voice.commonPhrases || []).length ? <div className="mgn-tags">{voice.commonPhrases.map((x,i)=><span className="mgn-tag" key={i}>{x}</span>)}</div> : <p className="mgn-muted">Not enough data yet.</p>}</div>
        <div><h4>Style habits</h4>{(voice.quirks || []).length ? <ul>{voice.quirks.map((x,i)=><li key={i}>{x}</li>)}</ul> : <p className="mgn-muted">Not enough data yet.</p>}</div>
      </div>
      <div className="mgn-profile-openers"><h4>Typical sentence starts</h4>{(voice.sampleOpeners || []).length ? voice.sampleOpeners.map((x,i)=><span key={i}>“{x}”</span>) : <p className="mgn-muted">Marginal will learn these as you add more samples.</p>}</div>
      <div className="mgn-profile-note"><Brain size={16}/><span>Marginal uses this profile as guidance, not as a score. Your choices—especially accepted and rejected suggestions—also help shape future autocomplete behavior.</span></div>
    </div>
  </div>;
}

/* ================================================================
   VERSION HISTORY / COMPARISON
================================================================ */
function VersionModal({ draft, currentText, onClose }) {
  const versions = draft.versions || [];
  const current = { id: "current", content: currentText, title: draft.title, wordCount: countWords(currentText), savedAt: Date.now() };
  const options = [...versions, current];
  const [aId, setAId] = useState(options.length > 1 ? options[Math.max(0, options.length - 2)].id : options[0]?.id);
  const [bId, setBId] = useState(current.id);
  const a = options.find(v => v.id === aId) || options[0];
  const b = options.find(v => v.id === bId) || current;
  const diff = diffWords(a?.content || "", b?.content || "");
  const added = diff.filter(x => x.type === "added").length;
  const removed = diff.filter(x => x.type === "removed").length;
  return <div className="mgn-modal-backdrop" onClick={onClose}>
    <div className="mgn-modal mgn-version-modal" onClick={e => e.stopPropagation()}>
      <div className="mgn-modal-head"><div><div className="mgn-eyebrow">Draft history</div><h3>Compare versions</h3></div><button className="mgn-icon-btn" onClick={onClose}><X size={18}/></button></div>
      {options.length < 2 ? <div className="mgn-empty-state"><History size={28}/><p>Keep writing and Marginal will save snapshots as your draft changes.</p></div> : <>
        <div className="mgn-version-selects"><label>Earlier version<select value={aId} onChange={e=>setAId(e.target.value)}>{options.map(v=><option key={v.id} value={v.id}>{v.id === "current" ? "Current draft" : new Date(v.savedAt).toLocaleString()} · {v.wordCount} words</option>)}</select></label><GitCompare size={18}/><label>Later version<select value={bId} onChange={e=>setBId(e.target.value)}>{options.map(v=><option key={v.id} value={v.id}>{v.id === "current" ? "Current draft" : new Date(v.savedAt).toLocaleString()} · {v.wordCount} words</option>)}</select></label></div>
        <div className="mgn-version-summary"><span className="mgn-added">+{added} added</span><span className="mgn-removed">−{removed} removed</span><span>{b?.wordCount - a?.wordCount >= 0 ? "+" : ""}{(b?.wordCount || 0) - (a?.wordCount || 0)} words</span></div>
        <div className="mgn-diff-box">{diff.map((x,i)=><span key={i} className={`mgn-diff-${x.type}`}>{x.text} </span>)}</div>
      </>}
    </div>
  </div>;
}


/* ================================================================
   ACCOUNT / SETTINGS
================================================================ */
function AvatarCropModal({ src, onClose, onSave }) {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef(null);
  function exportCrop() {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    setSaving(true);
    const size = 600;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    const base = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const scale = base * zoom;
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    const x = (size - w) / 2 + offsetX * size / 100;
    const y = (size - h) / 2 + offsetY * size / 100;
    ctx.drawImage(img, x, y, w, h);
    onSave(canvas.toDataURL("image/jpeg", .9));
    setSaving(false);
  }
  return <div className="mgn-modal-backdrop" onClick={onClose}>
    <div className="mgn-modal mgn-avatar-crop-modal" onClick={e=>e.stopPropagation()}>
      <div className="mgn-modal-head"><div><div className="mgn-eyebrow">Profile picture</div><h3>Crop your photo</h3></div><button className="mgn-icon-btn" onClick={onClose}><X size={18}/></button></div>
      <p className="mgn-muted">Adjust the photo so the part you want sits inside the circle.</p>
      <div className="mgn-crop-stage"><img ref={imgRef} src={src} alt="Crop preview" style={{transform:`translate(${offsetX}%, ${offsetY}%) scale(${zoom})`}}/><div className="mgn-crop-circle"/></div>
      <div className="mgn-crop-controls">
        <label>Zoom <input type="range" min="1" max="3" step=".01" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
        <label>Horizontal <input type="range" min="-35" max="35" value={offsetX} onChange={e=>setOffsetX(Number(e.target.value))}/></label>
        <label>Vertical <input type="range" min="-35" max="35" value={offsetY} onChange={e=>setOffsetY(Number(e.target.value))}/></label>
      </div>
      <div className="mgn-modal-actions"><button className="mgn-btn-ghost" onClick={onClose}>Cancel</button><button className="mgn-btn-primary" disabled={saving} onClick={exportCrop}>{saving?<Loader2 className="mgn-spin" size={16}/>:<Check size={16}/>} Use photo</button></div>
    </div>
  </div>;
}

function SettingsPage({ userName, profile, token, onUpdate, onLogout, onHome, onDashboard, onStats, onLibrary, onOutline, onProfile, onResearch, showToast, onRewrite }) {
  const settings = profile.settings || {};
  const [name, setName] = useState(profile.displayName || userName || "");
  const [email, setEmail] = useState(profile.email || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [saving, setSaving] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState("");
  const fileRef = useRef(null);
  function save(patch={}) { setSaving(true); const next={...profile,...patch}; Promise.resolve(onUpdate(next)).finally(()=>{setSaving(false);showToast("Profile settings saved.");}); }
  function uploadAvatar(e){ const file=e.target.files?.[0]; if(!file) return; if(file.size>5_000_000){showToast("Choose an image under 5 MB.");return;} const reader=new FileReader(); reader.onload=()=>{setCropSrc(String(reader.result));setCropOpen(true);}; reader.readAsDataURL(file); e.target.value=""; }
  const avatar = profile.avatar;
  return <div className="mgn-settings-page"><TopBar userName={name || userName} avatar={profile.avatar} onLogout={onLogout} onHome={onHome} onStats={onStats} onLibrary={onLibrary} onOutline={onOutline} onProfile={onProfile} onSettings={()=>{}} onResearch={onResearch} onRewrite={onRewrite}/><main className="mgn-settings-main">
    <div className="mgn-page-hero"><div><div className="mgn-eyebrow">Account & preferences</div><h1>Settings</h1><p>Make Marginal feel like your workspace. Your choices are saved to your account.</p></div><Settings size={42} className="mgn-page-hero-art"/></div>
    <div className="mgn-settings-grid">
      <section className="mgn-card mgn-settings-card"><div className="mgn-settings-section-head"><div><h3>Profile</h3><p>How other parts of Marginal identify you.</p></div><UserCircle/></div>
        <div className="mgn-avatar-editor"><button className="mgn-avatar-large" onClick={()=>fileRef.current?.click()}>{avatar?<img src={avatar} alt="Profile"/>:<span>{(name||userName)?.[0]?.toUpperCase()||"M"}</span>}<span className="mgn-avatar-edit"><Upload size={14}/></span></button><div><strong>Profile picture</strong><p>Upload a JPG, PNG, or WebP up to 2 MB.</p><button className="mgn-btn-ghost mgn-btn-sm" onClick={()=>fileRef.current?.click()}>Change picture</button></div><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadAvatar}/></div>
        <label className="mgn-setting-field"><span>Display name</span><input className="mgn-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>
        <label className="mgn-setting-field"><span>Email</span><input className="mgn-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
        <label className="mgn-setting-field"><span>Bio</span><textarea className="mgn-settings-textarea" value={bio} onChange={e=>setBio(e.target.value)} placeholder="A sentence about you…"/></label>
        <button className="mgn-btn-primary" disabled={saving} onClick={()=>save({displayName:name,email,bio})}>{saving?<Loader2 className="mgn-spin" size={16}/>:<Check size={16}/>} Save profile</button>
      </section>
      <section className="mgn-card mgn-settings-card"><div className="mgn-settings-section-head"><div><h3>Appearance</h3><p>Choose an accent color for your Marginal workspace.</p></div><Palette/></div>
        <div className="mgn-setting-choice"><span><strong>Accent color</strong><small>Your color follows you across the app.</small></span><div className="mgn-accent-grid">{["#7567F8","#4F8CFF","#E2558E","#19B887","#F08A3C","#8B5CF6"].map(c=><button key={c} aria-label={c} className={settings.accentColor===c?"active":""} style={{background:c}} onClick={()=>save({settings:{...settings,accentColor:c}})}/>)}</div></div>
      </section>
      <section className="mgn-card mgn-settings-card"><div className="mgn-settings-section-head"><div><h3>Writing behavior</h3><p>Control how much help appears while you write.</p></div><SlidersHorizontal/></div>
        {[["autocomplete","Autocomplete suggestions"],["explainSuggestions","Show “Why this?”"],["autoSave","Auto-save drafts"]].map(([key,label])=><label className="mgn-toggle-row" key={key}><span><strong>{label}</strong><small>{key==="autocomplete"?"Let Marginal continue sentences in your voice.":key==="explainSuggestions"?"Keep style reasoning one click away.":"Save draft changes as you work."}</small></span><input type="checkbox" checked={settings[key]!==false} onChange={e=>save({settings:{...settings,[key]:e.target.checked}})}/></label>)}
        <label className="mgn-setting-field"><span>Suggestion length</span><select value={settings.suggestionLength||"medium"} onChange={e=>save({settings:{...settings,suggestionLength:e.target.value}})}><option value="short">Short — a phrase or sentence</option><option value="medium">Medium — 1–2 sentences</option><option value="long">Long — up to a paragraph</option></select></label>
      </section>
      <section className="mgn-card mgn-settings-card"><div className="mgn-settings-section-head"><div><h3>Teach Marginal</h3><p>Add more writing so your Writing DNA becomes more accurate.</p></div><Brain/></div><div className="mgn-learn-box"><div><strong>{(profile.samples||[]).filter(s=>s?.trim()).length} writing samples</strong><p>More samples help Marginal recognize patterns that one essay cannot.</p></div><button className="mgn-btn-primary" onClick={()=>setLearnOpen(true)}><Sparkles size={16}/> Learn from my writing</button></div></section>
    </div></main>{learnOpen&&<ManageSamplesModal profile={profile} token={token} onClose={()=>setLearnOpen(false)} onApply={p=>{onUpdate(p);setLearnOpen(false);showToast("Your writing profile was updated.");}}/>}</div>;
}

/* ================================================================
   RESEARCH WORKSPACE + CITATIONS
================================================================ */
function makeCitation(source, style){
  const a=source.author||"Unknown author", t=source.title||"Untitled source", y=source.year||"n.d.", pub=source.publication||"", url=source.url||"";
  if(style==="APA") return `${a}. (${y}). ${t}.${pub?` ${pub}.`:""}${url?` ${url}`:""}`;
  if(style==="Chicago") return `${a}. “${t}.” ${pub?pub+", ":""}${y}.${url?` ${url}.`:""}`;
  return `${a}. “${t}.” ${pub?pub+", ":""}${y}.${url?` ${url}.`:""}`;
}
function ResearchWorkspacePage({ userName, profile, token, onUpdate, onLogout, onHome, onDashboard, onStats, onLibrary, onOutline, onProfile, onSettings, showToast, onRewrite }){
  const sources=profile.research?.sources||[]; const [style,setStyle]=useState(profile.research?.citationStyle||"MLA"); const [q,setQ]=useState(""); const [form,setForm]=useState({title:"",author:"",year:"",publication:"",url:"",notes:"",evidence:""});
  function saveSources(next){onUpdate({...profile,research:{...(profile.research||{}),sources:next,citationStyle:style}})}
  function add(){if(!form.title.trim()){showToast("Add a source title first.");return;} saveSources([{...form,id:Date.now().toString()},...sources]);setForm({title:"",author:"",year:"",publication:"",url:"",notes:"",evidence:""});showToast("Source added.");}
  const visible=sources.filter(s=>`${s.title} ${s.author} ${s.notes}`.toLowerCase().includes(q.toLowerCase()));
  return <div className="mgn-research-page"><TopBar userName={userName} avatar={profile.avatar} onLogout={onLogout} onHome={onHome} onStats={onStats} onLibrary={onLibrary} onOutline={onOutline} onProfile={onProfile} onSettings={onSettings} onResearch={()=>{}} onRewrite={onRewrite}/><main className="mgn-research-main"><div className="mgn-page-hero"><div><div className="mgn-eyebrow">Research workspace</div><h1>Sources & evidence</h1><p>Collect sources, save evidence, and keep your argument connected to what you found.</p></div><FileSearch size={42} className="mgn-page-hero-art"/></div>
    <div className="mgn-research-grid"><section className="mgn-card"><div className="mgn-card-head"><div><h3>Add a source</h3><p className="mgn-card-sub">Keep the bibliographic details and your notes together.</p></div><Plus/></div><div className="mgn-source-form"><input className="mgn-input" placeholder="Source title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><input className="mgn-input" placeholder="Author" value={form.author} onChange={e=>setForm({...form,author:e.target.value})}/><input className="mgn-input" placeholder="Year" value={form.year} onChange={e=>setForm({...form,year:e.target.value})}/><input className="mgn-input" placeholder="Publication / site" value={form.publication} onChange={e=>setForm({...form,publication:e.target.value})}/><input className="mgn-input" placeholder="URL (optional)" value={form.url} onChange={e=>setForm({...form,url:e.target.value})}/><textarea className="mgn-settings-textarea" placeholder="Evidence / quote / data" value={form.evidence} onChange={e=>setForm({...form,evidence:e.target.value})}/><textarea className="mgn-settings-textarea" placeholder="Your notes: what does this source contribute?" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button className="mgn-btn-primary" onClick={add}><Plus size={16}/> Add source</button></div></section>
    <section className="mgn-card"><div className="mgn-card-head"><div><h3>Your source bank</h3><p className="mgn-card-sub">{sources.length} source{sources.length===1?"":"s"} saved.</p></div><div className="mgn-citation-controls"><select value={style} onChange={e=>{setStyle(e.target.value);onUpdate({...profile,research:{...(profile.research||{}),citationStyle:e.target.value}})}}><option>MLA</option><option>APA</option><option>Chicago</option></select></div></div><div className="mgn-search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search sources…"/></div><div className="mgn-source-list">{visible.length===0?<div className="mgn-empty"><FileSearch size={26}/><p>No sources yet. Add one on the left.</p></div>:visible.map(s=><article className="mgn-source-card" key={s.id}><div><span className="mgn-source-kicker">{style}</span><h3>{s.title}</h3><p>{s.author||"Unknown author"}{s.year?` · ${s.year}`:""}{s.publication?` · ${s.publication}`:""}</p></div><div className="mgn-source-evidence"><strong>Evidence</strong><p>{s.evidence||"No evidence saved yet."}</p><strong>Notes</strong><p>{s.notes||"No notes saved yet."}</p></div><div className="mgn-source-actions"><button onClick={()=>navigator.clipboard?.writeText(makeCitation(s,style))}><Quote size={14}/> Copy citation</button>{s.url&&<a href={s.url} target="_blank" rel="noreferrer"><Link2 size={14}/> Open source</a>}<button className="danger" onClick={()=>saveSources(sources.filter(x=>x.id!==s.id))}><Trash2 size={14}/> Remove</button></div><div className="mgn-generated-citation">{makeCitation(s,style)}</div></article>)}</div></section></div>
  </main></div>;
}

/* ================================================================
   REWRITE IN MY VOICE
================================================================ */
function RewritePage({ userName, profile, token, onUpdate, onLogout, onHome, onDashboard, onStats, onLibrary, onOutline, onProfile, onSettings, onResearch, onOpenDraft, showToast }) {
  const voices = allVoices(profile);
  const [voiceId, setVoiceId] = useState("default");
  const activeVoice = getVoice(profile, voiceId);
  const [tone, setTone] = useState("auto");
  const [input, setInput] = useState("");
  const [segments, setSegments] = useState(null); // [{id,type:'same',text} | {id,type:'change',original,revised,why,accepted}]
  const [loading, setLoading] = useState(false);

  async function rewrite() {
    if (!input.trim()) { showToast("Paste in some text first."); return; }
    setLoading(true);
    setSegments(null);
    try {
      const weightLines = Object.entries(activeVoice.weights || {})
        .map(([k, v]) => `${k}: ${v}/100 (${v < 40 ? TRAIT_LABELS[k][0] : v > 60 ? TRAIT_LABELS[k][1] : "balanced"})`)
        .join("\n");
      const toneLine =
        tone === "professional"
          ? "Lean into their PROFESSIONAL register — more polished, fewer contractions."
          : tone === "casual"
          ? "Lean into their CASUAL register — relaxed, contractions fine."
          : "Use their natural, default voice.";
      const data = await callGemini(
        `You are Marginal's rewrite tool. Rewrite the text the person pastes in so it reads like something THEY would have written, based on their established style profile — without changing its meaning, facts, or argument. This is a style pass, not a content rewrite.

Break the ENTIRE input into an ordered list of segments that together reconstruct it start to finish. Return ONLY JSON of this shape:
{"segments": [{"type": "same", "text": "..."}, {"type": "change", "original": "...", "revised": "...", "why": "..."}]}

- "same" segments are copied verbatim from the input for parts that don't need to change.
- "change" segments replace a short phrase or sentence of the original ("original") with reworded text in the person's voice ("revised"), each with one concise "why" grounded in their style profile or trait dials (word choice, sentence length, contractions, hedging, transitions, directness, etc). Every person will want to review and individually accept or reject each "change" segment, so keep them at phrase/sentence granularity — not word-by-word, and not the whole text as one giant segment.
- Concatenating every segment's "text" (for "same") or "original" (for "change") in order must reproduce the input text.
- Skip trivial single-word synonym swaps unless nothing bigger changed in that area. Never invent facts, claims, or details that weren't already in the input.

STYLE PROFILE: ${JSON.stringify(activeVoice.styleProfile || {})}
TRAIT DIALS:
${weightLines}
TONE: ${toneLine}`,
        `TEXT TO REWRITE:\n${input.slice(0, 9000)}`,
        token,
        { json: true }
      );
      const segs = (data.segments || [])
        .filter((s) => s && (s.type === "same" ? s.text : s.original))
        .map((s, i) => ({ id: i, accepted: true, ...s }));
      if (segs.length === 0) throw new Error("empty");
      setSegments(segs);
    } catch {
      showToast("Couldn't rewrite that just now — try again in a moment.");
    }
    setLoading(false);
  }

  function toggleSegment(id) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, accepted: !s.accepted } : s)));
  }

  function setAll(accepted) {
    setSegments((prev) => prev.map((s) => (s.type === "change" ? { ...s, accepted } : s)));
  }

  function composeFinalText() {
    if (!segments) return "";
    return segments
      .map((s) => (s.type === "change" ? (s.accepted ? s.revised : s.original) : s.text))
      .join(" ")
      .replace(/ +([,.;:!?])/g, "$1")
      .replace(/ {2,}/g, " ")
      .trim();
  }

  function copyRewritten() {
    const text = composeFinalText();
    if (!text) return;
    navigator.clipboard?.writeText(text);
    showToast("Copied the rewritten text.");
  }

  async function saveAsDraft() {
    const content = composeFinalText();
    if (!content) return;
    const draft = {
      id: Date.now().toString(),
      title: "Rewritten draft",
      content,
      tone,
      paperType: "general",
      voiceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accepted: [],
      rejected: [],
      versions: [],
    };
    await onUpdate({ ...profile, drafts: [draft, ...profile.drafts] });
    onOpenDraft(draft.id);
  }

  const changeSegments = segments ? segments.filter((s) => s.type === "change") : [];
  const keptCount = changeSegments.filter((s) => s.accepted).length;

  return (
    <div className="mgn-rewrite-page">
      <TopBar userName={userName} avatar={profile.avatar} onLogout={onLogout} onHome={onHome} onStats={onStats} onLibrary={onLibrary} onOutline={onOutline} onProfile={onProfile} onSettings={onSettings} onResearch={onResearch} onRewrite={() => {}} />
      <main className="mgn-rewrite-main">
        <div className="mgn-page-hero">
          <div>
            <div className="mgn-eyebrow">Say it like you would</div>
            <h1>Rewrite in your voice</h1>
            <p>Paste in a paragraph, an email, or someone else's draft. Marginal reworks the wording to sound like you, explains every change, and lets you keep or undo each one.</p>
          </div>
          <Wand2 className="mgn-page-hero-art" size={42} />
        </div>

        <section className="mgn-rewrite-grid">
          <div className="mgn-card mgn-rewrite-input-card">
            <div className="mgn-card-head">
              <div>
                <h3>Your text</h3>
                <p className="mgn-card-sub">Paste in up to a few pages of writing.</p>
              </div>
            </div>
            <textarea
              className="mgn-settings-textarea mgn-rewrite-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste the text you want rewritten in your voice…"
            />
            <div className="mgn-rewrite-controls">
              <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <div className="mgn-choice-row">
                {TONE_OPTIONS.map((t) => (
                  <button key={t.id} className={tone === t.id ? "active" : ""} onClick={() => setTone(t.id)}>{t.label}</button>
                ))}
              </div>
            </div>
            <button className="mgn-btn-primary" onClick={rewrite} disabled={loading}>
              {loading ? <Loader2 className="mgn-spin" size={16} /> : <Wand2 size={16} />} {loading ? "Rewriting…" : "Rewrite in my voice"}
            </button>
            <div className="mgn-rewrite-meta">{countWords(input)} words</div>
          </div>

          <div className="mgn-card mgn-rewrite-output-card">
            <div className="mgn-card-head">
              <div>
                <h3>Rewritten</h3>
                <p className="mgn-card-sub">Click a highlighted change to keep or undo it.</p>
              </div>
              {segments && (
                <div className="mgn-rewrite-output-actions">
                  <button className="mgn-icon-btn" onClick={copyRewritten} title="Copy rewritten text"><Copy size={16} /></button>
                  <button className="mgn-btn-ghost mgn-btn-sm" onClick={saveAsDraft}><PenLine size={14} /> Save as draft</button>
                </div>
              )}
            </div>
            {!segments && !loading && (
              <div className="mgn-empty">
                <Wand2 size={26} />
                <p>Your rewrite — and a breakdown of every change — will show up here.</p>
              </div>
            )}
            {loading && (
              <div className="mgn-empty">
                <Loader2 className="mgn-spin" size={26} />
                <p>Marginal is matching this to your voice…</p>
              </div>
            )}
            {segments && !loading && (
              <>
                {changeSegments.length > 0 && (
                  <div className="mgn-rewrite-toggle-row">
                    <span className="mgn-pill-soft">{keptCount} of {changeSegments.length} changes kept</span>
                    <div className="mgn-rewrite-toggle-actions">
                      <button className="mgn-btn-ghost mgn-btn-sm" onClick={() => setAll(true)}><Check size={13} /> Keep all</button>
                      <button className="mgn-btn-ghost mgn-btn-sm" onClick={() => setAll(false)}><X size={13} /> Undo all</button>
                    </div>
                  </div>
                )}
                <div className="mgn-diff-box mgn-rewrite-diff">
                  {segments.map((s) =>
                    s.type === "same" ? (
                      <span key={s.id}>{s.text} </span>
                    ) : (
                      <span
                        key={s.id}
                        className={`mgn-rewrite-seg ${s.accepted ? "mgn-diff-added" : "mgn-rewrite-seg-reverted"}`}
                        onClick={() => toggleSegment(s.id)}
                        title={s.accepted ? `${s.why} — click to undo` : "Reverted to your original wording — click to reapply"}
                      >
                        {s.accepted ? s.revised : s.original}{" "}
                      </span>
                    )
                  )}
                </div>
                {changeSegments.length > 0 && (
                  <div className="mgn-rewrite-changes">
                    <div className="mgn-insights-label">What changed, and why</div>
                    {changeSegments.map((c) => (
                      <div className={`mgn-rewrite-change-row ${c.accepted ? "" : "is-reverted"}`} key={c.id}>
                        <div className="mgn-rewrite-change-text">
                          <span className="mgn-diff-removed">{c.original}</span>
                          <ArrowRight size={13} />
                          <span className="mgn-diff-added">{c.revised}</span>
                        </div>
                        <p className="mgn-rewrite-change-why">{c.why}</p>
                        <button className="mgn-rewrite-change-toggle" onClick={() => toggleSegment(c.id)}>
                          {c.accepted ? (<><X size={13} /> Undo this change</>) : (<><Check size={13} /> Keep this change</>)}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

/* ================================================================
   WRITING COACH / ESSAY HEALTH
================================================================ */
function essayHealth(text,paperType){ const words=countWords(text); const paras=text.trim()?text.split(/\n\s*\n/).filter(Boolean):[]; const sentences=(text.match(/[.!?]+/g)||[]).length; const evidence=(text.match(/\b(for example|according to|research|study|data|source|because|such as|according|shows|demonstrates)\b/gi)||[]).length; const transitions=(text.match(/\b(however|therefore|furthermore|moreover|although|while|instead|ultimately|consequently|similarly)\b/gi)||[]).length; const hasThesis=/\b(although|because|therefore|should|must|argue|argues|demonstrates|shows)\b/i.test(text.slice(0,900)); const argument=Math.min(100,35+(hasThesis?25:0)+(paras.length>=4?15:0)+(transitions>=3?15:0)+(words>=800?10:0)); const evidenceScore=Math.min(100,30+evidence*8+(words>700?20:0)); const analysis=Math.min(100,35+Math.max(0,paras.length-1)*7+(evidence>3?20:0)); const organization=Math.min(100,35+(paras.length>=3?25:0)+(transitions>=3?20:0)+(sentences>8?15:0)); const consistency=Math.min(100,45+(sentences>5?20:0)+(paras.length>2?20:0)); return {words,paras:paras.length,sentences,scores:{Argument:argument,Evidence:evidenceScore,Analysis:analysis,Organization:organization,"Style consistency":consistency},tips:[words<500?"Add enough development to fully support your central claim.":null,evidence<2?"Add more concrete evidence, examples, or source material.":null,transitions<2?"Make the relationship between paragraphs and ideas more explicit.":null,paras<3?"Separate major claims into distinct body paragraphs.":null].filter(Boolean)} }
function EssayHealthModal({text,paperType,onClose}){const h=essayHealth(text,paperType);return <div className="mgn-modal-backdrop" onClick={onClose}><div className="mgn-modal mgn-health-modal" onClick={e=>e.stopPropagation()}><div className="mgn-modal-head"><div><div className="mgn-eyebrow">Essay health</div><h3>How your draft is developing</h3></div><button className="mgn-icon-btn" onClick={onClose}><X/></button></div><div className="mgn-health-grid">{Object.entries(h.scores).map(([k,v])=><div className="mgn-health-score" key={k}><span>{k}</span><b>{Math.round(v)}</b><div><i style={{width:`${v}%`}}/></div></div>)}</div><div className="mgn-health-meta"><span>{h.words.toLocaleString()} words</span><span>{h.paras} paragraphs</span><span>{h.sentences} sentences</span></div>{h.tips.length>0&&<div className="mgn-health-tips"><strong>Next things to look at</strong>{h.tips.map((x,i)=><p key={i}>• {x}</p>)}</div>}<p className="mgn-muted">These are descriptive signals, not a grade or prediction of a teacher's score.</p></div></div>}
function WritingCoachModal({profile,token,text,paperType,onClose}){const [q,setQ]=useState("");const [answer,setAnswer]=useState("");const [loading,setLoading]=useState(false); async function ask(prompt=q){if(!prompt.trim())return;setLoading(true);try{const a=await callGemini(`You are Marginal's writing coach. Help a student improve their own thinking without rewriting the whole essay for them. Ask guiding questions when useful. Be concise, specific, and supportive. Paper type: ${paperType}. Style profile: ${JSON.stringify(profile.styleProfile||{})}.`, `QUESTION: ${prompt}\nDRAFT:\n${text.slice(-7000)}`, token);setAnswer(a.trim())}catch{setAnswer("Marginal couldn't answer that right now.")}setLoading(false)}return <div className="mgn-modal-backdrop" onClick={onClose}><div className="mgn-modal mgn-coach-modal" onClick={e=>e.stopPropagation()}><div className="mgn-modal-head"><div><div className="mgn-eyebrow">Ask Marginal</div><h3>Your writing coach</h3></div><button className="mgn-icon-btn" onClick={onClose}><X/></button></div><div className="mgn-coach-prompts">{["Does my argument make sense?","Where am I repeating myself?","What evidence am I missing?","Is my thesis defensible?"].map(x=><button key={x} onClick={()=>{setQ(x);ask(x)}}>{x}</button>)}</div><textarea className="mgn-settings-textarea mgn-coach-input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask anything about this draft…"/><button className="mgn-btn-primary" onClick={()=>ask()} disabled={loading}>{loading?<Loader2 className="mgn-spin"/>:<MessageCircle/>} Ask Marginal</button>{answer&&<div className="mgn-coach-answer"><Brain size={18}/><p>{answer}</p></div>}</div></div>}

/* ================================================================
   GLOBAL STYLE
================================================================ */
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');

      .mgn-app {
        --mgn-paper: #FCFBF8;
        --mgn-paper-dim: #F3F1EA;
        --mgn-ink: #1B1D2A;
        --mgn-ink-soft: #5A5C6B;
        --mgn-coral: #FF4D6D;
        --mgn-coral-dim: #FFE1E6;
        --mgn-yellow: #FFC53D;
        --mgn-yellow-dim: #FFF3D6;
        --mgn-mint: #17B890;
        --mgn-mint-dim: #DCF5EE;
        --mgn-lilac: #7C6FF0;
        --mgn-lilac-dim: #EBE8FE;
        --mgn-line: #E4E1D8;
        font-family: 'Inter', sans-serif;
        background: var(--mgn-paper);
        color: var(--mgn-ink);
        min-height: 100vh;
        width: 100%;
      }
      .mgn-app * { box-sizing: border-box; }
      .mgn-app kbd {
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        background: var(--mgn-ink);
        color: var(--mgn-paper);
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 600;
      }

      h1, h2, h3, .mgn-logo { font-family: 'Fraunces', serif; }

      .mgn-btn-primary, .mgn-btn-ghost {
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        font-size: 14px;
        border-radius: 10px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: transform 0.12s ease, background 0.15s ease;
      }
      .mgn-btn-primary {
        background: var(--mgn-ink);
        color: var(--mgn-paper);
        border: none;
        padding: 10px 18px;
      }
      .mgn-btn-primary:hover:not(:disabled) { transform: translateY(-1px); background: #2A2D40; }
      .mgn-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
      .mgn-btn-lg { padding: 13px 24px; font-size: 15px; }
      .mgn-btn-sm { padding: 7px 12px; font-size: 13px; }
      .mgn-btn-ghost {
        background: transparent;
        color: var(--mgn-ink);
        border: 1.5px solid var(--mgn-line);
        padding: 9px 16px;
      }
      .mgn-btn-ghost:hover { border-color: var(--mgn-ink); }
      .mgn-icon-btn {
        background: transparent; border: none; cursor: pointer;
        color: var(--mgn-ink-soft); display: inline-flex; padding: 4px;
        border-radius: 6px;
      }
      .mgn-icon-btn:hover { color: var(--mgn-ink); background: var(--mgn-paper-dim); }

      .mgn-input {
        font-family: 'Inter', sans-serif;
        border: 1.5px solid var(--mgn-line);
        border-radius: 10px;
        padding: 11px 14px;
        font-size: 14px;
        width: 100%;
        outline: none;
      }
      .mgn-input:focus { border-color: var(--mgn-coral); }

      .mgn-toast {
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: var(--mgn-ink); color: var(--mgn-paper);
        padding: 11px 20px; border-radius: 10px; font-size: 14px;
        z-index: 999; font-family: 'Inter', sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      }

      .mgn-spin { animation: mgn-spin 0.8s linear infinite; }
      @keyframes mgn-spin { to { transform: rotate(360deg); } }

      /* ---------- Landing ---------- */
      .mgn-landing { max-width: 1180px; margin: 0 auto; padding: 28px 32px 0; }
      .mgn-nav { display: flex; justify-content: space-between; align-items: center; padding-bottom: 40px; }
      .mgn-logo { font-size: 22px; font-weight: 600; }
      .mgn-logo-sm { font-size: 18px; }
      .mgn-nav-actions { display: flex; gap: 10px; align-items: center; }
      .mgn-nav-links { display: flex; gap: 28px; font-size: 14.5px; color: var(--mgn-ink-soft); }
      .mgn-nav-links a { color: inherit; text-decoration: none; }
      .mgn-nav-links a:hover { color: var(--mgn-ink); }
      .mgn-logo-btn { background: none; border: none; cursor: pointer; padding: 0; font: inherit; }
      .mgn-section-title { font-size: 26px; margin: 0 0 30px; text-align: center; }

      .mgn-hero { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 56px; align-items: center; padding: 30px 0 60px; }
      .mgn-h1 { font-size: 68px; line-height: 0.98; font-weight: 600; margin: 0 0 22px; letter-spacing: -0.02em; }
      .mgn-lede { font-size: 18px; line-height: 1.55; color: var(--mgn-ink-soft); max-width: 460px; margin-bottom: 30px; }

      .mgn-demo-card {
        background: var(--mgn-ink); border-radius: 18px; padding: 28px;
        min-height: 230px; box-shadow: 0 20px 50px rgba(27,29,42,0.22);
        position: relative;
      }
      .mgn-demo-dots { display: flex; gap: 6px; margin-bottom: 22px; }
      .mgn-demo-dots span { width: 9px; height: 9px; border-radius: 50%; background: #3A3D52; }
      .mgn-demo-text {
        font-family: 'Fraunces', serif; font-size: 22px; line-height: 1.5;
        color: var(--mgn-paper); min-height: 90px;
      }
      .mgn-demo-ghost { color: var(--mgn-coral); transition: color 0.3s ease; }
      .mgn-demo-ghost-accepted { color: var(--mgn-paper); }
      .mgn-caret-blink { animation: mgn-blink 1s step-end infinite; color: var(--mgn-coral); }
      @keyframes mgn-blink { 50% { opacity: 0; } }
      .mgn-key-chip {
        position: absolute; bottom: 24px; right: 28px;
        font-size: 12px; color: #9A9CB0; display: flex; gap: 6px; align-items: center;
      }

      .mgn-notes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; padding: 20px 0 70px; }
      .mgn-note {
        border-radius: 4px; padding: 20px; font-size: 14.5px; line-height: 1.5;
        box-shadow: 0 10px 22px rgba(27,29,42,0.08);
      }
      .mgn-note-coral { background: var(--mgn-coral-dim); }
      .mgn-note-yellow { background: var(--mgn-yellow-dim); }
      .mgn-note-mint { background: var(--mgn-mint-dim); }
      .mgn-note-lilac { background: var(--mgn-lilac-dim); }
      .mgn-note strong { display: block; margin-top: 4px; }

      .mgn-footer { text-align: left; color: var(--mgn-ink-soft); font-size: 13px; padding: 24px 0 40px; border-top: 1px solid var(--mgn-line); }

      .mgn-how { padding: 60px 0; border-top: 1px solid var(--mgn-line); }
      .mgn-how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
      .mgn-how-step { text-align: center; padding: 10px; }
      .mgn-how-num {
        width: 36px; height: 36px; border-radius: 50%; background: var(--mgn-ink); color: var(--mgn-paper);
        display: flex; align-items: center; justify-content: center; font-weight: 600; margin: 0 auto 14px;
      }
      .mgn-how-step h3 { font-size: 17px; margin: 0 0 8px; }
      .mgn-how-step p { color: var(--mgn-ink-soft); font-size: 14.5px; line-height: 1.55; margin: 0; }

      .mgn-quotes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; padding: 50px 0; border-top: 1px solid var(--mgn-line); }
      .mgn-quote {
        margin: 0; font-family: 'Fraunces', serif; font-size: 17px; line-height: 1.5; font-style: italic;
        color: var(--mgn-ink); border-left: 3px solid var(--mgn-coral); padding-left: 16px;
      }

      .mgn-faq { padding: 60px 0; border-top: 1px solid var(--mgn-line); }
      .mgn-faq-list { max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
      .mgn-faq-item {
        border: 1.5px solid var(--mgn-line); border-radius: 12px; padding: 16px 20px; background: var(--mgn-paper-dim);
      }
      .mgn-faq-item summary { cursor: pointer; font-weight: 600; list-style: none; }
      .mgn-faq-item summary::-webkit-details-marker { display: none; }
      .mgn-faq-item summary::before { content: "+ "; color: var(--mgn-coral); }
      .mgn-faq-item[open] summary::before { content: "– "; }
      .mgn-faq-item p { margin: 10px 0 0; color: var(--mgn-ink-soft); font-size: 14.5px; line-height: 1.55; }

      .mgn-footer-full { border-top: 1px solid var(--mgn-line); padding: 50px 0 24px; }
      .mgn-footer-top { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 30px; padding-bottom: 30px; }
      .mgn-footer-brand p { max-width: 260px; margin-top: 10px; font-size: 13.5px; }
      .mgn-footer-heading { font-weight: 600; margin-bottom: 12px; font-size: 13.5px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--mgn-ink-soft); }
      .mgn-footer-col { display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
      .mgn-footer-col a { color: var(--mgn-ink-soft); text-decoration: none; }
      .mgn-footer-col a:hover { color: var(--mgn-ink); }
      .mgn-footer-link { background: none; border: none; padding: 0; text-align: left; cursor: pointer; color: var(--mgn-ink-soft); font-size: 14px; }
      .mgn-footer-link:hover { color: var(--mgn-ink); }
      .mgn-footer-bottom { border-top: 1px solid var(--mgn-line); padding-top: 18px; font-size: 12.5px; color: var(--mgn-ink-soft); }

      /* ---------- Login ---------- */
      .mgn-center-page { max-width: 480px; margin: 0 auto; padding: 40px 24px; }
      .mgn-back { margin-bottom: 24px; }
      .mgn-panel { background: var(--mgn-paper); }
      .mgn-h2 { font-size: 32px; font-weight: 600; margin: 0 0 8px; }
      .mgn-muted { color: var(--mgn-ink-soft); font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
      .mgn-mode-toggle { margin-bottom: 20px; display: inline-flex; }
      .mgn-auth-form { display: flex; flex-direction: column; gap: 10px; }
      .mgn-avatar {
        width: 26px; height: 26px; border-radius: 50%; background: var(--mgn-coral);
        color: white; display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700; flex-shrink: 0;
      }

      /* ---------- Onboarding ---------- */
      .mgn-onboarding { max-width: 1000px; margin: 0 auto; padding: 40px 32px 80px; }
      .mgn-onboard-head { margin-bottom: 28px; }
      .mgn-sample-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .mgn-sample-box {
        border: 1.5px solid var(--mgn-line); border-radius: 12px; padding: 12px;
        display: flex; flex-direction: column; background: white;
      }
      .mgn-sample-label {
        font-size: 12px; font-weight: 600; color: var(--mgn-ink-soft); margin-bottom: 8px;
        display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.03em;
      }
      .mgn-sample-textarea {
        border: none; outline: none; resize: vertical; min-height: 130px;
        font-family: 'Fraunces', serif; font-size: 14.5px; line-height: 1.5;
      }
      .mgn-add-sample {
        border: 1.5px dashed var(--mgn-line); border-radius: 12px; background: transparent;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        min-height: 130px; cursor: pointer; color: var(--mgn-ink-soft); font-size: 14px;
      }
      .mgn-add-sample:hover { border-color: var(--mgn-ink); color: var(--mgn-ink); }
      .mgn-onboard-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 26px; }
      .mgn-error { color: var(--mgn-coral); font-size: 13px; }

      /* ---------- Dashboard ---------- */
      .mgn-topbar {
        display: flex; justify-content: space-between; align-items: center;
        padding: 18px 32px; border-bottom: 1px solid var(--mgn-line);
      }
      .mgn-topbar-user { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
      .mgn-dash-grid { max-width: 1180px; margin: 0 auto; padding: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
      .mgn-style-card { grid-row: 1 / span 2; }
      .mgn-card { background: white; border: 1px solid var(--mgn-line); border-radius: 16px; padding: 24px; }
      .mgn-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .mgn-card-head h3 { font-size: 19px; margin: 0; font-weight: 600; }
      .mgn-pill-soft { font-size: 12px; color: var(--mgn-ink-soft); background: var(--mgn-paper-dim); padding: 4px 10px; border-radius: 20px; }
      .mgn-voice-summary { font-family: 'Fraunces', serif; font-size: 16px; line-height: 1.55; margin-bottom: 16px; }
      .mgn-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
      .mgn-tag { font-size: 12.5px; background: var(--mgn-coral-dim); color: #B8324C; padding: 5px 11px; border-radius: 20px; }

      .mgn-sliders { display: flex; flex-direction: column; gap: 16px; margin-bottom: 18px; }
      .mgn-slider-labels { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--mgn-ink-soft); margin-bottom: 4px; }
      .mgn-slider {
        -webkit-appearance: none; width: 100%; height: 5px; border-radius: 4px;
        background: var(--mgn-line); outline: none;
      }
      .mgn-slider::-webkit-slider-thumb {
        -webkit-appearance: none; width: 17px; height: 17px; border-radius: 50%;
        background: var(--mgn-coral); cursor: pointer; border: 3px solid white; box-shadow: 0 0 0 1px var(--mgn-coral);
      }
      .mgn-deep-btn { width: 100%; justify-content: center; margin-top: 4px; }
      .mgn-insights { margin-top: 18px; border-top: 1px solid var(--mgn-line); padding-top: 14px; }
      .mgn-insights-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--mgn-ink-soft); margin-bottom: 8px; }

      .mgn-voices-block { margin-top: 18px; border-top: 1px solid var(--mgn-line); padding-top: 14px; }
      .mgn-voice-chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .mgn-voice-chip {
        display: inline-flex; align-items: center; gap: 6px; font-size: 13px;
        background: var(--mgn-lilac-dim); color: #4A3FA8; padding: 6px 12px; border-radius: 20px; border: none;
      }
      .mgn-voice-chip-x { padding: 2px; color: #4A3FA8; }
      .mgn-voice-chip-add {
        cursor: pointer; background: var(--mgn-paper-dim); color: var(--mgn-ink-soft); border: 1.5px dashed var(--mgn-line);
      }
      .mgn-voice-chip-add:hover { border-color: var(--mgn-ink); color: var(--mgn-ink); }
      .mgn-voice-select {
        border: 1.5px solid var(--mgn-line); border-radius: 20px; padding: 8px 14px; font-size: 13.5px;
        background: white; color: var(--mgn-ink); cursor: pointer;
      }

      .mgn-stats-card { display: flex; flex-direction: column; }
      .mgn-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 6px; }
      .mgn-stat { text-align: center; background: var(--mgn-paper-dim); border-radius: 12px; padding: 16px 8px; }
      .mgn-stat-num { font-family: 'Fraunces', serif; font-size: 28px; font-weight: 600; color: var(--mgn-ink); }
      .mgn-stat-label { font-size: 12px; color: var(--mgn-ink-soft); margin-top: 4px; }
      .mgn-stats-sub { margin-top: 14px; font-size: 12.5px; color: var(--mgn-ink-soft); text-align: center; }

      .mgn-share-preview svg { width: 100%; height: auto; border-radius: 12px; display: block; }
      .mgn-share-actions { display: flex; gap: 10px; margin-top: 18px; }
      .mgn-share-actions button { flex: 1; justify-content: center; }
      .mgn-insight-row { font-size: 13.5px; line-height: 1.5; color: var(--mgn-ink); margin-bottom: 4px; }

      .mgn-empty { color: var(--mgn-ink-soft); font-size: 14px; padding: 20px 0; }
      .mgn-draft-list { display: flex; flex-direction: column; gap: 10px; }
      .mgn-draft-row {
        text-align: left; border: 1px solid var(--mgn-line); border-radius: 12px; padding: 14px;
        background: transparent; cursor: pointer;
      }
      .mgn-draft-row:hover { border-color: var(--mgn-ink); }
      .mgn-draft-title { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; margin-bottom: 4px; }
      .mgn-draft-snippet { font-size: 13px; color: var(--mgn-ink-soft); margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mgn-draft-meta { font-size: 11.5px; color: #9A9CB0; }

      .mgn-modal-backdrop { position: fixed; inset: 0; background: rgba(27,29,42,0.45); display: flex; align-items: center; justify-content: center; z-index: 200; }
      .mgn-modal { background: white; border-radius: 16px; padding: 26px; width: 560px; max-width: 90vw; }
      .mgn-modal-wide { width: 760px; max-height: 85vh; overflow-y: auto; }
      .mgn-sample-remove { margin-left: auto; }
      .mgn-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
      .mgn-modal-head h3 { margin: 0; font-size: 20px; }
      .mgn-modal-textarea {
        width: 100%; min-height: 220px; border: 1.5px solid var(--mgn-line); border-radius: 10px;
        padding: 12px; font-family: 'Fraunces', serif; font-size: 14px; margin: 14px 0; resize: vertical;
      }


      /* ---------- Stats ---------- */
      .mgn-topbar-link { display:inline-flex; align-items:center; gap:6px; border:0; background:transparent; color:var(--mgn-ink-soft); font-size:13px; font-weight:600; cursor:pointer; padding:7px 9px; border-radius:9px; }
      .mgn-topbar-link:hover { background:var(--mgn-paper-dim); color:var(--mgn-ink); }
      .mgn-stats-nav { display:flex; align-items:center; gap:14px; }
      .mgn-stats-page { max-width:1180px; margin:0 auto; padding:42px 32px 70px; }
      .mgn-stats-hero { display:flex; justify-content:space-between; align-items:center; gap:24px; margin-bottom:28px; }
      .mgn-eyebrow { text-transform:uppercase; letter-spacing:.1em; font-size:11px; font-weight:800; color:var(--mgn-coral); margin-bottom:5px; }
      .mgn-stats-hero h1 { font-family:'Fraunces',serif; font-size:42px; margin:0 0 7px; }
      .mgn-stats-hero p { color:var(--mgn-ink-soft); max-width:690px; margin:0; line-height:1.55; }
      .mgn-stats-hero-icon { width:64px; height:64px; border-radius:20px; display:grid; place-items:center; background:var(--mgn-lilac-dim); color:#5d50c6; flex:0 0 auto; }
      .mgn-big-stat-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin-bottom:24px; }
      .mgn-big-stat { min-height:126px; border-radius:16px; padding:18px; display:flex; flex-direction:column; justify-content:space-between; border:1px solid var(--mgn-line); }
      .mgn-big-stat svg { width:20px; height:20px; }
      .mgn-big-stat strong { font-family:'Fraunces',serif; font-size:27px; line-height:1.05; margin-top:10px; }
      .mgn-big-stat span { font-size:11.5px; color:var(--mgn-ink-soft); }
      .mgn-big-stat.coral { background:var(--mgn-coral-dim); color:#a62f48; } .mgn-big-stat.mint { background:var(--mgn-mint-dim); color:#267b67; } .mgn-big-stat.lilac { background:var(--mgn-lilac-dim); color:#574bb3; } .mgn-big-stat.gold { background:#fff4d7; color:#9b6a10; } .mgn-big-stat.blue { background:#e8f1ff; color:#3565a6; } .mgn-big-stat.rose { background:#fbeaf1; color:#a64a72; }
      .mgn-stats-layout { display:grid; grid-template-columns:minmax(0,2fr) minmax(300px,1fr); gap:18px; margin-bottom:18px; }
      .mgn-chart-card { min-height:330px; } .mgn-card-sub { color:var(--mgn-ink-soft); font-size:12.5px; margin:4px 0 0; }
      .mgn-range { display:flex; gap:3px; background:var(--mgn-paper-dim); padding:3px; border-radius:10px; } .mgn-range button { border:0; background:transparent; padding:6px 9px; border-radius:7px; font-size:11px; cursor:pointer; color:var(--mgn-ink-soft); } .mgn-range button.active { background:white; color:var(--mgn-ink); box-shadow:0 1px 3px rgba(0,0,0,.08); }
      .mgn-bar-chart { height:225px; display:flex; align-items:flex-end; gap:5px; padding-top:18px; } .mgn-bar-col { flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px; min-width:0; } .mgn-bar { width:100%; max-width:24px; min-height:4px; border-radius:6px 6px 2px 2px; background:var(--mgn-coral); transition:height .25s ease; } .mgn-bar-col span { font-size:9px; color:#9a9cb0; }
      .mgn-goal-card { background:linear-gradient(135deg,#fff,#f8f5ff); } .mgn-goal-number { font-family:'Fraunces',serif; font-size:34px; margin:22px 0 12px; } .mgn-goal-number span { font-family:inherit; font-size:17px; color:var(--mgn-ink-soft); } .mgn-progress,.mgn-meter-track { height:10px; border-radius:10px; background:var(--mgn-paper-dim); overflow:hidden; } .mgn-progress div { height:100%; background:var(--mgn-mint); border-radius:inherit; } .mgn-goal-foot { display:flex; justify-content:space-between; align-items:center; margin-top:12px; font-size:11.5px; color:var(--mgn-ink-soft); } .mgn-goal-foot input { width:88px; border:1px solid var(--mgn-line); border-radius:8px; padding:5px 7px; }
      .mgn-heatmap { display:grid; grid-template-columns:repeat(21,1fr); gap:5px; padding-top:12px; } .mgn-heat { aspect-ratio:1; border-radius:4px; background:var(--mgn-mint); min-width:7px; } .mgn-heat-legend { display:flex; justify-content:flex-end; align-items:center; gap:5px; margin-top:10px; color:#9a9cb0; font-size:10px; } .mgn-heat-legend i { width:10px; height:10px; border-radius:3px; background:var(--mgn-mint); opacity:.3; } .mgn-heat-legend i:nth-of-type(2){opacity:.5}.mgn-heat-legend i:nth-of-type(3){opacity:.7}.mgn-heat-legend i:nth-of-type(4){opacity:1}
      .mgn-suggestion-meter { margin:20px 0 14px; } .mgn-meter-track { height:14px; } .mgn-meter-track .accepted { height:100%; background:var(--mgn-lilac); } .mgn-meter-labels { display:flex; justify-content:space-between; font-size:11px; color:var(--mgn-ink-soft); margin-top:8px; } .mgn-suggestion-big { font-family:'Fraunces',serif; font-size:29px; } .mgn-suggestion-big small { font-family:inherit; font-size:13px; color:var(--mgn-ink-soft); }
      .mgn-type-list { display:flex; flex-direction:column; gap:15px; } .mgn-type-row { display:grid; grid-template-columns:190px 1fr 45px; gap:14px; align-items:center; } .mgn-type-name { display:flex; flex-direction:column; gap:3px; } .mgn-type-name span { font-weight:600; font-size:13px; } .mgn-type-name small { font-size:10.5px; color:var(--mgn-ink-soft); } .mgn-type-track,.mgn-trait-track { height:8px; background:var(--mgn-paper-dim); border-radius:10px; overflow:hidden; } .mgn-type-track div { height:100%; background:var(--mgn-coral); border-radius:inherit; } .mgn-type-row strong { font-size:12px; text-align:right; color:var(--mgn-ink-soft); }
      .mgn-record-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; } .mgn-record-grid > div { border-radius:12px; padding:15px; background:var(--mgn-paper-dim); min-height:105px; display:flex; flex-direction:column; gap:7px; } .mgn-record-grid svg { width:17px; height:17px; color:var(--mgn-coral); } .mgn-record-grid b { font-family:'Fraunces',serif; font-size:20px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .mgn-record-grid span { font-size:10.5px; color:var(--mgn-ink-soft); }
      .mgn-trait-list { display:flex; flex-direction:column; gap:16px; padding-top:4px; } .mgn-trait-stat > div:first-child { display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px; } .mgn-trait-stat b { font-size:11px; color:var(--mgn-coral); } .mgn-trait-track div { height:100%; background:var(--mgn-coral); border-radius:inherit; }
      .mgn-insight-banner { display:flex; gap:15px; align-items:flex-start; background:var(--mgn-mint-dim); margin-top:18px; } .mgn-insight-banner svg { color:#267b67; flex:0 0 auto; } .mgn-insight-banner h3 { margin:0 0 5px; font-size:15px; } .mgn-insight-banner p { margin:0; color:var(--mgn-ink-soft); font-size:12px; line-height:1.5; }
      @media (max-width:1050px){ .mgn-big-stat-grid{grid-template-columns:repeat(3,1fr)} }
      @media (max-width:760px){ .mgn-profile-traits,.mgn-profile-columns{grid-template-columns:1fr}.mgn-version-selects{grid-template-columns:1fr}.mgn-version-selects > svg{display:none}.mgn-stats-page{padding:28px 18px 50px}.mgn-stats-hero{align-items:flex-start}.mgn-stats-hero h1{font-size:34px}.mgn-big-stat-grid{grid-template-columns:repeat(2,1fr)}.mgn-stats-layout{grid-template-columns:1fr}.mgn-type-row{grid-template-columns:1fr 70px}.mgn-type-track{grid-column:1 / 2}.mgn-type-row strong{grid-column:2;grid-row:1}.mgn-record-grid{grid-template-columns:repeat(2,1fr)}.mgn-topbar{padding:16px 18px}.mgn-stats-nav{gap:5px}.mgn-topbar-user{font-size:12px}.mgn-topbar-link{font-size:11px} }

      /* ---------- Voice profile ---------- */
      .mgn-profile-modal { max-width: 760px; }
      .mgn-profile-summary { font-family:'Fraunces',serif; font-size:18px; line-height:1.55; margin:8px 0 22px; }
      .mgn-profile-traits { display:grid; grid-template-columns:1fr 1fr; gap:16px 22px; }
      .mgn-profile-trait > div:first-child { display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px; }
      .mgn-profile-trait b { color:var(--mgn-coral); }
      .mgn-profile-trait small { display:block; margin-top:5px; color:var(--mgn-ink-soft); font-size:10px; }
      .mgn-profile-columns { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:24px; padding-top:20px; border-top:1px solid var(--mgn-line); }
      .mgn-profile-columns h4,.mgn-profile-openers h4 { margin:0 0 10px; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
      .mgn-profile-columns ul { margin:0; padding-left:18px; color:var(--mgn-ink-soft); font-size:12px; line-height:1.7; }
      .mgn-profile-openers { margin-top:20px; }
      .mgn-profile-openers span { display:inline-block; padding:8px 10px; border-radius:9px; background:var(--mgn-paper-dim); margin:0 7px 7px 0; font-family:'Fraunces',serif; font-size:13px; }
      .mgn-profile-note { display:flex; gap:9px; align-items:flex-start; margin-top:20px; padding:11px 12px; border-radius:10px; background:var(--mgn-mint-dim); color:var(--mgn-ink-soft); font-size:11.5px; line-height:1.5; }
      .mgn-profile-note svg { flex:0 0 auto; color:#267b67; }

      /* ---------- Version history ---------- */
      .mgn-version-modal { max-width:920px; }
      .mgn-version-selects { display:grid; grid-template-columns:1fr auto 1fr; gap:12px; align-items:end; margin:20px 0 14px; }
      .mgn-version-selects label { display:flex; flex-direction:column; gap:6px; font-size:11px; color:var(--mgn-ink-soft); font-weight:700; }
      .mgn-version-selects select { border:1px solid var(--mgn-line); border-radius:9px; padding:9px; background:white; color:var(--mgn-ink); font-size:12px; }
      .mgn-version-summary { display:flex; gap:14px; align-items:center; padding:10px 12px; background:var(--mgn-paper-dim); border-radius:9px; font-size:11px; color:var(--mgn-ink-soft); }
      .mgn-added { color:#16866d; font-weight:700; }.mgn-removed { color:var(--mgn-coral); font-weight:700; }
      .mgn-diff-box { margin-top:12px; border:1px solid var(--mgn-line); border-radius:12px; padding:18px; max-height:430px; overflow:auto; background:#fff; font-family:'Fraunces',serif; font-size:16px; line-height:1.8; }
      .mgn-diff-added { background:var(--mgn-mint-dim); text-decoration:underline; text-decoration-color:#17B890; }.mgn-diff-removed { background:var(--mgn-coral-dim); text-decoration:line-through; text-decoration-color:var(--mgn-coral); }
      .mgn-empty-state { text-align:center; padding:45px 20px; color:var(--mgn-ink-soft); }.mgn-empty-state svg { color:var(--mgn-lilac); }.mgn-empty-state p { font-size:13px; }

      /* ---------- Suggestion explanation ---------- */
      .mgn-why-btn { border:1px solid var(--mgn-line); background:var(--mgn-lilac-dim); color:var(--mgn-ink); border-radius:8px; padding:5px 8px; display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; cursor:pointer; }
      .mgn-why-btn:disabled { opacity:.55; cursor:wait; }
      .mgn-suggestion-why { display:flex; gap:10px; align-items:flex-start; margin-top:12px; padding:12px 13px; border-radius:10px; background:var(--mgn-lilac-dim); color:var(--mgn-ink); }
      .mgn-suggestion-why > svg { flex:0 0 auto; color:var(--mgn-lilac); margin-top:2px; }.mgn-suggestion-why > div { flex:1; }.mgn-suggestion-why strong { font-size:11px; }.mgn-suggestion-why p { margin:4px 0 0; font-size:11.5px; line-height:1.45; color:var(--mgn-ink-soft); }


      /* ---------- Library / Outline / Profile pages ---------- */
      .mgn-page-hero { display:flex; justify-content:space-between; align-items:center; gap:24px; margin-bottom:28px; }
      .mgn-page-hero h1 { font-size:42px; margin:0 0 7px; }
      .mgn-page-hero p { margin:0; color:var(--mgn-ink-soft); max-width:700px; line-height:1.55; }
      .mgn-page-hero-art { color:var(--mgn-lilac); background:var(--mgn-lilac-dim); padding:10px; border-radius:18px; box-sizing:content-box; }
      .mgn-library-page,.mgn-outline-page,.mgn-profile-page { min-height:100vh; }
      .mgn-library-main,.mgn-outline-main,.mgn-profile-main { max-width:1180px; margin:0 auto; padding:42px 32px 70px; }
      .mgn-library-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:18px; flex-wrap:wrap; }
      .mgn-search { display:flex; align-items:center; gap:8px; flex:1; min-width:220px; border:1px solid var(--mgn-line); border-radius:11px; padding:9px 12px; background:white; }
      .mgn-search input { border:0; outline:0; flex:1; font:inherit; font-size:13px; }
      .mgn-library-toolbar select,.mgn-outline-field-row select { border:1px solid var(--mgn-line); border-radius:10px; padding:10px 12px; background:white; color:var(--mgn-ink); }
      .mgn-library-count { font-size:11px; color:var(--mgn-ink-soft); }
      .mgn-library-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:15px; }
      .mgn-library-card { border:1px solid var(--mgn-line); border-radius:15px; background:white; overflow:hidden; }
      .mgn-library-open { width:100%; text-align:left; background:transparent; border:0; padding:18px; cursor:pointer; }
      .mgn-library-card:hover { border-color:var(--mgn-ink); box-shadow:0 8px 22px rgba(27,29,42,.05); }
      .mgn-library-card-top { display:flex; justify-content:space-between; gap:8px; font-size:10px; color:var(--mgn-ink-soft); }
      .mgn-library-type { color:var(--mgn-coral); font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
      .mgn-library-card h3 { font-family:'Fraunces',serif; font-size:22px; margin:12px 0 6px; }
      .mgn-library-card p { color:var(--mgn-ink-soft); font-size:12.5px; line-height:1.5; min-height:38px; max-height:58px; overflow:hidden; }
      .mgn-library-meta { color:#9A9CB0; font-size:10.5px; margin-top:12px; }
      .mgn-library-actions { display:flex; border-top:1px solid var(--mgn-line); }
      .mgn-library-actions button { flex:1; border:0; border-right:1px solid var(--mgn-line); background:var(--mgn-paper); padding:9px 6px; font-size:11px; display:flex; justify-content:center; align-items:center; gap:5px; cursor:pointer; }
      .mgn-library-actions button:last-child { border-right:0; }.mgn-library-actions .danger { color:var(--mgn-coral); }
      .mgn-outline-actions { display:flex; gap:8px; flex-wrap:wrap; }
      .mgn-outline-shell { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(300px,.8fr); gap:18px; align-items:start; }
      .mgn-outline-form,.mgn-outline-preview { background:white; border:1px solid var(--mgn-line); border-radius:16px; padding:20px; }
      .mgn-outline-field-row { display:grid; grid-template-columns:1fr 220px; gap:10px; }
      .mgn-outline-thesis { margin:18px 0; }.mgn-outline-thesis label { display:block; font-size:11px; font-weight:800; text-transform:uppercase; color:var(--mgn-ink-soft); margin-bottom:7px; }
      .mgn-outline-thesis textarea { width:100%; min-height:100px; resize:vertical; border:1px solid var(--mgn-line); border-radius:10px; padding:12px; font:15px/1.5 'Fraunces',serif; outline:none; }
      .mgn-outline-section { border:1px solid var(--mgn-line); border-radius:13px; padding:15px; margin-bottom:12px; background:var(--mgn-paper); }
      .mgn-outline-section-head { display:flex; gap:8px; align-items:center; }.mgn-outline-section-head input { flex:1; border:0; background:transparent; font:600 18px 'Fraunces',serif; outline:0; }
      .mgn-outline-purpose { width:100%; border:0; background:transparent; color:var(--mgn-ink-soft); font-size:11.5px; padding:5px 0 10px; outline:0; }
      .mgn-bullet-row { display:flex; gap:8px; align-items:center; margin:7px 0; }.mgn-bullet-row span { color:var(--mgn-coral); }.mgn-bullet-row input { flex:1; border:1px solid var(--mgn-line); border-radius:8px; padding:8px 9px; font-size:12px; outline:0; background:white; }
      .mgn-add-bullet,.mgn-add-section { border:0; background:transparent; color:var(--mgn-ink-soft); font-size:11px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; padding:5px 0; }.mgn-add-section { margin-top:2px; font-weight:700; color:var(--mgn-lilac); }
      .mgn-outline-preview { position:sticky; top:18px; }.mgn-outline-tree { margin-top:18px; display:flex; flex-direction:column; gap:10px; }.mgn-outline-tree .root { font:600 20px 'Fraunces',serif; padding-bottom:10px; border-bottom:1px solid var(--mgn-line); }.mgn-outline-tree .branch { border-left:3px solid var(--mgn-lilac); padding:5px 0 5px 12px; display:flex; flex-direction:column; gap:4px; }.mgn-outline-tree .branch b { font-size:12px; }.mgn-outline-tree .branch span { color:var(--mgn-ink-soft); font-size:11.5px; line-height:1.45; }
      .mgn-profile-main .mgn-page-hero { margin-bottom:22px; }.mgn-profile-page-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }.mgn-profile-page-grid .mgn-card h3 { margin-top:0; }
      @media(max-width:800px){.mgn-library-grid,.mgn-outline-shell,.mgn-profile-page-grid{grid-template-columns:1fr}.mgn-outline-preview{position:static}.mgn-outline-field-row{grid-template-columns:1fr}.mgn-page-hero{align-items:flex-start;flex-direction:column}.mgn-library-main,.mgn-outline-main,.mgn-profile-main{padding:28px 18px 55px}}

      /* ---------- Editor ---------- */
      .mgn-editor { max-width: 1440px; margin: 0 auto; padding: 20px 32px 60px; }
      .mgn-editor-top { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
      .mgn-title-input {
        font-family: 'Fraunces', serif; font-size: 21px; font-weight: 600; border: none; outline: none;
        flex: 1; min-width: 120px; background: transparent;
      }
      .mgn-editor-body { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 22px; align-items: start; }
      .mgn-editor-main { min-width: 0; }
      .mgn-paper-select-top { border: 1.5px solid var(--mgn-line); border-radius: 20px; padding: 8px 14px; font-size: 13.5px; background: white; color: var(--mgn-ink); cursor: pointer; max-width: 190px; }
      .mgn-writing-guide { position: sticky; top: 18px; border: 1px solid var(--mgn-line); border-radius: 16px; background: white; overflow: hidden; max-height: calc(100vh - 40px); box-shadow: 0 10px 28px rgba(27,29,42,0.06); }
      .mgn-writing-guide-collapsed { width: 72px; justify-self: end; }
      .mgn-guide-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 15px 16px; border-bottom: 1px solid var(--mgn-line); }
      .mgn-writing-guide-collapsed .mgn-guide-header { border-bottom: none; justify-content: center; padding: 12px; }
      .mgn-guide-kicker { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--mgn-ink-soft); font-weight: 700; }
      .mgn-guide-title { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; margin-top: 2px; }
      .mgn-guide-toggle { border: 1px solid var(--mgn-line); background: var(--mgn-paper-dim); border-radius: 9px; padding: 7px 10px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--mgn-ink); }
      .mgn-guide-content { padding: 15px 16px 18px; overflow-y: auto; max-height: calc(100vh - 108px); }
      .mgn-paper-select { width: 100%; border: 1.5px solid var(--mgn-line); border-radius: 10px; padding: 9px 11px; font-size: 13px; background: white; color: var(--mgn-ink); cursor: pointer; }
      .mgn-guide-subtitle { color: var(--mgn-ink-soft); font-size: 12.5px; line-height: 1.45; margin: 9px 0 16px; }
      .mgn-guide-section-title { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; font-weight: 700; color: var(--mgn-ink-soft); margin: 16px 0 9px; }
      .mgn-guide-steps, .mgn-guide-score-list { display: flex; flex-direction: column; gap: 8px; }
      .mgn-guide-step, .mgn-guide-score { border: 1px solid var(--mgn-line); border-radius: 10px; padding: 10px 11px; background: var(--mgn-paper); }
      .mgn-guide-step-title { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
      .mgn-guide-step-body { font-size: 12px; line-height: 1.48; color: var(--mgn-ink-soft); }
      .mgn-guide-score-top { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; margin-bottom: 4px; font-size: 13px; }
      .mgn-guide-score-top span { font-size: 11px; font-weight: 700; color: var(--mgn-coral); white-space: nowrap; }
      .mgn-guide-note { margin-top: 12px; padding: 10px 11px; border-radius: 10px; background: var(--mgn-mint-dim); font-size: 11.5px; line-height: 1.45; color: var(--mgn-ink); }
      .mgn-tone-toggle { display: flex; background: var(--mgn-paper-dim); border-radius: 20px; padding: 3px; }
      .mgn-tone-pill { border: none; background: transparent; padding: 6px 13px; border-radius: 16px; font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--mgn-ink-soft); }
      .mgn-tone-pill-active { background: var(--mgn-ink); color: white; }

      .mgn-write-area { position: relative; border: 1.5px solid var(--mgn-line); border-radius: 14px; background: white; }
      .mgn-overlay, .mgn-textarea {
        font-family: 'Fraunces', serif; font-size: 19px; line-height: 1.7;
        padding: 30px 34px; white-space: pre-wrap; word-wrap: break-word;
        min-height: 650px; max-height: 72vh; overflow-y: auto;
      }
      .mgn-overlay {
        position: absolute; inset: 0; pointer-events: none; color: var(--mgn-ink); margin: 0;
      }
      .mgn-ghost { color: var(--mgn-coral); }
      .mgn-textarea {
        position: relative; width: 100%; border: none; outline: none; resize: none;
        background: transparent; color: transparent; caret-color: var(--mgn-ink);
      }
      .mgn-editor-hint {
        display: flex; gap: 18px; align-items: center; margin-top: 14px; font-size: 12.5px; color: var(--mgn-ink-soft); flex-wrap: wrap;
      }
      .mgn-editor-hint kbd { margin: 0 2px; }
      .mgn-thinking { display: flex; align-items: center; gap: 6px; color: var(--mgn-coral); }
      .mgn-alt-count { margin-left: auto; }

      @media (max-width: 980px) {
        .mgn-editor-body { grid-template-columns: 1fr; }
        .mgn-writing-guide { position: static; max-height: none; }
        .mgn-guide-content { max-height: 520px; }
        .mgn-writing-guide-collapsed { width: 100%; justify-self: stretch; }
      }

      @media (max-width: 860px) {
        .mgn-hero { grid-template-columns: 1fr; }
        .mgn-notes { grid-template-columns: repeat(2, 1fr); }
        .mgn-dash-grid { grid-template-columns: 1fr; }
        .mgn-sample-grid { grid-template-columns: 1fr; }
        .mgn-h1 { font-size: 48px; }
      }

      /* ---------- Marginal visual refresh ---------- */
      .mgn-app {
        --mgn-purple:#7567F8; --mgn-purple-deep:#5648D9; --mgn-blue:#4F8CFF;
        --mgn-pink:#F36AA8; --mgn-orange:#FF9A4D; --mgn-green:#19B887;
        background:
          radial-gradient(circle at 8% 4%, rgba(117,103,248,.10), transparent 24rem),
          radial-gradient(circle at 92% 18%, rgba(79,140,255,.08), transparent 22rem),
          var(--mgn-paper);
      }
      .mgn-app button { -webkit-tap-highlight-color:transparent; }
      .mgn-btn-primary { background:linear-gradient(135deg,var(--mgn-purple),#927FFF); border:0; box-shadow:0 7px 18px rgba(117,103,248,.20); }
      .mgn-btn-primary:hover { transform:translateY(-1px); box-shadow:0 10px 22px rgba(117,103,248,.26); }
      .mgn-btn-ghost:hover { border-color:rgba(117,103,248,.35); background:rgba(117,103,248,.07); }
      .mgn-topbar { position:sticky; top:0; z-index:100; background:rgba(252,251,248,.88); backdrop-filter:blur(16px); border-bottom:1px solid rgba(228,225,216,.8); box-shadow:0 4px 20px rgba(30,25,70,.035); }
      .mgn-topbar .mgn-logo { color:var(--mgn-purple-deep); }
      .mgn-topbar-link { transition:all .16s ease; }
      .mgn-topbar-link:hover { color:var(--mgn-purple-deep); background:rgba(117,103,248,.09); transform:translateY(-1px); }
      .mgn-avatar { background:linear-gradient(135deg,var(--mgn-purple),var(--mgn-pink)) !important; color:#fff !important; box-shadow:0 4px 12px rgba(117,103,248,.18); }
      .mgn-page-hero, .mgn-stats-hero { position:relative; }
      .mgn-page-hero h1, .mgn-stats-hero h1 { letter-spacing:-.035em; }
      .mgn-page-hero:after { content:""; position:absolute; right:12%; top:-12px; width:90px; height:90px; border-radius:50%; background:linear-gradient(135deg,rgba(117,103,248,.10),rgba(243,106,168,.06)); filter:blur(2px); pointer-events:none; }
      .mgn-card { border:1px solid rgba(228,225,216,.95); box-shadow:0 12px 30px rgba(35,28,70,.045); transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease; }
      .mgn-card:hover { box-shadow:0 16px 38px rgba(35,28,70,.07); border-color:rgba(117,103,248,.18); }
      .mgn-dash { position:relative; }
      .mgn-dash > .mgn-dash-grid { position:relative; }
      .mgn-dash-grid > .mgn-card:nth-child(1) { background:linear-gradient(145deg,#fff,#f6f3ff); border-color:#e5e0ff; }
      .mgn-dash-grid > .mgn-card:nth-child(2) { background:linear-gradient(145deg,#fff,#f2f8ff); border-color:#dfeaff; }
      .mgn-dash-grid > .mgn-card:nth-child(3) { background:linear-gradient(145deg,#fff,#fff5f7); border-color:#f7dfe6; }
      .mgn-dash-grid > .mgn-card:nth-child(4) { background:linear-gradient(145deg,#fff,#f1fbf7); border-color:#d9f1e8; }
      .mgn-draft-row { background:rgba(255,255,255,.72); transition:all .16s ease; }
      .mgn-draft-row:hover { transform:translateX(3px); border-color:rgba(117,103,248,.35); background:#fff; box-shadow:0 7px 18px rgba(35,28,70,.05); }
      .mgn-stat { transition:transform .16s ease,box-shadow .16s ease; border:1px solid rgba(228,225,216,.7); }
      .mgn-stat:nth-child(1){background:#eeeaff}.mgn-stat:nth-child(2){background:#eaf3ff}.mgn-stat:nth-child(3){background:#fff0f3}.mgn-stat:nth-child(4){background:#e8faf4}
      .mgn-stat:hover { transform:translateY(-2px); box-shadow:0 7px 18px rgba(35,28,70,.07); }
      .mgn-big-stat { border:1px solid rgba(255,255,255,.75); box-shadow:0 8px 22px rgba(35,28,70,.035); transition:transform .18s ease,box-shadow .18s ease; }
      .mgn-big-stat:hover { transform:translateY(-3px); box-shadow:0 13px 28px rgba(35,28,70,.08); }
      .mgn-big-stat.coral{background:linear-gradient(145deg,#ffe6eb,#fff4f6)} .mgn-big-stat.mint{background:linear-gradient(145deg,#ddf7ef,#f4fffb)} .mgn-big-stat.lilac{background:linear-gradient(145deg,#eae7ff,#f7f5ff)} .mgn-big-stat.gold{background:linear-gradient(145deg,#fff1cb,#fffaf0)} .mgn-big-stat.blue{background:linear-gradient(145deg,#e5f0ff,#f5f9ff)} .mgn-big-stat.rose{background:linear-gradient(145deg,#f9e5ef,#fff6fa)}
      .mgn-range button.active { background:linear-gradient(135deg,#fff,#f0edff); color:var(--mgn-purple-deep); }
      .mgn-bar { background:linear-gradient(180deg,#8c7fff,var(--mgn-purple)); }
      .mgn-goal-card { background:linear-gradient(135deg,#fff,#f0edff,#eef7ff) !important; border-color:#dfd9ff; }
      .mgn-progress div { background:linear-gradient(90deg,var(--mgn-green),#65d5b2); }
      .mgn-heat { background:var(--mgn-green); }
      .mgn-record-grid > div { transition:transform .16s ease; }
      .mgn-record-grid > div:hover { transform:translateY(-2px); background:#eeeaff; }
      .mgn-trait-track div { background:linear-gradient(90deg,var(--mgn-pink),var(--mgn-purple)); }
      .mgn-type-track div { background:linear-gradient(90deg,var(--mgn-orange),var(--mgn-coral)); }
      .mgn-suggestion-meter .accepted { background:linear-gradient(90deg,var(--mgn-purple),var(--mgn-pink)) !important; }
      .mgn-write-area { border-color:#ddd8f8; box-shadow:0 18px 45px rgba(64,48,130,.06); overflow:hidden; }
      .mgn-write-area:focus-within { border-color:rgba(117,103,248,.55); box-shadow:0 20px 50px rgba(117,103,248,.10); }
      .mgn-ghost { color:var(--mgn-purple) !important; background:rgba(117,103,248,.055); border-radius:4px; }
      .mgn-writing-guide { border-color:#ded9fa; box-shadow:0 14px 34px rgba(64,48,130,.07); }
      .mgn-guide-header { background:linear-gradient(135deg,#f8f6ff,#fff); }
      .mgn-guide-step:nth-child(4n+1){background:#f2efff;border-color:#e4defe}.mgn-guide-step:nth-child(4n+2){background:#eef6ff;border-color:#dfeaff}.mgn-guide-step:nth-child(4n+3){background:#fff3f6;border-color:#f7dfe8}.mgn-guide-step:nth-child(4n){background:#effbf7;border-color:#d9f1e8}
      .mgn-guide-score { background:#fffaf0; border-color:#f5e5bf; }
      .mgn-guide-note { background:linear-gradient(135deg,#e9f9f4,#f2efff); }
      .mgn-page-hero-art { background:linear-gradient(135deg,#eae7ff,#ffeaf2) !important; color:var(--mgn-purple-deep) !important; box-shadow:0 10px 25px rgba(117,103,248,.10); }
      .mgn-library-grid .mgn-card { background:rgba(255,255,255,.8); }
      .mgn-library-grid .mgn-card:nth-child(3n+1) { border-top:3px solid var(--mgn-purple); }
      .mgn-library-grid .mgn-card:nth-child(3n+2) { border-top:3px solid var(--mgn-blue); }
      .mgn-library-grid .mgn-card:nth-child(3n) { border-top:3px solid var(--mgn-orange); }
      .mgn-outline-section { background:linear-gradient(145deg,#fff,#faf9ff); border-color:#e3defb; box-shadow:0 8px 20px rgba(35,28,70,.035); }
      .mgn-outline-section:nth-child(3n+1){border-left:4px solid var(--mgn-purple)}.mgn-outline-section:nth-child(3n+2){border-left:4px solid var(--mgn-blue)}.mgn-outline-section:nth-child(3n){border-left:4px solid var(--mgn-orange)}
      .mgn-outline-tree .branch { border-left-color:var(--mgn-purple); background:rgba(117,103,248,.035); border-radius:0 10px 10px 0; }
      .mgn-profile-page-grid .mgn-card:first-child { background:linear-gradient(145deg,#fff,#f7f3ff); border-top:4px solid var(--mgn-pink); }
      .mgn-profile-page-grid .mgn-card:last-child { background:linear-gradient(145deg,#fff,#eef7ff); border-top:4px solid var(--mgn-blue); }
      .mgn-profile-trait { padding:10px; border-radius:12px; background:rgba(255,255,255,.72); }
      .mgn-tag { background:#eeeaff !important; color:#5849c6 !important; border:1px solid #ddd6ff; }
      .mgn-profile-openers span { background:#fff0f5 !important; border-color:#f5d6e3 !important; }
      .mgn-toast { background:linear-gradient(135deg,#24213a,#4d43a8) !important; box-shadow:0 12px 30px rgba(60,45,130,.25) !important; }
      .mgn-empty { padding:28px 20px; border:1px dashed #dcd7f5; border-radius:14px; background:linear-gradient(135deg,#faf9ff,#fff); }
      @media(max-width:760px){.mgn-topbar{overflow-x:auto}.mgn-topbar-user{min-width:max-content}.mgn-page-hero:after{display:none}}

      .mgn-outline-card{background:rgba(255,255,255,.86);border:1px solid var(--mgn-line);border-radius:18px;padding:22px;margin-bottom:18px;box-shadow:0 10px 28px rgba(40,35,80,.06)}
      .mgn-outline-field-row{margin-bottom:30px;align-items:end}
      .mgn-outline-field-row .mgn-input,.mgn-outline-field-row select{min-height:46px}
      .mgn-outline-intro{margin-top:4px}
      .mgn-outline-section-title{display:flex;gap:14px;align-items:flex-start;margin-bottom:20px}.mgn-outline-step{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--mgn-purple),var(--mgn-pink));color:#fff;font-weight:800;font-size:12px;letter-spacing:.04em}.mgn-outline-section-title h3,.mgn-outline-body-header h3{margin:0 0 4px;font-size:22px}.mgn-outline-section-title p,.mgn-outline-body-header p{margin:0;color:var(--mgn-ink-soft);line-height:1.55;font-size:13px}.mgn-outline-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.mgn-outline-detail-field{display:flex;flex-direction:column;gap:6px}.mgn-outline-detail-field:nth-child(3){grid-column:1/-1}.mgn-outline-field-label{font-size:13px;font-weight:800;color:var(--mgn-ink)}.mgn-outline-detail-field small{font-size:11px;line-height:1.45;color:var(--mgn-ink-soft);min-height:30px}.mgn-outline-detail-field input,.mgn-outline-detail-field textarea{width:100%;border:1px solid var(--mgn-line);background:#fff;border-radius:11px;padding:11px 12px;font:inherit;font-size:13px;color:var(--mgn-ink);outline:none;transition:.18s}.mgn-outline-detail-field textarea{min-height:84px;resize:vertical;line-height:1.5}.mgn-outline-detail-field input:focus,.mgn-outline-detail-field textarea:focus{border-color:var(--mgn-purple);box-shadow:0 0 0 3px rgba(117,103,248,.12)}.mgn-outline-body-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:28px 0 14px;padding:4px 2px}.mgn-outline-body-header>div:first-child{display:flex;gap:12px;align-items:flex-start}.mgn-outline-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}.mgn-outline-kicker{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:800;color:var(--mgn-purple);margin-bottom:5px}.mgn-outline-title-input{border:0;background:transparent;font:600 19px 'Fraunces',serif;color:var(--mgn-ink);padding:0;outline:none;width:min(520px,70vw)}.mgn-outline-title-input:focus{box-shadow:inset 0 -2px 0 var(--mgn-purple)}.mgn-outline-conclusion{margin-top:10px;background:linear-gradient(135deg,rgba(117,103,248,.07),rgba(243,106,168,.07))}.mgn-outline-intro{background:linear-gradient(135deg,rgba(79,140,255,.06),rgba(117,103,248,.06))}.mgn-outline-body-card{border-left:4px solid var(--mgn-purple)}
      @media(max-width:900px){.mgn-outline-fields{grid-template-columns:1fr}.mgn-outline-detail-field:nth-child(3){grid-column:auto}.mgn-outline-body-header{align-items:flex-start;flex-direction:column}.mgn-outline-actions{flex-wrap:wrap}}
      .mgn-app{--mgn-accent:#7567F8;--mgn-accent-deep:#5648D9;--mgn-accent-soft:#eeeaff;}
      .mgn-btn-primary{background:linear-gradient(135deg,var(--mgn-accent),var(--mgn-accent-deep));box-shadow:0 7px 18px color-mix(in srgb,var(--mgn-accent) 22%,transparent)}
      .mgn-btn-primary:hover:not(:disabled){background:linear-gradient(135deg,var(--mgn-accent-deep),var(--mgn-accent));}
      .mgn-topbar{position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);background:color-mix(in srgb,var(--mgn-paper) 90%,transparent)}
      .mgn-quick-actions{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;padding:24px 32px 0}.mgn-quick-action{border:1px solid var(--mgn-line);background:var(--mgn-card,#fff);border-radius:16px;padding:15px;display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;transition:.18s;box-shadow:0 8px 24px rgba(30,25,70,.04)}.mgn-quick-action:hover{transform:translateY(-3px);border-color:var(--mgn-accent);box-shadow:0 14px 30px rgba(30,25,70,.08)}.mgn-quick-action svg:first-child{width:20px;color:var(--mgn-accent)}.mgn-quick-action span{display:flex;flex-direction:column;flex:1}.mgn-quick-action strong{font-size:14px}.mgn-quick-action small{font-size:11px;color:var(--mgn-ink-soft);margin-top:2px}.mgn-quick-action.primary{background:linear-gradient(135deg,var(--mgn-accent-soft),#fff)}
      .mgn-settings-main,.mgn-research-main{max-width:1180px;margin:0 auto;padding:34px 28px 70px}.mgn-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.mgn-settings-card{padding:24px}.mgn-settings-section-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:20px}.mgn-settings-section-head h3{margin:0 0 4px;font-size:22px}.mgn-settings-section-head p{margin:0;color:var(--mgn-ink-soft);font-size:13px}.mgn-settings-section-head>svg{color:var(--mgn-accent);width:22px}.mgn-avatar-editor{display:flex;align-items:center;gap:16px;padding:16px;border-radius:16px;background:var(--mgn-paper-dim);margin-bottom:20px}.mgn-avatar-large{position:relative;width:76px;height:76px;border-radius:50%;border:0;background:linear-gradient(135deg,var(--mgn-accent),var(--mgn-pink,#F36AA8));color:#fff;font-size:28px;font-weight:800;overflow:hidden;cursor:pointer}.mgn-avatar-large img{width:100%;height:100%;object-fit:cover}.mgn-avatar-edit{position:absolute;right:4px;bottom:4px;width:25px;height:25px;border-radius:50%;background:#fff;color:var(--mgn-ink);display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.15)}.mgn-avatar-editor p{margin:4px 0 9px;font-size:12px;color:var(--mgn-ink-soft)}.mgn-setting-field{display:flex;flex-direction:column;gap:7px;margin:15px 0;font-size:13px;font-weight:700}.mgn-setting-field input,.mgn-setting-field textarea,.mgn-setting-field select{font-weight:400}.mgn-settings-textarea{width:100%;min-height:90px;resize:vertical;border:1.5px solid var(--mgn-line);border-radius:11px;padding:11px 13px;font:inherit;font-size:13px;outline:none;background:var(--mgn-card,#fff);color:var(--mgn-ink)}.mgn-settings-textarea:focus{border-color:var(--mgn-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mgn-accent) 12%,transparent)}.mgn-setting-choice,.mgn-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:15px 0;border-top:1px solid var(--mgn-line)}.mgn-setting-choice span,.mgn-toggle-row span{display:flex;flex-direction:column;gap:4px}.mgn-setting-choice small,.mgn-toggle-row small{font-size:11px;color:var(--mgn-ink-soft);font-weight:400}.mgn-choice-row{display:flex;gap:7px}.mgn-choice-row button{border:1px solid var(--mgn-line);background:var(--mgn-card,#fff);padding:8px 10px;border-radius:9px;display:flex;align-items:center;gap:5px;cursor:pointer}.mgn-choice-row button.active{border-color:var(--mgn-accent);color:var(--mgn-accent-deep);background:var(--mgn-accent-soft)}.mgn-accent-grid{display:flex;gap:8px;flex-wrap:wrap;max-width:190px}.mgn-accent-grid button{width:28px;height:28px;border-radius:50%;border:3px solid transparent;cursor:pointer}.mgn-accent-grid button.active{border-color:var(--mgn-ink)}.mgn-toggle-row input{width:42px;height:22px;accent-color:var(--mgn-accent)}.mgn-learn-box{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:18px;border-radius:14px;background:linear-gradient(135deg,var(--mgn-accent-soft),#eef7ff)}.mgn-learn-box p{margin:4px 0 0;font-size:12px;color:var(--mgn-ink-soft)}
      .mgn-research-grid{display:grid;grid-template-columns:390px 1fr;gap:18px}.mgn-source-form{display:grid;gap:10px}.mgn-citation-controls select{border:1px solid var(--mgn-line);border-radius:8px;padding:7px}.mgn-source-list{display:grid;gap:12px;margin-top:14px}.mgn-source-card{border:1px solid var(--mgn-line);border-radius:14px;padding:16px;background:var(--mgn-paper);}.mgn-source-card h3{margin:4px 0 3px;font-size:18px}.mgn-source-card>div:first-child p{margin:0;color:var(--mgn-ink-soft);font-size:12px}.mgn-source-kicker{font-size:10px;font-weight:800;color:var(--mgn-accent);text-transform:uppercase;letter-spacing:.08em}.mgn-source-evidence{margin:14px 0;padding:12px;border-radius:10px;background:var(--mgn-paper-dim);font-size:12px}.mgn-source-evidence strong{display:block;margin-top:7px}.mgn-source-evidence strong:first-child{margin-top:0}.mgn-source-evidence p{margin:4px 0;color:var(--mgn-ink-soft);line-height:1.5}.mgn-source-actions{display:flex;gap:8px;flex-wrap:wrap}.mgn-source-actions button,.mgn-source-actions a{border:1px solid var(--mgn-line);background:var(--mgn-card,#fff);padding:7px 9px;border-radius:8px;font-size:11px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;text-decoration:none;color:inherit}.mgn-source-actions .danger{color:#c0394b}.mgn-generated-citation{margin-top:10px;padding:10px;border-left:3px solid var(--mgn-accent);font:12px/1.5 Georgia,serif;background:color-mix(in srgb,var(--mgn-accent-soft) 45%,transparent)}
      .mgn-rewrite-main{max-width:1180px;margin:0 auto;padding:34px 28px 70px}.mgn-rewrite-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}.mgn-rewrite-input-card,.mgn-rewrite-output-card{display:flex;flex-direction:column;gap:14px}.mgn-rewrite-textarea{min-height:320px;font-size:14px;line-height:1.6}.mgn-rewrite-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}.mgn-rewrite-controls select{border:1px solid var(--mgn-line);border-radius:9px;padding:8px 10px;font:inherit;font-size:13px;background:var(--mgn-card,#fff);color:var(--mgn-ink)}.mgn-rewrite-meta{font-size:11px;color:var(--mgn-ink-soft);text-align:right}.mgn-rewrite-output-actions{display:flex;align-items:center;gap:8px}.mgn-rewrite-changes{display:grid;gap:12px;margin-top:6px}.mgn-rewrite-change-row{border:1px solid var(--mgn-line);border-radius:12px;padding:12px 14px;background:var(--mgn-paper-dim);transition:.15s}.mgn-rewrite-change-row.is-reverted{opacity:.6}.mgn-rewrite-change-text{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;line-height:1.6}.mgn-rewrite-change-text svg{flex-shrink:0;color:var(--mgn-ink-soft)}.mgn-rewrite-change-why{margin:8px 0 0;font-size:12px;color:var(--mgn-ink-soft);line-height:1.5}
      .mgn-rewrite-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.mgn-rewrite-toggle-actions{display:flex;gap:8px}.mgn-rewrite-diff{cursor:default}.mgn-rewrite-seg{cursor:pointer;border-radius:4px;transition:.12s;box-decoration-break:clone;-webkit-box-decoration-break:clone}.mgn-rewrite-seg:hover{filter:brightness(0.97)}.mgn-rewrite-seg-reverted{background:transparent;border-bottom:1px dashed var(--mgn-ink-soft);color:var(--mgn-ink-soft)}.mgn-rewrite-change-toggle{margin-top:10px;border:1px solid var(--mgn-line);background:var(--mgn-card,#fff);padding:6px 10px;border-radius:8px;font-size:11px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;color:inherit}.mgn-rewrite-change-toggle:hover{border-color:var(--mgn-accent);color:var(--mgn-accent-deep)}
      @media(max-width:900px){.mgn-rewrite-grid{grid-template-columns:1fr}}
      .mgn-health-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.mgn-health-score{padding:12px;border:1px solid var(--mgn-line);border-radius:12px}.mgn-health-score span{font-size:11px;color:var(--mgn-ink-soft)}.mgn-health-score b{display:block;font-size:24px;margin:5px 0}.mgn-health-score>div{height:6px;background:var(--mgn-paper-dim);border-radius:6px;overflow:hidden}.mgn-health-score i{display:block;height:100%;background:linear-gradient(90deg,var(--mgn-accent),var(--mgn-pink,#F36AA8))}.mgn-health-meta{display:flex;gap:15px;margin:16px 0;font-size:12px;color:var(--mgn-ink-soft)}.mgn-health-tips{padding:14px;border-radius:12px;background:var(--mgn-accent-soft)}.mgn-health-tips strong{font-size:13px}.mgn-health-tips p{font-size:12px;margin:7px 0}.mgn-coach-prompts{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.mgn-coach-prompts button{border:1px solid var(--mgn-line);background:var(--mgn-paper);border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer}.mgn-coach-prompts button:hover{border-color:var(--mgn-accent);color:var(--mgn-accent-deep)}.mgn-coach-input{min-height:100px;margin-bottom:10px}.mgn-coach-answer{display:flex;gap:10px;margin-top:16px;padding:15px;border-radius:12px;background:var(--mgn-accent-soft);line-height:1.6;font-size:13px}.mgn-coach-answer p{margin:0}
      @media(max-width:900px){.mgn-quick-actions{grid-template-columns:1fr 1fr}.mgn-settings-grid,.mgn-research-grid{grid-template-columns:1fr}.mgn-health-grid{grid-template-columns:1fr 1fr}.mgn-health-score:last-child{grid-column:1/-1}}
      @media(max-width:560px){.mgn-quick-actions{grid-template-columns:1fr;padding-left:18px;padding-right:18px}.mgn-settings-main,.mgn-research-main{padding-left:16px;padding-right:16px}.mgn-choice-row{flex-wrap:wrap}}
      .mgn-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}
          .mgn-avatar-crop-modal{max-width:560px}.mgn-crop-stage{position:relative;width:min(100%,420px);aspect-ratio:1;margin:10px auto 18px;border-radius:18px;overflow:hidden;background:#111;display:grid;place-items:center}.mgn-crop-stage img{width:100%;height:100%;object-fit:contain;transform-origin:center;transition:transform .05s linear}.mgn-crop-circle{position:absolute;inset:9%;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 999px rgba(0,0,0,.48);pointer-events:none}.mgn-crop-controls{display:grid;gap:11px;margin:0 4px 18px}.mgn-crop-controls label{display:grid;grid-template-columns:90px 1fr;align-items:center;gap:12px;font-size:12px;font-weight:700}.mgn-crop-controls input{width:100%;accent-color:var(--mgn-accent)}.mgn-modal-actions{display:flex;justify-content:flex-end;gap:9px}.mgn-avatar-large{width:96px;height:96px}.mgn-avatar-large img{object-fit:cover;display:block}.mgn-avatar-editor{align-items:center}
    `}
</style>
  );
}
