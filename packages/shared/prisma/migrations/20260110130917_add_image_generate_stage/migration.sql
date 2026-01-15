/*
  Warnings:

  - The values [SAVING] on the enum `JobStage` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "JobStage_new" AS ENUM ('QUEUED', 'GEMINI_PREP', 'IMAGE_GENERATE', 'VIDEO_GENERATE', 'TTS_GENERATE', 'MUX', 'COMPLETE');
ALTER TABLE "Job" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Job" ALTER COLUMN "stage" TYPE "JobStage_new" USING ("stage"::text::"JobStage_new");
ALTER TYPE "JobStage" RENAME TO "JobStage_old";
ALTER TYPE "JobStage_new" RENAME TO "JobStage";
DROP TYPE "JobStage_old";
ALTER TABLE "Job" ALTER COLUMN "stage" SET DEFAULT 'QUEUED';
COMMIT;
