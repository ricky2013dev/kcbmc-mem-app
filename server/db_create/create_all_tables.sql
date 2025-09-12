-- ===============================================
-- KCBMC Member Application Database Schema
-- Complete database creation script
-- ===============================================
-- This script creates all required tables, constraints, and indexes
-- for the KCBMC family care management system.
--
-- Run this script in your PostgreSQL database to create the complete schema.
-- ===============================================

-- Create staff table
CREATE TABLE "staff" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"nick_name" varchar(100) NOT NULL,
	"personal_pin" varchar(4) NOT NULL,
	"group" varchar(50) NOT NULL,
	"email" varchar(255),
	"last_login" timestamp,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "staff_nick_name_unique" UNIQUE("nick_name")
);

-- Create families table
CREATE TABLE "families" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_code" varchar(20),
	"family_name" varchar(255) NOT NULL,
	"visited_date" date NOT NULL,
	"registration_date" date,
	"member_status" varchar(50) NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"email" varchar(255),
	"address" varchar(255) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(50) NOT NULL,
	"zip_code" varchar(10) NOT NULL,
	"full_address" varchar(500) NOT NULL,
	"family_notes" text,
	"family_picture" varchar(500),
	"life_group" varchar(255),
	"support_team_member" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "families_family_code_unique" UNIQUE("family_code")
);

-- Create family_members table
CREATE TABLE "family_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" varchar NOT NULL,
	"korean_name" varchar(255) NOT NULL,
	"english_name" varchar(255) NOT NULL,
	"birth_date" date,
	"phone_number" varchar(20),
	"email" varchar(255),
	"relationship" varchar(50) NOT NULL,
	"courses" jsonb DEFAULT '[]'::jsonb,
	"grade_level" varchar(10),
	"grade_group" varchar(50),
	"school" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create events table
CREATE TABLE "events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"time" varchar(10) NOT NULL,
	"location" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create event_attendance table
CREATE TABLE "event_attendance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"family_id" varchar NOT NULL,
	"family_member_id" varchar,
	"attendance_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"updated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "valid_attendance_status" CHECK ("attendance_status" IN ('present', 'absent', 'pending'))
);

-- Create care_logs table
CREATE TABLE "care_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" varchar NOT NULL,
	"staff_id" varchar NOT NULL,
	"date" date NOT NULL,
	"type" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create announcements table
CREATE TABLE "announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"type" varchar(20) DEFAULT 'Medium' NOT NULL,
	"is_login_required" boolean DEFAULT true NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"created_by" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "valid_announcement_type" CHECK ("type" IN ('Major', 'Medium', 'Minor'))
);

-- Create staff_login_logs table
CREATE TABLE "staff_login_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" varchar NOT NULL,
	"login_time" timestamp NOT NULL DEFAULT NOW(),
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"success" boolean NOT NULL DEFAULT true,
	"failure_reason" varchar(255),
	"created_at" timestamp DEFAULT NOW()
);

-- ===============================================
-- FOREIGN KEY CONSTRAINTS
-- ===============================================

-- Family members foreign keys
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_id_families_id_fk" 
	FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;

-- Events foreign keys
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_staff_id_fk" 
	FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;

-- Event attendance foreign keys
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_event_id_events_id_fk" 
	FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_family_id_families_id_fk" 
	FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_family_member_id_family_members_id_fk" 
	FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_updated_by_staff_id_fk" 
	FOREIGN KEY ("updated_by") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;

-- Care logs foreign keys
ALTER TABLE "care_logs" ADD CONSTRAINT "care_logs_family_id_families_id_fk" 
	FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "care_logs" ADD CONSTRAINT "care_logs_staff_id_staff_id_fk" 
	FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;

-- Announcements foreign keys
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_staff_id_fk" 
	FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;

-- Staff login logs foreign keys
ALTER TABLE "staff_login_logs" ADD CONSTRAINT "staff_login_logs_staff_id_staff_id_fk" 
	FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE;

-- ===============================================
-- INDEXES FOR PERFORMANCE
-- ===============================================

-- Events indexes
CREATE INDEX IF NOT EXISTS "idx_events_date" ON "events" ("date");
CREATE INDEX IF NOT EXISTS "idx_events_is_active" ON "events" ("is_active");

-- Event attendance indexes
CREATE INDEX IF NOT EXISTS "idx_event_attendance_event_id" ON "event_attendance" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_event_attendance_family_id" ON "event_attendance" ("family_id");
CREATE INDEX IF NOT EXISTS "idx_event_attendance_status" ON "event_attendance" ("attendance_status");

-- Announcements indexes
CREATE INDEX IF NOT EXISTS "idx_announcements_active_dates" ON "announcements" ("is_active", "start_date", "end_date");
CREATE INDEX IF NOT EXISTS "idx_announcements_login_required" ON "announcements" ("is_login_required");
CREATE INDEX IF NOT EXISTS "idx_announcements_type" ON "announcements" ("type");
CREATE INDEX IF NOT EXISTS "idx_announcements_created_by" ON "announcements" ("created_by");

-- Staff login logs indexes
CREATE INDEX IF NOT EXISTS "idx_staff_login_logs_staff_id" ON "staff_login_logs" ("staff_id");
CREATE INDEX IF NOT EXISTS "idx_staff_login_logs_login_time" ON "staff_login_logs" ("login_time");
CREATE INDEX IF NOT EXISTS "idx_staff_login_logs_success" ON "staff_login_logs" ("success");

-- ===============================================
-- COMMENTS FOR DOCUMENTATION
-- ===============================================

COMMENT ON TABLE "staff" IS 'Staff members who can access the system';
COMMENT ON TABLE "families" IS 'Family records with contact and address information';
COMMENT ON TABLE "family_members" IS 'Individual family members with personal details';
COMMENT ON TABLE "events" IS 'Events and activities organized by the church';
COMMENT ON TABLE "event_attendance" IS 'Attendance tracking for events';
COMMENT ON TABLE "care_logs" IS 'Care and interaction logs for families';
COMMENT ON TABLE "announcements" IS 'System announcements and news';
COMMENT ON TABLE "staff_login_logs" IS 'Login attempt tracking for staff members';

COMMENT ON COLUMN "staff"."last_login" IS 'Timestamp of when the staff member last logged in';
COMMENT ON COLUMN "staff_login_logs"."staff_id" IS 'Foreign key reference to the staff member';
COMMENT ON COLUMN "staff_login_logs"."login_time" IS 'Timestamp of when the login attempt was made';
COMMENT ON COLUMN "staff_login_logs"."ip_address" IS 'IP address from which the login attempt was made';
COMMENT ON COLUMN "staff_login_logs"."user_agent" IS 'Browser/client user agent string';
COMMENT ON COLUMN "staff_login_logs"."success" IS 'Whether the login attempt was successful';
COMMENT ON COLUMN "staff_login_logs"."failure_reason" IS 'Reason for failed login (e.g., invalid credentials, account locked)';

-- ===============================================
-- SCRIPT COMPLETION
-- ===============================================

-- Verify tables were created successfully
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('staff', 'families', 'family_members', 'events', 'event_attendance', 'care_logs', 'announcements', 'staff_login_logs')
ORDER BY tablename;

-- Display success message
SELECT 'Database schema created successfully! All tables, constraints, and indexes have been set up.' AS status;