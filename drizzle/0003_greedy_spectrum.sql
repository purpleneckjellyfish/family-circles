CREATE TABLE "federated_followers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"actor_uri" text NOT NULL,
	"inbox_uri" text NOT NULL,
	"shared_inbox_uri" text,
	"public_key_pem" text,
	"status" "follow_status" DEFAULT 'accepted' NOT NULL,
	"follow_activity_uri" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "federated_followers" ADD CONSTRAINT "federated_followers_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "federated_followers_family_actor_uidx" ON "federated_followers" USING btree ("family_id","actor_uri");--> statement-breakpoint
CREATE INDEX "federated_followers_family_idx" ON "federated_followers" USING btree ("family_id");