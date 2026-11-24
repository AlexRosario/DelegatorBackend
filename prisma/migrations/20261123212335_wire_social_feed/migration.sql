-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('BLUESKY', 'YOUTUBE', 'INSTAGRAM', 'X', 'FACEBOOK', 'THREADS', 'MASTODON');

-- CreateEnum
CREATE TYPE "FeedSourceKind" AS ENUM ('MEMBER', 'AGENCY', 'ORGANIZATION', 'CREATOR');

-- CreateEnum
CREATE TYPE "FeedLane" AS ENUM ('WIRE', 'MILL');

-- CreateTable
CREATE TABLE "FeedSource" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FeedSourceKind" NOT NULL,
    "lane" "FeedLane" NOT NULL DEFAULT 'WIRE',
    "memberId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" SERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "handle" TEXT,
    "platformId" TEXT,
    "url" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "likeCount" INTEGER,
    "commentCount" INTEGER,
    "repostCount" INTEGER,
    "viewCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedSource_slug_key" ON "FeedSource"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSource_memberId_key" ON "FeedSource"("memberId");

-- CreateIndex
CREATE INDEX "FeedSource_lane_kind_active_idx" ON "FeedSource"("lane", "kind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_sourceId_platform_key" ON "SocialAccount"("sourceId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_platform_platformId_key" ON "SocialAccount"("platform", "platformId");

-- CreateIndex
CREATE INDEX "SocialPost_postedAt_id_idx" ON "SocialPost"("postedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_accountId_platformPostId_key" ON "SocialPost"("accountId", "platformPostId");

-- AddForeignKey
ALTER TABLE "FeedSource" ADD CONSTRAINT "FeedSource_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "FeedSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
