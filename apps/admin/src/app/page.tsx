import { Button } from '@/components/ui/button';
import { brand } from '@/lib/brand';

export default function AdminHomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-2xl font-semibold">{brand.name} · Panel de administración</h1>
      <p className="text-sm text-muted-foreground">El acceso se habilita en la fase 03.</p>
      <Button variant="outline" disabled>
        Iniciar sesión
      </Button>
    </main>
  );
}
