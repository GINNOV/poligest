# Financial & Payment Logic Documentation

This document explains how the clinic's financial calculations, remaining balances (Residuo), and item statuses are handled to ensure consistency across the application.

## 1. Core Definitions

| Term | Technical Definition | Impact on "Residuo" |
| :--- | :--- | :--- |
| **Total (Totale)** | `Quantity * Price` of a quote item. | N/A |
| **Incassato** | Sum of actual payments (CASH, ELECTRONIC, BANK_TRANSFER). | **Reduces Residuo** |
| **Pagherò** | Standard deferred payment (PAY_LATER). Treated as a commitment. | **Reduces Residuo** |
| **Altro** | Special "Other" payment method. Tracked separately. | **NO IMPACT on Residuo** |
| **Residuo** | `Total - Incassato - Pagherò`. | N/A |

## 2. Mathematical Formula
The remaining balance (**Residuo**) for any given item or quote follows this logic:
```typescript
// Altro is EXCLUDED from the subtraction
const residuo = Math.max(0, total - actualCollections - pagheroAmount);
```

## 3. Item Status Logic
The status of a quote item is determined by the following priority:

1.  **Lavori in corso (In Progress):** Item is linked to a `DentalRecord` that is not yet marked as `treated`.
2.  **Saldato (Settled):** `Residuo < 0.01` (effectively zero).
3.  **Parzialmente incassato (Partial):** `Actually Collected > 0` AND item is not settled.
4.  **Promesso (Altro):** `Actually Collected == 0` AND `Altro > 0`.
5.  **Da incassare (Unpaid):** No collections, no "Altro" amounts, and not settled.

## 4. UI Implementation Details

### Summary Tiles (`PaymentsSummaryTiles.tsx`)
- **Prestazioni:** Sum of all item totals.
- **Incassato:** Sum of actual money collected.
- **Pagherò:** Sum of all standard deferred commitments.
- **totale Altro:** Sum of special "Other" commitments. This box has a **red gradient** background to highlight its special status.
- **Residuo:** The net amount still owed by the patient (excluding Altro).

### Daily Report (`report-giornaliero`)
- **Row Coloring:**
    - **Yellow (`bg-amber-50`):** Contanti (Cash)
    - **Blue (`bg-blue-50`):** Bonifico (Bank Transfer)
    - **Gray (`bg-zinc-100`):** Pagherò
    - **Emerald Tint:** Default for Electronic/Other.

## 5. Files to Maintain Synchronized
If you change the financial math, you **MUST** update these three files together:
1. `src/app/[locale]/(app)/finanza/pagamenti/page.tsx` (Server-side initial load)
2. `src/components/payment-state-provider.tsx` (Client-side interactive updates)
3. `src/components/unsettled-items-list.tsx` (Status badges and item grids)
