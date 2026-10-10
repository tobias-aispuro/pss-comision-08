import { SignUp } from '@clerk/nextjs';

import AuthLayout from '@/components/AuthLayout';
import { aparienciaClerk } from '@/lib/clerk-apariencia';

export default function SignUpPage() {
  return (
    <AuthLayout
      etiqueta="✈ Paso 1 · Credenciales de acceso"
      titulo="Bienvenido a SkyLink"
      subtitulo="Creá tu correo y contraseña para iniciar el registro oficial."
    >
      <SignUp forceRedirectUrl="/onboarding" appearance={aparienciaClerk} />
    </AuthLayout>
  );
}
