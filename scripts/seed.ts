// Resets the demo data. Run: npm run db:seed
import bcrypt from "bcryptjs";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: process.env.DATABASE_SSL === "1" ? "require" : false });

const TZ = "America/Santo_Domingo";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
const at = (hhmm: string) => new Date(`${today}T${hhmm}:00-04:00`);

const hash = await bcrypt.hash("demo1234", 10);

await sql`truncate notices, services, users restart identity cascade`;

const [, carlos, maria] = await sql<{ id: number }[]>`
  insert into users (email, password_hash, name, role, vehicle) values
    ('dispatch@transekur.test', ${hash}, 'Despacho Demo',  'dispatch', null),
    ('carlos@transekur.test',   ${hash}, 'Carlos Pérez',   'driver',   'Toyota Alphard negra · A123456'),
    ('maria@transekur.test',    ${hash}, 'María Santana',  'driver',   'Mercedes Clase V blanca · B654321')
  returning id`;

await sql`
  insert into services (client_name, client_phone, pickup_at, pickup_point, driver_id) values
    ('Laura Gómez (demo)',  '+1 809 555 0101', ${at("14:30")}, 'Aeropuerto Punta Cana, terminal B', ${carlos.id}),
    ('John Smith (demo)',   '+1 829 555 0102', ${at("17:00")}, 'Hotel Demo, Bávaro',                 ${carlos.id}),
    ('Ana Martínez (demo)', '+1 849 555 0103', ${at("15:15")}, 'Aeropuerto Las Américas',            ${maria.id})`;

console.log("Demo data ready: dispatch@, carlos@, maria@transekur.test / demo1234");
await sql.end();
