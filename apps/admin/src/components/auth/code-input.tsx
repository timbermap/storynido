'use client';

/** Código TOTP de 6 dígitos (solo números, con autocompletado de códigos de un solo uso). */
export function CodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label="Código de verificación"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      autoFocus
      className="h-12 rounded-md border bg-background px-3 text-center font-mono text-2xl tracking-[0.4em] focus:outline-2 focus:outline-ring"
      value={value}
      onChange={(event) => {
        onChange(event.target.value.replace(/\D/g, '').slice(0, 6));
      }}
    />
  );
}
