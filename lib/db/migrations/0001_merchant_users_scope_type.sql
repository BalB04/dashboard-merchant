CREATE TYPE "merchant_scope_type" AS ENUM ('merchant', 'canonical');
ALTER TABLE "merchant_users" ADD COLUMN "scope_type" "merchant_scope_type" DEFAULT 'merchant' NOT NULL;
