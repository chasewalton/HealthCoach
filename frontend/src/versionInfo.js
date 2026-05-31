/** Display version (keep in sync with VersionBadge / release notes). */
export const VERSION = 'v2.13.25';

/**
 * Newest first. Update when you ship changes.
 * @type {{ version: string; date?: string; changes: string[] }[]}
 */
export const CHANGELOG = [
  {
    version: 'v2.13.25',
    date: '2026-05-31',
    changes: ['Version bump.'],
  },
  {
    version: 'v2.13.24',
    date: '2026-05-31',
    changes: [
      'Updated Firebase SDK dependencies (frontend firebase 12.14, functions firebase-admin 13.10, firebase-functions 7.2.5).',
    ],
  },
  {
    version: 'v2.13.23',
    date: '2026-05-21',
    changes: [
      'Landing since-visit check-in: removed the visible label above the narrative textarea; placeholder and aria-label still describe the field.',
    ],
  },
  {
    version: 'v2.13.22',
    date: '2026-05-21',
    changes: [
      'Landing since-visit check-in: simplified the assistant lead before the checklist to a single question — "How have you been since your visit?" — instead of the previous three-part message with narrative intro and dated checklist preamble.',
    ],
  },
  {
    version: 'v2.13.21',
    date: '2026-05-21',
    changes: [
      'Landing visit-goals "Continue": after the patient enters one to three focus topics and hits Continue, the user reply bubble now renders the topics as a multi-line numbered list ("I\'d like to focus on:" followed by "1. ...", "2. ...", "3. ..." each on its own line) instead of flattening them into a single semicolon-joined paragraph. Updated landing.userLine.focusTopics (en + es) to drop the trailing period and use a newline before the list, and added white-space: pre-wrap to .msg-row.user .msg-bubble so user-side messages with embedded newlines render line breaks visually.',
    ],
  },
  {
    version: 'v2.13.20',
    date: '2026-05-21',
    changes: [
      'Since-last-visit recap: rewrote the POST /api/since-visit-recap system prompt so the interim recap reads like a primary care physician verbally summing up the chart in patient phrasing instead of a hyper-segmented bulleted list. Removed the fixed "Symptoms since your visit:", "Medication changes:", "Test results and what your team told you:", "Care visits between then and now:", "Emergency or hospital visits:", and "Important diagnostic tests:" section headers, replaced them with 1 to 3 short chronological prose paragraphs (oldest to most recent, anchored with relative time phrases like "about three months ago"), and explicitly banned bullets, numbered lists, dash list items, all-caps labels, and chart-note phrasing ("patient reports", "denies", "HPI"). Kept the existing opener sentence ("Here\'s what\'s happened since your visit on {visitDate} with {provider}.") and the do-not-invent constraints.',
    ],
  },
  {
    version: 'v2.13.19',
    date: '2026-05-21',
    changes: [
      'Landing handoff feedback intro: after HealthCoach sends the "OK Thanks! Let\'s move on to your feedback..." message, an "End Conversation" CTA now appears in the bottom-right of the chat area (above the version badge) so the patient can wrap up directly after answering the feedback question. Moved the End Conversation CTA from bottom-left to bottom-right and tagged the feedback intro message with endConversationCta so the button persists across reloads.',
    ],
  },
  {
    version: 'v2.13.18',
    date: '2026-05-21',
    changes: [
      'Landing dashboard: HealthCoach now uses reflective listening on every scripted follow-up instead of jumping straight to the next question. After the "is there something going particularly well in your care?" answer, the going-well reply (e.g. "my blood pressure is improving") is now warmly named back before the provider-questions offer is offered, instead of skipping straight from the user line to the offer. After the summary share-recipient picker, HealthCoach now reflects back who the patient chose (e.g. "Great — you\'ll share this summary with yourself and a family member or care partner") before transitioning into the feedback intro. Internally: removed the early-return that bypassed the brief-ack LLM call for the concerns step in afterSinceVisitFollowUpUserMessage; added a concerns -> appendProviderQuestionsOffer post-ack branch; added a pushReflectiveBriefAck helper and wired it into handleHandoffShareChoice. The dashboard brief-ack system prompt was also strengthened to explicitly call out reflective listening for positive "going well" wins, share-recipient choices, and "nothing in particular" declinations, so the model mirrors the concrete detail back instead of emitting a generic "thanks for letting me know" / "OK thanks, let\'s move on".',
    ],
  },
  {
    version: 'v2.13.17',
    date: '2026-05-21',
    changes: [
      'Approved summary modal: widened from 640px to match the handoff summary card (up to 960px) so the full summary is easier to read on desktop.',
    ],
  },
  {
    version: 'v2.13.16',
    date: '2026-05-21',
    changes: [
      'Landing handoff summary card: switched the card background from --neutral-50 (same as the chat area) to --color-surface (white) so the summary stands out against the chat background.',
    ],
  },
  {
    version: 'v2.13.15',
    date: '2026-05-18',
    changes: [
      'Track-changes editor: fixed visible "gaps" in the red strikethrough between deleted words. mergeAdjacentTrackedSiblings now bridges across whitespace-only text node siblings (single spaces, newlines, non-breaking spaces) when looking for a same-kind tracked sibling to merge into, and absorbs that whitespace into the merged span. Previously two adjacent <del> runs separated by a leftover " " text node (e.g. when deleting one word, then the next, then the next) rendered as separately-styled boxed inline pills because text-decoration: line-through does not extend across separate inline boxes and del.track-del has padding: 0 1px. After this fix, "Decide if I should track BP at home" renders as a single continuous red strikethrough run instead of eight word-shaped pills with gaps between them. The same fix applies symmetrically to <ins.track-ins> merges. Accept-all/reject-all semantics are unchanged: accept removes the whole merged span (including absorbed whitespace, which is correct because both adjacent words were deleted anyway), reject unwraps the span and leaves the original whitespace in place.',
    ],
  },
  {
    version: 'v2.13.14',
    date: '2026-05-18',
    changes: [
      'Track-changes editor: backspace now walks the cursor leftward like normal text-editor backspace. deleteRange now always parks the caret at the START (left edge) of the merged <del> for both Backspace and Delete instead of pinning it to the trailing end for Backspace. Net effect: pressing Backspace from "still working|" produces "still workin|<del>g</del>" -> "still worki|<del>ng</del>" -> ... -> "s|<del>till working</del>", with the cursor moving one position left per keypress and the red strikethrough growing leftward behind it. Forward Delete continues to keep the cursor pinned at the start of the deletion run while the strikethrough grows to its right.',
    ],
  },
  {
    version: 'v2.13.13',
    date: '2026-05-18',
    changes: [
      'Track-changes editor: fixed forward-Delete caret drift that made each keypress feel like "typing" the deleted letter. deleteRange now takes a direction argument and parks the caret at the LEFT edge of the merged <del> for forward deletes (so the cursor stays visually in place and the red strikethrough grows to the right of it) while keeping the RIGHT-edge anchor for Backspace (so the cursor stays at the trailing end of the merged deletion as it grows leftward). Added a setCaretBefore helper to position the caret at the start of a node for the forward-delete path.',
    ],
  },
  {
    version: 'v2.13.12',
    date: '2026-05-18',
    changes: [
      'Landing handoff card: removed the in-editor track-changes helper UI. The "Click anywhere to place your cursor..." instructional hint and the inline "Accept all changes" / "Reject all changes" buttons no longer render when the pre-note editor is active, keeping the editing surface focused on the contenteditable body and the bottom-row primary actions. The two helper handlers and translation strings are retained so the workflow stays intact: pressing Apply Edits still auto-accepts pending tracked changes via handleHandoffSummaryApprove. Same trim applied to the editor test harness.',
    ],
  },
  {
    version: 'v2.13.11',
    date: '2026-05-18',
    changes: [
      'Track-changes editor: fixed two more issues. (1) Consecutive deletions no longer render as a sequence of small boxed letters with visible separator bars between them: deleteRange now merges any newly created <del.track-del> with directly adjacent <del.track-del> siblings into a single span, so backspacing through "of breath" renders as one continuous red strikethrough rather than "of|breath" with gaps. (2) Typing multiple consecutive spaces inside the editor now actually displays each space: the contenteditable body gained white-space: pre-wrap so the browser preserves runs of whitespace and explicit line breaks instead of visually collapsing them to one. The same adjacent-sibling merge is also applied to <ins.track-ins> for symmetry so cross-boundary insertions stay one continuous green underline.',
    ],
  },
  {
    version: 'v2.13.10',
    date: '2026-05-18',
    changes: [
      'Track-changes editor: fixed a bug where consecutive Backspace/Delete keypresses adjacent to an existing tracked deletion required two keystrokes per letter. handleDelete now recursively continues the same-direction delete after hopping past an existing <del>, so backspacing through prose marks one new character as struck through per keypress (instead of the first keypress silently jumping the caret over the prior strikethrough and the second keypress finally marking the next letter).',
    ],
  },
  {
    version: 'v2.13.9',
    date: '2026-05-18',
    changes: [
      'Landing handoff card: restyled the "Edit with track changes" toggle to match the "Approve Summary" pill button. The bottom-row edit button now uses the .landing-action-btn class (teal outline, rounded pill, 15px bold label) so the two actions share the same visual treatment, with a new .landing-action-btn.is-active filled-teal state showing when the toggle is in "Done editing" mode. Same change applied to the editor test harness; the in-editor Accept all / Reject all controls keep the smaller secondary look.',
    ],
  },
  {
    version: 'v2.13.8',
    date: '2026-05-18',
    changes: [
      'Landing handoff card: split the primary button into a true two-step flow. The first click of "Apply Edits" now commits the pending track-changes (accepts insertions, removes deletions, exits edit mode) and re-renders the card with clean text so the button label flips back to "Approve Summary"; a second click then finalizes the approval and progresses the chat. Same two-step behavior added to the editor test harness handleApprove flow.',
    ],
  },
  {
    version: 'v2.13.7',
    date: '2026-05-18',
    changes: [
      'Landing handoff card action row: pushed the "Edit with track changes" and "Approve Summary" buttons flush to the right edge of the card. The .landing-handoff-main-actions row now overrides the inherited 680px max-width and 42px right padding from .landing-action-row (full width, margin-left: auto, margin-right: 0, padding-right: 0) so both buttons live at the card edge instead of floating in the middle.',
    ],
  },
  {
    version: 'v2.13.6',
    date: '2026-05-18',
    changes: [
      'Landing handoff card: moved the review guidance ("Read through the pre-note above. Tap Edit with track changes...") from the footer up to the top of the card, sitting between the "HealthCoach Chat Summary" label and the draft body so users see the instructions before they read the summary. Same change applied to the editor test harness; new --top modifier on .landing-handoff-summary-guidance adds spacing above the body.',
    ],
  },
  {
    version: 'v2.13.5',
    date: '2026-05-18',
    changes: [
      'Review focus form: right-justified the standalone "Continue" button so it sits flush right below the "Nothing specific" / "Need help? Get suggestions" row.',
    ],
  },
  {
    version: 'v2.13.4',
    date: '2026-05-18',
    changes: [
      'Landing handoff card: moved the "Edit with track changes" toggle button out of the card header and into the bottom action row, sitting to the left of the primary "Approve Summary" button so both actions live together. Same change applied to the editor test harness.',
    ],
  },
  {
    version: 'v2.13.3',
    date: '2026-05-18',
    changes: [
      'Review focus form: rearranged the action buttons so "Nothing specific" and "Need help? Get suggestions" now sit together at the top of the action area (where Continue used to be), and the primary "Continue" button now sits alone below the divider, left-aligned.',
    ],
  },
  {
    version: 'v2.13.2',
    date: '2026-05-18',
    changes: [
      'Landing handoff card: capitalized "Chat" and "Summary" in the section label so it reads "HealthCoach Chat Summary" (Spanish: "Resumen del Chat de HealthCoach"). Updated the editor test harness label to match.',
    ],
  },
  {
    version: 'v2.13.1',
    date: '2026-05-18',
    changes: [
      'Landing handoff card: bumped the "HealthCoach chat summary" label from 12px to 18px so the section header reads more prominently above the draft body.',
    ],
  },
  {
    version: 'v2.13.0',
    date: '2026-05-18',
    changes: [
      'Post-approval summary: after the user approves their pre-note, the summary text no longer appears inline in a chat bubble. Instead the chat shows a tappable "Your approved summary" document card (file icon + label) that opens a new modal with the full summary they can revisit anytime.',
      'Post-approval flow: split the privacy reminder and share prompt into two separate assistant chat bubbles. The reminder bubble answers "Who sees your data?" and "What does HealthCoach do with your data?" in patient-friendly language, then a follow-up bubble asks "In the future, you may be able to share this conversation summary with others. Who would you want to share this summary with?"',
      'Share recipient form: selecting "Other" now reveals an optional free-text field ("Who else? (optional)") so users can name the other person. The text is saved with the summary_share_intent feedback payload and surfaced in parentheses in the user reply line. New SummaryDocModal component wired into the landing screen via onOpenSummaryDoc.',
    ],
  },
  {
    version: 'v2.12.2',
    date: '2026-05-18',
    changes: [
      'Renamed the landing handoff/note card label from "Pre-note for your provider" to "HealthCoach chat summary" (Spanish: "Resumen del chat de HealthCoach"). Updated the editor test harness label to match.',
    ],
  },
  {
    version: 'v2.12.1',
    date: '2026-05-18',
    changes: [
      'Pre-note review card: the main commit button now reads "Apply Edits" instead of "Approve Summary" whenever the user has pending track-changes (insertions or deletions) in the draft; it flips back to "Approve Summary" if all edits are rejected or accepted away. Spanish label is "Aplicar cambios".',
    ],
  },
  {
    version: 'v2.12.0',
    date: '2026-05-18',
    changes: [
      'Pre-note review card: constrained the card width to match the chat input (max 960px, centered) so it no longer spans edge-to-edge above the composer.',
      'Pre-note review card: added an inline "Edit with track changes" mode that lets users click anywhere in the draft to position the cursor; new typing is wrapped in a green underlined insertion, and Backspace/Delete marks original text with a red strikethrough deletion instead of removing it. Accept all / Reject all buttons finalize or discard the markup, and approving the summary automatically accepts pending changes before sending downstream.',
    ],
  },
  {
    version: 'v2.11.2',
    date: '2026-05-18',
    changes: [
      'Since-last-visit acknowledgment: replaced the canned "Thanks for letting me know — I\'ll keep that context in mind." reply with a tailored AI acknowledgment that names back the specific thing the patient shared (e.g., empathetically responding to "Significant life change — My mother has cancer" instead of a generic thank-you).',
      'Brief-ack system prompt: added explicit guidance to read the "Label — detail" format, mirror the patient\'s own words, lead with warm empathy for emotionally heavy disclosures, and never reply with generic "thanks for letting me know" phrasing.',
    ],
  },
  {
    version: 'v2.11.1',
    date: '2026-05-18',
    changes: [
      'Handoff prompt: shortened the "Ready to create a summary" user reply to "Yes, I\'m ready to create a summary." in both English and Spanish.',
    ],
  },
  {
    version: 'v2.11.0',
    date: '2026-05-18',
    changes: [
      'Provider question suggestions: now generate exactly 4 ideas (down from 5-8) so the list stays focused on the highest-value asks.',
      'Provider question suggestions: added an "Add my own" button below the suggested checklist that reveals an inline text field for the patient to add their own question, which appears as a new checked item in the list.',
    ],
  },
  {
    version: 'v2.10.9',
    date: '2026-05-18',
    changes: [
      'Review focus fields: converted the three focus inputs to auto-growing, word-wrapping textareas so longer entries stay visible without horizontal scrolling; the field grows taller as the user types and the clear button stays aligned to the first row.',
    ],
  },
  {
    version: 'v2.10.8',
    date: '2026-05-18',
    changes: [
      'Review focus prompt: restructured the form so the "Need help? Get suggestions" button sits directly under the three focus fields as a helper action, with a thin divider separating a single action row that places "Nothing specific" on the left and "Continue" on the right.',
    ],
  },
  {
    version: 'v2.10.7',
    date: '2026-05-18',
    changes: [
      'Landing chat action buttons (Continue, Yes, Approve, etc.): default state is now white with green text and a green outline; hover swaps to the green gradient with white text.',
    ],
  },
  {
    version: 'v2.10.6',
    date: '2026-05-18',
    changes: [
      'Landing chat journey stepper graphic: replaced the inline illustration with an updated four-step image (Get Started complete, Review Your Last Visit current, Prepare for Next Visit, Remaining Questions).',
    ],
  },
  {
    version: 'v2.10.5',
    date: '2026-05-18',
    changes: [
      'Journey stepper "Get Started" icon: redrew the rocket as a clear upright rocket with body, fins, porthole, and exhaust flame so it no longer reads as a banana shape.',
    ],
  },
  {
    version: 'v2.10.4',
    date: '2026-05-18',
    changes: [
      'Landing chat action rows (Continue, Yes, Approve, etc.): right-justified so the buttons align with the right edge of the user message bubbles instead of sitting under the assistant avatar.',
    ],
  },
  {
    version: 'v2.10.3',
    date: '2026-05-18',
    changes: [
      'Post-summary share prompt: removed the per-recipient contact input fields and the "Nothing is sent automatically" hint so the form is just a list of checkboxes for who to share with.',
      'Post-summary share prompt: renamed the "Yourself" option to "Myself" (Spanish: "Yo mismo").',
      'Study feedback modal: renamed the heading from "Last Visit Summary" to "HealthCoach Conversation Summary" (Spanish: "Resumen de la conversación con HealthCoach").',
      'Post-walkthrough feedback intro: bolded "HealthCoach Chat" so the product name stands out (en/es).',
    ],
  },
  {
    version: 'v2.10.2',
    date: '2026-05-18',
    changes: [
      'Post-summary share prompt: renamed the "Caretaker" option to "Family Member or Care Partner" (and its contact placeholder); Spanish updated to "Familiar o pareja de cuidado".',
    ],
  },
  {
    version: 'v2.10.1',
    date: '2026-05-18',
    changes: [
      'Visit goals checklist: removed the last three examples (vaccine or immunization, paperwork or forms signed, asking about a new or changing symptom) so the list focuses on refill, lab result, referral, and work/school note (en/es).',
    ],
  },
  {
    version: 'v2.10.0',
    date: '2026-05-18',
    changes: [
      'Landing journey stepper: added per-step SVG icons (rocket, clipboard chart, planner, speech bubbles) above each indicator, matching the inline journey illustration; icons tint to match locked/active/completed state and shift on hover for clickable future steps.',
    ],
  },
  {
    version: 'v2.9.1',
    date: '2026-05-14',
    changes: [
      'Dashboard going-well step: shortened the "nothing to add" user line to "Nothing in particular right now." (en/es).',
    ],
  },
  {
    version: 'v2.9.0',
    date: '2026-05-14',
    changes: [
      'Dashboard: after visit walkthrough feedback, show a since-last-visit recap (LLM + synthetic timeline) before questions about the last visit and what happened since; new POST /api/since-visit-recap.',
    ],
  },
  {
    version: 'v2.8.34',
    date: '2026-05-14',
    changes: [
      'CUJ documentation: published printable PDFs (overview, workflow, sequence) and added PDF download buttons alongside each diagram link on the docs index page.',
    ],
  },
  {
    version: 'v2.8.33',
    date: '2026-05-14',
    changes: [
      'Landing top-bar HealthCoach logo now opens the CUJ documentation site (healthcoach-cuj.surge.sh) in a new tab; updated tooltip and aria-label accordingly.',
    ],
  },
  {
    version: 'v2.8.32',
    date: '2026-05-14',
    changes: [
      'Study feedback modal: degree Likert labels (Not at all through Extremely) with per-point text.',
      'Dashboard visit priorities: three focus fields first, then Continue, then suggest-topics actions.',
      'Since-last-visit step: narrative textarea, updated lead copy, and Important life change checklist item.',
      'Pre-note review and post-approval share copy updated; share prompt includes privacy reminder and future-intent wording; share form uses the short legend for its accessible name.',
    ],
  },
  {
    version: 'v2.8.31',
    date: '2026-05-13',
    changes: [
      'Restored the CUJ workflow documentation page so the user journey link renders.',
    ],
  },
  {
    version: 'v2.8.30',
    date: '2026-05-08',
    changes: [
      'Dashboard provider question ideas: each suggestion is its own checkbox (all start selected); SMS includes only checked questions.',
    ],
  },
  {
    version: 'v2.8.29',
    date: '2026-05-08',
    changes: [
      'Landing dashboard chat: auto-scroll only on the first staggered assistant message in a series so follow-up lines (e.g. Continue after Past Visit Summary) do not scroll long content out of view.',
    ],
  },
  {
    version: 'v2.8.28',
    date: '2026-05-08',
    changes: [
      'Landing dashboard chat: slower eased scroll when auto-positioning (custom duration; reduced motion still jumps instantly).',
    ],
  },
  {
    version: 'v2.8.27',
    date: '2026-05-08',
    changes: [
      'Landing dashboard chat: smooth scroll when auto-positioning after new messages (respects prefers-reduced-motion).',
    ],
  },
  {
    version: 'v2.8.26',
    date: '2026-05-08',
    changes: [
      'Dashboard provider question suggestions: removed optional SMS helper line; phone field stays hidden until Text to my phone is used (fixes flex CSS overriding the hidden attribute).',
    ],
  },
  {
    version: 'v2.8.25',
    date: '2026-05-07',
    changes: [
      'Landing dashboard chat: when the latest assistant message is taller than the scroll area, scroll so its top stays in view instead of pinning only the bottom.',
    ],
  },
  {
    version: 'v2.8.24',
    date: '2026-05-07',
    changes: [
      'Provider questions SMS row: moved Text to my phone ahead of number field and show tel input only after the first button press (opens Messages on a second click when a number is entered).',
    ],
  },
  {
    version: 'v2.8.23',
    date: '2026-05-07',
    changes: [
      'Landing dashboard: added communication-with-care-team row to since-last-visit checklist; replaced four-item concerns checklist with going-well free-text prompt and Nothing to add; checklist context and handoff prompts include goingWellNote.',
    ],
  },
  {
    version: 'v2.8.22',
    date: '2026-05-07',
    changes: [
      'Since last visit checklist: detail field placeholder shortened to "Tell me more..." (EN) and matching ES line.',
    ],
  },
  {
    version: 'v2.8.21',
    date: '2026-05-07',
    changes: [
      'Review focus fields: per-input Clear control appears when the field has text (after suggestions or typing).',
    ],
  },
  {
    version: 'v2.8.20',
    date: '2026-05-07',
    changes: [
      'Quick Feedback: show toast after successful submit; keep modal open with error toast if sending fails.',
    ],
  },
  {
    version: 'v2.8.19',
    date: '2026-05-07',
    changes: [
      'Quick Feedback: third question and detail label now use "mistakes" instead of "error" (EN/ES aligned).',
    ],
  },
  {
    version: 'v2.8.18',
    date: '2026-05-07',
    changes: [
      'Quick Feedback modal: two Likert items (easy to understand, useful) plus error yes/no before submit; API stores summaryEasyToUnderstand and summaryUseful.',
    ],
  },
  {
    version: 'v2.8.17',
    date: '2026-05-07',
    changes: [
      'Visit recap: legacy "Provider\'s Impression" subheading normalizes to "What Your Provider Thought" for recap-shaped messages; header regex accepts curly apostrophes.',
    ],
  },
  {
    version: 'v2.8.16',
    date: '2026-05-07',
    changes: [
      'Landing journey label: "Review Visit" renamed to "Review Your Last Visit" (EN/ES copy aligned).',
    ],
  },
  {
    version: 'v2.8.15',
    date: '2026-05-07',
    changes: ['Version bump.'],
  },
  {
    version: 'v2.8.14',
    date: '2026-05-04',
    changes: [
      'Remaining Questions wrap-up now shows a persistent bottom-left End Conversation button until the user clicks it.',
    ],
  },
  {
    version: 'v2.8.13',
    date: '2026-05-04',
    changes: [
      'Dashboard and guided chat headers now include a back-one-message control that reverses the conversation to the previous HealthCoach turn.',
    ],
  },
  {
    version: 'v2.8.12',
    date: '2026-05-04',
    changes: [
      'Summary sharing now supports selecting multiple recipients, adds Other, and asks for contact details for each selected recipient.',
    ],
  },
  {
    version: 'v2.8.11',
    date: '2026-05-04',
    changes: [
      'Feedback handoff copy now asks whether the user has any other concerns or questions after they choose who to share the approved summary with.',
    ],
  },
  {
    version: 'v2.8.10',
    date: '2026-04-30',
    changes: [
      'Provider pre-note approval now asks who the user wants to share the approved summary with before moving into feedback, instead of confirming an automatic provider send.',
    ],
  },
  {
    version: 'v2.8.9',
    date: '2026-04-30',
    changes: [
      'Provider pre-note review: moved the summary card out of the assistant bubble so it sits above the composer, placed the review guidance at the bottom of the card, and removed the duplicate revision hint.',
    ],
  },
  {
    version: 'v2.8.8',
    date: '2026-04-30',
    changes: [
      'Provider pre-note: tightened summary order and wording so visit priorities and provider questions come first, recent history is expanded for HPI use, old last-visit recap headings are omitted, and unwanted risk-check phrasing is removed.',
    ],
  },
  {
    version: 'v2.8.7',
    date: '2026-04-22',
    changes: [
      'Review priorities: "Need help? Get suggestions" now auto-populates the three focus fields from the visit note instead of rendering clickable chips. Empty fields are filled, user-typed values are preserved, and Refresh regenerates ideas (en + es hint added).',
    ],
  },
  {
    version: 'v2.8.6',
    date: '2026-04-22',
    changes: [
      'Review priorities prompt: restored the explanation below "Do you have any questions from your last visit?" — calls out up-to-three topic entry and points to the Need help? Get suggestions and Nothing specific buttons (en + es).',
    ],
  },
  {
    version: 'v2.8.5',
    date: '2026-04-22',
    changes: [
      'Landing greeting timeline message now renders a four-step journey illustration (Get Started / Review Visit / Prepare for Next Visit / Remaining Questions) at the end of the bubble.',
    ],
  },
  {
    version: 'v2.8.4',
    date: '2026-04-22',
    changes: [
      'Visit recap section rename: "Visit summary" → "Provider\'s Impression" (prompts, seeds, and frontend post-processor updated; legacy header still recognized so saved sessions normalize to the new label).',
    ],
  },
  {
    version: 'v2.8.3',
    date: '2026-04-22',
    changes: [
      'Visit recap post-processing: assistant replies with Visit summary / Main concerns / Next steps are reordered to that canonical sequence, and a prose Visit summary is converted to one-sentence bullet points for readability.',
    ],
  },
  {
    version: 'v2.8.2',
    date: '2026-04-22',
    changes: [
      'Review priorities prompt shortened to "Do you have any questions from your last visit?" (en + es).',
    ],
  },
  {
    version: 'v2.8.1',
    date: '2026-04-20',
    changes: [
      'Visit recap ordering: Visit summary now renders first, followed by Main concerns, then Next steps (review_guided, review_specific, and dashboard prompts + seeds updated to require this order and end after Next steps).',
    ],
  },
  {
    version: 'v2.8.0',
    date: '2026-04-16',
    changes: [
      'Full Spanish UI: centralized i18n (en/es), profile language reload, dateLocale for sessions and exports, language-agnostic chips, and Spanish emergency-keyword detection in prep chat.',
    ],
  },
  {
    version: 'v2.7.16',
    date: '2026-04-15',
    changes: [
      'Added 30,000ft CUJ overview diagram (docs/cuj-overview.html) with zoomable SVG viewer; deployed all three diagrams to healthcoach-cuj.surge.sh with client-side password gate.',
    ],
  },
  {
    version: 'v2.7.15',
    date: '2026-04-15',
    changes: [
      'Added UML sequence diagram (docs/cuj-sequence.html) showing temporal message flow between Patient, UI, Bot, LLM, Firestore, and EHR across all 5 phases.',
    ],
  },
  {
    version: 'v2.7.14',
    date: '2026-04-15',
    changes: [
      'Added interactive CUJ workflow diagram (docs/cuj-workflow.html) documenting all phases, steps, branches, captures, and cross-cutting design decisions.',
    ],
  },
  {
    version: 'v2.7.13',
    date: '2026-04-15',
    changes: [
      'Dashboard visit goals: interactive checklist for common requests, optional notes field, Continue / Nothing to add (replaces inline bullet list in the chat bubble).',
    ],
  },
  {
    version: 'v2.7.12',
    date: '2026-04-15',
    changes: [
      'Quick Feedback: split overlay with Last Visit Summary on the right (walkthrough recap and/or approved provider note from the dashboard chat).',
    ],
  },
  {
    version: 'v2.7.11',
    date: '2026-04-15',
    changes: [
      'Dashboard: declining provider-question help goes straight to visit goals (no brief LLM reply); visit-goals heading uses normal weight (no bold markdown).',
    ],
  },
  {
    version: 'v2.7.10',
    date: '2026-04-15',
    changes: [
      'Dashboard visit recap: strip any trailing engagement question after the Visit summary section before showing the message (models still sometimes append it).',
    ],
  },
  {
    version: 'v2.7.9',
    date: '2026-04-15',
    changes: [
      'Dashboard: after the concerns and going-well checklist, go straight to the provider-questions prompt (no LLM "prepare for next visit" message in between).',
    ],
  },
  {
    version: 'v2.7.8',
    date: '2026-04-15',
    changes: [
      'Prompts: forbid the old end-of-recap question (e.g. what has been on your mind most about this visit); align Firestore prompt seed overrides for review_guided / review_specific with defaults.',
    ],
  },
  {
    version: 'v2.7.7',
    date: '2026-04-15',
    changes: [
      'Visit note recap prompts (dashboard + review): structured Main concerns / Next steps / Visit summary ends without a trailing engagement question in the same message.',
    ],
  },
  {
    version: 'v2.7.6',
    date: '2026-04-15',
    changes: [
      'Dashboard visit recap: show a Continue prompt after the summary; Quick Feedback opens only after Continue (not immediately).',
    ],
  },
  {
    version: 'v2.7.5',
    date: '2026-04-15',
    changes: [
      'Dashboard visit walkthrough: request the recap via the API only — no synthetic user bubble in the chat after the lead-in.',
    ],
  },
  {
    version: 'v2.7.4',
    date: '2026-04-15',
    changes: [
      'Dashboard: after confirming the visit note, show a Phase-1 visit walkthrough (lead-in + LLM recap), then quick feedback (PAIR), then review priorities and the rest of the flow.',
      'Dashboard briefAck chat turns use a dedicated system prompt so checklist handoffs do not trigger a full last-visit summary.',
      'Stepper wrap-up still opens quick feedback only when leaving Review Visit; chips after modal close only apply in that wrap-up step.',
    ],
  },
  {
    version: 'v2.7.3',
    date: '2026-04-15',
    changes: [
      'Onboarding privacy Continue: Enter submits like the button (empty composer or type continue).',
      'Dashboard chat: tapping Continue / Yes (visit note) / Continue to visit goals records a short user line in the thread so assistant replies are not back-to-back without a user turn.',
    ],
  },
  {
    version: 'v2.7.2',
    date: '2026-04-15',
    changes: [
      'Visit note confirmation: Enter confirms the visit (same as Yes) from the composer when it is empty or says yes/y, and from the dashboard when focus is not on another button or text field.',
    ],
  },
  {
    version: 'v2.7.1',
    date: '2026-04-15',
    changes: [
      'Visit note confirmation row: Yes (primary) on the left, Report Error with Note on the right.',
    ],
  },
  {
    version: 'v2.7.0',
    date: '2026-04-15',
    changes: [
      'Dashboard handoff flow: after concerns, optional provider-question suggestions (Yes/No, POST /api/provider-question-suggestions) with SMS helper and Continue to visit goals; visit goals then hard-coded Ready to create a summary of our conversation? before pre-note generation.',
      'Handoff system prompt: may include suggested provider questions when they appear in the thread.',
    ],
  },
  {
    version: 'v2.6.7',
    date: '2026-04-15',
    changes: [
      'Visit goals prompt (pre-handoff): example requests shown as a bulleted list instead of one long sentence.',
    ],
  },
  {
    version: 'v2.6.6',
    date: '2026-04-15',
    changes: [
      'Landing review: post-check-in concerns as a four-item checklist (medications, care-team communication, tests/referrals, what is going well) with optional details, then visit goals.',
      'Handoff system prompt mentions those four checklist themes when grounding the thread.',
    ],
  },
  {
    version: 'v2.6.5',
    date: '2026-04-15',
    changes: [
      'Landing review: after since-last-visit check-in, go straight to the concerns follow-up (skip the extra “anything else since your visit” prompt).',
      'Handoff system prompt text aligned with that flow (checklist → concerns → visit goals).',
    ],
  },
  {
    version: 'v2.6.4',
    date: '2026-04-15',
    changes: [
      'Visit Summary modal: optional share-intent checklist (provider, self, someone else) with contact fields; saved via POST /api/feedback (type summary_share_intent, optional chatMode).',
    ],
  },
  {
    version: 'v2.6.3',
    date: '2026-04-15',
    changes: [
      'Visit note confirmation: Report Error with Note next to Yes; opens note modal without dismissing the confirm row.',
    ],
  },
  {
    version: 'v2.6.2',
    date: '2026-04-15',
    changes: [
      'Review priorities: visible Nothing specific button in the form row (copy aligned); removed unused message action that never rendered.',
    ],
  },
  {
    version: 'v2.6.1',
    date: '2026-04-15',
    changes: [
      'Review priorities: three inline focus fields after visit confirm (Continue, Nothing specific, on-demand suggestions) instead of chat-first entry.',
    ],
  },
  {
    version: 'v2.6.0',
    date: '2026-04-15',
    changes: [
      'Pre-note review: coaching copy, Approve Summary, natural-language revisions via landing composer and POST /api/handoff-summary-revise; composer enabled during review.',
    ],
  },
  {
    version: 'v2.5.5',
    date: '2026-04-15',
    changes: [
      'Pre-summary prompt reframed as visit goals with embedded examples (refill, labs, referral, work/school note, vaccines, forms, new symptoms); handoff system prompt mentions visit goals.',
    ],
  },
  {
    version: 'v2.5.4',
    date: '2026-04-15',
    changes: [
      'Tighter landing and handoff copy (priorities, checklist hint, suggestion hint, handoff review); shorter handoff-summary system prompt.',
    ],
  },
  {
    version: 'v2.5.3',
    date: '2026-04-15',
    changes: [
      'Auto-focus the message field after assistant prompts when typed input is expected (landing + live chat); skip chip-only steps and visit/privacy CTAs.',
    ],
  },
  {
    version: 'v2.5.2',
    date: '2026-04-15',
    changes: [
      'Review priorities: open-ended chat first, then Add another / Edit / Done plus on-demand Need help? Get suggestions (visit-note-only); removed auto-loaded suggestion panel.',
    ],
  },
  {
    version: 'v2.5.1',
    date: '2026-04-15',
    changes: [
      'Handoff flow: final pre-summary prompt copy (your summary), clearer review line, handoff system prompt ties draft to priorities, since-visit updates, and concerns.',
    ],
  },
  {
    version: 'v2.5.0',
    date: '2026-04-15',
    changes: [
      'Dashboard handoff: pre-summary prompt, POST /api/handoff-summary consolidated draft, approve/edit/reorder UI, and final confirmation copy for the provider.',
    ],
  },
  {
    version: 'v2.4.0',
    date: '2026-04-15',
    changes: [
      'After the since-last-visit checklist, two guided prompts (anything else for your provider, then care concerns) with optional Nothing to add and brief LLM acknowledgments via POST /api/chat briefAck.',
    ],
  },
  {
    version: 'v2.3.8',
    date: '2026-04-15',
    changes: [
      'Since-last-visit checklist: optional detail field appears under each checked item; details are included in the saved check-in message.',
    ],
  },
  {
    version: 'v2.3.7',
    date: '2026-04-15',
    changes: [
      'After review priorities, landing chat shows a since-last-visit checklist (anchored to visit date when available) with five clinical check-ins, None of these, and Continue.',
    ],
  },
  {
    version: 'v2.3.6',
    date: '2026-04-15',
    changes: [
      'Review focus form: added a Nothing button beside Continue to skip specific focus areas with one tap.',
    ],
  },
  {
    version: 'v2.3.5',
    date: '2026-04-15',
    changes: [
      'Review-focus AI suggestions: stricter grounding in the visit note and PMH documented in that note only; updated prompts and landing copy.',
    ],
  },
  {
    version: 'v2.3.4',
    date: '2026-04-15',
    changes: [
      'New POST /api/review-focus-suggestions endpoint and landing UI to load LLM-backed review focus ideas from the visit note (tap to fill empty fields, Refresh to reload).',
    ],
  },
  {
    version: 'v2.3.3',
    date: '2026-04-15',
    changes: [
      'Review-focus form on the landing chat: added an AI Suggestions panel below the three topic fields (ready for future content).',
    ],
  },
  {
    version: 'v2.3.2',
    date: '2026-04-15',
    changes: [
      'After confirming the visit note on the landing chat, users can enter up to three review focus areas inline before continuing.',
    ],
  },
  {
    version: 'v2.3.1',
    date: '2026-04-15',
    changes: [
      'Landing onboarding: HealthCoach intro and three-step overview now appear before visit-note confirmation (including after privacy Continue and when onboarding is skipped).',
    ],
  },
  {
    version: 'v2.3.0',
    date: '2026-04-13',
    changes: [
      'End-of-review wrap-up sequence: asks about remaining questions, checks next-steps completion, and explores blockers before advancing.',
      'Study feedback modal ("Did you notice any errors?") with Yes/No + optional detail text, persisted to Firestore.',
      'New POST /api/feedback backend endpoint for study data collection.',
    ],
  },
  {
    version: 'v2.2.0',
    date: '2026-04-13',
    changes: [
      'Added first-time onboarding flow: language selection, preferred name, and privacy disclosure before the guided walkthrough.',
      'Review visit now asks the user to confirm the visit note before starting the review.',
      'Journey stepper updated with a new "Get Started" phase for onboarding.',
    ],
  },
  {
    version: 'v2.1.2',
    date: '2026-04-13',
    changes: [
      'Clicking a future journey step now triggers the AI to recap the current phase and transition into the next one.',
    ],
  },
  {
    version: 'v2.1.1',
    date: '2026-04-13',
    changes: [
      'Journey stepper steps are now clickable to skip ahead; completed steps remain locked.',
      'Opening greeting split into two messages: HealthCoach introduction and a timeline walkthrough explaining the 3 phases.',
    ],
  },
  {
    version: 'v2.1.0',
    date: '2026-04-13',
    changes: [
      'Structured journey redesign: replaced sidebar, conversation history, and quick actions with a linear 3-phase journey stepper (Review Visit → Prepare for Next Visit → Remaining Questions).',
      'Chat auto-starts with a HealthCoach greeting for the Review Visit phase.',
      'Forward-only progression: completed journey steps are locked.',
    ],
  },
  {
    version: 'v2.0.9',
    date: '2026-04-08',
    changes: [
      'End-chat and landing share modals, chat export helper, and related landing/auth/API UI updates.',
    ],
  },
  {
    version: 'v2.0.8',
    date: '2026-04-06',
    changes: [
      'Chat: “Here’s how to prepare” section headers render as plain subheadings instead of boxed cards.',
    ],
  },
  {
    version: 'v2.0.6',
    date: '2026-03-22',
    changes: ['Version bump.'],
  },
  {
    version: 'v2.0.5',
    date: '2026-03-23',
    changes: [
      'Landing quick actions: "Help me prepare for my next visit" now starts the same dashboard chat flow as the other landing prompts instead of jumping into the separate combined chat screen.',
    ],
  },
  {
    version: 'v2.0.4',
    date: '2026-03-22',
    changes: [
      'Registration: save the new account profile with the freshly created Firebase user so signup no longer fails with `/api/profile` 401 errors.',
    ],
  },
  {
    version: 'v2.0.3',
    date: '2026-03-23',
    changes: [
      'API client: attach ID tokens using the Firebase User from the auth listener when needed; retry once with a forced token refresh on 401.',
    ],
  },
  {
    version: 'v2.0.2',
    date: '2026-03-23',
    changes: [
      'Wait for Firebase auth to finish restoring the session before calling the API so the first /api/profile request includes an ID token.',
    ],
  },
  {
    version: 'v2.0.1',
    date: '2026-03-23',
    changes: [
      'HTTP API: public invoker on the Cloud Function so Hosting /api rewrites work. Local Vite: set BACKEND_URL to production Hosting for the API proxy.',
    ],
  },
  {
    version: 'v2.0.0',
    date: '2026-03-22',
    changes: [
      'Rebuilt authentication on Firebase Auth with email/password sign-in and registration.',
      'Moved the backend API to Firebase Cloud Functions with Firestore-backed profile, note, session, and admin prompt data.',
      'Conversation history and custom note reset now use Firestore and real UUID session IDs.',
    ],
  },
  {
    version: 'v1.6.0',
    date: '2026-03-22',
    changes: [
      'Major conversation overhaul: HealthCoach now asks before telling, follows the patient\'s lead, and acknowledges multiple conditions and providers.',
      'Removed rigid yes/no greeting flow -- conversations start with an open-ended question.',
      'AI prompts rewritten for empathy, pacing, and genuine back-and-forth dialogue.',
      'Progress bar advances more gently so patients never feel rushed.',
      'Increased response length for more thoughtful, conversational replies.',
    ],
  },
  {
    version: 'v1.5.11',
    date: '2026-03-22',
    changes: [
      'Redesigned chat message formatting: section headers, grouped bullet cards, and clearer visual hierarchy for easier reading.',
    ],
  },
  {
    version: 'v1.5.10',
    date: '2025-03-22',
    changes: [
      'Language and admin prompt dropdowns vertically center the selected value.',
    ],
  },
  {
    version: 'v1.5.9',
    date: '2025-03-21',
    changes: [
      'Version label opens release notes with a running changelog.',
      'Admin access is available from the top of the release notes dialog.',
    ],
  },
  {
    version: 'v1.5.8',
    changes: [
      'Landing dashboard chat, session history, and combined review + prep flow refinements.',
    ],
  },
];
