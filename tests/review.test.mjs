import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cases } from '../fixtures/invoices.ts';
import { createClassifier } from '../app/model.ts';
import { accept, compare, initialDraft } from '../app/review.ts';

const asset = name => readFile(new URL('../public/model/' + name, import.meta.url));
const bytes = buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const classify = createClassifier(JSON.parse(await asset('vocabulary.json')), bytes(await asset('vectors.bin')), bytes(await asset('scales.bin')));
const [match] = cases;

test('allocates the two supported services to the full open balance', () => {
  const draft = initialDraft(match);
  const review = compare(match,draft,classify);
  assert.equal(review.eligible,true);
  assert.deepEqual(review.rows.map(row => row.available),[80000,120000]);
  assert.equal(accept(match,draft,classify).accepted,true);
});
