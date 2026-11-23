# Product brief

When a supplier bundles two services into one charge, can an accounts payable reviewer tell how much belongs on each order line?

## The decision

A buyer ordered $800 of account setup and $1,200 of data migration. The supplier sends one invoice line with two service descriptions and a total. The reviewer needs to establish what the buyer authorized, how much remains on each line and whether those balances determine a single split.

Split Review puts the invoice wording beside each proposed allocation. The reviewer can accept the split, correct the invoice inputs and compare again, or investigate a hold.

## Three cases on the same order

### Matching services

“Setup” and “Data import” cover both ordered services. The $2,000 invoice uses the full open balance. Accepting applies $800 to account setup and $1,200 to migration.

### Different service

“Setup” and “Priority support” also total $2,000. Support has no corresponding order line. The reviewer sees which phrase needs buyer authorization. Changing it to “data import” demonstrates how a corrected description affects the decision.

### Used balance

An earlier bill used $300 of the $1,200 migration line. That leaves $800 for setup and $900 for migration. The original $2,000 invoice shows a **$300 shortfall**. Correcting it to **$1,700** makes the $800 and $900 split eligible. At $1,600, the reviewer still needs a per-service breakdown because the total permits several splits.

## Acceptance criteria

- Each billed phrase must support a different ordered service. A reviewer can inspect the scores and any wording that needs clarification. For example, “account setup guide” could refer to a document. That charge stays on hold even if the model scores it close to account setup.
- The total must equal the sum of both open balances to the cent. In this narrow case, each line can then take its full remaining balance.
- Only the reviewer can record the split. Acceptance closes both open balances for that case. Reloading the tab restores the decision. Resetting the case restores its starting balances.

## Scope and assumptions

The demo uses three independent synthetic examples, one vendor, one linked order and USD. The two service phrases are already separated. The demo assumes a common entity and period. Document extraction, verification of service delivery and bank or ledger posting are outside its scope. Editing represents a corrected synthetic invoice.

## What would earn a pilot?

The demo uses Model2Vec because it runs in the browser and handled a phrase central to this workflow. It matched “data import” to migration, where the local decision model we tried, Bekko System One, returned “unclear.” Model2Vec still deferred 15 of 22 phrases with a known service in our small synthetic trial.

For a pilot, the question is whether a hosted model such as Jev could resolve more of those cases reliably. We would adopt it if the time saved on real reviews justifies the inference cost and added wait, within the agreed limit on incorrect suggestions.

Start with ten recent manual splits, including one returned to the buyer. Ask two reviewers whether the invoice and order contained enough evidence to resolve each case. Record time spent reconstructing allocations separately from time spent obtaining missing authorization.

| Evaluation | Decision criterion |
| --- | --- |
| Offline comparison | Have two reviewers label whole splits independently. On held-out vendors, compare exact phrase matching, Model2Vec and a hosted candidate. At the agreed error limit, measure how many bundles each can resolve, the response time and the cost per correct suggestion. |
| Quality gate | Agree on an acceptable error rate with the controls owner. As an illustration, zero wrong splits in 300 independent suggestions gives a one-sided 95% upper bound just under 1%. Repeated vendor templates weaken that estimate. |
| Reviewer pilot | Compare assisted and manual review across comparable cases. A proposed target is a 25% reduction in median active time to a correct resolution, including corrections. |

The demo exercises the workflow on synthetic records. Accuracy and time savings on vendor invoices remain open questions. [Architecture](architecture.md)
