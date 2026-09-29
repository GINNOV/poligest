# Studio invoices on Finanza

Date: 2026-09-29
Status: approved in conversation, pending review of this file

## What this is

Staff with access to Finanza can issue a numbered studio invoice for a patient. The lines come from that patient's preventivi. Each quote line can sit on only one issued invoice, and it is copied in full. The invoice is a document. It does not record a payment and it does not change what the patient still owes.

This document stays inside Sorriso. It is not a fattura elettronica, it has no VAT breakdown, and it is not sent to the Agenzia delle Entrate.

## Entry

Add a card on the Movimenti page at `/finanza`, in the same grid as the existing cards.

- Title: Fatture
- Image: reuse `/tiles/accounting.png`
- Description: Emetti una fattura di studio dalle righe dei preventivi. Stampala o inviala al paziente.
- Link: `/finanza/fatture`

The page uses the same gate as the other Finanza pages: `requireUser` for `ADMIN` and `MANAGER`. The staff nav already hides Finanza when the finance feature is off.

## Pages

`/finanza/fatture` lists every invoice, newest first. Columns are number, date, patient, total, and status. Status is Emessa or Annullata. The empty state says that there are no invoices yet and shows **Nuova fattura**.

`/finanza/fatture/nuova` is the create flow.

1. Staff pick a patient with the existing `PatientSearchCombobox`, the same control Pagamenti uses. The chosen patient is carried as `patientId` in the query string, matching Pagamenti.
2. After a patient is chosen, the page lists billable lines grouped by preventivo. Each row shows the service name, service date, quantity, and line total, with a checkbox.
3. A running total sums the checked lines.
4. **Emetti fattura** saves the invoice and opens its document page.

If the patient has no preventivi, the page says so and hides the button. If every line is already on an issued invoice, the page says that and hides the button. Submitting with nothing checked stays on the form and asks for at least one line. The server checks this again.

`/finanza/fatture/[invoiceId]` is the document. It follows the preventivo print page: the studio logo, the clinic name from `DEFAULT_CLINIC_NAME`, and the existing `PrintButton`. The eyebrow says Fattura. The page shows the invoice number, the issue date, the snapshotted patient name, the codice fiscale when the snapshot has one, the lines, and the total. Euro amounts use the same `toFixed(2)` formatting as the preventivo print. A line under the table reads: Documento di studio. Non sostituisce la fattura elettronica.

A voided invoice still opens and still prints. The page shows Annullata on it.

## Billable lines

A quote that has one or more `QuoteItem` rows exposes those rows. It does not also expose the quote header.

A quote with zero `QuoteItem` rows exposes one line built from the quote header: `serviceName`, `serviceDate`, `quantity`, `price`, and `total`. That is the same fallback the preventivo print uses.

Manual-adjustment items are billable. Payment status and `saldato` are ignored.

A line is free when no `InvoiceLine` pointing at it belongs to an invoice with status `ISSUED`. Lines that appear only on voided invoices are free again.

If items are added to a quote after its header-only line was invoiced, the header invoice stays as it was and the new items are billable on their own. Staff who would otherwise double-count void the header invoice and issue a new one from the items.

## Records

Add `Invoice` and `InvoiceLine`.

`Invoice`

- `id`
- `year` and `number`, unique together
- `issuedAt`
- `status`: `ISSUED` or `VOID`
- `voidedAt`, null until voided
- `patientId`, required, `onDelete: Restrict`
- `patientName` and `patientTaxId`, copied at issue time
- `total`, `Decimal(12, 2)`
- `userId` of the staff member who issued it
- `createdAt`, `updatedAt`

`InvoiceLine`

- `id`
- `invoiceId`
- `quoteId`
- `quoteItemId`, null only for a header-only quote line
- snapshots: `serviceName`, `serviceDate`, `quantity`, `price`, `total`
- `createdAt`

`patientName` is the patient last name, then the first name, which is the order on the preventivo print. `patientTaxId` is `Patient.taxId`, or null when the patient has none. A missing codice fiscale does not block issuing.

The server computes `Invoice.total` as the sum of the line totals. The client total is display only.

Later edits to the preventivo or the patient do not change an issued invoice. Email is the exception: the recipient is the patient's current email, not a snapshot.

## Number

The visible number is `{year}/{number}` with no zero padding, for example `2026/1`.

`year` is the calendar year of `issuedAt` in the practice timezone. Read `PracticeSetting.timeZone`, and use `Europe/Rome` when the setting is missing. `number` starts at 1 for each year. Voiding does not free the number.

Allocation happens in the same transaction as the insert. The retry rule is in the issuing section.

## Issuing

One database transaction does all of the following.

1. Load the patient. If the patient does not exist, stop.
2. Re-read the selected sources inside the transaction. Take a row lock on the patient so two issuers cannot pass the check together.
3. Reject the save if any selected source is missing, belongs to another patient, or is already on an issued invoice. The form asks the staff member to refresh.
4. Copy the line snapshots and sum the total.
5. Allocate the next number and insert the invoice and its lines. On a unique conflict for the year and number pair, retry the allocation up to 3 times, then fail with an Italian error.

Then write an audit entry `finance.invoice.issued` on entity `Invoice`, the same way other Finanza actions call `logAudit`. Revalidate `/finanza` and `/finanza/fatture`.

## Void

**Annulla fattura** is shown on an issued invoice. It sets `status` to `VOID` and `voidedAt` to now. The lines stay on the invoice so the document still prints. Those sources become billable again. A voided invoice cannot be voided a second time, and an issued invoice cannot be edited.

Audit action: `finance.invoice.voided`.

## Email

**Invia al paziente** is shown on an issued invoice. It is hidden on a voided one.

The button is disabled when the patient has no current email. The page then says: Aggiungi un'email in anagrafica per inviare la fattura.

Sending uses `sendEmailTemplate` with template name `invoice-ready`. The subject is the stored template subject. The body is the stored template body when that body contains `{{invoiceLines}}`. Otherwise the send overrides the body with the default below, so an untouched template still delivers the invoice and a template the studio has rewritten around the new placeholders is left alone. `ensureDefaultTemplates` must keep its current behavior of not overwriting a stored body.

Default body:

```
Ciao {{patientName}},

la fattura {{invoiceNumber}} del {{invoiceDate}} è pronta.

{{invoiceLines}}

Totale: {{invoiceTotal}}

Grazie,
{{clinicName}}
```

There is no `{{button}}` and no link into the staff app. `invoiceLines` is plain text, one service per line, with quantity and amount. Add `invoiceNumber`, `invoiceDate`, `invoiceTotal`, and `invoiceLines` to the placeholder catalog.

A failed send leaves the invoice issued and shows the error. A successful send writes `finance.invoice.emailed`.

Update the default `invoice-ready` seed body to the text above so a new database gets the invoice content. Do not change the subject.

## Tests

Put the rules in `app/src/lib/finance/invoices.ts` and cover them with Vitest, without a database.

- `2026` and `1` format as `2026/1`.
- The next number is one higher than the highest number already used that year, including voided invoices. A new year starts at 1.
- The year follows the practice timezone across the New Year boundary.
- A quote with items exposes the items and hides the header. A quote with no items exposes one header line.
- A source on an issued invoice is unavailable. A source that appears only on a voided invoice is available.
- The invoice total equals the sum of the selected line totals.
- An empty selection is rejected.

## Out of scope

Fattura elettronica, XML, SDI, VAT, partial amounts, clinic tax settings, patient address on the document, credit notes other than void and reissue, any payment created by the invoice, and updates to the staff manual or in-page guides.
