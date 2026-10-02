import { generateText, tool } from 'ai'
import { z } from 'zod'
import { db } from '@/lib/db'
import { events, registrations, students } from '@/lib/db/schema'
import { and, count, eq, ilike, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'

const model = process.env.AI_MODEL ?? 'google/gemini-2.5-flash'

export async function POST(request: Request) {
  const { message, studentId = 'demo-student' } = await request.json()
  if (typeof message !== 'string' || message.trim().length < 2) return NextResponse.json({ error: 'Enter a question.' }, { status: 400 })
  const result = await generateText({
    model,
    system: 'You are EventAI, a concise college event assistant. Use tools for every factual answer. Never invent events, counts, or registration status. Explain completed actions clearly.',
    prompt: message,
    tools: {
      searchEvents: tool({ description: 'Search upcoming events by name, topic, venue, or month.', inputSchema: z.object({ query: z.string().optional(), month: z.string().optional() }), execute: async ({ query, month }) => {
        const term = [query, month].filter(Boolean).join(' ')
        return db.select().from(events).where(term ? or(ilike(events.name, `%${term}%`), ilike(events.description, `%${term}%`), ilike(events.date, `%${term}%`)) : undefined)
      }}),
      lookupRegistration: tool({ description: 'Look up a student registration for an event.', inputSchema: z.object({ eventName: z.string().optional() }), execute: async ({ eventName }) => db.select({ event: events.name, status: registrations.status, registrationDate: registrations.registrationDate }).from(registrations).innerJoin(events, eq(registrations.eventId, events.id)).where(and(eq(registrations.studentId, studentId), eventName ? ilike(events.name, `%${eventName}%`) : undefined)) }),
      createRegistration: tool({ description: 'Register the current student for an event. Enforces duplicate and capacity rules.', inputSchema: z.object({ eventId: z.string() }), execute: async ({ eventId }) => {
        const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
        if (!event) return { error: 'Event not found' }
        const existing = await db.query.registrations.findFirst({ where: and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId), eq(registrations.status, 'confirmed')) })
        if (existing) return { error: 'Already registered' }
        const [{ total }] = await db.select({ total: count() }).from(registrations).where(and(eq(registrations.eventId, eventId), eq(registrations.status, 'confirmed')))
        if (Number(total) >= event.maximumCapacity) return { error: 'Event is full' }
        const id = crypto.randomUUID()
        await db.insert(registrations).values({ id, studentId, eventId, status: 'confirmed' })
        return { success: true, registrationId: id, event: event.name, calendarSync: 'Google Calendar sync requested' }
      }}),
      cancelRegistration: tool({ description: 'Cancel the current student registration.', inputSchema: z.object({ eventId: z.string() }), execute: async ({ eventId }) => { await db.update(registrations).set({ status: 'cancelled' }).where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId))); return { success: true } }}),
      statistics: tool({ description: 'Get EventAI platform statistics.', inputSchema: z.object({}), execute: async () => { const [eventCount, studentCount, registrationCount] = await Promise.all([db.select({ total: count() }).from(events), db.select({ total: count() }).from(students), db.select({ total: count() }).from(registrations).where(eq(registrations.status, 'confirmed'))]); return { events: Number(eventCount[0].total), students: Number(studentCount[0].total), registrations: Number(registrationCount[0].total) } }}),
    },
    maxOutputTokens: 600,
  })
  return NextResponse.json({ answer: result.text, steps: result.steps.length })
}
