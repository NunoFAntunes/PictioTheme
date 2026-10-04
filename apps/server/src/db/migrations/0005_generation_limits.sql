ALTER TABLE "generation_jobs" ADD COLUMN "client_ip_hash" text;--> statement-breakpoint
CREATE INDEX "generation_jobs_client_ip_idx" ON "generation_jobs" USING btree ("client_ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "generation_jobs_created_at_idx" ON "generation_jobs" USING btree ("created_at");