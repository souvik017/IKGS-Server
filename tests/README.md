# Backend tests

`workflows.test.js` is an end-to-end integration suite that boots the real
Express application against an in-memory MongoDB (`mongodb-memory-server`), so
no local MongoDB installation is required.

It exercises the required business workflows:

| # | Workflow |
|---|----------|
| 1 | Admin login / logout and unauthenticated access is rejected |
| 2 | Service catalogue creation and public read |
| 3 | Public booking submission creates a DB record |
| 4 | Public enquiry submission creates a DB record |
| 5 | Enquiry status updates, follow-ups and lead conversion (reusing customers) |
| 6 | Booking status update and conversion into a linked appointment |
| 7 | Appointment assignment to an employee |
| 8 | Customer profile returns all linked records |
| 9 | Quotation totals calculated server-side (client totals ignored) |
| 10 | Quotation PDF generated from persisted records |
| 11 | Appointment-based and general/monthly invoices |
| 12 | Invoice payment status transitions (partial → paid) |
| 13 | Inventory stock-in, stock-out, invalid stock-out rejection and reporting |
| 14 | Appointment closure (max two images, completion timestamp, duplicate prevention) |
| 15 | Only approved reviews appear publicly |
| 16 | Tax applied only when enabled in settings |
| 17 | Dashboard summary reads real data |
| 18 | Seed script is non-destructive and idempotent |

Run with:

```bash
npm test
```

The first run downloads a MongoDB binary for `mongodb-memory-server`, which
requires network access. If that download is blocked, the suite cannot run.
