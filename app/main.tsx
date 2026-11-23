import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { cases, order, type Invoice } from '../fixtures/invoices';
import { loadClassifier, matchThreshold, type Classifier } from './model';
import { accept, compare, initialDraft, parseCents, restore, type Draft } from './review';
import './style.css';

const Documents = lazy(() => import('./Documents'));
const pages = { workspace: 'Workspace', brief: 'Product brief', architecture: 'Architecture' } as const;
function currentPage(): keyof typeof pages {
  const hash = location.hash.slice(1);
  return hash === 'brief' || hash === 'architecture' ? hash : 'workspace';
}

const usd = (cents: number) => (cents/100).toLocaleString('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0,
});
const key = (invoice: Invoice) => 'split-review/v1/' + invoice.id;
const memoryDrafts = new Map<string, Draft>();

function readDraft(invoice: Invoice, classify: Classifier) {
  const memoryDraft = memoryDrafts.get(invoice.id);
  if (memoryDraft) return restore(invoice, memoryDraft, classify);
  try { return restore(invoice, JSON.parse(sessionStorage.getItem(key(invoice)) || 'null'), classify); }
  catch { return initialDraft(invoice); }
}

function Editor({ draft, onSave, onClose }: {draft: Draft; onSave: (draft: Draft) => void; onClose: () => void}) {
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const first = String(data.get('first')).trim();
    const second = String(data.get('second')).trim();
    const cents = parseCents(String(data.get('amount')));
    if (!first || !second) {
      setError('Enter a description for each billed service.');
      return;
    }
    if (cents === null) {
      setError('Enter a USD amount from $0.01 to $999,999.99 with up to two decimal places.');
      return;
    }
    onSave({ phrases: [first, second], cents, accepted: false });
  }
  return <form className="editor" onSubmit={submit}>
    <label>First billed service<input autoFocus name="first" required maxLength={70} defaultValue={draft.phrases[0]} /></label>
    <label>Second billed service<input name="second" required maxLength={70} defaultValue={draft.phrases[1]} /></label>
    <label>Invoice total (USD)<input name="amount" required inputMode="decimal" defaultValue={(draft.cents/100).toFixed(2)} /></label>
    {error && <p role="alert">{error}</p>}
    <div className="buttons"><button className="primary">Compare changes</button><button type="button" onClick={onClose}>Cancel</button></div>
  </form>;
}

function Review({invoice, classify}: {invoice: Invoice; classify: Classifier}) {
  const [draft, setDraft] = useState<Draft>(() => readDraft(invoice, classify));
  const [editing, setEditing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const nextFocus = useRef<'decision' | 'edit' | null>(null);
  useLayoutEffect(() => {
    if (nextFocus.current === 'decision') headingRef.current?.focus();
    if (nextFocus.current === 'edit') editButton.current?.focus();
    nextFocus.current = null;
  }, [draft, editing]);
  const result = compare(invoice, draft, classify);
  const status = draft.accepted ? 'accepted' : result.eligible ? 'ready' : 'hold';
  function save(next: Draft) {
    nextFocus.current = 'decision';
    setDraft(next);
    try {
      sessionStorage.setItem(key(invoice), JSON.stringify(next));
      memoryDrafts.delete(invoice.id);
    } catch {
      memoryDrafts.set(invoice.id, next);
    }
    setEditing(false);
  }
  const hasShortfall = result.shortfallCents > 0;
  const heading = hasShortfall ? usd(result.shortfallCents) + ' shortfall' :
    {ready:'Suggested split',hold:'Hold for review',accepted:'Split recorded'}[status];
  return <div className="desk">
    <div className="sources">
      <section className="document invoice">
        <div className="folio"><span>Vendor invoice</span><span>{invoice.id}</span></div>
        <div className="doc-body"><div className="vendor"><span className="monogram" aria-hidden="true">A</span><div><h2>{order.vendor}</h2><span className="muted">Implementation services</span></div></div>
          <div className="line-summary"><div><div className="caption">Billed description</div><p className="quote">“{draft.phrases.join(' and ')}”</p></div><div className="amount">{usd(draft.cents)}</div></div>
          {editing ? <Editor draft={draft} onSave={save} onClose={() => { nextFocus.current = 'edit'; setEditing(false); }} /> :
            !draft.accepted && <button ref={editButton} className="text-button" onClick={() => setEditing(true)}>Edit invoice</button>}
        </div>
      </section>
      <section className="document purchase"><div className="folio"><span>Purchase order</span><span>{order.id}</span></div>
        <div className="doc-body"><table><thead><tr><th>Approved service</th><th>Ordered</th><th>Open balance</th></tr></thead><tbody>
        {result.rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{usd(row.cents)}</td><td>{usd(draft.accepted ? 0 : row.available)}</td></tr>)}
        </tbody></table></div>
      </section>
    </div>
    <section className={'assessment ' + status} aria-label="Review decision"><div className="folio"><span>Allocation review</span><strong>{editing ? 'Editing invoice' : {hold:'On hold',ready:'Ready to accept',accepted:'Accepted'}[status]}</strong></div>
      <div className="assessment-body"><div aria-live="polite"><h2 ref={headingRef} tabIndex={-1}>{heading}</h2>
        {result.previouslyBilled.map(row => <p className="reason" key={row.id}>An earlier invoice used <strong>{usd(row.cents - row.available)}</strong> of the {usd(row.cents)} ordered for {row.name.toLowerCase()}, leaving <strong>{usd(row.available)}</strong> for this invoice.</p>)}
        {result.issues.length > 0 && <ul className="issues">{result.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        {status !== 'hold' && <p className="reason">{draft.accepted ? 'Two bill lines have been applied to the order in this demo session.' : 'Both ordered services have supporting wording and enough open balance.'}</p>}
      </div>
      <div className="allocations">{result.rows.map(row => <div className="allocation" key={row.id}><div><strong>{row.name}</strong><div className={'evidence' + (!row.evidence ? ' missing' : '')}>{row.evidence ? '“' + row.evidence + '”' : 'No distinct supporting phrase'}</div></div><b>{usd(row.available)}{status === 'hold' && ' available'}</b></div>)}</div>
      <div className="delta"><span>Invoice <b>{usd(draft.cents)}</b></span><span>{draft.accepted ? 'Applied to order' : 'Available to bill'} <b>{usd(result.availableCents)}</b></span></div>
      <div className="buttons"><button className="primary" disabled={!result.eligible || draft.accepted || editing} onClick={() => save(accept(invoice,draft,classify))}>{draft.accepted ? 'Split recorded' : 'Accept split'}</button><button onClick={() => save(initialDraft(invoice))}>Reset case</button></div>
      {memoryDrafts.has(invoice.id) && <p role="status" className="reason">Tab storage is unavailable. This review will last until you reload the page.</p>}
      </div>
      <details className="trace"><summary>Inspect matching evidence</summary><p>Each phrase is compared with local service examples. Cosine similarity measures closeness. The margin is its lead over the next category.</p>
      <dl>{result.judgments.map((j,i) => <div key={i}><dt>{draft.phrases[i]}</dt><dd>{'similarity' in j ? j.label + ' · similarity ' + j.similarity.toFixed(3) + ' · margin ' + j.margin.toFixed(3) : 'Held before scoring.'}{j.reason && <p>{j.reason}</p>}</dd></div>)}</dl>
      <p>A match requires similarity of at least {matchThreshold.similarity} and a margin of at least {matchThreshold.margin}.</p></details>
    </section>
  </div>;
}

function caseIndex() {
    const invoiceId = new URLSearchParams(location.search).get('invoice');
    return Math.max(0, cases.findIndex(invoice => invoice.id === invoiceId));
}

function Workspace() {
  const [index,setIndex] = useState(caseIndex);
  useEffect(() => {
    const restoreCase = () => setIndex(caseIndex());
    window.addEventListener('popstate', restoreCase);
    return () => window.removeEventListener('popstate', restoreCase);
  }, []);
  function selectCase(i: number) {
    const url = new URL(location.href);
    url.searchParams.set('invoice', cases[i].id);
    history.replaceState(null, '', url);
    setIndex(i);
  }
  const [classify,setClassify] = useState<Classifier | null>(null);
  const [failed,setFailed] = useState(false);
  useEffect(() => { loadClassifier().then(fn => setClassify(() => fn)).catch(() => setFailed(true)); }, []);
  return <><div className="mast"><div><p className="caption">Invoice workspace</p><h1>Review a bundled charge</h1><p className="sub">Compare one invoice line with the two services the buyer ordered.</p></div><span className="demo-label">Synthetic records · USD</span></div>
    <nav className="cases" aria-label="Example invoices">{cases.map((c,i) => <button key={c.id} aria-pressed={i===index} onClick={() => selectCase(i)}><span>{c.id}</span>{c.name}</button>)}</nav>
    {classify ? <Review key={cases[index].id} invoice={cases[index]} classify={classify} /> : <section className="loading" role="status">{failed ? <><h2>Matching model unavailable</h2><p>Reload the local model files to continue the review.</p><button onClick={() => location.reload()}>Reload</button></> : 'Loading service matching model…'}</section>}
    <footer><span>Model2Vec / potion-base-2M</span><span>Browser inference · Session-local review</span></footer>
    </>;
}

function App() {
  const [page, setPage] = useState(currentPage);
  const [visitedWorkspace, setVisitedWorkspace] = useState(page === 'workspace');
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const navigate = () => {
      const next = currentPage();
      if (next === 'workspace') setVisitedWorkspace(true);
      setPage(next);
      main.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => { document.title = pages[page] + ' | Split Review'; }, [page]);

  return <>
    <header className="brandbar"><div className="frame bar">
      <div className="brand"><img src="./split-review.svg" width="30" height="30" alt="" />Split Review</div>
      <nav className="page-nav" aria-label="Main navigation">
        {Object.entries(pages).map(([id, label]) =>
          <a key={id} href={'#' + id} aria-current={id === page ? 'page' : undefined}>{label}</a>)}
      </nav>
      <a className="repo-link" href="https://github.com/baikjy0215/split-review" aria-label="View Split Review on GitHub">GitHub</a>
    </div></header>
    <main className="frame" ref={main} tabIndex={-1}>
      {visitedWorkspace && <div hidden={page !== 'workspace'}><Workspace /></div>}
      {page !== 'workspace' && <Suspense fallback={<p role="status">Loading document…</p>}><Documents page={page}/></Suspense>}
    </main>
  </>;
}
createRoot(document.getElementById('root')!).render(<App />);
