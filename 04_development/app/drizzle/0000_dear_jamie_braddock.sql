CREATE TABLE "agent_checkpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"project_id" text,
	"current_stage" text NOT NULL,
	"completed_tasks" text,
	"pending_tasks" text,
	"context_snapshot" text,
	"last_output_hash" text,
	"metadata" text,
	"created_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"event_type" text NOT NULL,
	"message" text,
	"detail" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost" double precision,
	"created_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"part_id" text,
	"parent_id" text,
	"tmux_session" text,
	"cli_session_id" text,
	"model_name" text,
	"model_provider" text,
	"task_type" text,
	"status_message" text,
	"notes_path" text,
	"started_at" text,
	"stopped_at" text,
	"created_at" text DEFAULT now()::text NOT NULL,
	"updated_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"key_encrypted" text NOT NULL,
	"key_iv" text NOT NULL,
	"key_tag" text NOT NULL,
	"key_masked" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" text,
	"monthly_usage" double precision DEFAULT 0,
	"created_at" text DEFAULT now()::text NOT NULL,
	"updated_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"approval_id" text NOT NULL,
	"action" text NOT NULL,
	"comment" text,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"created_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"source_agent_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution" text,
	"resolved_at" text,
	"created_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"detail" text,
	"created_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"file_path" text,
	"size_bytes" integer,
	"error_message" text,
	"created_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"sender" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"metadata" text,
	"created_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text,
	"api_key_id" integer,
	"model_name" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost" double precision NOT NULL,
	"project_id" text,
	"created_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"agent_id" text,
	"task_description" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"started_at" text,
	"completed_at" text,
	"result" text,
	"created_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"from_agent_id" text,
	"to_agent_id" text,
	"content" text NOT NULL,
	"message_type" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"last_retry_at" text,
	"error_detail" text,
	"created_at" text DEFAULT now()::text NOT NULL,
	"updated_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"source_agent_id" text,
	"target_url" text,
	"is_read" boolean DEFAULT false,
	"created_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"part_id" text NOT NULL,
	"retry_count" integer DEFAULT 3 NOT NULL,
	"retry_strategy" text DEFAULT 'exponential' NOT NULL,
	"retry_interval_base" integer DEFAULT 10 NOT NULL,
	"approval_stages" text,
	"default_model" text,
	"created_at" text DEFAULT now()::text NOT NULL,
	"updated_at" text DEFAULT now()::text NOT NULL,
	CONSTRAINT "part_policies_part_id_unique" UNIQUE("part_id")
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"skill_name" text NOT NULL,
	"skill_version" text NOT NULL,
	"sensitivity_level" text DEFAULT 'normal' NOT NULL,
	"model_provider" text,
	"color" text,
	"status" text DEFAULT 'active' NOT NULL,
	"input_json" text,
	"orchestrator_path" text,
	"created_at" text DEFAULT now()::text NOT NULL,
	"updated_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"part_id" text NOT NULL,
	"sub_agent_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"current_stage" text,
	"progress_percent" integer DEFAULT 0,
	"priority" text DEFAULT 'normal' NOT NULL,
	"started_at" text,
	"completed_at" text,
	"created_at" text DEFAULT now()::text NOT NULL,
	"updated_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"version" text NOT NULL,
	"parent_skill" text,
	"schema_json" text,
	"file_path" text NOT NULL,
	"created_at" text DEFAULT now()::text NOT NULL,
	"updated_at" text DEFAULT now()::text NOT NULL,
	CONSTRAINT "skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "system_health" (
	"id" serial PRIMARY KEY NOT NULL,
	"cpu_percent" double precision NOT NULL,
	"memory_percent" double precision NOT NULL,
	"disk_percent" double precision NOT NULL,
	"network_up_mbps" double precision,
	"network_down_mbps" double precision,
	"active_agents" integer NOT NULL,
	"created_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" text DEFAULT now()::text NOT NULL,
	"updated_at" text DEFAULT now()::text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_checkpoints" ADD CONSTRAINT "agent_checkpoints_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_checkpoints" ADD CONSTRAINT "agent_checkpoints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_source_agent_id_agents_id_fk" FOREIGN KEY ("source_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_queue" ADD CONSTRAINT "execution_queue_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_queue" ADD CONSTRAINT "execution_queue_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_queue" ADD CONSTRAINT "message_queue_from_agent_id_agents_id_fk" FOREIGN KEY ("from_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_queue" ADD CONSTRAINT "message_queue_to_agent_id_agents_id_fk" FOREIGN KEY ("to_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_source_agent_id_agents_id_fk" FOREIGN KEY ("source_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_policies" ADD CONSTRAINT "part_policies_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_sub_agent_id_agents_id_fk" FOREIGN KEY ("sub_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_checkpoint_agent" ON "agent_checkpoints" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_checkpoint_project" ON "agent_checkpoints" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_checkpoint_created" ON "agent_checkpoints" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_logs_agent" ON "agent_logs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_logs_event" ON "agent_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_agent_logs_created" ON "agent_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_agents_part" ON "agents" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "idx_agents_parent" ON "agents" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_agents_status" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agents_role" ON "agents" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_approval_hist_approval" ON "approval_history" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "idx_approvals_status" ON "approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_approvals_project" ON "approvals" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_approvals_created" ON "approvals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_actor" ON "audit_logs" USING btree ("actor_type");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_resource" ON "audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_chat_sender" ON "chat_messages" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "idx_chat_created" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_cost_agent" ON "cost_records" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_cost_model" ON "cost_records" USING btree ("model_name");--> statement-breakpoint
CREATE INDEX "idx_cost_project" ON "cost_records" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_cost_created" ON "cost_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_eq_priority" ON "execution_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_eq_status" ON "execution_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_eq_project" ON "execution_queue" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_mq_status" ON "message_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mq_from" ON "message_queue" USING btree ("from_agent_id");--> statement-breakpoint
CREATE INDEX "idx_mq_to" ON "message_queue" USING btree ("to_agent_id");--> statement-breakpoint
CREATE INDEX "idx_mq_created" ON "message_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notif_type" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_notif_read" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_notif_created" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_projects_part" ON "projects" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_projects_priority" ON "projects" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_health_created" ON "system_health" USING btree ("created_at");