CREATE TABLE "deck_covers" (
	"id" text PRIMARY KEY NOT NULL,
	"png" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "cover_id" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "cover_id" text;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_cover_id_deck_covers_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."deck_covers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_cover_id_deck_covers_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."deck_covers"("id") ON DELETE set null ON UPDATE no action;