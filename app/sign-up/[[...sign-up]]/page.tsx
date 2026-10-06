import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-900/60 bg-[url('/aeropuerto.jpeg')] bg-cover bg-center bg-blend-overlay py-12 px-4 flex flex-col items-center justify-center">
      
      <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-xl max-w-md w-full mb-6 text-center border border-white/20">
        <span className="text-xs font-bold text-sky-primary bg-sky-primary/10 px-3 py-1 rounded-full uppercase tracking-wider">
          ✈ Paso 1 • Credenciales de Acceso
        </span>
        <h2 className="text-2xl font-bold text-slate-900 mt-4">Bienvenido a SkyLink</h2>
        <p className="text-sky-neutral mt-2 text-sm">Crea tu correo y contraseña para iniciar el registro oficial.</p>
      </div>

      <div className="w-full max-w-md">
        <SignUp 
          forceRedirectUrl="/onboarding"
          appearance={{
            variables: { colorPrimary: '#08A6C9' },
            elements: {
              card: 'shadow-xl border border-slate-200 rounded-xl w-full p-2',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              formButtonPrimary: 'bg-[#046A7A] hover:bg-[#318098] text-white font-medium py-3 rounded-md normal-case text-base',
              formFieldInput: 'border-slate-300 focus:border-[#08A6C9] focus:ring-[#08A6C9] rounded-md p-3 outline-none',
            }
          }} 
        />
      </div>
    </div>
  );
}