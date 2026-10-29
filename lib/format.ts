export const TZ = "America/Santo_Domingo"; // UTC-4 all year, no DST

const dateTime = new Intl.DateTimeFormat("es-DO", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
const timeOnly = new Intl.DateTimeFormat("es-DO", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const fmtDateTime = (d: Date) => dateTime.format(d);
export const fmtTime = (d: Date) => timeOnly.format(d);

// <input type="datetime-local"> gives "YYYY-MM-DDTHH:MM" with no zone: read it as Santo Domingo time.
export function parseLocalDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00-04:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function tenMinutesMessage(p: { client: string; driver: string; vehicle: string; pickup: string }) {
  return (
    `Hola ${p.client}, le escribe Transekur. Su chofer ${p.driver} (${p.vehicle}) ` +
    `llegará en unos 10 minutos a ${p.pickup}.`
  );
}

export function whatsappLink(phone: string, message: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
