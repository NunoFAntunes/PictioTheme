ALTER TABLE "decks" DROP CONSTRAINT "decks_source_check";--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "source_deck_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "kind" text DEFAULT 'generate' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "source_deck_id" uuid;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_source_deck_id_decks_id_fk" FOREIGN KEY ("source_deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_source_deck_id_decks_id_fk" FOREIGN KEY ("source_deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "decks_translation_unique" ON "decks" USING btree ("source_deck_id","language") WHERE "decks"."source_deck_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_jobs_one_translation_idx" ON "generation_jobs" USING btree ("source_deck_id","language") WHERE "generation_jobs"."status" = 'running' and "generation_jobs"."kind" = 'translate';--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_source_check" CHECK ("decks"."source" in ('ai', 'curated', 'remix', 'translation'));--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_kind_check" CHECK ("generation_jobs"."kind" in ('generate', 'translate'));