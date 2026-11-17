-- CreateEnum
CREATE TYPE "EstadoEmailTicket" AS ENUM ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "pasajeroReservaId" TEXT NOT NULL,
    "emitidoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailEstado" "EstadoEmailTicket" NOT NULL DEFAULT 'PENDIENTE',
    "emailIntentos" INTEGER NOT NULL DEFAULT 0,
    "emailUltimoIntentoAt" TIMESTAMP(3),
    "emailEnviadoAt" TIMESTAMP(3),
    "emailError" TEXT,
    "emailLockUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_pasajeroReservaId_key" ON "Ticket"("pasajeroReservaId");

-- CreateIndex
CREATE INDEX "Ticket_emailEstado_idx" ON "Ticket"("emailEstado");

-- CreateIndex
CREATE INDEX "Ticket_emailEstado_emailLockUntil_idx" ON "Ticket"("emailEstado", "emailLockUntil");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_pasajeroReservaId_fkey" FOREIGN KEY ("pasajeroReservaId") REFERENCES "PasajeroReserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;
