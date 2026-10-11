-- Chaos mode (decks.md#card-kinds). Silly cards were weak (one stock activity bolted onto each
-- noun), so they're deleted rather than converted: Chaos cards are made anew for a deck when a
-- host asks for them. Medium goes away: its cards become easy.
DELETE FROM "cards" WHERE "is_silly";--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "cards_difficulty_check";--> statement-breakpoint
ALTER TABLE "cards" RENAME COLUMN "difficulty" TO "kind";--> statement-breakpoint
UPDATE "cards" SET "kind" = 'easy' WHERE "kind" = 'medium';--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "is_silly";--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_kind_check" CHECK ("cards"."kind" in ('easy', 'hard', 'chaos'));--> statement-breakpoint
ALTER TABLE "generation_jobs" RENAME COLUMN "include_silly" TO "include_chaos";--> statement-breakpoint
ALTER TABLE "generation_jobs" DROP COLUMN "difficulties";--> statement-breakpoint
ALTER TABLE "generation_jobs" DROP CONSTRAINT "generation_jobs_kind_check";--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_kind_check" CHECK ("generation_jobs"."kind" in ('generate', 'translate', 'chaos'));--> statement-breakpoint
CREATE UNIQUE INDEX "generation_jobs_one_chaos_idx" ON "generation_jobs" USING btree ("source_deck_id") WHERE "generation_jobs"."status" = 'running' and "generation_jobs"."kind" = 'chaos';
