CREATE TYPE "public"."occasion" AS ENUM('none', 'christmas', 'birthday', 'easter', 'other');--> statement-breakpoint
CREATE TYPE "public"."person_kind" AS ENUM('adult', 'kid');--> statement-breakpoint
CREATE TABLE "post_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "family_memberships" ADD COLUMN "can_post" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "follows" ADD COLUMN "can_post" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "kind" "person_kind" DEFAULT 'adult' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "occasion" "occasion" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "occasion_label" text;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_reactions_post_user_uidx" ON "post_reactions" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE INDEX "post_reactions_post_idx" ON "post_reactions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "posts_occasion_idx" ON "posts" USING btree ("occasion");