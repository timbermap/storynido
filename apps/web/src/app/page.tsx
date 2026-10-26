import { Button } from '@/components/ui/button';
import { brand } from '@/lib/brand';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{brand.name}</h1>
      <p className="text-lg text-muted-foreground">
        Cuentos infantiles personalizados donde tu hijo es el protagonista.
      </p>
      <Button size="lg" disabled>
        Muy pronto
      </Button>
    </main>
  );
}
