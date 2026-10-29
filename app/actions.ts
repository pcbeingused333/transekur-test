"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { parseLocalDateTime, tenMinutesMessage, TZ } from "@/lib/format";
import { createSession, destroySession } from "@/lib/session";

// Compared against when the email is unknown, so a wrong email and a wrong
// password take the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function login(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [user] = await sql<{ id: number; role: string; password_hash: string }[]>`
    select id, role, password_hash from users where email = ${email}`;
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) redirect("/login?error=1");
  await createSession(user.id);
  redirect(user.role === "dispatch" ? "/dispatch" : "/driver");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function createService(form: FormData) {
  await requireUser("dispatch");

  const client = String(form.get("client") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const pickupPoint = String(form.get("pickup") ?? "").trim();
  const pickupAt = parseLocalDateTime(String(form.get("when") ?? ""));
  const driverId = Number(form.get("driver"));

  const valid =
    client && client.length <= 120 &&
    /^\+?[0-9 ()-]{7,20}$/.test(phone) &&
    pickupPoint && pickupPoint.length <= 200 &&
    pickupAt && Number.isInteger(driverId);
  if (!valid) redirect("/dispatch?error=invalid");

  const [driver] = await sql`select id from users where id = ${driverId} and role = 'driver'`;
  if (!driver) redirect("/dispatch?error=invalid");

  await sql`
    insert into services (client_name, client_phone, pickup_at, pickup_point, driver_id)
    values (${client}, ${phone}, ${pickupAt}, ${pickupPoint}, ${driverId})`;
  revalidatePath("/dispatch");
  redirect("/dispatch?created=1");
}

// Demo helper: recreates the example services for today, so the driver view is
// never empty for whoever tests this days later. Only touches "(demo)" rows.
export async function resetDemoServices() {
  await requireUser("dispatch");
  await sql.begin(async (tx) => {
    await tx`delete from services where client_name like '% (demo)'`; // notices go with them (on delete cascade)
    await tx`
      insert into services (client_name, client_phone, pickup_at, pickup_point, driver_id)
      select v.client, v.phone, ((now() at time zone ${TZ})::date + v.t::time) at time zone ${TZ}, v.pickup,
             (select id from users where email = v.driver)
      from (values
        ('Laura Gómez (demo)',  '+1 809 555 0101', '14:30', 'Aeropuerto Punta Cana, terminal B', 'carlos@transekur.test'),
        ('John Smith (demo)',   '+1 829 555 0102', '17:00', 'Hotel Demo, Bávaro',                'carlos@transekur.test'),
        ('Ana Martínez (demo)', '+1 849 555 0103', '15:15', 'Aeropuerto Las Américas',           'maria@transekur.test')
      ) as v(client, phone, t, pickup, driver)`;
  });
  revalidatePath("/dispatch");
  redirect("/dispatch?reset=1");
}

export async function notifyTenMinutes(form: FormData) {
  const driver = await requireUser("driver");
  const serviceId = Number(form.get("serviceId"));
  if (!Number.isInteger(serviceId)) return;

  // Ownership and "today" are enforced here, not just by what the page lists.
  const [service] = await sql<{ client_name: string; pickup_point: string }[]>`
    select client_name, pickup_point from services
    where id = ${serviceId}
      and driver_id = ${driver.id}
      and (pickup_at at time zone ${TZ})::date = (now() at time zone ${TZ})::date`;
  if (!service) return;

  const message = tenMinutesMessage({
    client: service.client_name,
    driver: driver.name,
    vehicle: driver.vehicle ?? "",
    pickup: service.pickup_point,
  });
  // notices.service_id is unique: a double tap inserts nothing the second time.
  await sql`
    insert into notices (service_id, message) values (${serviceId}, ${message})
    on conflict (service_id) do nothing`;
  revalidatePath("/driver");
  revalidatePath("/dispatch");
}
