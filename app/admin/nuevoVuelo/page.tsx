import NuevoVueloForm from './NuevoVueloForm'

export default async function NuevoVueloPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string }>
}) {
  const params = (await searchParams) ?? {}
  const fueCreado = params.success === '1'

  return <NuevoVueloForm success={fueCreado} />
}
