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
      const inner = textLines.map((l) => applyInlineMarkdown(l)).join('<br>');
      if (inner.trim()) {
        blocks.push({ type: 'p', html: inner });
      }
    }
  }

  return renderBlocks(blocks);
}

function renderBlocks(blocks) {
  const parts = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.type === 'header') {
      const headerHtml = `<div class="msg-section-header">${block.text}</div>`;
      const contentParts = [];
      i++;
      while (i < blocks.length && blocks[i].type !== 'header') {
        contentParts.push(renderSingleBlock(blocks[i]));
        i++;
      }
      if (contentParts.length) {
        parts.push(
          `<div class="msg-section">${headerHtml}<div class="msg-section-body">${contentParts.join('')}</div></div>`
        );
      } else {
        parts.push(`<div class="msg-section">${headerHtml}</div>`);
      }
      continue;
    }

    parts.push(renderSingleBlock(block));
    i++;
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
