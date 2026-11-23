# Split Review

Review one bundled invoice against two fixed-price purchase order lines. The browser matches the service phrases locally and checks the amounts in cents. All records are synthetic.

## Try it

- **Matching services** shows how a $2,000 invoice can be split into $800 of account setup and $1,200 of data migration.
- **Different service** holds the invoice when the vendor bills priority support. Open the evidence panel to inspect the phrase matches.
- **Used balance** shows a $300 shortfall after a previous bill. Compare a corrected $1,700 invoice to review the remaining $800 and $900 allocations.

[See the $300 shortfall in the workspace](docs/assets/used-balance.png)

## Run locally

Use Node.js 24 or later.

```sh
npm ci
npm run dev
```

Run `npm test` to check the matching and allocation logic. Use `npm run build` to type-check and generate the static site. [Model license](public/model/LICENSE.txt) · [Font license](public/fonts/OFL.txt)
