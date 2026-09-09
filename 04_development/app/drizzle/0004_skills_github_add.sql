ALTER TABLE "skills" ALTER COLUMN "version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "topics" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "is_private" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "default_branch" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "repo_pushed_at" text;