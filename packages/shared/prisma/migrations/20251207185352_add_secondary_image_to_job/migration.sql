/*
  Warnings:

  - The values [SECONDARY_IMAGE] on the enum `AssetKind` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AssetKind_new" AS ENUM ('SOURCE_IMAGE', 'INTERMEDIATE_VIDEO', 'TTS_AUDIO', 'FINAL_VIDEO');
ALTER TABLE "Asset" ALTER COLUMN "kind" TYPE "AssetKind_new" USING ("kind"::text::"AssetKind_new");
ALTER TYPE "AssetKind" RENAME TO "AssetKind_old";
ALTER TYPE "AssetKind_new" RENAME TO "AssetKind";
DROP TYPE "AssetKind_old";
COMMIT;
