import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import EditarVueloForm from '@/components/EditarVueloForm'

export default async function EditarVueloPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(['ADMINISTRADOR'])
  const { id } = await params

  const vuelo = await prisma.vuelo.findUnique({ where: { id } })
  if (!vuelo) notFound()

  return (
    <main className="flex-1 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50 via-white to-sky-50 px-6 py-6 md:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">
              Administración
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Modificar vuelo {vuelo.codigoVuelo}
            </h2>
          </div>

          <EditarVueloForm vuelo={vuelo} />
        </div>
      </div>
    </main>
  )
}