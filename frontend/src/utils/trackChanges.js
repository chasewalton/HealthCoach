/**
 * Track-changes ("redline") editor for contenteditable hosts.
 *
 * Behavior, modelled on legal redlining / Word's Track Changes:
 *   - Typing in the host element wraps new characters in <ins class="track-ins">
 *     (rendered green/underlined).
 *   - Backspace/Delete on original text wraps the affected characters in
 *     <del class="track-del"> (rendered red strikethrough) instead of removing them.
 *   - Backspace/Delete on text that is already inside an <ins> physically removes
 *     those characters (it was an unsubmitted insertion, so the user is undoing it).
 *   - Backspace/Delete that touches an existing <del> skips past the strikethrough
 *     (those characters are already marked deleted).
 *   - Selection deletion wraps the whole selection in <del> (with the above ins/del
 *     short-circuits applied per-character).
 *
 * The DOM inside the editor is the source of truth. Callers can flatten the
 * markup via `flattenAcceptedText()` or `flattenRejectedText()` to get the
 * final plain-text version on approval / cancel.
 */

const INS_CLASS = 'track-ins';
const DEL_CLASS = 'track-del';

function isElementWith(node, tagName, className) {
  return !!(
    node &&
    node.nodeType === Node.ELEMENT_NODE &&
    node.tagName === tagName &&
    node.classList?.contains(className)
  );
}

function isInsEl(node) { return isElementWith(node, 'INS', INS_CLASS); }
function isDelEl(node) { return isElementWith(node, 'DEL', DEL_CLASS); }

function ancestorWithin(node, predicate, root) {
  let cur = node;
  while (cur && cur !== root) {
    if (predicate(cur)) return cur;
    cur = cur.parentNode;
  }
  return null;
}

function createIns(text) {
  const el = document.createElement('ins');
  el.className = INS_CLASS;
  if (text) el.appendChild(document.createTextNode(text));
  return el;
}

function createDel() {
  const el = document.createElement('del');
  el.className = DEL_CLASS;
  return el;
}

function setCaret(node, offset) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function setCaretAfter(node) {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function setCaretBefore(node) {
  const range = document.createRange();
  range.setStartBefore(node);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function getActiveRange(root) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }
  return range;
}

function handleInsertText(range, text, root) {
  if (!text) return;
  if (!range.collapsed) deleteRange(range, root);
  const sel = window.getSelection();
  const active = sel.rangeCount ? sel.getRangeAt(0) : range;
  const node = active.startContainer;
  const offset = active.startOffset;
  const insAncestor = ancestorWithin(node, isInsEl, root);
  if (insAncestor) {
    if (node.nodeType === Node.TEXT_NODE) {
      const before = node.textContent.slice(0, offset);
      const after = node.textContent.slice(offset);
      node.textContent = before + text + after;
      setCaret(node, before.length + text.length);
      return;
    }
    const tn = document.createTextNode(text);
    if (offset >= insAncestor.childNodes.length) insAncestor.appendChild(tn);
    else insAncestor.insertBefore(tn, insAncestor.childNodes[offset]);
    setCaret(tn, text.length);
    return;
  }
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentNode;
    const before = node.textContent.slice(0, offset);
    const after = node.textContent.slice(offset);
    const ins = createIns(text);
    if (!after) {
      node.textContent = before;
      parent.insertBefore(ins, node.nextSibling);
    } else if (!before) {
      node.textContent = after;
      parent.insertBefore(ins, node);
    } else {
      node.textContent = before;
      const tail = document.createTextNode(after);
      parent.insertBefore(ins, node.nextSibling);
      parent.insertBefore(tail, ins.nextSibling);
    }
    const merged = mergeAdjacentTrackedSiblings(ins, isInsEl);
    const lastText = lastTextDescendant(merged);
    if (lastText) setCaret(lastText, lastText.textContent.length);
    else setCaretAfter(merged);
    return;
  }
  const ins = createIns(text);
  if (offset >= node.childNodes.length) node.appendChild(ins);
  else node.insertBefore(ins, node.childNodes[offset]);
  const merged = mergeAdjacentTrackedSiblings(ins, isInsEl);
  const lastText = lastTextDescendant(merged);
  if (lastText) setCaret(lastText, lastText.textContent.length);
  else setCaretAfter(merged);
}

function lastTextDescendant(node) {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) return node;
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const found = lastTextDescendant(node.childNodes[i]);
    if (found) return found;
  }
  return null;
}

function handleInsertBreak(range, root) {
  const br = document.createElement('br');
  const wrap = createIns();
  wrap.appendChild(br);
  if (!range.collapsed) deleteRange(range, root);
  const sel = window.getSelection();
  const active = sel.rangeCount ? sel.getRangeAt(0) : range;
  active.insertNode(wrap);
  setCaretAfter(wrap);
}

function expandToAdjacentChar(range, direction, root) {
  const r = range.cloneRange();
  try {
    if (direction === 'backward') r.setStart(r.startContainer, Math.max(0, r.startOffset));
    r.collapse(direction === 'backward');
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    sel.modify('extend', direction === 'backward' ? 'backward' : 'forward', 'character');
    return sel.rangeCount ? sel.getRangeAt(0) : null;
  } catch {
    return null;
  }
}

function deleteRange(range, root, _direction) {
  if (range.collapsed) return;
  const frag = range.extractContents();
  const placeholder = document.createTextNode('');
  range.insertNode(placeholder);
  const del = createDel();
  walkAndWrap(frag, del, root);
  if (del.childNodes.length) placeholder.parentNode.insertBefore(del, placeholder);
  placeholder.remove();
  if (del.parentNode) {
    const merged = mergeAdjacentTrackedSiblings(del, isDelEl);
    // Anchor the caret at the START (left edge) of the merged strikethrough
    // for BOTH directions. This matches normal text-editor backspace muscle
    // memory: each Backspace walks the cursor one position to the left while
    // the strikethrough grows leftward behind it ("still working|" ->
    // "still workin|<del>g</del>" -> "still worki|<del>ng</del>" -> ...);
    // and forward Delete keeps the cursor pinned in place at the start of
    // the deletion run while the strikethrough grows to its right
    // ("s|till working" -> "s|<del>t</del>ill working" ->
    // "s|<del>ti</del>ll working" -> ...).
    setCaretBefore(merged);
  }
}

function isWhitespaceOnlyTextNode(node) {
  return (
    !!node &&
    node.nodeType === Node.TEXT_NODE &&
    !/[^\s\u00A0]/.test(node.textContent)
  );
}

/**
 * Merge `node` with any same-kind siblings on either side, BRIDGING across any
 * whitespace-only text node siblings between them. Without this bridge, two
 * `<del>` runs separated by a leftover space (e.g. "<del>at</del> <del>home</del>")
 * render as two boxed inline pills with a visible gap between them, because
 * `text-decoration: line-through` does not extend across separate inline boxes.
 * Whitespace nodes between the two runs are absorbed into the merged span so:
 *   - the visual line-through and red highlight stay continuous,
 *   - accept-all still drops everything (whitespace included, which is fine
 *     since both adjacent words were deleted anyway), and
 *   - reject-all still unwraps the span, leaving the whitespace where it was.
 * Returns the surviving merged node.
 */
function mergeAdjacentTrackedSiblings(node, predicate) {
  if (!node || !node.parentNode) return node;
  while (true) {
    let cur = node.previousSibling;
    const whitespaceBuf = [];
    while (cur && isWhitespaceOnlyTextNode(cur)) {
      whitespaceBuf.unshift(cur);
      cur = cur.previousSibling;
    }
    if (!cur || !predicate(cur)) break;
    for (let i = whitespaceBuf.length - 1; i >= 0; i--) {
      node.insertBefore(whitespaceBuf[i], node.firstChild);
    }
    while (cur.lastChild) node.insertBefore(cur.lastChild, node.firstChild);
    cur.remove();
  }
  while (true) {
    let cur = node.nextSibling;
    const whitespaceBuf = [];
    while (cur && isWhitespaceOnlyTextNode(cur)) {
      whitespaceBuf.push(cur);
      cur = cur.nextSibling;
    }
    if (!cur || !predicate(cur)) break;
    for (const ws of whitespaceBuf) node.appendChild(ws);
    while (cur.firstChild) node.appendChild(cur.firstChild);
    cur.remove();
  }
  node.normalize();
  return node;
}

/**
 * Walk the extracted fragment and re-emit it into the editor's flow:
 *   - text + non-tracked elements -> append to `del` (wrapped as deletion)
 *   - <ins> content -> drop (these were never accepted insertions)
 *   - <del> content -> keep as-is (already deleted)
 */
function walkAndWrap(fragment, del, root) {
  while (fragment.firstChild) {
    const node = fragment.firstChild;
    if (isInsEl(node)) {
      fragment.removeChild(node);
      continue;
    }
    if (isDelEl(node)) {
      const parent = del.parentNode || root;
      parent.insertBefore(node, del);
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE && (node.querySelector?.('ins.track-ins, del.track-del'))) {
      const inner = document.createDocumentFragment();
      while (node.firstChild) inner.appendChild(node.firstChild);
      const wrapper = node.cloneNode(false);
      del.appendChild(wrapper);
      const tmp = document.createDocumentFragment();
      tmp.appendChild(inner);
      walkAndWrap(tmp, wrapper, root);
      fragment.removeChild(node);
      continue;
    }
    del.appendChild(node);
  }
}

function handleDelete(range, direction, root) {
  if (!range.collapsed) {
    deleteRange(range, root, direction);
    return;
  }
  const expanded = expandToAdjacentChar(range, direction, root);
  if (!expanded || expanded.collapsed) return;
  const target = direction === 'backward' ? expanded.startContainer : expanded.endContainer;
  const insAncestor = ancestorWithin(target, isInsEl, root);
  if (insAncestor) {
    expanded.deleteContents();
    if (!insAncestor.childNodes.length) insAncestor.remove();
    return;
  }
  const delAncestor = ancestorWithin(target, isDelEl, root);
  if (delAncestor) {
    if (direction === 'backward') {
      const range2 = document.createRange();
      range2.setStartBefore(delAncestor);
      range2.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range2);
    } else {
      setCaretAfter(delAncestor);
    }
    // Don't leave the user staring at no visible change. After hopping past
    // an existing tracked deletion, continue the same delete in the same
    // direction so consecutive backspace/Delete keystrokes keep extending the
    // strikethrough one character at a time instead of requiring a second
    // keypress per letter.
    const followUp = getActiveRange(root);
    if (followUp && followUp.collapsed) {
      handleDelete(followUp, direction, root);
    }
    return;
  }
  deleteRange(expanded, root, direction);
}

/** Attach track-changes behavior to a contenteditable element. */
export function attachTrackChanges(root, onChange) {
  if (!root) return () => {};
  const handler = (e) => {
    const type = e.inputType;
    const range = getActiveRange(root);
    if (!range) return;
    if (
      type === 'insertText' ||
      type === 'insertCompositionText' ||
      type === 'insertReplacementText' ||
      type === 'insertFromYank' ||
      type === 'insertFromDrop' ||
      type === 'insertFromPaste' ||
      type === 'insertFromPasteAsQuotation'
    ) {
      e.preventDefault();
      let text = e.data ?? '';
      if (!text && e.dataTransfer) text = e.dataTransfer.getData('text/plain') || '';
      if (text) handleInsertText(range, text, root);
    } else if (type === 'insertParagraph' || type === 'insertLineBreak') {
      e.preventDefault();
      handleInsertBreak(range, root);
    } else if (
      type === 'deleteContentBackward' ||
      type === 'deleteWordBackward' ||
      type === 'deleteSoftLineBackward' ||
      type === 'deleteHardLineBackward'
    ) {
      e.preventDefault();
      handleDelete(range, 'backward', root);
    } else if (
      type === 'deleteContentForward' ||
      type === 'deleteWordForward' ||
      type === 'deleteSoftLineForward' ||
      type === 'deleteHardLineForward' ||
      type === 'deleteByCut'
    ) {
      e.preventDefault();
      handleDelete(range, 'forward', root);
    } else if (type === 'deleteContent') {
      e.preventDefault();
      handleDelete(range, 'backward', root);
    }
    if (typeof onChange === 'function') onChange(root);
  };
  root.addEventListener('beforeinput', handler);
  return () => root.removeEventListener('beforeinput', handler);
}

/** Whether the editor currently has any pending track-changes markup. */
export function hasTrackedChanges(root) {
  if (!root) return false;
  return !!root.querySelector('ins.track-ins, del.track-del');
}

/** Accept all changes: drop <del> content, unwrap <ins>. Mutates `root`. */
export function acceptAllChanges(root) {
  if (!root) return;
  root.querySelectorAll('del.track-del').forEach((el) => el.remove());
  root.querySelectorAll('ins.track-ins').forEach((el) => {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
  });
  root.normalize();
}

/** Reject all changes: drop <ins> content, unwrap <del>. Mutates `root`. */
export function rejectAllChanges(root) {
  if (!root) return;
  root.querySelectorAll('ins.track-ins').forEach((el) => el.remove());
  root.querySelectorAll('del.track-del').forEach((el) => {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
  });
  root.normalize();
}

function nodeToPlainText(node, mode) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  if (isInsEl(node)) {
    if (mode === 'rejected') return '';
    return childrenToPlainText(node, mode);
  }
  if (isDelEl(node)) {
    if (mode === 'accepted') return '';
    return childrenToPlainText(node, mode);
  }
  const tag = node.tagName;
  if (tag === 'BR') return '\n';
  const inner = childrenToPlainText(node, mode);
  const blockTags = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  if (blockTags.has(tag) && inner) {
    if (tag === 'LI') return `- ${inner}\n`;
    return `${inner}\n`;
  }
  return inner;
}

function childrenToPlainText(node, mode) {
  let out = '';
  node.childNodes.forEach((c) => { out += nodeToPlainText(c, mode); });
  return out;
}

/** Plain text version with insertions kept and deletions discarded. */
export function flattenAcceptedText(root) {
  if (!root) return '';
  return childrenToPlainText(root, 'accepted')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Plain text version with insertions discarded and deletions kept. */
export function flattenRejectedText(root) {
  if (!root) return '';
  return childrenToPlainText(root, 'rejected')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
