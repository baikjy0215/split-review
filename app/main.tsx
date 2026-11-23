import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cases, order, type Invoice } from '../fixtures/invoices';
import { loadClassifier, type Classifier } from './model';
import { accept, compare, initialDraft, type Draft } from './review';
import './style.css';

const usd = (cents: number) => (cents/100).toLocaleString('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0,
});
function Review({invoice, classify}: {invoice: Invoice; classify: Classifier}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(invoice));
  const result = compare(invoice, draft, classify);
  const status = draft.accepted ? 'accepted' : result.eligible ? 'ready' : 'hold';
  function save(next: Draft) {
    setDraft(next);
  }
  const heading = {ready:'Suggested split',hold:'Hold for review',accepted:'Split recorded'}[status];
  return <div className="desk">
    <div className="sources">
      <section className="document invoice">
        <div className="folio"><span>Vendor invoice</span><span>{invoice.id}</span></div>
        <div className="doc-body"><div className="vendor"><span className="monogram" aria-hidden="true">A</span><div><h2>{order.vendor}</h2><span className="muted">Implementation services</span></div></div>
          <div className="line-summary"><div><div className="caption">Billed description</div><p className="quote">“{draft.phrases.join(' and ')}”</p></div><div className="amount">{usd(draft.cents)}</div></div>
        </div>
      </section>
      <section className="document purchase"><div className="folio"><span>Purchase order</span><span>{order.id}</span></div>
        <div className="doc-body"><table><thead><tr><th>Approved service</th><th>Ordered</th><th>Open balance</th></tr></thead><tbody>
        {result.rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{usd(row.cents)}</td><td>{usd(draft.accepted ? 0 : row.available)}</td></tr>)}
        </tbody></table></div>
      </section>
    </div>
    <section className={'assessment ' + status} aria-label="Review decision"><div className="folio"><span>Allocation review</span><strong>{{hold:'On hold',ready:'Ready to accept',accepted:'Accepted'}[status]}</strong></div>
      <div className="assessment-body"><div aria-live="polite"><h2>{heading}</h2>
        {result.issues.length > 0 && <ul className="issues">{result.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        {status !== 'hold' && <p className="reason">{draft.accepted ? 'Two bill lines have been applied to the order in this demo session.' : 'Both ordered services have supporting wording and enough open balance.'}</p>}
      </div>
      <div className="allocations">{result.rows.map(row => <div className="allocation" key={row.id}><div><strong>{row.name}</strong><div className={'evidence' + (!row.evidence ? ' missing' : '')}>{row.evidence ? '“' + row.evidence + '”' : 'No distinct supporting phrase'}</div></div><b>{usd(row.available)}{status === 'hold' && ' available'}</b></div>)}</div>
      <div className="delta"><span>Invoice <b>{usd(draft.cents)}</b></span><span>{draft.accepted ? 'Applied to order' : 'Available to bill'} <b>{usd(result.availableCents)}</b></span></div>
      <div className="buttons"><button className="primary" disabled={!result.eligible || draft.accepted} onClick={() => save(accept(invoice,draft,classify))}>{draft.accepted ? 'Split recorded' : 'Accept split'}</button><button onClick={() => save(initialDraft(invoice))}>Reset case</button></div>
      </div>
    </section>
  </div>;
}

function Workspace() {
  const [classify,setClassify] = useState<Classifier | null>(null);
  const [failed,setFailed] = useState(false);
  useEffect(() => { loadClassifier().then(fn => setClassify(() => fn)).catch(() => setFailed(true)); }, []);
  return <><div className="mast"><div><p className="caption">Invoice workspace</p><h1>Review a bundled charge</h1><p className="sub">Compare one invoice line with the two services the buyer ordered.</p></div><span className="demo-label">Synthetic records · USD</span></div>
    {classify ? <Review key={cases[0].id} invoice={cases[0]} classify={classify} /> : <section className="loading" role="status">{failed ? <><h2>Matching model unavailable</h2><p>Reload the local model files to continue the review.</p><button onClick={() => location.reload()}>Reload</button></> : 'Loading service matching model…'}</section>}
    <footer><span>Model2Vec / potion-base-2M</span><span>Browser inference · Session-local review</span></footer>
    </>;
}

function App() {
  return <>
    <header className="brandbar"><div className="frame bar">
      <div className="brand"><img src="./split-review.svg" width="30" height="30" alt="" />Split Review</div>
    </div></header>
    <main className="frame"><Workspace /></main>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
