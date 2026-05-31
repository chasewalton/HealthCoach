/**
 * Standalone test harness for the pre-note redline editor.
 * Mirrors the card render in LandingScreen.js so we can iterate on the editor
 * without going through the full landing chat flow.
 */
import { formatMessage, escapeHtml } from '../utils/format.js';
import {
  attachTrackChanges,
  hasTrackedChanges,
  acceptAllChanges,
  rejectAllChanges,
  flattenAcceptedText,
} from '../utils/trackChanges.js';

const SAMPLES = [
  {
    id: 'cholesterol',
    label: 'Cholesterol follow-up',
    text:
`Visit priorities:
- I would like to talk about my cholesterol numbers
- I want to understand if my statin dose is still right

Questions for your provider:
- How are my cholesterol levels doing since my last bloodwork?
- Should I be doing anything different with diet or exercise?
- Do I need another lipid panel before the next visit?

Since last visit:
- Started walking 20 minutes most days
- Cut down on red meat to about once a week
- No new chest pain or shortness of breath

Current medications and adherence:
- Atorvastatin 20mg nightly - taking consistently
- Lisinopril 10mg morning - taking consistently
- Aspirin 81mg morning - sometimes forget on weekends

What I want from this visit:
- Confirm the plan is still working
- Decide if I should track BP at home`,
  },
  {
    id: 'sleep',
    label: 'Sleep and energy concerns',
    text:
`Visit priorities:
- I am tired all the time even when I sleep eight hours
- I want to know if this could be related to my thyroid

Questions for your provider:
- Could my fatigue be from something other than poor sleep?
- Should we check my thyroid and iron levels again?
- Is there a referral that would help me figure this out?

Since last visit:
- Cut back on caffeine after noon
- Tried going to bed at the same time most nights
- Still wake up at least once and feel groggy in the morning

Current medications and adherence:
- Levothyroxine 75mcg morning - taking consistently
- Vitamin D 2000 IU daily - taking most days

What I want from this visit:
- A plan I can actually stick to during the workweek
- Clarity on whether more labs are needed`,
  },
  {
    id: 'empty',
    label: 'Minimal draft (edge case)',
    text:
`Visit priorities:
You did not identify specific priorities to focus on for this visit.

Questions for your provider:
- (none added yet)

Since last visit:
- (nothing reported)`,
  },
  {
    id: 'paragraphs',
    label: 'Prose-heavy draft (paragraphs)',
    text:
`Visit priorities:
The patient would like to discuss ongoing back pain that flares up after long periods of sitting at a desk. They would also like to confirm whether the current pain plan is working or if something needs to change.

Questions for your provider:
The patient wants to know whether physical therapy is worth restarting, whether imaging is still warranted, and what to do if the next flare keeps them from working for more than a day.

Since last visit:
The patient has been doing the home stretching plan most mornings, has reduced ibuprofen use to about twice a week, and has not had any new symptoms such as numbness or weakness.

What I want from this visit:
The patient wants a written plan they can refer back to and a clear answer about whether to restart PT.`,
  },
];

const STATIC_LABELS = {
  en: {
    cardAria: 'Pre-note draft',
    cardLabel: 'HealthCoach Chat Summary',
    editBtn: 'Edit with track changes',
    editingBtn: 'Done editing',
    editAria:
      'Edit the pre-note. New text appears underlined in green; deleted text appears struck through in red.',
    editControlsAria: 'Track-changes actions',
    acceptAllBtn: 'Accept all changes',
    rejectAllBtn: 'Reject all changes',
    approveBtn: 'Approve Summary',
    applyEditsBtn: 'Apply Edits',
    guidance:
      'Read through the pre-note above. Tap "Edit with track changes" to make changes - your insertions show in green and deletions show in red. When you are happy with it, tap Approve Summary (or Apply Edits if you made changes).',
    editHintHtml:
      'Click anywhere to place your cursor. Typing adds <span class="track-ins-swatch">new text</span>; pressing Delete or Backspace marks text as <span class="track-del-swatch">deleted</span> without removing it. Use Accept all or Reject all to finalize.',
  },
  es: {
    cardAria: 'Borrador de pre-nota',
    cardLabel: 'Resumen del Chat de HealthCoach',
    editBtn: 'Editar con control de cambios',
    editingBtn: 'Terminar edicion',
    editAria:
      'Edite la pre-nota. El texto nuevo aparece subrayado en verde; el texto eliminado aparece tachado en rojo.',
    editControlsAria: 'Acciones de control de cambios',
    acceptAllBtn: 'Aceptar todos los cambios',
    rejectAllBtn: 'Rechazar todos los cambios',
    approveBtn: 'Aprobar resumen',
    applyEditsBtn: 'Aplicar cambios',
    guidance:
      'Lea la pre-nota de arriba. Pulse "Editar con control de cambios" para hacer cambios - las inserciones aparecen en verde y las eliminaciones en rojo. Cuando este satisfecho, pulse Aprobar resumen (o Aplicar cambios si hizo modificaciones).',
    editHintHtml:
      'Haga clic en cualquier lugar para colocar el cursor. Al escribir se agrega <span class="track-ins-swatch">texto nuevo</span>; al pulsar Suprimir o Retroceso el texto se marca como <span class="track-del-swatch">eliminado</span> sin quitarlo. Use Aceptar todos o Rechazar todos para finalizar.',
  },
};

const harnessState = {
  lang: 'en',
  sampleId: SAMPLES[0].id,
  draft: SAMPLES[0].text,
  draftHtml: '',
  isEditing: false,
};

function t(key) {
  return STATIC_LABELS[harnessState.lang][key] ?? STATIC_LABELS.en[key] ?? key;
}

function getCurrentSample() {
  return SAMPLES.find((s) => s.id === harnessState.sampleId) ?? SAMPLES[0];
}

function htmlHasTrackedChanges(html) {
  if (typeof html !== 'string' || !html) return false;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return hasTrackedChanges(tmp);
}

function updateStatus() {
  const editor = document.getElementById('editor-test-summary-body');
  const inEditor = editor ? hasTrackedChanges(editor) : false;
  const inStored = htmlHasTrackedChanges(harnessState.draftHtml);
  const hasEdits = inEditor || inStored;
  document.getElementById('editor-test-has-edits').textContent = hasEdits ? 'yes' : 'no';
  document.getElementById('editor-test-btn-label').textContent =
    hasEdits ? t('applyEditsBtn') : t('approveBtn');

  let finalHtmlSource = '';
  if (editor) finalHtmlSource = editor.innerHTML;
  else finalHtmlSource = harnessState.draftHtml || formatMessage(harnessState.draft);

  const tmp = document.createElement('div');
  tmp.innerHTML = finalHtmlSource;
  acceptAllChanges(tmp);
  const flattened = flattenAcceptedText(tmp);

  document.getElementById('editor-test-final-output').textContent = flattened || '(empty)';
  document.getElementById('editor-test-html-output').textContent =
    (editor ? editor.innerHTML : harnessState.draftHtml) || '(no redlines yet)';
}

function updateLangIndicator() {
  document.getElementById('editor-test-lang-indicator').textContent =
    `language: ${harnessState.lang.toUpperCase()}`;
}

function renderCard() {
  const container = document.getElementById('editor-test-chat-container');
  if (!container) return;
  const existing = container.querySelector(':scope > .landing-handoff-summary-card');
  existing?.remove();

  const isEditing = harnessState.isEditing;
  const bodyHtml = harnessState.draftHtml
    ? harnessState.draftHtml
    : formatMessage(harnessState.draft);
  const hasPendingEdits = htmlHasTrackedChanges(harnessState.draftHtml);
  const approveBtnLabel = hasPendingEdits ? t('applyEditsBtn') : t('approveBtn');
  const editBtnLabel = isEditing ? t('editingBtn') : t('editBtn');

  const card = document.createElement('div');
  card.className = 'landing-handoff-summary-card';
  if (isEditing) card.classList.add('is-editing');
  card.setAttribute('aria-label', t('cardAria'));
  card.innerHTML = `
    <div class="landing-handoff-summary-card-header">
      <div class="landing-handoff-summary-label">${escapeHtml(t('cardLabel'))}</div>
    </div>
    <div class="landing-handoff-summary-guidance landing-handoff-summary-guidance--top">${formatMessage(t('guidance'))}</div>
    <div
      class="landing-handoff-summary-body"
      id="editor-test-summary-body"
      ${isEditing ? 'contenteditable="true" spellcheck="true" aria-label="' + escapeHtml(t('editAria')) + '"' : ''}
    >${bodyHtml}</div>
    <div class="landing-handoff-summary-footer">
      <div class="landing-action-row landing-handoff-main-actions">
        <button
          type="button"
          class="landing-action-btn${isEditing ? ' is-active' : ''}"
          id="editor-test-edit-btn"
          aria-pressed="${isEditing ? 'true' : 'false'}"
        >${escapeHtml(editBtnLabel)}</button>
        <button type="button" class="landing-action-btn" id="editor-test-approve-btn">${escapeHtml(approveBtnLabel)}</button>
      </div>
    </div>
  `;

  const inputArea = container.querySelector(':scope > .landing-chat-input-area');
  container.insertBefore(card, inputArea);

  card.querySelector('#editor-test-approve-btn').addEventListener('click', handleApprove);
  card.querySelector('#editor-test-edit-btn').addEventListener('click', toggleEditing);
  if (isEditing) {
    const editor = card.querySelector('#editor-test-summary-body');
    const approveBtn = card.querySelector('#editor-test-approve-btn');
    if (editor) {
      const persist = () => {
        harnessState.draftHtml = editor.innerHTML;
        if (approveBtn) {
          approveBtn.textContent = hasTrackedChanges(editor)
            ? t('applyEditsBtn')
            : t('approveBtn');
        }
        updateStatus();
      };
      attachTrackChanges(editor, persist);
      requestAnimationFrame(() => editor.focus());
    }
  }

  updateStatus();
}

function toggleEditing() {
  if (harnessState.isEditing) {
    const editor = document.getElementById('editor-test-summary-body');
    if (editor) {
      harnessState.draftHtml = editor.innerHTML;
      if (!hasTrackedChanges(editor)) harnessState.draftHtml = '';
    }
    harnessState.isEditing = false;
  } else {
    harnessState.isEditing = true;
  }
  renderCard();
}

function handleAcceptAll() {
  const editor = document.getElementById('editor-test-summary-body');
  if (!editor) return;
  acceptAllChanges(editor);
  harnessState.draft = flattenAcceptedText(editor);
  harnessState.draftHtml = '';
  harnessState.isEditing = false;
  renderCard();
}

function handleRejectAll() {
  const editor = document.getElementById('editor-test-summary-body');
  if (!editor) return;
  rejectAllChanges(editor);
  harnessState.draftHtml = '';
  harnessState.isEditing = false;
  renderCard();
}

function handleApprove() {
  const editor = document.getElementById('editor-test-summary-body');
  const hasPendingHtml = htmlHasTrackedChanges(harnessState.draftHtml);
  const hasPendingLive = !!(editor && harnessState.isEditing && hasTrackedChanges(editor));
  if (hasPendingHtml || hasPendingLive) {
    let flat;
    if (editor && (harnessState.isEditing || harnessState.draftHtml)) {
      acceptAllChanges(editor);
      flat = flattenAcceptedText(editor);
    } else if (harnessState.draftHtml) {
      const tmp = document.createElement('div');
      tmp.innerHTML = harnessState.draftHtml;
      acceptAllChanges(tmp);
      flat = flattenAcceptedText(tmp);
    } else {
      flat = harnessState.draft;
    }
    harnessState.draft = flat;
    harnessState.draftHtml = '';
    harnessState.isEditing = false;
    renderCard();
    return;
  }
  const finalText = harnessState.draft;
  const message = `[Approve clicked]\nFinal plain-text submission:\n\n${finalText}`;
  console.log(message);
  window.alert(message);
}

function resetDraft() {
  const sample = getCurrentSample();
  harnessState.draft = sample.text;
  harnessState.draftHtml = '';
  harnessState.isEditing = false;
  renderCard();
}

function populateSampleSelect() {
  const sel = document.getElementById('editor-test-sample');
  sel.innerHTML = SAMPLES.map((s) =>
    `<option value="${s.id}">${s.label}</option>`
  ).join('');
  sel.value = harnessState.sampleId;
}

function wireToolbar() {
  document.getElementById('editor-test-sample').addEventListener('change', (e) => {
    harnessState.sampleId = e.target.value;
    resetDraft();
  });
  document.getElementById('editor-test-reset').addEventListener('click', resetDraft);
  document.getElementById('editor-test-toggle-en-es').addEventListener('click', () => {
    harnessState.lang = harnessState.lang === 'en' ? 'es' : 'en';
    updateLangIndicator();
    renderCard();
  });
}

populateSampleSelect();
wireToolbar();
updateLangIndicator();
renderCard();
