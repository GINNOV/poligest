/*
  Warnings:

  - You are about to drop the column `udiDi` on the `StockMovement` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "udiDi" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "udiDi";

-- CreateIndex
CREATE INDEX "Product_udiDi_idx" ON "Product"("udiDi");
