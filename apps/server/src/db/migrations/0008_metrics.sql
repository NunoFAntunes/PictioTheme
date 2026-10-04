CREATE TABLE "card_votes" (
	"card_id" uuid NOT NULL,
	"player_id" text NOT NULL,
	"vote" smallint NOT NULL,
	"voted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_votes_card_id_player_id_pk" PRIMARY KEY("card_id","player_id"),
	CONSTRAINT "card_votes_vote_check" CHECK ("card_votes"."vote" in (1, -1))
);
--> statement-breakpoint
CREATE TABLE "product_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"player_id" text,
	"room_code" text,
	"deck_id" uuid,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "times_offered" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "times_picked" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "card_votes" ADD CONSTRAINT "card_votes_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_events_name_at_idx" ON "product_events" USING btree ("name","at");