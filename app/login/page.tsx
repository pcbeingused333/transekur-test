import { login } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Transekur · aviso de llegada</h1>
        <p className="mt-1 text-sm text-neutral-600">Demo con datos inventados.</p>
      </div>
      <form action={login} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Correo
          <input name="email" type="email" required autoComplete="username" className="rounded border px-3 py-2 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input name="password" type="password" required autoComplete="current-password" className="rounded border px-3 py-2 text-base" />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">Correo o contraseña incorrectos.</p>}
        <button className="rounded bg-neutral-900 px-3 py-3 text-base font-medium text-white">Entrar</button>
      </form>
      <details className="text-sm text-neutral-600">
        <summary className="cursor-pointer">Usuarios de la demo</summary>
        <ul className="mt-2 space-y-1 font-mono text-xs">
          <li>dispatch@transekur.test / demo1234</li>
          <li>carlos@transekur.test / demo1234</li>
          <li>maria@transekur.test / demo1234</li>
        </ul>
      </details>
    </main>
  );
}
