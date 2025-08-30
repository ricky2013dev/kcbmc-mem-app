import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  timestamp, 
  boolean, 
  integer,
  date,
  jsonb
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Staff table
export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  nickName: varchar("nick_name", { length: 100 }).notNull().unique(),
  personalPin: varchar("personal_pin", { length: 4 }).notNull(),
  group: varchar("group", { length: 50 }).notNull(), // ADM, MGM, TEAM-A, TEAM-B
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Families table
export const families = pgTable("families", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyName: varchar("family_name", { length: 255 }).notNull(),
  visitedDate: date("visited_date").notNull(),
  registrationDate: date("registration_date"),
  memberStatus: varchar("member_status", { length: 50 }).notNull(), // visit, member, pending
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  address: varchar("address", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  zipCode: varchar("zip_code", { length: 10 }).notNull(),
  fullAddress: varchar("full_address", { length: 500 }).notNull(),
  familyNotes: text("family_notes"),
  familyPicture: varchar("family_picture", { length: 500 }),
  lifeGroup: varchar("life_group", { length: 255 }),
  supportTeamMember: varchar("support_team_member", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Family members table
export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  koreanName: varchar("korean_name", { length: 255 }).notNull(),
  englishName: varchar("english_name", { length: 255 }).notNull(),
  birthDate: date("birth_date"),
  phoneNumber: varchar("phone_number", { length: 20 }),
  email: varchar("email", { length: 255 }),
  relationship: varchar("relationship", { length: 50 }).notNull(), // husband, wife, child, other
  courses: jsonb("courses").$type<string[]>().default([]),
  gradeLevel: varchar("grade_level", { length: 10 }), // for children
  gradeGroup: varchar("grade_group", { length: 50 }), // for children
  school: varchar("school", { length: 255 }), // for children
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const familiesRelations = relations(families, ({ many }) => ({
  members: many(familyMembers),
}));

export const familyMembersRelations = relations(familyMembers, ({ one }) => ({
  family: one(families, {
    fields: [familyMembers.familyId],
    references: [families.id],
  }),
}));

// Zod schemas
export const insertStaffSchema = createInsertSchema(staff).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilySchema = createInsertSchema(families).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Staff = typeof staff.$inferSelect;
export type InsertStaff = z.infer<typeof insertStaffSchema>;

export type Family = typeof families.$inferSelect;
export type InsertFamily = z.infer<typeof insertFamilySchema>;

export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;

export type FamilyWithMembers = Family & {
  members: FamilyMember[];
};
