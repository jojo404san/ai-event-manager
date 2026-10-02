import { pgTable, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core'

export const students = pgTable('students', { id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(), course: text('course').notNull(), role: text('role').notNull().default('student'), createdAt: timestamp('created_at').defaultNow().notNull() })
export const events = pgTable('events', { id: text('id').primaryKey(), name: text('name').notNull(), description: text('description').notNull(), date: text('date').notNull(), time: text('time').notNull(), venue: text('venue').notNull(), maximumCapacity: integer('maximum_capacity').notNull(), createdAt: timestamp('created_at').defaultNow().notNull() })
export const registrations = pgTable('registrations', { id: text('id').primaryKey(), studentId: text('student_id').notNull(), eventId: text('event_id').notNull(), registrationDate: timestamp('registration_date').defaultNow().notNull(), status: text('status').notNull().default('confirmed'), calendarEventId: text('calendar_event_id') }, (table) => ({ studentEventUnique: uniqueIndex('student_event_unique').on(table.studentId, table.eventId) }))

export type Event = typeof events.$inferSelect
export type Registration = typeof registrations.$inferSelect
export type Student = typeof students.$inferSelect
