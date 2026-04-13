const BULLET_LINE = /^(\s*)([-*])\s+(.*)$/;
const ORDERED_LINE = /^(\s*)(\d+)\.\s+(.*)$/;

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
 * Groups consecutive lines into semantic blocks: section-headers, bullet lists,
 * ordered lists, and paragraph text.  Then wraps header + following content into
 * visual "section cards" so patients see clear groupings instead of a wall of text.
 */
export function formatMessage(text) {
  if (text == null || text === '') return '';

  const escaped = escapeHtml(String(text));
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

export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
