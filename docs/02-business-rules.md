# Business Rules — Decisions Log

Answers from the client that settle open questions from the architecture proposal.
Rules not listed here are still **open** and must be confirmed before they're implemented.

| # | Topic | Decision | Decided |
|---|---|---|---|
| Q1 | Marla size | **1 marla = 225 sq ft** (project default `sqft_per_marla = 225`, 1 kanal = 20 marla) | 21-Oct-2026 |
| Q4 | When a unit becomes `sold` | Only when the **full down payment is cleared** (all `down_payment` installments `paid`, cheques cleared). Before that the unit stays `booked`. | 21-Oct-2026 |
| Q5 | Late fees | A **late-payment penalty applies to installments**. Rate/method/grace days still to be confirmed, so they are configurable per project (see below). | 21-Oct-2026 |
| Q6 | Sale commission | Waystar's 5% is **earned pro-rata as payments are collected** (5% of each cleared payment), not all at booking. | 21-Oct-2026 |

## Late-fee settings (configurable per project until confirmed)

- `late_fee_method`: `none` | `flat_per_installment` | `pct_of_overdue_per_month` | `pct_per_day`
- `late_fee_rate`: numeric
- `late_fee_grace_days`: int
- `late_fee_cap_pct`: optional cap as % of the installment amount
- Applied by the nightly overdue job; can be waived only via an approved `waiver` request.

Still to confirm: the actual rate and method, grace days, whether penalties on rent invoices apply too,
and whether a payment settles the penalty or the principal first.

## Schema impact

- `projects`: add `late_fee_method`, `late_fee_rate`, `late_fee_grace_days`, `late_fee_cap_pct`.
- `refresh_unit_status`: `booked → sold` when the sum of cleared allocations on `down_payment` installments = their `amount_due`.
- `commissions`: earned amount = 5% × cleared, non-reversed payments on the sale; recomputed on clear/bounce/reverse.
  Add `earned_amount` column (vs. `amount` = full potential commission on the final price).

---

## Simco Villas — rules taken from SIMCO's own documents (22-Oct-2026)

Source: the client's Simco Villas templates. These are 01 Booking Form, 03 Possession Letter, 05 NDC Letter,
06 Allotment Letter, 07 Sale Agreement and 08 Installment Payment Schedule.
They apply to **Simco Villas only**. The other projects keep the defaults until their own documents arrive.

| Topic | Rule (as written in the documents) |
|---|---|
| Location | SIMCO VILLAS, PMO Road, Taxila, District Rawalpindi. Seller office: Simco Square, Faisal Hills, Taxila |
| Plot types | 5 Marla (25′ × 50′), 6 Marla (30′ × 50′), 8 Marla (30′ × 60′) |
| Corner plots | +10% on the plot price |
| Installment plan | 30% down payment at booking, then 70% in **8 equal quarterly installments** (8.75% each). No separate possession installment |
| Full-payment plan | Single payment per the current price list. **Possession charges of 5%** are added *before* the full-payment discount |
| Late penalty | **10% per month on the overdue amount** |
| Default → cancellation | **2 consecutive unpaid installments** cancel the booking/allotment. **20% of the total sale price** is deducted and the balance is refunded **after the plot is re-sold** (within [__] days) |
| Payment allocation | Oldest unpaid installment first, unless the Company agrees otherwise in writing. Advance payments allowed |
| Area adjustment | Final demarcated area vs. booked area adjusted pro-rata at the per-marla / per-sq-ft price agreed at booking |
| Construction | Allowed only after **80% of the sale price** has been paid |
| Utilities / maintenance | Payable from the date of the Seller's "ready for possession" notice, whether or not possession is taken |
| Possession | Only after full payment and maintenance dues. Allottee may report dimension discrepancies within [__] days |
| NDC | States its purpose (transfer / possession / bank financing / other). **Valid 7 days** |
| Disputes on letters | Must be raised in writing within 7 days |
| Document refs | Booking Form `BF-`, Allotment Letter `AL-`, Sale Agreement `SA-`, Possession Letter `PL-`, NDC `NDC-` |
| Booking form extras | Joint applicant / nominee with relationship, booking amount paid, payment instrument no., NTN / tax-filer status |

Still blank in the templates. These become per-project settings that an admin fills in:
- Seller legal status / registration no. / NTN; authorized signatory name + CNIC
- Managing Director name (Allotment Letter)
- Approval / NOC ref.; possession date/timeline; delay-compensation basis
- Refund period after re-sale; discrepancy-report window; allotment countersign window
