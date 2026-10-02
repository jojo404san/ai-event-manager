import { db } from '@/lib/db'
import { events, registrations } from '@/lib/db/schema'
import { count, eq, ilike, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()
  const rows = await db.select().from(events).where(query ? or(ilike(events.name, `%${query}%`), ilike(events.description, `%${query}%`), ilike(events.venue, `%${query}%`)) : undefined)
  const counts = await db.select({ eventId: registrations.eventId, total: count() }).from(registrations).where(eq(registrations.status, 'confirmed')).groupBy(registrations.eventId)
  return NextResponse.json(rows.map((event) => ({ ...event, registered: Number(counts.find((item) => item.eventId === event.id)?.total ?? 0) })))
}
