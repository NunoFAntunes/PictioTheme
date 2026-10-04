CREATE TABLE "deck_reports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"deck_id" uuid NOT NULL,
	"reporter_id" text NOT NULL,
	"reason" text NOT NULL,
	"cover_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "deck_reports_reason_check" CHECK ("deck_reports"."reason" in ('cover', 'content'))
);
--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "cover_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deck_reports" ADD CONSTRAINT "deck_reports_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_reports" ADD CONSTRAINT "deck_reports_cover_id_deck_covers_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."deck_covers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deck_reports_once_idx" ON "deck_reports" USING btree ("deck_id","reporter_id","reason",coalesce("cover_id", ''));