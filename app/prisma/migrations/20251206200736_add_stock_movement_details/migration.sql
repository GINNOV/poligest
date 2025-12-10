-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "interventionDate" TIMESTAMP(3),
ADD COLUMN     "interventionSite" TEXT,
ADD COLUMN     "patientId" TEXT,
ADD COLUMN     "purchaseDate" TIMESTAMP(3),
ADD COLUMN     "udiDi" TEXT,
ADD COLUMN     "udiPi" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_patientId_idx" ON "StockMovement"("patientId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
