import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cases } from '../fixtures/invoices.ts';
import { createClassifier } from '../app/model.ts';
import { accept, compare, initialDraft } from '../app/review.ts';

const asset = name => readFile(new URL('../public/model/' + name, import.meta.url));
const bytes = buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const classify = createClassifier(JSON.parse(await asset('vocabulary.json')), bytes(await asset('vectors.bin')), bytes(await asset('scales.bin')));
const [match,scope] = cases;

test('matches paraphrased services and declines a same-price substitution', () => {
  assert.equal(classify('data import').label, 'migration');
  assert.equal(classify('priority support').label, 'support');
  assert.equal(compare(match,initialDraft(match),classify).eligible,true);
  assert.equal(compare(scope,initialDraft(scope),classify).eligible,false);
});
test('holds estimates, tax, and assistance even when the total fits', () => {
  for (const phrase of ['data import tax','data migration estimates','data migration scheduled','supporting data migration']) {
    const draft = {...initialDraft(match), cents:200000, phrases:['Setup',phrase]};
    const review = compare(match,draft,classify);
    assert.equal(accept(match,draft,classify).accepted,false,phrase);
    assert.ok(review.judgments[1].reason);
    assert.equal('similarity' in review.judgments[1],false);
    assert.ok(review.issues.some(issue => issue.includes(phrase)));
  }
});
test('repeat acceptance keeps the first allocation, and held cases cannot be accepted', () => {
  const accepted = accept(match,initialDraft(match),classify);
  assert.equal(accepted.accepted,true);
  assert.equal(accept(match,accepted,classify),accepted);
  assert.equal(accept(scope,initialDraft(scope),classify).accepted,false);
});
test('high similarity alone cannot authorize a different deliverable or setup target', () => {
  for (const [setup, migration] of [
    ['account setup guide', 'data import'],
    ['network setup', 'data import'],
    ['account setup', 'data import software'],
    ['account setup', 'data migration manual'],
  ]) {
    const draft = {...initialDraft(match), phrases:[setup, migration], cents:200000};
    const review = compare(match,draft,classify);
    assert.equal(review.eligible,false);
    assert.ok(review.judgments.some(j => j.label === 'unclear' && 'similarity' in j && j.reason));
  }
  const supported = {...initialDraft(match), phrases:['account setup fee','customer data migration'], cents:200000};
  assert.equal(accept(match,supported,classify).accepted,true);
});
