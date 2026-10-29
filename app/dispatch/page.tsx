import AutoRefresh from "@/components/AutoRefresh";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtDateTime, fmtTime, whatsappLink } from "@/lib/format";
import { createService, logout, resetDemoServices } from "../actions";

type Row = {
  id: number;
  client_name: string;
  client_phone: string;
  pickup_at: Date;
  pickup_point: string;
  driver_name: string;
  vehicle: string;
  message: string | null;
  sent_at: Date | null;
};

const input = "rounded border px-3 py-2 text-base";

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; reset?: string }>;
}) {
  const user = await requireUser("dispatch");
  const { error, created, reset } = await searchParams;

  const drivers = await sql<{ id: number; name: string; vehicle: string }[]>`
    select id, name, vehicle from users where role = 'driver' order by name`;
  const services = await sql<Row[]>`
    select s.id, s.client_name, s.client_phone, s.pickup_at, s.pickup_point,
           d.name as driver_name, d.vehicle, n.message, n.sent_at
    from services s
    join users d on d.id = s.driver_id
    left join notices n on n.service_id = s.id
    order by s.pickup_at desc
    limit 100`;

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-6">
      <AutoRefresh />
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Despacho</h1>
        <form action={logout} className="flex items-center gap-3 text-sm">
          <span className="text-neutral-600">{user.name}</span>
          <button className="underline">Salir</button>
        </form>
      </header>

      <section>
        <h2 className="mb-3 font-medium">Nuevo servicio</h2>
        <form action={createService} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Cliente
            <input name="client" required maxLength={120} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Teléfono
            <input name="phone" type="tel" required placeholder="+1 809 555 0100" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fecha y hora (hora de Santo Domingo)
            <input name="when" type="datetime-local" required className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Punto de recogida
            <input name="pickup" required maxLength={200} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Chofer
            <select name="driver" required defaultValue="" className={input}>
              <option value="" disabled>Elegir chofer…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name} · {d.vehicle}</option>
              ))}
            </select>
          </label>
          {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">Revisa los campos: algo no es válido.</p>}
          {created && <p role="status" className="text-sm text-green-700 sm:col-span-2">Servicio creado.</p>}
          <button className="rounded bg-neutral-900 px-3 py-3 font-medium text-white sm:col-span-2">Crear y asignar</button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Servicios</h2>
          <form action={resetDemoServices}>
            <button className="rounded border px-3 py-1.5 text-sm">Cargar servicios de ejemplo para hoy</button>
          </form>
        </div>
        {reset && <p role="status" className="mb-3 text-sm text-green-700">Servicios de ejemplo recreados para hoy.</p>}
        {services.length === 0 ? (
          <p className="text-sm text-neutral-600">Todavía no hay servicios.</p>
        ) : (
          <ul className="space-y-3">
            {services.map((s) => (
              <li key={s.id} className="rounded border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{s.client_name}</strong>
                  <span>{fmtDateTime(s.pickup_at)}</span>
                </div>
                <p className="text-neutral-600">{s.client_phone} · {s.pickup_point}</p>
                <p className="text-neutral-600">Chofer: {s.driver_name} · {s.vehicle}</p>
                {s.sent_at && s.message ? (
                  <div className="mt-2 rounded bg-green-50 p-2">
                    <p className="font-medium text-green-800">Aviso enviado a las {fmtTime(s.sent_at)}</p>
                    <p className="mt-1">SMS simulado: “{s.message}”</p>
                    <a className="underline" href={whatsappLink(s.client_phone, s.message)} target="_blank" rel="noreferrer">
                      Abrir en WhatsApp
                    </a>
                  </div>
                ) : (
                  <p className="mt-2 text-neutral-500">Aviso pendiente</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
