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
