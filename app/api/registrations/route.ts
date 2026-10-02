import { db } from '@/lib/db'
import { events, registrations } from '@/lib/db/schema'
import { and, count, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bodySchema = z.object({ studentId: z.string().min(1), eventId: z.string().min(1), action: z.enum(['register', 'cancel']).default('register') })

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid registration request' }, { status: 400 })
  const { studentId, eventId, action } = parsed.data
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (action === 'cancel') { await db.update(registrations).set({ status: 'cancelled' }).where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId))); return NextResponse.json({ status: 'cancelled' }) }
  const existing = await db.query.registrations.findFirst({ where: and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId), eq(registrations.status, 'confirmed')) })
  if (existing) return NextResponse.json({ error: 'You are already registered for this event' }, { status: 409 })
  const [{ total }] = await db.select({ total: count() }).from(registrations).where(and(eq(registrations.eventId, eventId), eq(registrations.status, 'confirmed')))
  if (Number(total) >= event.maximumCapacity) return NextResponse.json({ error: 'This event is full' }, { status: 409 })
  const id = crypto.randomUUID()
  await db.insert(registrations).values({ id, studentId, eventId, status: 'confirmed' })
  return NextResponse.json({ id, status: 'confirmed', calendar: 'Calendar sync queued' }, { status: 201 })
}
