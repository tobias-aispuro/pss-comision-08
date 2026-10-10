// Estilo de los formularios de Clerk para que se integren en AuthLayout (sin tarjeta propia
// y con la paleta de SkyLink). El título lo muestra AuthLayout, por eso se oculta el de Clerk.
export const aparienciaClerk = {
  variables: { colorPrimary: '#08A6C9', borderRadius: '0.75rem' },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full max-w-none shadow-none border-0',
    card: 'w-full shadow-none border-0 bg-transparent p-0',
    header: 'hidden',
    formButtonPrimary: 'bg-[#046A7A] hover:bg-[#318098] text-white font-semibold py-3 normal-case text-sm shadow-sm',
    formFieldInput: 'bg-slate-50 border-slate-200 py-3',
    footer: 'bg-transparent',
  },
}
