import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

function timestamp() {
  return new Date().toISOString().slice(0, 10);
}

function formatPlainText(messages, metadata = {}) {
  const header = `HealthCoach Conversation\n${'='.repeat(40)}`;
  const date = `Date: ${new Date().toLocaleString()}`;
  const recipient = metadata.recipientLabel
    ? `Prepared for: ${metadata.recipientLabel}`
    : '';
  const body = messages
    .map((m) => `${m.role === 'user' ? 'Patient' : 'HealthCoach'}: ${m.content}`)
    .join('\n\n');
  return [header, date, recipient, '', body].filter(Boolean).join('\n');
}

export function downloadAsTxt(messages, metadata = {}) {
  const content = formatPlainText(messages, metadata);
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `healthcoach-chat-${timestamp()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadAsPdf(messages, metadata = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const usable = pageW - margin * 2;
  let y = margin;

  function addPage() {
    doc.addPage();
    y = margin;
  }

  function checkSpace(need) {
    if (y + need > doc.internal.pageSize.getHeight() - margin) addPage();
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('HealthCoach Conversation', margin, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);
  y += 5;
  if (metadata.recipientLabel) {
    doc.text(`Prepared for: ${metadata.recipientLabel}`, margin, y);
    y += 5;
  }
  y += 6;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setTextColor(0);
  for (const m of messages) {
    const label = m.role === 'user' ? 'Patient' : 'HealthCoach';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    checkSpace(14);
    doc.text(label, margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(m.content, usable);
    for (const line of lines) {
      checkSpace(5);
      doc.text(line, margin, y);
      y += 4.5;
    }
    y += 6;
  }

  doc.save(`healthcoach-chat-${timestamp()}.pdf`);
}

export async function downloadAsDocx(messages, metadata = {}) {
  const children = [
    new Paragraph({
      text: 'HealthCoach Conversation',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Generated ${new Date().toLocaleString()}`, color: '888888', size: 20 }),
      ],
    }),
  ];

  if (metadata.recipientLabel) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Prepared for: ${metadata.recipientLabel}`, color: '888888', size: 20 }),
        ],
      }),
    );
  }

  children.push(new Paragraph({ text: '' }));

  for (const m of messages) {
    const label = m.role === 'user' ? 'Patient' : 'HealthCoach';
    children.push(
      new Paragraph({
        children: [new TextRun({ text: label, bold: true, size: 24 })],
        spacing: { before: 240 },
      }),
      new Paragraph({
        children: [new TextRun({ text: m.content, size: 22 })],
        spacing: { after: 120 },
      }),
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `healthcoach-chat-${timestamp()}.docx`);
}

export function getPlainTextPreview(messages) {
  return formatPlainText(messages);
}
