CREATE TABLE "players" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"name_chosen" boolean DEFAULT false NOT NULL,
	"drawing_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_name_chosen_check" CHECK (not "players"."name_chosen" or "players"."display_name" is not null)
);
--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_drawing_id_avatars_id_fk" FOREIGN KEY ("drawing_id") REFERENCES "public"."avatars"("id") ON DELETE set null ON UPDATE no action;