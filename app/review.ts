import { order, type Invoice } from '../fixtures/invoices.ts';
import type { Classifier } from './model.ts';

export interface Draft { phrases: [string, string]; cents: number; accepted: boolean }
export function initialDraft(invoice: Invoice): Draft {
  return { phrases: [...invoice.phrases], cents: 200000, accepted: false };
}
export function compare(invoice: Invoice, draft: Draft, classify: Classifier) {
  const judgments = draft.phrases.map(classify);
  const rows = order.lines.map((line, index) => {
    const matches = judgments.flatMap((j, i) => j.label === line.label ? [i] : []);
    return { ...line, available: invoice.balances[index], evidence: matches.length === 1 ? draft.phrases[matches[0]] : null };
  });
  const issues: string[] = [];
  judgments.forEach((judgment, index) => {
    const phrase = '“' + draft.phrases[index] + '”';
    if (judgment.label === 'unclear') {
      issues.push(phrase + ' - ' + (judgment.reason ?? 'The model could not identify a clear service match.'));
    } else if (!order.lines.some(line => line.label === judgment.label)) {
      issues.push('Check the buyer’s authorization for ' + phrase + '.');
    }
  });
  if (!issues.length && rows.some(row => !row.evidence)) issues.push('Both phrases point to the same service. Confirm what was billed for the other order line.');
  const availableCents = rows.reduce((total, row) => total + row.available, 0);
  if (draft.cents < availableCents) issues.push('This invoice covers only part of the open balance. Confirm how much was billed for each service.');
  return { rows, judgments, issues: [...new Set(issues)], availableCents,
    eligible: issues.length === 0 && draft.cents === availableCents };
}
export function accept(invoice: Invoice, draft: Draft, classify: Classifier): Draft {
  if (draft.accepted || !compare(invoice, draft, classify).eligible) return draft;
  return { ...draft, accepted: true };
}
