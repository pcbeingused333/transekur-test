import { redirect } from "next/navigation";
import { sql } from "./db";
import { readSession } from "./session";

export type Role = "dispatch" | "driver";
export type User = { id: number; email: string; name: string; role: Role; vehicle: string | null };

export async function currentUser(): Promise<User | null> {
  const id = await readSession();
  if (!id) return null;
  const [user] = await sql<User[]>`
    select id, email, name, role, vehicle from users where id = ${id}`;
  return user ?? null;
}

// Call this at the top of every page AND every server action: actions are
// public POST endpoints, so the page-level check alone does not protect them.
export async function requireUser(role: Role): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect("/");
  return user;
}
