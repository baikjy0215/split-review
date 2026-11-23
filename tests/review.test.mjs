import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cases } from '../fixtures/invoices.ts';
import { createClassifier } from '../app/model.ts';
import { accept, compare, initialDraft, parseCents, restore } from '../app/review.ts';

const asset = name => readFile(new URL('../public/model/' + name, import.meta.url));
const bytes = buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const classify = createClassifier(JSON.parse(await asset('vocabulary.json')), bytes(await asset('vectors.bin')), bytes(await asset('scales.bin')));
const [match,scope,used] = cases;

test('matches paraphrased services and declines a same-price substitution', () => {
  assert.equal(classify('data import').label, 'migration');
  assert.equal(classify('priority support').label, 'support');
  assert.equal(compare(match,initialDraft(match),classify).eligible,true);
  assert.equal(compare(scope,initialDraft(scope),classify).eligible,false);
});
test('holds when balances, scope or the invoice total fail independently', () => {
  assert.equal(compare(used,initialDraft(used),classify).eligible,false);
  for (const phrase of ['no data import','data migration support','setup']) {
    const draft = {...initialDraft(match),phrases:['Setup',phrase]};
    assert.equal(compare(match,draft,classify).eligible,false,phrase);
  }
  assert.equal(compare(match,{...initialDraft(match),cents:200001},classify).eligible,false);
});
test('correcting a previously billed order to the open total releases the hold', () => {
  const draft = initialDraft(used);
  assert.equal(compare(used,draft,classify).shortfallCents,30000);
  const corrected = {...draft,cents:170000};
  const review = compare(used,corrected,classify);
  assert.equal(review.shortfallCents,0);
  assert.deepEqual(review.rows.map(row => row.available),[80000,90000]);
  assert.equal(accept(used,corrected,classify).accepted,true);
  assert.equal(restore(used,{...corrected,accepted:true},classify).accepted,true);
  assert.equal(accept(used,{...corrected,phrases:scope.phrases},classify).accepted,false);
  for (const cents of [169999,170001]) {
    const partial = compare(used,{...draft,cents},classify);
    assert.equal(partial.eligible,false);
    assert.equal(partial.shortfallCents,Math.max(0,cents-170000));
  }
});
test('currency conversion is exact to a cent and rejects incomplete or unsupported values', () => {
  assert.equal(parseCents('2000.01'),200001);
  assert.equal(parseCents('0.1'),10);
  assert.equal(parseCents(' $1,700 '),170000);
  assert.equal(parseCents('999,999.99'),99999999);
  for (const value of ['-2','0','1.001','1e3','', '1000000','1,70','1,2,00','$1.700,00']) assert.equal(parseCents(value),null,value);
});
test('holds estimates, tax, and assistance even when the total fits', () => {
  for (const phrase of ['data import tax','data migration estimates','data migration scheduled','supporting data migration']) {
    const draft = {...initialDraft(used), cents:170000, phrases:['Setup',phrase]};
    const review = compare(used,draft,classify);
    assert.equal(accept(used,draft,classify).accepted,false,phrase);
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
    const draft = {...initialDraft(used), phrases:[setup, migration], cents:170000};
    const review = compare(used,draft,classify);
    assert.equal(review.eligible,false);
    assert.ok(review.judgments.some(j => j.label === 'unclear' && 'similarity' in j && j.reason));
    assert.equal(restore(used,{...draft, accepted:true},classify).accepted,false);
  }
  const supported = {...initialDraft(used), phrases:['account setup fee','customer data migration'], cents:170000};
  assert.equal(accept(used,supported,classify).accepted,true);
});
test('the published phrase results agree with the bundled classifier', async () => {
  const file = new URL('../public/evaluation/phrase-results.csv', import.meta.url);
  const [, ...rows] = (await readFile(file,'utf8')).trim().split(/\r?\n/);
  for (const row of rows) {
    const [phrase,, heldBeforeScoring, prediction] = row.split(',');
    const judgment = classify(phrase);
    assert.equal(judgment.label,prediction,phrase);
    assert.equal(String(!('similarity' in judgment)),heldBeforeScoring,phrase);
  }
});
test('restores accepted state only after rechecking the underlying evidence', () => {
  assert.equal(restore(match,{...initialDraft(match),accepted:true},classify).accepted,true);
  assert.equal(restore(scope,{...initialDraft(scope),accepted:true},classify).accepted,false);
  assert.deepEqual(restore(match,{phrases:[2,null],cents:-1},classify),initialDraft(match));
});
