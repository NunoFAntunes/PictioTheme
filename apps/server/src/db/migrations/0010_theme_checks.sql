CREATE TABLE "theme_checks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_by" text NOT NULL,
	"client_ip_hash" text,
	"theme" text NOT NULL,
	"language" text NOT NULL,
	"verdict" text NOT NULL,
	"model" text,
	"cost_usd" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_checks_verdict_check" CHECK ("theme_checks"."verdict" in ('accepted', 'wrong_language', 'unclear', 'refused', 'unreadable'))
);
--> statement-breakpoint
CREATE INDEX "theme_checks_created_by_idx" ON "theme_checks" USING btree ("created_by","created_at");--> statement-breakpoint
CREATE INDEX "theme_checks_client_ip_idx" ON "theme_checks" USING btree ("client_ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "theme_checks_created_at_idx" ON "theme_checks" USING btree ("created_at");