-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('SOURCE_IMAGE', 'INTERMEDIATE_VIDEO', 'TTS_AUDIO', 'FINAL_VIDEO');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'FAILED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "JobStage" AS ENUM ('QUEUED', 'GEMINI_PREP', 'VIDEO_GENERATE', 'TTS_GENERATE', 'MUX', 'COMPLETE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "stage" "JobStage" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sourceImageId" TEXT NOT NULL,
    "resultVideoId" TEXT,
    "ttsAudioId" TEXT,
    "prompt" TEXT NOT NULL,
    "promptPreset" TEXT,
    "voicePreset" TEXT,
    "ttsScript" TEXT,
    "aspect" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "styleHints" JSONB,
    "providerMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Share_slug_key" ON "Share"("slug");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_sourceImageId_fkey" FOREIGN KEY ("sourceImageId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_resultVideoId_fkey" FOREIGN KEY ("resultVideoId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_ttsAudioId_fkey" FOREIGN KEY ("ttsAudioId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
