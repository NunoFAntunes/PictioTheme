CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"deck_id" uuid NOT NULL,
	"text" text NOT NULL,
	"difficulty" text NOT NULL,
	"is_silly" boolean DEFAULT false NOT NULL,
	"alternates" text[] DEFAULT '{}'::text[] NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"times_drawn" integer DEFAULT 0 NOT NULL,
	"times_guessed" integer DEFAULT 0 NOT NULL,
	"flags" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "cards_difficulty_check" CHECK ("cards"."difficulty" in ('easy', 'medium', 'hard'))
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"theme_query" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"family_friendly" boolean DEFAULT true NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"created_by" uuid,
	"source" text NOT NULL,
	"model" text,
	"play_count" integer DEFAULT 0 NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"downvotes" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decks_slug_unique" UNIQUE("slug"),
	CONSTRAINT "decks_visibility_check" CHECK ("decks"."visibility" in ('public', 'unlisted', 'hidden')),
	CONSTRAINT "decks_source_check" CHECK ("decks"."source" in ('ai', 'curated', 'remix'))
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cards_deck_text_unique" ON "cards" USING btree ("deck_id",lower("text"));--> statement-breakpoint
CREATE INDEX "decks_tags_idx" ON "decks" USING gin ("tags");