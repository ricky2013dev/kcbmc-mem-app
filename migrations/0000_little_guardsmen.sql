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
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"contact_person_name" varchar(255),
	"contact_person_phone" varchar(20),
	"contact_person_email" varchar(255),
	"picture" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"type" varchar(50) DEFAULT 'Regular' NOT NULL,
	"date" date NOT NULL,
	"comment" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_attendance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"family_id" varchar NOT NULL,
	"family_member_id" varchar,
	"attendance_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"updated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "families" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_code" varchar(20),
	"family_name" varchar(255) NOT NULL,
	"visited_date" date,
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
	"biz" varchar(255),
	"biz_title" varchar(255),
	"biz_category" varchar(255),
	"biz_name" varchar(255),
	"biz_intro" text,
	"team_id" varchar,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "families_family_code_unique" UNIQUE("family_code")
);
--> statement-breakpoint
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
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"nick_name" varchar(100) NOT NULL,
	"personal_pin" varchar(4) NOT NULL,
	"group" varchar(50) NOT NULL,
	"email" varchar(255),
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "staff_nick_name_unique" UNIQUE("nick_name")
);
--> statement-breakpoint
CREATE TABLE "staff_login_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" varchar NOT NULL,
	"login_time" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"success" boolean DEFAULT true NOT NULL,
	"failure_reason" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"contact_person_name" varchar(255),
	"contact_person_phone" varchar(20),
	"contact_person_email" varchar(255),
	"picture" varchar(500),
	"assigned_staff" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_logs" ADD CONSTRAINT "care_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_logs" ADD CONSTRAINT "care_logs_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_family_member_id_family_members_id_fk" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_updated_by_staff_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_login_logs" ADD CONSTRAINT "staff_login_logs_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;