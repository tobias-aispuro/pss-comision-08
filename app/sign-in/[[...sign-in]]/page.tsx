import { SignIn } from '@clerk/nextjs';

import AuthLayout from '@/components/AuthLayout';
import { aparienciaClerk } from '@/lib/clerk-apariencia';

export default function SignInPage() {
  return (
    <AuthLayout titulo="Iniciar sesión" subtitulo="Ingresá con tu cuenta de SkyLink para continuar.">
      <SignIn forceRedirectUrl="/" fallbackRedirectUrl="/" appearance={aparienciaClerk} />
    </AuthLayout>
  );
}
