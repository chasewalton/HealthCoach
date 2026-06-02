const BULLET_LINE = /^(\s*)([-*])\s+(.*)$/;
const ORDERED_LINE = /^(\s*)(\d+)\.\s+(.*)$/;

/** Canonical: "What Your Provider Thought:". Legacy headers still parsed below. */
const VISIT_RECAP_IMPRESSION_LABEL = 'What Your Provider Thought:';

/** Regex fragment: provider impression section start (canonical or legacy). */
const VISIT_RECAP_IMPRESSION_HEADER_RE =
  `(?:what\\s+your\\s+provider\\s+thought|provider[\u0027\u2019]?s\\s+impression|visit\\s+summary)`;

const visitRecapImpressionStartRe = new RegExp(
  `(^|\\n)[ \\t]*${VISIT_RECAP_IMPRESSION_HEADER_RE}\\s*:[ \\t]*`,
  'i'
);

const visitRecapHasImpressionSectionRe = new RegExp(
  `${VISIT_RECAP_IMPRESSION_HEADER_RE}\\s*:`,
  'i'
);

const visitRecapSectionHeaderLineRe = new RegExp(
  `^(?:(?:your\\s+)?main\\s+concerns|next\\s+steps|${VISIT_RECAP_IMPRESSION_HEADER_RE})\\s*:`,
  'im'
);

/**
 * When the message is clearly the structured visit recap (main concerns + next steps),
 * rewrite legacy "Provider's Impression:" (ASCII or curly apostrophe) to the canonical
 * subheading so chat and summary panels match prompts. Scoped to recap-shaped copy only.
 */
function normalizeVisitRecapLegacyImpressionHeader(text) {
  const s = String(text ?? '').replace(/\r\n/g, '\n');
  if (!s.trim()) return s;
  if (!/(?:^|\n)[ \t]*(?:your\s+)?main\s+concerns\s*:/im.test(s)) return s;
  if (!/(?:^|\n)[ \t]*next\s+steps\s*:/im.test(s)) return s;
  return s.replace(
    /(^|\n)([ \t]*)provider[\u0027\u2019]s\s+impression\s*:/gim,
    (_, pre, indent) => `${pre}${indent}What Your Provider Thought:`
  );
}

/**
 * Matches a standalone section header like "Why you came in:" or "Your cholesterol:"
 * Must be 3-55 chars, letters/digits/spaces/hyphens/parens/apostrophes, ending with colon.
 * Must contain at least one space (avoids single-word false positives like "Sure:").
 */
const HEADER_LINE = /^[A-Z][A-Za-z0-9 '\-,/()]{2,53}:$/;

function applyInlineMarkdown(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/**
 * Splits assistant copy into primary (conversation) + secondary (UI instructions).
 * Rendered with `.chat-msg-text--instruction`; removed for model/export via {@link stripInstructionMarker}.
 */
export const MESSAGE_INSTRUCTION_SPLIT = '\n\n[HC_INSTRUCTION]\n\n';

export function composeMessageWithInstruction(primary, instruction) {
  const p = String(primary ?? '').trimEnd();
  const i = String(instruction ?? '').trim();
  if (!i) return p;
  return p + MESSAGE_INSTRUCTION_SPLIT + i;
}

/** Replace instruction delimiter with a normal paragraph break for LLM history, exports, and plain text. */
export function stripInstructionMarker(text) {
  if (text == null || text === '') return '';
  return String(text).split(MESSAGE_INSTRUCTION_SPLIT).join('\n\n');
}

function isHeaderLine(line) {
  const trimmed = line.trim();
  if (!HEADER_LINE.test(trimmed)) return false;
  if (!trimmed.includes(' ')) return false;
  return true;
}

function extractHeaderText(line) {
  return line.trim().replace(/:$/, '');
}

/** Section card styling; these render as plain subheadings (no bubble/card). */
function isPlainSubheadingHeader(text) {
  const t = (text || '').trim();
  return /^here'?s how to prepare$/i.test(t);
}

/**
 * If a run of plain-text lines ends with one or more lines that form a
 * question (last non-empty line ends with '?'), and there is preceding
 * non-question content separated by a blank line, split into two groups
 * so the question renders as its own paragraph block outside section cards.
 */
function splitTrailingQuestion(textLines) {
  let lastBlank = -1;
  for (let j = textLines.length - 1; j >= 0; j--) {
    if (textLines[j].trim() === '') { lastBlank = j; break; }
  }
  if (lastBlank <= 0) return [textLines];

  const tail = textLines.slice(lastBlank + 1);
  while (tail.length && tail[0].trim() === '') tail.shift();
  if (!tail.length) return [textLines];

  const lastLine = tail[tail.length - 1].trim();
  if (!lastLine.endsWith('?')) return [textLines];

  const head = textLines.slice(0, lastBlank);
  while (head.length && head[head.length - 1].trim() === '') head.pop();
  if (!head.length) return [textLines];

  return [head, tail];
}

/**
 * If an assistant message contains the three structured visit-recap sections
 * ("Your Main Concerns:" [or legacy "Main concerns:"], "What Your Provider Thought:"
 * [legacy "Provider's Impression:" or "Visit summary:"], "Next steps:"), enforce the
 * canonical ordering (Your Main Concerns → What Your Provider Thought → Next steps) and
 * convert a prose impression body into bullet points (one sentence per bullet).
 * Prompts ask the model for this, but models sometimes reorder or write prose;
 * older saved sessions may still use legacy headers.
 */
export function reorderAndBulletizeVisitRecap(text) {
  const s = String(text ?? '').replace(/\r\n/g, '\n');
  if (!s.trim()) return s;

  const mainRe = /(^|\n)[ \t]*(?:your\s+)?main\s+concerns\s*:[ \t]*/i;
  const nextRe = /(^|\n)[ \t]*next\s+steps\s*:[ \t]*/i;

  const im = s.match(visitRecapImpressionStartRe);
  const mm = s.match(mainRe);
  const nm = s.match(nextRe);
  if (!im || !mm || !nm) return s;

  const iStart = im.index + (im[1] ? 1 : 0);
  const mStart = mm.index + (mm[1] ? 1 : 0);
  const nStart = nm.index + (nm[1] ? 1 : 0);

  const bounds = [
    { key: 'impression', start: iStart, label: VISIT_RECAP_IMPRESSION_LABEL },
    { key: 'main', start: mStart, label: 'Your Main Concerns:' },
    { key: 'next', start: nStart, label: 'Next steps:' },
  ].sort((a, b) => a.start - b.start);

  const firstStart = bounds[0].start;
  const opener = s.slice(0, firstStart).replace(/\s+$/, '');

  const bodies = {};
  for (let i = 0; i < bounds.length; i++) {
    const startIdx = bounds[i].start;
    const endIdx = i + 1 < bounds.length ? bounds[i + 1].start : s.length;
    const chunk = s.slice(startIdx, endIdx);
    const headerEnd = chunk.indexOf(':');
    const body = (headerEnd >= 0 ? chunk.slice(headerEnd + 1) : chunk).replace(/^\s*\n?/, '').trimEnd();
    bodies[bounds[i].key] = body;
  }

  let impressionBody = bodies.impression;
  const alreadyBulleted = /^\s*[-*]\s+/m.test(impressionBody);
  if (!alreadyBulleted && impressionBody.trim()) {
    const flat = impressionBody.replace(/\s*\n+\s*/g, ' ').trim();
    const sentences = flat
      .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
      .map((x) => x.trim())
      .filter(Boolean);
    const items = sentences.length ? sentences : [flat];
    impressionBody = items.map((x) => `- ${x}`).join('\n');
  }

  const parts = [];
  if (opener.trim()) parts.push(opener.trim());
  parts.push(`Your Main Concerns:\n${bodies.main}`);
  parts.push(`${VISIT_RECAP_IMPRESSION_LABEL}\n${impressionBody}`);
  parts.push(`Next steps:\n${bodies.next}`);
  return parts.join('\n\n');
}

/**
 * Groups consecutive lines into semantic blocks: section-headers, bullet lists,
 * ordered lists, and paragraph text.  Then wraps header + following content into
 * visual "section cards" so patients see clear groupings instead of a wall of text.
 */
export function formatMessage(text) {
  if (text == null || text === '') return '';

  const normalized = reorderAndBulletizeVisitRecap(
    normalizeVisitRecapLegacyImpressionHeader(String(text))
  );
  const instrAt = normalized.indexOf(MESSAGE_INSTRUCTION_SPLIT);
  if (instrAt !== -1) {
    const primaryPart = normalized.slice(0, instrAt);
    const instructionPart = normalized.slice(instrAt + MESSAGE_INSTRUCTION_SPLIT.length);
    const headHtml = formatMessage(primaryPart);
    const tailHtml = formatInstructionParagraphs(instructionPart);
    return headHtml + tailHtml;
  }

  const escaped = escapeHtml(normalized);
  if (!escaped.trim()) return '';

  const lines = escaped.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isHeaderLine(line)) {
      blocks.push({ type: 'header', text: extractHeaderText(line) });
      i++;
      continue;
    }

    const bullet = line.match(BULLET_LINE);
    if (bullet) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(BULLET_LINE);
        if (!m) break;
        items.push(applyInlineMarkdown(m[3]));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    const ordered = line.match(ORDERED_LINE);
    if (ordered) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(ORDERED_LINE);
        if (!m) break;
        items.push(applyInlineMarkdown(m[3]));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const textLines = [];
    while (i < lines.length) {
      if (lines[i].match(BULLET_LINE) || lines[i].match(ORDERED_LINE) || isHeaderLine(lines[i])) break;
      textLines.push(lines[i]);
      i++;
    }
    while (textLines.length && textLines[0].trim() === '') textLines.shift();
    while (textLines.length && textLines[textLines.length - 1].trim() === '') textLines.pop();
    if (textLines.length) {
      const groups = splitTrailingQuestion(textLines);
      for (const group of groups) {
        const inner = group.map((l) => applyInlineMarkdown(l)).join('<br>');
        if (inner.trim()) {
          blocks.push({ type: 'p', html: inner });
        }
      }
    }
  }

  return renderBlocks(blocks);
}

function isTrailingQuestion(block) {
  if (block.type !== 'p') return false;
  const text = block.html.replace(/<[^>]+>/g, '').trim();
  return text.endsWith('?');
}

function renderBlocks(blocks) {
  let trailing = null;
  if (
    blocks.length >= 2 &&
    isTrailingQuestion(blocks[blocks.length - 1]) &&
    blocks.some((b) => b.type === 'header')
  ) {
    trailing = blocks[blocks.length - 1];
    blocks = blocks.slice(0, -1);
  }

  const parts = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.type === 'header') {
      const plain = isPlainSubheadingHeader(block.text);
      const sectionClass = plain ? 'msg-section msg-section--plain' : 'msg-section';
      const headerHtml = `<div class="msg-section-header">${block.text}</div>`;
      const contentParts = [];
      i++;
      while (i < blocks.length && blocks[i].type !== 'header') {
        contentParts.push(renderSingleBlock(blocks[i]));
        i++;
      }
      if (contentParts.length) {
        parts.push(
          `<div class="${sectionClass}">${headerHtml}<div class="msg-section-body">${contentParts.join('')}</div></div>`
        );
      } else {
        parts.push(`<div class="${sectionClass}">${headerHtml}</div>`);
      }
      continue;
    }

    parts.push(renderSingleBlock(block));
    i++;
  }

  if (trailing) {
    parts.push(renderSingleBlock(trailing));
  }

  return parts.join('');
}

function renderSingleBlock(block) {
  switch (block.type) {
    case 'ul':
      return `<ul class="chat-msg-list">${block.items.map((t) => `<li>${t}</li>`).join('')}</ul>`;
    case 'ol':
      return `<ol class="chat-msg-list chat-msg-list--ordered">${block.items.map((t) => `<li>${t}</li>`).join('')}</ol>`;
    case 'p':
      return `<p class="chat-msg-text">${block.html}</p>`;
    default:
      return '';
  }
}

/**
 * Removes trailing question line(s) after a structured visit recap (includes a
 * "What Your Provider Thought:" or legacy "Provider's Impression:" / "Visit summary:" section).
 * Models often still append engagement questions (e.g. "What part of this visit…") despite prompts.
 */
export function stripTrailingVisitRecapEngagementQuestion(text) {
  let s = String(text ?? '').replace(/\r\n/g, '\n').trimEnd();
  if (!s) return s;
  if (!visitRecapHasImpressionSectionRe.test(s)) return s;

  for (let guard = 0; guard < 8; guard++) {
    const t = s.trimEnd();
    const idx = t.lastIndexOf('\n\n');
    if (idx === -1) break;
    const tail = t.slice(idx + 2).trim();
    if (!tail.endsWith('?')) break;
    if (tail.length > 600) break;
    if (visitRecapSectionHeaderLineRe.test(tail)) break;
    s = t.slice(0, idx).trimEnd();
  }

  for (let guard = 0; guard < 4; guard++) {
    const t = s.trimEnd();
    const m = t.match(/\n([^\n]+\?)\s*$/);
    if (!m) break;
    const line = m[1].trim();
    if (line.length > 400) break;
    if (visitRecapSectionHeaderLineRe.test(line)) break;
    s = t.slice(0, m.index).trimEnd();
  }

  // Exact known closing (with or without a newline before it)
  s = s.replace(/\s*\n+What part of this visit has been on your mind the most\?\s*$/i, '');
  s = s.replace(/\s+What part of this visit has been on your mind the most\?\s*$/i, '');

  return s.trimEnd();
}

/**
 * Sanitizes a brief-ack LLM reply (the short reflective acknowledgments shown
 * between scripted dashboard steps). These should be 1–2 plain sentences with
 * no question and no list. Models sometimes append the next scripted question
 * or leak future-step content (e.g. share-recipient option lists) into the ack,
 * which makes the app look like it skipped a turn or asked twice. We:
 *   1. Drop list-like and ALL-CAPS cue lines (bullets, numbered options,
 *      "YOU CAN CHOOSE ONE OR MORE", etc.).
 *   2. Truncate at the first interrogative sentence — an acknowledgment must
 *      never pose a question; the app drives every transition.
 * Defense-in-depth alongside the brief-ack system prompt rules.
 */
export function sanitizeBriefAckReply(text) {
  let s = String(text ?? '').replace(/\r\n/g, '\n').trim();
  if (!s) return s;

  s = s
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^[-*•]\s+/.test(t)) return false;
      if (/^\d+[.)]\s+/.test(t)) return false;
      if (t.length >= 6 && /[A-Z]{2}/.test(t) && !/[a-z]/.test(t)) return false;
      return true;
    })
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!s) return s;

  const qIdx = s.indexOf('?');
  if (qIdx !== -1) {
    let boundary = -1;
    for (let i = qIdx - 1; i >= 0; i--) {
      const ch = s[i];
      if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') {
        boundary = i;
        break;
      }
    }
    s = s.slice(0, boundary + 1).trim();
  }

  return s.trim();
}

export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatInstructionParagraphs(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  const paragraphs = raw
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs
    .map((para) => {
      const escaped = escapeHtml(para);
      const inner = escaped.split('\n').map((line) => applyInlineMarkdown(line)).join('<br>');
      return `<p class="chat-msg-text chat-msg-text--instruction">${inner}</p>`;
    })
    .join('');
}
