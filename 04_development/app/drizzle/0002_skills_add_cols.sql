ALTER TABLE "skills" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "sensitivity" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "has_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "repo_url" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "repo_commit" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "synced_at" text;--> statement-breakpoint
CREATE INDEX "idx_skills_category" ON "skills" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_skills_status" ON "skills" USING btree ("status");