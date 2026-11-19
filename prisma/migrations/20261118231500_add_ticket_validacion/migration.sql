-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "validado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Ticket" ADD COLUMN "validadoAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "validadoPorId" TEXT;

-- CreateIndex
CREATE INDEX "Ticket_validado_idx" ON "Ticket"("validado");
