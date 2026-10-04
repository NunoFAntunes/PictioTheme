CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_by" text NOT NULL,
	"theme" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"difficulties" text[] NOT NULL,
	"include_silly" boolean NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"deck_id" uuid,
	"error" text,
	"model" text,
	"provider" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "generation_jobs_status_check" CHECK ("generation_jobs"."status" in ('running', 'published', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_jobs_created_by_idx" ON "generation_jobs" USING btree ("created_by","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_jobs_one_running_idx" ON "generation_jobs" USING btree ("created_by") WHERE "generation_jobs"."status" = 'running';