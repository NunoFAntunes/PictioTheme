-- Deck search (docs/technical/data-model.md): trigram matching on titles, for typo-tolerant search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decks_title_trgm_idx" ON "decks" USING gin ("title" gin_trgm_ops);
