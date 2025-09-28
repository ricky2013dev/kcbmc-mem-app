import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  date,
  jsonb,
  decimal
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
  email: varchar("email", { length: 255 }),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staff login logs table
export const staffLoginLogs = pgTable("staff_login_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  loginTime: timestamp("login_time").notNull().defaultNow(),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv6 support
  userAgent: varchar("user_agent", { length: 500 }),
  success: boolean("success").notNull().default(true),
  failureReason: varchar("failure_reason", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Families table
export const families = pgTable("families", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyCode: varchar("family_code", { length: 20 }).unique(),
  familyName: varchar("family_name", { length: 255 }).notNull(),
  visitedDate: date("visited_date"),
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
  biz: varchar("biz", { length: 255 }),
  bizTitle: varchar("biz_title", { length: 255 }),
  bizCategory: varchar("biz_category", { length: 255 }),
  bizName: varchar("biz_name", { length: 255 }),
  bizIntro: text("biz_intro"),
  teamId: varchar("team_id").references(() => teams.id, { onDelete: "set null" }),
  displayOrder: integer("display_order").default(0),
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
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Care logs table
export const careLogs = pgTable("care_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  type: varchar("type", { length: 100 }).notNull(), // visit, call, email, etc.
  description: text("description").notNull(),
  status: varchar("status", { length: 50 }).notNull(), // pending, completed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// News announcements table
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  type: varchar("type", { length: 20 }).notNull().default("Medium"), // Major, Medium, Minor
  isLoginRequired: boolean("is_login_required").notNull().default(true),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  createdBy: varchar("created_by").notNull().references(() => staff.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Events table
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  date: date("date").notNull(),
  time: varchar("time", { length: 10 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull().references(() => staff.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event attendance table
export const eventAttendance = pgTable("event_attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  familyMemberId: varchar("family_member_id").references(() => familyMembers.id, { onDelete: "cascade" }),
  attendanceStatus: varchar("attendance_status", { length: 20 }).notNull().default("pending"), // present, absent, pending
  updatedBy: varchar("updated_by").notNull().references(() => staff.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Donations table
export const donations = pgTable("donations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("Regular"), // Regular, Special
  date: date("date").notNull(),
  received: boolean("received").notNull().default(true),
  emailForThank: boolean("email_for_thank").notNull().default(false),
  emailForTax: boolean("email_for_tax").notNull().default(false),
  comment: text("comment"),
  createdBy: varchar("created_by").notNull().references(() => staff.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const familiesRelations = relations(families, ({ one, many }) => ({
  members: many(familyMembers),
  careLogs: many(careLogs),
  eventAttendance: many(eventAttendance),
  donations: many(donations),
  team: one(teams, {
    fields: [families.teamId],
    references: [teams.id],
  }),
}));

export const familyMembersRelations = relations(familyMembers, ({ one, many }) => ({
  family: one(families, {
    fields: [familyMembers.familyId],
    references: [families.id],
  }),
  eventAttendance: many(eventAttendance),
}));

export const staffRelations = relations(staff, ({ many }) => ({
  careLogs: many(careLogs),
  announcements: many(announcements),
  createdEvents: many(events),
  updatedAttendance: many(eventAttendance),
  createdDonations: many(donations),
  loginLogs: many(staffLoginLogs),
}));

export const careLogsRelations = relations(careLogs, ({ one }) => ({
  family: one(families, {
    fields: [careLogs.familyId],
    references: [families.id],
  }),
  staff: one(staff, {
    fields: [careLogs.staffId],
    references: [staff.id],
  }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  createdByStaff: one(staff, {
    fields: [announcements.createdBy],
    references: [staff.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  createdByStaff: one(staff, {
    fields: [events.createdBy],
    references: [staff.id],
  }),
  attendance: many(eventAttendance),
}));

export const eventAttendanceRelations = relations(eventAttendance, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendance.eventId],
    references: [events.id],
  }),
  family: one(families, {
    fields: [eventAttendance.familyId],
    references: [families.id],
  }),
  familyMember: one(familyMembers, {
    fields: [eventAttendance.familyMemberId],
    references: [familyMembers.id],
  }),
  updatedByStaff: one(staff, {
    fields: [eventAttendance.updatedBy],
    references: [staff.id],
  }),
}));

export const staffLoginLogsRelations = relations(staffLoginLogs, ({ one }) => ({
  staff: one(staff, {
    fields: [staffLoginLogs.staffId],
    references: [staff.id],
  }),
}));

export const donationsRelations = relations(donations, ({ one }) => ({
  family: one(families, {
    fields: [donations.familyId],
    references: [families.id],
  }),
  createdByStaff: one(staff, {
    fields: [donations.createdBy],
    references: [staff.id],
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
  familyCode: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCareLogSchema = createInsertSchema(careLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventAttendanceSchema = createInsertSchema(eventAttendance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffLoginLogSchema = createInsertSchema(staffLoginLogs).omit({
  id: true,
  createdAt: true,
});

export const insertDonationSchema = createInsertSchema(donations).omit({
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

export type CareLog = typeof careLogs.$inferSelect;
export type InsertCareLog = z.infer<typeof insertCareLogSchema>;

export type FamilyWithMembers = Family & {
  members: FamilyMember[];
};

export type CareLogWithStaff = CareLog & {
  staff: {
    id: string;
    fullName: string;
    nickName: string;
  };
};

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

export type AnnouncementWithStaff = Announcement & {
  createdByStaff: {
    id: string;
    fullName: string;
    nickName: string;
  };
};

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type EventAttendance = typeof eventAttendance.$inferSelect;
export type InsertEventAttendance = z.infer<typeof insertEventAttendanceSchema>;

export type EventWithStaff = Event & {
  createdByStaff: {
    id: string;
    fullName: string;
    nickName: string;
  };
};

export type EventWithAttendance = Event & {
  createdByStaff: {
    id: string;
    fullName: string;
    nickName: string;
  };
  attendance: (EventAttendance & {
    family: {
      id: string;
      familyName: string;
    };
    familyMember?: {
      id: string;
      koreanName: string;
      englishName: string;
      relationship: string;
      gradeGroup: string | null;
    };
  })[];
};

export type EventAttendanceWithDetails = EventAttendance & {
  event: Event;
  family: {
    id: string;
    familyName: string;
  };
  familyMember?: {
    id: string;
    koreanName: string;
    englishName: string;
    relationship: string;
    gradeGroup: string | null;
  };
  updatedByStaff: {
    id: string;
    fullName: string;
    nickName: string;
  };
};

export type StaffLoginLog = typeof staffLoginLogs.$inferSelect;
export type InsertStaffLoginLog = z.infer<typeof insertStaffLoginLogSchema>;

export type StaffLoginLogWithStaff = StaffLoginLog & {
  staff: {
    id: string;
    fullName: string;
    nickName: string;
    group: string;
  };
};

export type Donation = typeof donations.$inferSelect;
export type InsertDonation = z.infer<typeof insertDonationSchema>;

export type DonationWithDetails = Donation & {
  family: {
    id: string;
    familyName: string;
  };
  createdByStaff: {
    id: string;
    fullName: string;
    nickName: string;
  };
};

// Departments table
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  contactPersonName: varchar("contact_person_name", { length: 255 }),
  contactPersonPhone: varchar("contact_person_phone", { length: 20 }),
  contactPersonEmail: varchar("contact_person_email", { length: 255 }),
  picture: varchar("picture", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Teams table
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  departmentId: varchar("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  contactPersonName: varchar("contact_person_name", { length: 255 }),
  contactPersonPhone: varchar("contact_person_phone", { length: 20 }),
  contactPersonEmail: varchar("contact_person_email", { length: 255 }),
  picture: varchar("picture", { length: 500 }),
  assignedStaff: jsonb("assigned_staff").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Department relations
export const departmentsRelations = relations(departments, ({ many }) => ({
  teams: many(teams),
}));

// Team relations
export const teamsRelations = relations(teams, ({ one, many }) => ({
  department: one(departments, {
    fields: [teams.departmentId],
    references: [departments.id],
  }),
  families: many(families),
}));

// Zod schemas for departments
export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Zod schemas for teams
export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


// Types
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type DepartmentWithTeams = Department & {
  teams: Team[];
};

export type TeamWithDepartment = Team & {
  department: Department;
};

export type TeamWithFamilies = Team & {
  families: FamilyWithMembers[];
};
