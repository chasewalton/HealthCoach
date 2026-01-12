const messages = [];
let demographics = null;

const chatEl = document.getElementById("chat");
const stepEl = document.getElementById("step");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const summarizeBtn = document.getElementById("summarize-btn");
const summaryEl = document.getElementById("summary");
const summaryTextEl = document.getElementById("summary-text");
const startBtn = document.getElementById("landing-continue") || document.getElementById("start-chat-btn");
const settingsConfirmBtn = document.getElementById("start-chat-btn");
const formEl = document.getElementById("demographics-form");
const whoInputs = Array.from(document.querySelectorAll('input[name="demo-who"]'));
const relationshipEl = document.getElementById("relationship-row");
const chatContainerEl = document.getElementById("chat-container");
const summaryContainerEl = document.getElementById("summary-container");
const progressEl = document.getElementById("progress");
const choicesEl = document.getElementById("choices");
const modelSelectEl = document.getElementById("model-select");
const postSubmitEl = document.getElementById("post-submit");
const postProgressEl = document.getElementById("post-progress");
const reviewBtn = document.getElementById("review-btn");
const ourdxBtn = document.getElementById("ourdx-btn");
const continueOurdxBtn = document.getElementById("continue-ourdx-btn");
const reviewContainerEl = document.getElementById("review-container");
const filesContainerEl = document.getElementById("files-container");
const segContainer = document.getElementById("segmented");
const segChat = document.getElementById("seg-chat");
const segFiles = document.getElementById("seg-files");
const segBackToChat = document.getElementById("seg-back-to-chat");
const micBtn = document.getElementById("mic-btn");
const connectRecordsBtn = document.getElementById("connect-records");
const infoSheet = document.getElementById("info-sheet");
const askLandingEl = document.getElementById("ask-landing");
const askCardReview = document.getElementById("ask-card-review");
const askCardSurvey = document.getElementById("ask-card-survey");
const navBackBtn = document.getElementById("nav-back");
const newChatBtn = document.getElementById("nav-new-chat");
const askHeadlineEl = document.querySelector(".ask-headline");
const topbarEl = document.querySelector(".topbar");
const navProfileBtn = document.getElementById("nav-profile");
const navHistoryBtn = document.getElementById("nav-history");
const modalEl = document.getElementById("profile-modal");
const modalCloseBtn = modalEl ? modalEl.querySelector(".modal-close") : null;
const modalBackdrop = modalEl ? modalEl.querySelector(".modal-backdrop") : null;
const modalSaveBtn = document.getElementById("modal-save");
const modalFields = {
  name: document.getElementById("prof-name"),
  dob: document.getElementById("prof-dob"),
  gender: document.getElementById("prof-gender"),
  lang: document.getElementById("prof-lang"),
};
// Settings modal refs
const settingsModal = document.getElementById("settings-modal");
const settingsCloseBtn = settingsModal ? settingsModal.querySelector(".settings-close") : null;
const settingsBackdrop = settingsModal ? settingsModal.querySelector(".modal-backdrop") : null;
const settingsSaveBtn = document.getElementById("settings-save");
const settingsFields = {
  lang: document.getElementById("set-lang"),
  interpreter: document.getElementById("set-interpreter"),
  education: document.getElementById("set-education"),
  literacy: document.getElementById("set-literacy"),
};
// Confirm profile modal
const confirmModal = document.getElementById("confirm-modal");
const confirmCloseBtn = confirmModal ? confirmModal.querySelector(".confirm-close") : null;
const confirmBackdrop = confirmModal ? confirmModal.querySelector(".modal-backdrop") : null;
const confirmYesBtn = document.getElementById("confirm-yes");
const confirmEditBtn = document.getElementById("confirm-edit");
const confirmSummaryEl = document.getElementById("confirm-summary");
const historyDrawer = document.getElementById("history-drawer");
const historyClose = historyDrawer ? historyDrawer.querySelector(".drawer-close") : null;
const historyBackdrop = historyDrawer ? historyDrawer.querySelector(".drawer-backdrop") : null;
const historyList = document.getElementById("history-list");
// Summary modal
const summaryModal = document.getElementById("summary-modal");
const summaryModalText = document.getElementById("summary-modal-text");
const summaryCloseBtn = summaryModal ? summaryModal.querySelector(".summary-close") : null;
const summaryBackdrop = summaryModal ? summaryModal.querySelector(".modal-backdrop") : null;
const summaryOkBtn = document.getElementById("summary-modal-ok");
const summaryShareBtn = document.getElementById("summary-share");
const selectSummaryCb = document.getElementById("select-summary");
const selectTranscriptCb = document.getElementById("select-transcript");
const downloadSelectedBtn = document.getElementById("download-selected");
const summarySwitchBtn = document.getElementById("summary-switch");
let lastSummaryText = "";

// Track the furthest section reached to avoid regressions in progress UI
let furthestSectionIndex = 0;
let chatStarted = false;

const SECTIONS = [
  { id: "S1", label: "What matters most" },
  { id: "S2", label: "Health last 6 months" },
  { id: "S3", label: "Getting it right" },
  { id: "S4", label: "Wrap-up" },
];

function setPostProgress(currentIndex) {
  if (!postProgressEl) return;
  const steps = Array.from(postProgressEl.querySelectorAll(".progress2-step"));
  steps.forEach((el, idx) => {
    el.classList.toggle("current", idx === currentIndex);
    el.classList.toggle("done", idx < currentIndex);
  });
}

function setSegmented(active) {
  if (!segContainer) return;
  segContainer.style.display = "flex";
  if (segChat) segChat.classList.toggle("active", active === "chat");
  if (segFiles) segFiles.classList.toggle("active", active === "files");
}

function updateWhoVisibility() {
  const who = (whoInputs.find(i => i.checked)?.value) || "self";
  if (relationshipEl) relationshipEl.style.display = who === "other" ? "block" : "none";
}
whoInputs.forEach((i) => i.addEventListener("change", updateWhoVisibility));
updateWhoVisibility();

// Basic required validation for Continue button (landing inputs)
const continueBtn = startBtn;
function validateDemographicsRequired() {
  const nameVal = (document.getElementById("landing-name")?.value || "").trim();
  const dobVal = (document.getElementById("landing-dob")?.value || "").trim();
  if (continueBtn) continueBtn.disabled = !(nameVal && dobVal);
}
["landing-name", "landing-dob"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", validateDemographicsRequired);
});
validateDemographicsRequired();

// Lightweight "Why we ask" handler
document.querySelectorAll("button.why").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.getAttribute("data-why");
    const messages = {
      race: "We ask about race to help ensure equitable care and understand health patterns across populations. Sharing is optional.",
    };
    // Open sheet
    if (infoSheet) {
      const content = infoSheet.querySelector("#sheet-content");
      if (content) content.textContent = messages[key] || "This helps us tailor your experience. Sharing is optional.";
      infoSheet.setAttribute("aria-hidden", "false");
    }
  });
});
if (infoSheet) {
  const closeBtn = infoSheet.querySelector(".sheet-close");
  const backdrop = infoSheet.querySelector(".sheet-backdrop");
  [closeBtn, backdrop].forEach((el) => {
    el && el.addEventListener("click", () => infoSheet.setAttribute("aria-hidden", "true"));
  });
}

// Segmented fallback selects (mobile) – keep values in sync
function syncSegToSelect(groupName, selectId) {
  const select = document.getElementById(selectId);
  const radios = Array.from(document.querySelectorAll(`input[name="${groupName}"]`));
  if (!select || radios.length === 0) return;
  // radios -> select
  radios.forEach((r) => {
    r.addEventListener("change", () => {
      if (r.checked) select.value = r.value;
    });
  });
  // select -> radios
  select.addEventListener("change", () => {
    const target = radios.find((r) => r.value === select.value);
    if (target) {
      target.checked = true;
      target.dispatchEvent(new Event("change"));
    }
  });
}
syncSegToSelect("demo-eth", "eth-select");
syncSegToSelect("demo-interpreter", "interp-select");

function renderMessages() {
  chatEl.innerHTML = "";
  const visible = messages.filter((m) => m.role !== "system");
  visible.forEach((m) => {
    const chunks = (m.content || "").split(/\n{2,}/).filter(Boolean);
    if (chunks.length === 0) chunks.push("");
    chunks.forEach((chunk) => {
      // Strip hidden markers and legacy tags from display
      const clean = chunk
        .replace(/\[[^\]]*(?:S[1-4]|binary|mc|free)[^\]]*\]/gi, "")
        .replace(/\[(Q[^\]]+)\]/g, "")
        .trim();
      const row = document.createElement("div");
      row.className = `message ${m.role}`;
      const bubble = document.createElement("div");
      bubble.className = `bubble ${m.role === "user" ? "user-bubble" : "assistant-bubble"}`;
      bubble.textContent = clean;
      row.appendChild(bubble);
      chatEl.appendChild(row);
    });
  });
  chatEl.scrollTop = chatEl.scrollHeight;
  renderStep();
  renderChoices();
  try { saveTranscriptServer(); } catch {}
}

function detectSectionIndex() {
  // Look from newest to oldest assistant message for a section hint
  const assistants = [...messages].reverse().filter((m) => m.role === "assistant" && m.content);
  for (const m of assistants) {
    // Preferred hidden marker [S1]..[S4], tolerant of extra chars inside brackets
    const hidden = m.content.match(/\[[^\]]*S([1-4])[^\]]*\]/i);
    if (hidden) {
      const idx = parseInt(hidden[1], 10) - 1;
      furthestSectionIndex = Math.max(furthestSectionIndex, idx);
      return furthestSectionIndex;
    }
    // Fallback: textual cues like "SECTION 2" or "Section 3"
    const textual = m.content.match(/section\s*([1-4])\b/i);
    if (textual) {
      const idx = parseInt(textual[1], 10) - 1;
      furthestSectionIndex = Math.max(furthestSectionIndex, idx);
      return furthestSectionIndex;
    }
  }
  // Default to first section
  return furthestSectionIndex;
}

function renderStep() {
  const currentIndex = Math.max(0, Math.min(SECTIONS.length - 1, detectSectionIndex()));
  if (!progressEl) return;
  progressEl.innerHTML = "";
  SECTIONS.forEach((s, idx) => {
    const step = document.createElement("div");
    step.className = "progress-step";
    step.dataset.label = s.label;
    if (idx < currentIndex) step.classList.add("done");
    if (idx === currentIndex) step.classList.add("current");
    progressEl.appendChild(step);
  });
}

function parseChoicesFromAssistantText(text) {
  const t = text || "";
  // Prefer invisible markers to drive UI
  const qTypeMatch = t.match(/\[(binary|mc|free)\]/i);
  const qType = qTypeMatch ? qTypeMatch[1].toLowerCase() : null;
  if (!qType) {
    return null; // no chips without marker
  }
  if (qType === "binary") {
    return { type: "single", options: ["Yes", "No"] };
  }
  if (qType === "mc") {
    // Parse bulleted or enumerated options shown by the assistant
    const lines = t.split(/\n/);
    const opts = [];
    for (const line of lines) {
      const m = line.match(/^\s*(?:\d+[\)\.\-]|[-•])\s*(.+?)\s*$/);
      if (m) {
        const label = m[1].trim();
        if (label && label.length <= 120) opts.push(label);
      }
    }
    if (opts.length >= 2) {
      return { type: "multi", options: opts.slice(0, 12) };
    }
    return null;
  }
  // free-form: no chips
  return null;
}

let currentChoices = null;
function renderChoices() {
  if (!choicesEl) return;
  // Only show choices for the latest assistant message
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) {
    choicesEl.innerHTML = "";
    currentChoices = null;
    return;
  }
  const detected = parseChoicesFromAssistantText(lastAssistant.content || "");
  if (!detected) {
    choicesEl.innerHTML = "";
    currentChoices = null;
    return;
  }
  currentChoices = { ...detected, selected: new Set() };
  choicesEl.innerHTML = "";
  detected.options.forEach((opt, idx) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "choice-chip";
    chip.textContent = opt;
    chip.addEventListener("click", () => {
      if (currentChoices.type === "single") {
        sendDirect(opt);
        choicesEl.innerHTML = "";
        currentChoices = null;
      } else {
        // toggle select
        if (currentChoices.selected.has(opt)) {
          currentChoices.selected.delete(opt);
          chip.classList.remove("selected");
        } else {
          currentChoices.selected.add(opt);
          chip.classList.add("selected");
        }
        submitBtn.disabled = currentChoices.selected.size === 0;
      }
    });
    choicesEl.appendChild(chip);
  });
  let submitBtn = null;
  if (currentChoices.type === "multi") {
    submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "choice-submit";
    submitBtn.textContent = "Submit";
    submitBtn.disabled = true;
    submitBtn.addEventListener("click", () => {
      if (!currentChoices || currentChoices.selected.size === 0) return;
      const text = Array.from(currentChoices.selected).join("; ");
      sendDirect(text);
      choicesEl.innerHTML = "";
      currentChoices = null;
    });
    choicesEl.appendChild(submitBtn);
  }
}

function currentProviderAndModel() {
  const saved = (() => { try { return localStorage.getItem("hc_model") || ""; } catch { return ""; } })();
  if (modelSelectEl && saved && !modelSelectEl.value) {
    modelSelectEl.value = saved;
  }
  const val = (modelSelectEl && modelSelectEl.value) || saved || "ollama|llama3:instruct";
  const [provider, model] = val.split("|");
  return { provider, model };
}

async function sendDirect(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;
  messages.push({ role: "user", content: trimmed });
  renderMessages();
  try { localStorage.setItem("hc_current_session", JSON.stringify({ messages })); } catch {}
  sendBtn.disabled = true;
  try {
    const { provider, model } = currentProviderAndModel();
    const data = await apiPost("/chat", { messages, language: demographics?.primary_language || "en", provider, model });
    messages.push({ role: "assistant", content: data.reply });
  } catch (e) {
    messages.push({ role: "assistant", content: "Sorry—server error. Please try again." });
  } finally {
    sendBtn.disabled = false;
    renderMessages();
    try { localStorage.setItem("hc_current_session", JSON.stringify({ messages })); } catch {}
  }
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(path, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function toSingleLine(s) {
  return (s || "").toString().replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function valueToInline(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(valueToInline).filter(Boolean).join("; ");
  if (typeof v === "object") {
    const parts = Object.entries(v).map(([k, val]) => `${k.replace(/_/g, " ")}: ${valueToInline(val)}`.trim());
    return parts.filter(Boolean).join(", ");
  }
  return String(v).trim();
}
function arrayToBullets(arr) {
  const lines = (arr || []).map((v) => valueToInline(v)).filter(Boolean);
  return lines.length ? "• " + lines.join("\n• ") : "";
}
function objectSectionsToText(obj) {
  if (!obj || typeof obj !== "object") return "";
  const preferredOrder = ["overview", "summary", "key_points", "highlights", "findings", "recommendations", "next_steps", "actions"];
  const seen = new Set();
  const sections = [];
  for (const key of preferredOrder) {
    if (obj[key] == null) continue;
    seen.add(key);
    const val = obj[key];
    if (typeof val === "string") {
      if (key === "overview" || key === "summary") {
        sections.push(toSingleLine(val));
      } else {
        sections.push(`${key.replace(/_/g, " ")}:\n${arrayToBullets([val])}`);
      }
    } else if (Array.isArray(val)) {
      const bullets = arrayToBullets(val);
      if (bullets) sections.push(`${key.replace(/_/g, " ")}:\n${bullets}`);
    } else if (typeof val === "object") {
      const inline = valueToInline(val);
      if (inline) sections.push(`${key.replace(/_/g, " ")}:\n• ${inline}`);
    }
  }
  // Add remaining keys
  for (const [k, v] of Object.entries(obj)) {
    if (seen.has(k)) continue;
    const label = k.replace(/_/g, " ");
    if (typeof v === "string") {
      const t = v.trim();
      if (t) sections.push(`${label}:\n${arrayToBullets([t])}`);
    } else if (Array.isArray(v)) {
      const bullets = arrayToBullets(v);
      if (bullets) sections.push(`${label}:\n${bullets}`);
    } else if (typeof v === "object" && v) {
      const inline = valueToInline(v);
      if (inline) sections.push(`${label}:\n• ${inline}`);
    } else if (v != null) {
      sections.push(`${label}: ${String(v)}`);
    }
  }
  return sections.filter(Boolean).join("\n\n").trim();
}
function formatSummaryText(resp) {
  if (resp == null) return "";
  if (typeof resp === "string") return toSingleLine(resp);
  if (typeof resp === "object") {
    const direct = resp.text || resp.reply || resp.message || resp.content;
    if (typeof direct === "string" && direct.trim()) return toSingleLine(direct);
    const s = resp.summary;
    if (typeof s === "string" && s.trim()) return toSingleLine(s);
    if (s && typeof s === "object") {
      const shaped = objectSectionsToText(s);
      if (shaped) return shaped;
    }
    const fallback = objectSectionsToText(resp);
    if (fallback) return fallback;
  }
  return "";
}

// Generic JSON POST (for profile save)
async function apiPostJson(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Server-backed transcript helpers
function getProfile() {
  try { return JSON.parse(localStorage.getItem("hc_profile") || "{}"); } catch { return {}; }
}
function profileKeyFrom(p) {
  const n = (p.patient_name || p.name || "").trim().toLowerCase();
  const d = (p.patient_dob || p.dob || "").trim();
  return `${n}|${d}`;
}
function convStorageKey(pk) { return `hc_conv:${pk}`; }
function getCurrentConversationId() {
  const pk = profileKeyFrom(getProfile());
  try { return localStorage.getItem(convStorageKey(pk)) || ""; } catch { return ""; }
}
function setCurrentConversationId(id) {
  const pk = profileKeyFrom(getProfile());
  try { if (id) localStorage.setItem(convStorageKey(pk), id); } catch {}
}
async function saveTranscriptServer() {
  const p = getProfile();
  const body = {
    patient_name: p.patient_name || "",
    patient_dob: p.patient_dob || "",
    messages,
  };
  const existing = getCurrentConversationId();
  if (existing) body.conversation_id = existing;
  const resp = await apiPost("/transcripts/save", body);
  if (resp && resp.id) setCurrentConversationId(resp.id);
  return resp;
}
async function loadLatestTranscriptServer() {
  const p = getProfile();
  const q = `patient_name=${encodeURIComponent(p.patient_name || "")}&patient_dob=${encodeURIComponent(p.patient_dob || "")}`;
  const list = await apiGet(`/transcripts/list?${q}`);
  const items = (list && Array.isArray(list.items)) ? list.items : [];
  const current = getCurrentConversationId();
  const chosenId = current || (items[0] && items[0].id);
  if (!chosenId) return false;
  const doc = await apiGet(`/transcripts/get?id=${encodeURIComponent(chosenId)}&${q}`);
  if (doc && Array.isArray(doc.messages)) {
    messages.length = 0;
    doc.messages.forEach(m => messages.push(m));
    setCurrentConversationId(doc.id || chosenId);
    renderMessages();
    return true;
  }
  return false;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}
function buildDemographics() {
  const el = (id) => document.getElementById(id);
  const val = (id) => el(id)?.value ?? null;
  const whoRadio = document.querySelector('input[name="demo-who"]:checked');
  const who_for = whoRadio ? whoRadio.value : "self";
  const patient_name = val("demo-patient-name");
  const patient_dob = val("demo-patient-dob");
  const relationship = val("demo-relationship");
  const sex = val("demo-sex"); // may be null if control not present
  const raceRaw = val("demo-race") || "";
  const ethRadio = document.querySelector('input[name="demo-eth"]:checked');
  const hispanic = ethRadio ? ethRadio.value : "";
  const lang = val("demo-lang") || "";
  const interpRadio = document.querySelector('input[name="demo-interpreter"]:checked');
  const interpreter = interpRadio ? interpRadio.value : "";
  const education_level = val("demo-education");
  const health_literacy = val("demo-literacy");

  const race = (raceRaw || "").trim();
  const hispanic_or_latino =
    hispanic ? (hispanic.toLowerCase() === "yes" ? true : hispanic.toLowerCase() === "no" ? false : null) : null;
  const interpreter_needed =
    interpreter ? (interpreter.toLowerCase() === "yes" ? true : interpreter.toLowerCase() === "no" ? false : null) : null;
  const primary_language = lang || null;

  return {
    who_for,
    relationship,
    patient_name,
    patient_dob,
    sex: sex || null,
    race: race || null,
    hispanic_or_latino,
    primary_language,
    interpreter_needed,
    education_level,
    health_literacy,
  };
}

function buildDemographicsSystemContent(demo) {
  const parts = [];
  parts.push(`about: ${demo.who_for === "self" ? "self" : "someone_else"}`);
  // Patient context (always)
  const patient = [];
  if (demo.patient_name) patient.push(`name=${demo.patient_name}`);
  if (demo.patient_dob) patient.push(`dob=${demo.patient_dob}`);
  if (demo.sex) parts.push(`sex: ${demo.sex}`);
  if (demo.race) parts.push(`race: ${demo.race}`);
  if (demo.hispanic_or_latino !== null)
    parts.push(`hispanic_or_latino: ${demo.hispanic_or_latino ? "yes" : "no"}`);
  if (demo.primary_language) parts.push(`primary_language: ${demo.primary_language}`);
  if (demo.interpreter_needed !== null)
    parts.push(`interpreter_needed: ${demo.interpreter_needed ? "yes" : "no"}`);
  if (demo.education_level) parts.push(`education_level: ${demo.education_level}`);
  if (demo.health_literacy) parts.push(`health_literacy: ${demo.health_literacy}`);
  if (patient.length) parts.push(`patient: { ${patient.join(", ")} }`);
  if (demo.who_for === "other" && demo.relationship) parts.push(`relationship: ${demo.relationship}`);
  const summary = parts.length ? parts.join(", ") : "none provided";
  const adapt =
    demo.health_literacy === "somewhat_hard" || demo.health_literacy === "very_hard"
      ? "Use shorter sentences, simpler words, and extra clarification when needed."
      : "Use clear everyday language.";
  return `
Demographics and context already collected by the app:.
Do not ask demographic, education, health literacy, or 'who is this about' questions; proceed to the OurDX survey after demographics.
Style guidance: ${adapt}
`.trim();
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;
  messages.push({ role: "user", content: text });
  inputEl.value = "";
  renderMessages();
   try { localStorage.setItem("hc_current_session", JSON.stringify({ messages })); } catch {}

  sendBtn.disabled = true;
  try {
    const { provider, model } = currentProviderAndModel();
    const data = await apiPost("/chat", { messages, language: demographics?.primary_language || "en", provider, model });
    messages.push({ role: "assistant", content: data.reply });
  } catch (e) {
    messages.push({ role: "assistant", content: "Sorry—server error. Please try again." });
  } finally {
    sendBtn.disabled = false;
    renderMessages();
    try { localStorage.setItem("hc_current_session", JSON.stringify({ messages })); } catch {}
  }
}

async function summarize() {
  if (messages.length === 0) return;
  summarizeBtn.disabled = true;
  const originalText = summarizeBtn.textContent;
  try {
    const { provider, model } = currentProviderAndModel();
    const resp = await apiPost("/summarize", { messages, provider, model });
    // Build a readable text summary from response
    let textOut = formatSummaryText(resp);
    if (!textOut) textOut = "No summary returned.";
    if (summaryEl) summaryEl.textContent = "";
    if (summaryTextEl) summaryTextEl.textContent = "";
    if (summaryContainerEl) summaryContainerEl.style.display = "none";
    // Also show the text summary in a centered modal
    openSummaryModal(textOut || "No summary returned.");
    summarizeBtn.textContent = "Summarized";
    // Save snapshot locally for history (optional)
    try { saveTranscriptSnapshot(); } catch {}
  } catch (e) {
    summarizeBtn.textContent = "Save failed";
    console.error("Summarize failed", e);
  } finally {
    setTimeout(() => {
      summarizeBtn.textContent = originalText;
      summarizeBtn.disabled = false;
    }, 1200);
  }
}

sendBtn.addEventListener("click", sendMessage);
summarizeBtn.addEventListener("click", summarize);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
// Auto-grow textarea height up to a cap
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  const max = 160;
  inputEl.style.height = Math.min(max, inputEl.scrollHeight) + "px";
});

function showPostSubmit() {
  if (formEl) formEl.style.display = "none";
  if (postSubmitEl) postSubmitEl.style.display = "block";
  if (chatContainerEl) chatContainerEl.style.display = "none";
  if (reviewContainerEl) reviewContainerEl.style.display = "none";
  if (summaryContainerEl) summaryContainerEl.style.display = "none";
  setPostProgress(0);
}

async function ensureChatStarted() {
  if (chatStarted) return;
  // If there are already non-system messages (restored session), don't auto-send
  const hasChat = messages.some(m => m.role === "user" || m.role === "assistant");
  // Ensure a single system demographics message exists
  if (!messages.find(m => m.role === "system")) {
    messages.unshift({ role: "system", content: buildDemographicsSystemContent(demographics || {}) });
  }
  renderMessages();
  // Do NOT auto-call the backend; wait for user input
  chatStarted = true;
}

async function goToReview() {
  if (postSubmitEl) postSubmitEl.style.display = "none";
  // Use nav helper so Back works (pushes previous view)
  showSection(reviewContainerEl);
  // Also show chat alongside review
  if (chatContainerEl) chatContainerEl.style.display = "flex";
  setPostProgress(0);
  if (typeof activateSoapTab === "function") activateSoapTab("subjective");
  await ensureChatStarted();
}

async function goToOurDX() {
  if (postSubmitEl) postSubmitEl.style.display = "none";
  if (reviewContainerEl) reviewContainerEl.style.display = "none";
  if (filesContainerEl) filesContainerEl.style.display = "none";
  if (chatContainerEl) chatContainerEl.style.display = "flex";
  setSegmented("chat");
  // Step index 1 for OurDX
  setPostProgress(1);
  await ensureChatStarted();
}

function openSettingsModal(prefill) {
  if (!settingsModal) return;
  const p = prefill || {};
  if (settingsFields.lang) settingsFields.lang.value = p.primary_language || p.lang || "en";
  if (settingsFields.interpreter) {
    const v = p.interpreter_needed;
    settingsFields.interpreter.value = v === true ? "Yes" : v === false ? "No" : "";
  }
  if (settingsFields.education) settingsFields.education.value = p.education_level || "";
  if (settingsFields.literacy) settingsFields.literacy.value = p.health_literacy || "";
  settingsModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeSettingsModal() {
  if (settingsModal) settingsModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function showSettingsPage() {
  const nameEl = document.getElementById("landing-name") || document.getElementById("demo-patient-name");
  const dobEl = document.getElementById("landing-dob") || document.getElementById("demo-patient-dob");
  const name = (nameEl?.value || "").trim();
  const dob = (dobEl?.value || "").trim();
  if (!name) { nameEl && nameEl.focus(); return; }
  if (!dob) { dobEl && dobEl.focus(); return; }
  // Copy into patient fields for system context later and to seed profile
  const pName = document.getElementById("demo-patient-name");
  const pDob = document.getElementById("demo-patient-dob");
  if (pName) pName.value = name;
  if (pDob) pDob.value = dob;
  // Open centered settings modal with prefill from any stored profile
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem("hc_profile") || "{}"); } catch {}
  openSettingsModal({ ...stored, patient_name: name, patient_dob: dob });
}

function confirmSettings() {
  // Persist settings to profile (localStorage) and update session demographics
  const name = (document.getElementById("demo-patient-name")?.value || "").trim();
  const dob = (document.getElementById("demo-patient-dob")?.value || "").trim();
  // Capture previous profile (if any) to detect patient switch
  let prevProfile = {};
  try { prevProfile = JSON.parse(localStorage.getItem("hc_profile") || "{}"); } catch {}
  const prof = {
    patient_name: name,
    patient_dob: dob,
    sex: modalFields.gender ? modalFields.gender.value : "",
    primary_language: settingsFields.lang ? settingsFields.lang.value : "",
    interpreter_needed: settingsFields.interpreter ? (settingsFields.interpreter.value === "Yes" ? true : settingsFields.interpreter.value === "No" ? false : null) : null,
    education_level: settingsFields.education ? settingsFields.education.value : "",
    health_literacy: settingsFields.literacy ? settingsFields.literacy.value : "",
  };
  // Save profile for profile icon modal prefill
  try { localStorage.setItem("hc_profile", JSON.stringify(prof)); } catch {}
  // If patient changed, refresh data and history
  const normalize = (s) => (s || "").trim().toLowerCase();
  const patientChanged =
    normalize(prevProfile.patient_name) !== normalize(prof.patient_name) ||
    (prevProfile.patient_dob || "") !== (prof.patient_dob || "");
  if (patientChanged) {
    // Clear saved transcripts/history and reset chat session state
    try { localStorage.removeItem("hc_transcripts"); } catch {}
    messages.length = 0;
    chatStarted = false;
    furthestSectionIndex = 0;
    if (chatEl) chatEl.innerHTML = "";
    if (choicesEl) choicesEl.innerHTML = "";
    if (progressEl) progressEl.innerHTML = "";
    if (summaryEl) summaryEl.textContent = "";
    // Refresh history drawer contents if open later
    if (typeof renderHistory === "function") {
      try { renderHistory(); } catch {}
    }
  }
  demographics = {
    ...buildDemographics(),
    ...prof,
  };
  // Update headline with name
  if (askHeadlineEl) {
    const n = prof.patient_name || "there";
    askHeadlineEl.textContent = `Welcome to HealthCoach, ${n}.`;
  }
  closeSettingsModal();
  // Return to landing, hide login fields, and reveal options
  showSection(askLandingEl);
  const loginForm = document.querySelector(".login-form");
  if (loginForm) loginForm.style.display = "none";
  const headerSub = document.querySelector(".ask-headline-wrap .ask-started");
  const landingOptions = document.getElementById("landing-options");
  if (landingOptions) {
    landingOptions.style.display = "block";
    landingOptions.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  // Hide subtitle when showing section chooser
  const subtitleEl = document.querySelector(".page-subtitle");
  if (subtitleEl) subtitleEl.style.display = "none";
}

if (startBtn) startBtn.addEventListener("click", showSettingsPage);
if (settingsConfirmBtn) settingsConfirmBtn.addEventListener("click", confirmSettings);
if (settingsSaveBtn) settingsSaveBtn.addEventListener("click", confirmSettings);
if (settingsCloseBtn) settingsCloseBtn.addEventListener("click", closeSettingsModal);
if (settingsBackdrop) settingsBackdrop.addEventListener("click", closeSettingsModal);
if (reviewBtn) reviewBtn.addEventListener("click", async () => {
  try { await loadLatestTranscriptServer(); } catch {}
  await goToReview();
});
if (ourdxBtn) ourdxBtn.addEventListener("click", goToOurDX);
if (continueOurdxBtn) continueOurdxBtn.addEventListener("click", goToOurDX);

// Allow pressing Enter in the login inputs to trigger Continue
const loginFormEl = document.querySelector(".login-form");
if (loginFormEl) {
  loginFormEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!continueBtn || continueBtn.disabled) return;
      showSettingsPage();
    }
  });
}

// SOAP tabs (review page)
const soapTabsEl = document.getElementById("soap-tabs");
const soapContentEl = document.getElementById("soap-content");
function activateSoapTab(tabId) {
  if (!soapTabsEl || !soapContentEl) return;
  const tabs = Array.from(soapTabsEl.querySelectorAll(".tab"));
  const panels = Array.from(soapContentEl.querySelectorAll("[data-panel]"));
  tabs.forEach((t) => {
    const active = t.getAttribute("data-tab") === tabId;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });
  panels.forEach((p) => {
    const show = p.getAttribute("data-panel") === tabId;
    p.style.display = show ? "block" : "none";
  });
}
if (soapTabsEl) {
  soapTabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    const id = btn.getAttribute("data-tab");
    if (id) activateSoapTab(id);
  });
}

// SOAP tabs in chat view
const soapTabsChatEl = document.getElementById("soap-tabs-chat");
function activateSoapTabChat(tabId) {
  if (!soapTabsChatEl) return;
  const tabs = Array.from(soapTabsChatEl.querySelectorAll(".tab"));
  tabs.forEach((t) => {
    const active = t.getAttribute("data-tab") === tabId;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });
}
function setChatMode(mode) {
  chatMode = mode;
  if (progressEl) progressEl.style.display = mode === "review" ? "none" : "flex";
  if (soapTabsChatEl) soapTabsChatEl.style.display = mode === "review" ? "flex" : "none";
  if (mode === "review") {
    activateSoapTabChat("subjective");
  }
}
if (soapTabsChatEl) {
  soapTabsChatEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    const id = btn.getAttribute("data-tab");
    if (id) activateSoapTabChat(id);
  });
}

// Segmented control handlers
function showChat() {
  if (!chatContainerEl) return;
  setSegmented("chat");
  chatContainerEl.style.display = "flex";
  if (filesContainerEl) filesContainerEl.style.display = "none";
}
function showFiles() {
  if (!filesContainerEl) return;
  setSegmented("files");
  filesContainerEl.style.display = "block";
  if (chatContainerEl) chatContainerEl.style.display = "none";
}
if (segChat) segChat.addEventListener("click", showChat);
if (segFiles) segFiles.addEventListener("click", showFiles);
if (segBackToChat) segBackToChat.addEventListener("click", showChat);
if (modelSelectEl) {
  try {
    const saved = localStorage.getItem("hc_model");
    if (saved) modelSelectEl.value = saved;
  } catch {}
  modelSelectEl.addEventListener("change", () => {
    try { localStorage.setItem("hc_model", modelSelectEl.value); } catch {}
  });
}

// Icons / actions
if (micBtn) {
  micBtn.addEventListener("click", () => {
    // Placeholder: voice input not implemented
    messages.push({ role: "assistant", content: "Voice input coming soon." });
    renderMessages();
    try { localStorage.setItem("hc_current_session", JSON.stringify({ messages })); } catch {}
  });
}
if (connectRecordsBtn) {
  connectRecordsBtn.addEventListener("click", () => {
    // Placeholder: wire to real connection flow if available
    alert("Connecting to medical records is not yet configured.");
  });
}

// Simple navigation stack so Back behaves predictably
let currentViewEl = null;
const navStack = [];
function updateBackButtonState() {
  if (!navBackBtn) return;
  const atRoot = currentViewEl && currentViewEl.id === "ask-landing";
  // Back should be enabled on landing if login is hidden (options visible)
  const loginFormEl = document.querySelector(".login-form");
  const landingOptionsEl = document.getElementById("landing-options");
  const loginHidden = !!(loginFormEl && loginFormEl.style.display === "none");
  const optionsVisible = !!(landingOptionsEl && landingOptionsEl.style.display !== "none");
  const landingSubstateCanGoBack = atRoot && (loginHidden || optionsVisible);
  const canGoBack = navStack.length > 0 || (!atRoot && !!currentViewEl) || landingSubstateCanGoBack;
  navBackBtn.disabled = !canGoBack;
  navBackBtn.style.opacity = canGoBack ? 1 : 0.5;
}
function hideAllSections() {
  if (askLandingEl) askLandingEl.style.display = "none";
  if (postSubmitEl) postSubmitEl.style.display = "none";
  if (reviewContainerEl) reviewContainerEl.style.display = "none";
  if (chatContainerEl) chatContainerEl.style.display = "none";
  if (formEl) formEl.style.display = "none";
}
function showSection(el, options = {}) {
  if (!el) return;
  if (currentViewEl && currentViewEl === el) return;
  if (!options.replace && currentViewEl) {
    navStack.push(currentViewEl);
  }
  hideAllSections();
  // Use flex for chat container so input can stick to bottom
  el.style.display = (el.id === "chat-container") ? "flex" : "block";
  currentViewEl = el;
  updateBackButtonState();
  if (topbarEl) topbarEl.style.display = "flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
  try { localStorage.setItem("hc_last_view", el.id || ""); } catch {}
}
function navigateBack() {
  // Special handling: if we are on landing and login is hidden (options visible), restore login fields
  const onLanding = currentViewEl && currentViewEl.id === "ask-landing";
  if (onLanding) {
    const loginFormEl = document.querySelector(".login-form");
    const landingOptionsEl = document.getElementById("landing-options");
    const loginHidden = !!(loginFormEl && loginFormEl.style.display === "none");
    const optionsVisible = !!(landingOptionsEl && landingOptionsEl.style.display !== "none");
    if (loginHidden || optionsVisible) {
      if (landingOptionsEl) landingOptionsEl.style.display = "none";
      if (loginFormEl) loginFormEl.style.display = "block";
      const subtitleEl = document.querySelector(".page-subtitle");
      if (subtitleEl) subtitleEl.style.display = "";
      updateBackButtonState();
      try { localStorage.setItem("hc_last_view", "ask-landing"); } catch {}
      return;
    }
  }
  if (navStack.length > 0) {
    const prev = navStack.pop();
    hideAllSections();
    prev.style.display = "block";
    currentViewEl = prev;
    updateBackButtonState();
    window.scrollTo({ top: 0, behavior: "smooth" });
    try { localStorage.setItem("hc_last_view", currentViewEl.id || ""); } catch {}
    return;
  }
  // Fallback: if no history in stack, go to landing OPTIONS (not login)
  if (askLandingEl) {
    showSection(askLandingEl, { replace: true });
    const loginFormEl = document.querySelector(".login-form");
    const landingOptionsEl = document.getElementById("landing-options");
    if (loginFormEl) loginFormEl.style.display = "none";
    if (landingOptionsEl) landingOptionsEl.style.display = "block";
    const subtitleEl = document.querySelector(".page-subtitle");
    if (subtitleEl) subtitleEl.style.display = "none";
    try { localStorage.setItem("hc_last_view", "ask-landing"); } catch {}
  }
}
if (askCardReview) askCardReview.addEventListener("click", async () => {
  showSection(reviewContainerEl);
  if (typeof activateSoapTab === "function") activateSoapTab("subjective");
  if (chatContainerEl) chatContainerEl.style.display = "flex";
  setPostProgress(0);
  try { await loadLatestTranscriptServer(); } catch {}
  ensureChatStarted();
});
if (askCardSurvey) askCardSurvey.addEventListener("click", async () => {
  showSection(chatContainerEl);
  await ensureChatStarted();
});

// Topbar back: return to landing
if (navBackBtn) {
  navBackBtn.addEventListener("click", navigateBack);
}

// Start a new chat for the current patient
async function startNewChat() {
  // Clear current conversation id so server creates a new one
  try {
    const p = getProfile();
    const pk = profileKeyFrom(p);
    localStorage.removeItem(`hc_conv:${pk}`);
  } catch {}
  // Reset chat UI/state
  messages.length = 0;
  chatStarted = false;
  if (chatEl) chatEl.innerHTML = "";
  // Use nav helper so Back works
  showSection(chatContainerEl);
  // Ensure demographics system message and render
  await ensureChatStarted();
  // Persist empty conversation to get new id
  try { await saveTranscriptServer(); } catch {}
}
if (newChatBtn) newChatBtn.addEventListener("click", startNewChat);

// Restore last view if present; otherwise show landing
(async function restoreLastView() {
  let last = "";
  try { last = localStorage.getItem("hc_last_view") || ""; } catch {}
  const byId = (id) => id ? document.getElementById(id) : null;
  if (last) {
    const el = byId(last);
    if (el) {
      if (last === "review-container") {
        showSection(reviewContainerEl, { replace: true });
        if (chatContainerEl) chatContainerEl.style.display = "flex";
        setPostProgress(0);
        try { await loadLatestTranscriptServer(); } catch {}
        ensureChatStarted();
        return;
      }
      if (last === "chat-container") {
        showSection(chatContainerEl, { replace: true });
        try { await loadLatestTranscriptServer(); } catch {}
        ensureChatStarted();
        return;
      }
      showSection(el, { replace: true });
      return;
    }
  }
  if (askLandingEl) {
    showSection(askLandingEl, { replace: true });
  }
})();

// Profile modal wiring
function setProfileFields(data) {
  const p = data || {};
  const isoDob = p.patient_dob && /^\d{4}-\d{2}-\d{2}$/.test(p.patient_dob)
    ? p.patient_dob
    : (p.patient_dob ? new Date(p.patient_dob).toISOString().slice(0,10) : "");
  if (modalFields.name) modalFields.name.value = p.patient_name || "";
  if (modalFields.dob) modalFields.dob.value = isoDob || "";
  if (modalFields.gender) modalFields.gender.value = p.sex || "";
  if (modalFields.lang) modalFields.lang.value = p.primary_language || "";
}
function openProfileModal(options) {
  if (!modalEl) return;
  const opts = options || {};
  if (opts.prefill) {
    if (opts.data) {
      setProfileFields(opts.data);
    } else {
      try { setProfileFields(JSON.parse(localStorage.getItem("hc_profile") || "{}")); } catch { setProfileFields({}); }
    }
  } else {
    setProfileFields({});
  }
  modalEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}
function closeProfileModal() {
  if (modalEl) modalEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}
if (navProfileBtn) navProfileBtn.addEventListener("click", () => openProfileModal({ prefill: true }));
if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeProfileModal);
if (modalBackdrop) modalBackdrop.addEventListener("click", closeProfileModal);
if (modalSaveBtn) {
  modalSaveBtn.addEventListener("click", async () => {
    const p = {
      patient_name: modalFields.name ? modalFields.name.value.trim() : "",
      patient_dob: modalFields.dob ? modalFields.dob.value : "",
      sex: modalFields.gender ? modalFields.gender.value : "",
      primary_language: modalFields.lang ? modalFields.lang.value : "",
    };
    try { localStorage.setItem("hc_profile", JSON.stringify(p)); } catch {}
    if (askHeadlineEl) {
      const name = p.patient_name || "there";
      askHeadlineEl.textContent = `Welcome to HealthCoach, ${name}.`;
    }
    closeProfileModal();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalEl && modalEl.getAttribute("aria-hidden") === "false") {
    e.preventDefault();
    closeProfileModal();
  }
  if (e.key === "Escape" && confirmModal && confirmModal.getAttribute("aria-hidden") === "false") {
    e.preventDefault();
    closeConfirmModal();
  }
  if (e.key === "Escape" && summaryModal && summaryModal.getAttribute("aria-hidden") === "false") {
    e.preventDefault();
    closeSummaryModal();
  }
});

// Confirm modal helpers
function openConfirmModal(profile) {
  if (!confirmModal) return;
  if (confirmSummaryEl) {
    confirmSummaryEl.innerHTML = "";
    const add = (label, value) => {
      const row = document.createElement("div");
      row.className = "item";
      const l = document.createElement("div");
      l.className = "label";
      l.textContent = label;
      const v = document.createElement("div");
      v.className = "value";
      v.textContent = value || "—";
      row.appendChild(l); row.appendChild(v);
      confirmSummaryEl.appendChild(row);
    };
    add("Name", profile.patient_name);
    add("Date of birth", profile.patient_dob);
    add("Gender", profile.sex);
    add("Primary language", profile.primary_language);
  }
  confirmModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}
function closeConfirmModal() {
  if (confirmModal) confirmModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}
if (confirmCloseBtn) confirmCloseBtn.addEventListener("click", closeConfirmModal);
if (confirmBackdrop) confirmBackdrop.addEventListener("click", closeConfirmModal);

async function renderHistory() {
  if (!historyList) return;
  historyList.innerHTML = "";
  try {
    const p = getProfile();
    const q = `patient_name=${encodeURIComponent(p.patient_name || "")}&patient_dob=${encodeURIComponent(p.patient_dob || "")}`;
    const list = await apiGet(`/transcripts/list?${q}`);
    const items = (list && Array.isArray(list.items)) ? list.items : [];
    if (items.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No previous chats yet.";
      historyList.appendChild(li);
      return;
    }
    items.forEach((t) => {
      const li = document.createElement("li");
      const dateStr = t.updated_at || t.created_at || null;
      const date = dateStr ? new Date(dateStr).toLocaleString() : "";
      li.textContent = `Chat • ${date}`;
      li.addEventListener("click", async () => {
        try {
          const doc = await apiGet(`/transcripts/get?id=${encodeURIComponent(t.id)}&${q}`);
          if (doc && Array.isArray(doc.messages)) {
            messages.length = 0;
            doc.messages.forEach(m => messages.push(m));
            setCurrentConversationId(doc.id || t.id);
            showSection(chatContainerEl);
            renderMessages();
          }
        } finally {
          if (historyDrawer) historyDrawer.setAttribute("aria-hidden", "true");
        }
      });
      historyList.appendChild(li);
    });
  } catch (e) {
    const li = document.createElement("li");
    li.textContent = "Failed to load history.";
    historyList.appendChild(li);
  }
}
function openHistory() {
  if (!historyDrawer) return;
  renderHistory();
  historyDrawer.setAttribute("aria-hidden", "false");
}
function closeHistory() {
  if (historyDrawer) historyDrawer.setAttribute("aria-hidden", "true");
}
if (navHistoryBtn) navHistoryBtn.addEventListener("click", openHistory);
if (historyClose) historyClose.addEventListener("click", closeHistory);
if (historyBackdrop) historyBackdrop.addEventListener("click", closeHistory);

function openSummaryModal(text) {
  if (!summaryModal) return;
  const t = (text || "").trim();
  lastSummaryText = t;
  if (summaryModalText) summaryModalText.textContent = t;
  // Configure dynamic "switch" button label and action
  if (summarySwitchBtn) {
    const onReview = currentViewEl && currentViewEl === reviewContainerEl;
    const onChat = currentViewEl && currentViewEl === chatContainerEl;
    const label = onReview ? "Go to OurDX" : "Go to Review";
    const span = summarySwitchBtn.querySelector("span");
    if (span) span.textContent = label;
    summarySwitchBtn.onclick = async () => {
      closeSummaryModal();
      try {
        if (onReview) {
          await goToOurDX();
        } else {
          await goToReview();
        }
      } catch {}
    };
  }
  summaryModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}
function closeSummaryModal() {
  if (summaryModal) summaryModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}
if (summaryCloseBtn) summaryCloseBtn.addEventListener("click", closeSummaryModal);
if (summaryBackdrop) summaryBackdrop.addEventListener("click", closeSummaryModal);
if (summaryOkBtn) summaryOkBtn.addEventListener("click", closeSummaryModal);
// Removed individual download buttons; unified ZIP download via "Download" button
if (summaryShareBtn) {
  summaryShareBtn.addEventListener("click", () => {
    const p = getProfile();
    const name = (p.patient_name || "").trim();
    const subject = `Conversation summary${name ? " — " + name : ""}`;
    const body = (summaryModalText?.textContent || "").trim();
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try { window.open(mailto, "_blank"); } catch { window.location.href = mailto; }
  });
}
if (downloadSelectedBtn) {
  downloadSelectedBtn.addEventListener("click", () => {
    const includeSummary = !!(selectSummaryCb && selectSummaryCb.checked);
    const includeTranscript = !!(selectTranscriptCb && selectTranscriptCb.checked);
    if (!includeSummary && !includeTranscript) return;
    const p = getProfile();
    const name = (p.patient_name || "patient").trim();
    const dob = (p.patient_dob || "").trim();
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const base = [name, dob].filter(Boolean).join("_") || "chat";

    // Trigger individual downloads (no ZIP)
    if (includeSummary) {
      const filename = `summary_${base}_${ts}.txt`.toLowerCase().replace(/\s+/g, "_");
      const text = (lastSummaryText || summaryModalText?.textContent || "").trim();
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    if (includeTranscript) {
      const filename = `transcript_${base}_${ts}.json`.toLowerCase().replace(/\s+/g, "_");
      const data = JSON.stringify({ messages }, null, 2);
      const blob = new Blob([data], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  });
}

function saveTranscriptSnapshot() {
  const snapshot = {
    id: Date.now(),
    timestamp: Date.now(),
    title: (messages.find(m => m.role === "user")?.content || "Chat").slice(0, 48),
    messages: [...messages],
  };
  let list = [];
  try { list = JSON.parse(localStorage.getItem("hc_transcripts") || "[]"); } catch {}
  list.push(snapshot);
  localStorage.setItem("hc_transcripts", JSON.stringify(list));
}
