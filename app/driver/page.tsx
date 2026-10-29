import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtTime, TZ } from "@/lib/format";
import { logout, notifyTenMinutes } from "../actions";

type Row = {
  id: number;
  client_name: string;
  pickup_at: Date;
  pickup_point: string;
  sent_at: Date | null;
};

export default async function DriverPage() {
  const user = await requireUser("driver");

  // Only this driver's services, only today in Santo Domingo.
  const services = await sql<Row[]>`
    select s.id, s.client_name, s.pickup_at, s.pickup_point, n.sent_at
    from services s
    left join notices n on n.service_id = s.id
    where s.driver_id = ${user.id}
      and (s.pickup_at at time zone ${TZ})::date = (now() at time zone ${TZ})::date
    order by s.pickup_at`;

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Hola, {user.name}</h1>
          <p className="text-sm text-neutral-600">{user.vehicle} · servicios de hoy</p>
        </div>
        <form action={logout}>
          <button className="text-sm underline">Salir</button>
        </form>
      </header>

      {services.length === 0 ? (
        <p className="text-neutral-600">No tienes servicios para hoy.</p>
      ) : (
        <ul className="space-y-4">
          {services.map((s) => (
            <li key={s.id} className="rounded-lg border p-4">
              <p className="text-lg font-semibold">{fmtTime(s.pickup_at).slice(0, 5)} · {s.client_name}</p>
              <p className="text-neutral-600">{s.pickup_point}</p>
              {s.sent_at ? (
                <p className="mt-3 rounded bg-green-50 p-3 text-center font-medium text-green-800">
                  Aviso enviado a las {fmtTime(s.sent_at)}
                </p>
              ) : (
                <form action={notifyTenMinutes} className="mt-3">
                  <input type="hidden" name="serviceId" value={s.id} />
                  <button className="w-full rounded-lg bg-neutral-900 py-4 text-lg font-semibold text-white active:bg-neutral-700">
                    A 10 min
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
