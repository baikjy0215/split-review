export type Service = 'setup' | 'migration' | 'support';
export type Judgment =
  | { label: Service | 'unclear'; similarity: number; margin: number; reason?: string }
  | { label: 'unclear'; reason: string };
export type Classifier = (phrase: string) => Judgment;
export const matchThreshold = { similarity: .84, margin: .16 };

const examples: Record<Service, string[]> = {
  setup: ['account setup', 'setup', 'account configuration', 'workspace activation', 'initial configuration', 'workspace provisioning', 'account installation'],
  migration: ['data migration', 'import source data', 'database transfer', 'record migration', 'import existing records', 'data conversion'],
  support: ['priority support', 'technical support', 'premium support', 'help desk', 'customer assistance', 'support retainer'],
};
// A close embedding can still describe a different object, such as a setup guide.
// Limit positive evidence for these two fixed-price lines to reviewed wording.
const qualifiers = {
  setup: 'account accounts tenant new initial configured configure provision provisioned set up',
  migration: 'customer historical legacy migrated migrate imported transferred converted records',
};
const commonWords = 'a an the of for to from service services fee fees completed'.split(' ');
function abstain(reason: string): Judgment {
  return { label: 'unclear', reason };
}
const adjustment = /\b(tax|taxes|vat|gst|credits?|refunds?|discounts?|deposits?)\b/;
const planned = /\b(estimates?|estimated|quotes?|quoted|proposals?|proposed|scheduled|planned)\b/;
const excluded = /\b(no|not|non|without|excluding|exclude|excluded|waived|waive|except|canceled|cancelled|credit|refund|discount|free|optional|or|and|instead|replacement|reversal|training|consulting|unrelated|unconfirmed|pending|partial|reduced|prepaid|advance|deposit)\b/;

export function createClassifier(tokens: string[], weights: ArrayBuffer, scaleBuffer: ArrayBuffer): Classifier {
  const dimensions = 64;
  const vocab = new Map(tokens.map((word, id) => [word, id]));
  if (weights.byteLength !== tokens.length * dimensions || scaleBuffer.byteLength !== tokens.length * 4) {
    throw new Error('Model weights and vocabulary have incompatible dimensions.');
  }
  const vectors = new Int8Array(weights);
  const scales = new DataView(scaleBuffer);

  function tokenize(word: string): number[] {
    const result: number[] = [];
    let start = 0;
    while (start < word.length) {
      let end = word.length;
      let id: number | undefined;
      while (end > start) {
        id = vocab.get((start ? '##' : '') + word.slice(start, end));
        if (id !== undefined) break;
        end--;
      }
      if (id === undefined) return [];
      result.push(id);
      start = end;
    }
    return result;
  }
  function encode(phrase: string) {
    const parts = phrase.split(' ').map(tokenize);
    if (parts.some(ids => !ids.length)) return null;
    const sum = new Float64Array(dimensions);
    for (const id of parts.flat()) {
      const scale = scales.getFloat32(id * 4, true);
      for (let i = 0; i < dimensions; i++) sum[i] += vectors[id * dimensions + i] * scale;
    }
    const length = Math.hypot(...sum);
    return length ? sum.map(value => value / length) : null;
  }
  const catalog = (Object.keys(examples) as Service[]).map(label => ({
    label, vectors: examples[label].map(encode).filter(v => v !== null),
    scopeWords: label === 'support' ? null : new Set([
      ...examples[label].join(' ').split(' '), ...qualifiers[label].split(' '), ...commonWords,
    ]),
  }));
  return text => {
    const phrase = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[-\s]+/g, ' ');
    if (!/^[a-z]+(?: [a-z]+){0,5}$/.test(phrase)) return abstain('Use a short service description for matching.');
    if (adjustment.test(phrase)) return abstain('Tax or payment adjustments require a separate review.');
    if (planned.test(phrase)) return abstain('This wording describes proposed pricing or planned work.');
    if (excluded.test(phrase)) return abstain('This wording falls outside the supported service descriptions.');
    const assistance = /\b(help|support|supporting|assistance|advice|planning|preparation|guidance|advisory|assessments?|documentation)\b/;
    const implementation = /\b(setup|configuration|provisioning|activation|installation|migration|migrate|import|transfer|conversion)\b/;
    if (assistance.test(phrase) && implementation.test(phrase)) return abstain('This wording could describe assistance with the service.');
    const vector = encode(phrase);
    if (!vector) return abstain('The local model could not encode this phrase.');
    const ranked = catalog.map(group => ({
      group,
      score: Math.min(1, Math.max(...group.vectors.map(v => v.reduce((s, n, i) => s + n * vector[i], 0)))),
    })).sort((a, b) => b.score - a.score);
    const similarity = ranked[0].score;
    const margin = similarity - ranked[1].score;
    if (!(similarity >= matchThreshold.similarity && margin >= matchThreshold.margin)) {
      return { label: 'unclear', similarity, margin };
    }
    const { label, scopeWords } = ranked[0].group;
    const unverified = scopeWords && phrase.split(' ').find(word => !scopeWords.has(word));
    if (unverified) {
      return { label: 'unclear', similarity, margin,
        reason: 'Confirm what “' + unverified + '” refers to before applying this charge to the order.' };
    }
    return { label, similarity, margin };
  };
}

export async function loadClassifier(): Promise<Classifier> {
  const resources = await Promise.all(['vocabulary.json', 'vectors.bin', 'scales.bin'].map(async name => {
    const response = await fetch('./model/' + name);
    if (!response.ok) throw new Error('Could not load ' + name);
    return response;
  }));
  const [tokens, weights, scales] = await Promise.all([resources[0].json(), resources[1].arrayBuffer(), resources[2].arrayBuffer()]);
  return createClassifier(tokens, weights, scales);
}
