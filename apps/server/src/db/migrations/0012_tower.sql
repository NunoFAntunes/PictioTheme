CREATE TABLE "tower_decks" (
	"deck_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"show_category" boolean DEFAULT false NOT NULL,
	"category_label" text,
	"sort" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tower_match_players" (
	"match_id" uuid NOT NULL,
	"player_id" text NOT NULL,
	"team" text NOT NULL,
	"display_name" text NOT NULL,
	"drawings" integer NOT NULL,
	"solves" integer NOT NULL,
	"steals" integer NOT NULL,
	"sends" integer NOT NULL,
	"placements" integer NOT NULL,
	"fumbles" integer NOT NULL,
	CONSTRAINT "tower_match_players_match_id_player_id_pk" PRIMARY KEY("match_id","player_id"),
	CONSTRAINT "tower_match_players_team_check" CHECK ("tower_match_players"."team" in ('orange', 'teal'))
);
--> statement-breakpoint
CREATE TABLE "tower_matches" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_code" text NOT NULL,
	"settings" jsonb NOT NULL,
	"winner" text,
	"end_reason" text NOT NULL,
	"height_orange" real NOT NULL,
	"height_teal" real NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	CONSTRAINT "tower_matches_winner_check" CHECK ("tower_matches"."winner" in ('orange', 'teal')),
	CONSTRAINT "tower_matches_end_reason_check" CHECK ("tower_matches"."end_reason" in ('topped_out', 'time', 'abandoned'))
);
--> statement-breakpoint
ALTER TABLE "tower_decks" ADD CONSTRAINT "tower_decks_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tower_match_players" ADD CONSTRAINT "tower_match_players_match_id_tower_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tower_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tower_matches_ended_at_idx" ON "tower_matches" USING btree ("ended_at");