# Split Review

[Open the live demo](https://baikjy0215.github.io/split-review/)

Split Review helps an accounts payable reviewer allocate a bundled invoice to two fixed-price purchase order lines. The demo suggests a split when each service has distinct supporting wording and the invoice total exactly matches the combined open balances. The reviewer sees the evidence and decides whether to accept.

## Try the three invoices

Each case starts with a $2,000 invoice against an order for $800 of account setup and $1,200 of data migration. The cases are independent synthetic examples.

| Workspace case | Initial decision | What to try |
| --- | --- | --- |
| Matching services | “Setup” and “Data import” support both lines. | Accept $800 for setup and $1,200 for migration. Both open balances reach $0. |
| Different service | “Priority support” has no matching order line. | Edit the second phrase to “data import” and choose **Compare changes**. |
| Used balance | A prior bill used $300 for migration. Only $900 remains on that line, so the invoice is $300 over the combined open balances. | Compare a corrected total of $1,700. The reviewer can accept $800 for setup and $900 for migration. |

A smaller total can also require review. At $1,600 in Used balance, several allocations could fit. The reviewer needs the billed amount for each service.

## Run locally

Use Node.js 24 or later and npm.

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite. **Workspace** opens first. **Product brief** explains the decision and pilot criteria. **Architecture** shows the browser implementation and the proposed shared backend.

Compared edits and accepted decisions survive a reload in the same tab. **Reset case** restores the selected example.

Run `npm test` for the matching, acceptance and published phrase-result checks. Run `npm run build` to type-check and produce the static app in `dist/`. Serve that directory at a site root or under a subdirectory. The model and IBM Plex Sans font are bundled locally. [Model license](public/model/LICENSE.txt) · [Font license](public/fonts/OFL.txt)

[Product brief](docs/product-brief.md) · [Architecture](docs/architecture.md) · [Demo walkthrough and model details](docs/demo.md)

## Why Model2Vec?

The browser demo uses Potion 2M, a small Model2Vec embedding model, to match invoice phrases to ordered services. In our synthetic trial it recognized “data import” as migration. Bekko System One 17M, the local decision model we tested, returned “unclear” on that same phrase. Potion also had the smallest download at 2.29 MB.

A pilot could use a hosted decision model such as Jev if it recognizes more vendor wording at an acceptable error rate and cost. Either way, application code checks the open balances in cents and the reviewer decides whether to accept.

## Source layout

| Directory | Contents |
| --- | --- |
| `app/` | Review workspace, decision logic, matcher and document views |
| `docs/` | Product brief, architecture diagram and walkthrough |
| `fixtures/` | Synthetic invoices and purchase order |
| `tests/` | Matching, currency, balance and acceptance checks |
| `public/model/` | Bundled model vocabulary, quantized weights and upstream license |
