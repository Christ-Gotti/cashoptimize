import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, categories } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

async function auth(req: Request) {
  const h = req.headers.get("Authorization");
  if (!h) return null;
  const token = h.replace("Bearer ", "");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  return row?.defaultOrgId ?? null;
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(req: Request) {
  try {
    const orgId = await auth(req);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as { label?: string; direction?: "inflow" | "outflow"; color?: string };
    if (!body.label || !body.direction) {
      return NextResponse.json({ error: "label et direction requis" }, { status: 400 });
    }

    const slug = slugify(body.label) + "-" + Math.random().toString(36).slice(2, 6);
    const [inserted] = await db
      .insert(categories)
      .values({
        orgId,
        slug,
        label: body.label.trim(),
        direction: body.direction,
        color: body.color ?? "#6366f1",
      })
      .returning();

    return NextResponse.json({ ok: true, category: inserted });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}