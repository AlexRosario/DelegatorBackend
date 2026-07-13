-- CreateTable
CREATE TABLE "MemberDonorCache" (
    "bioguideId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberDonorCache_pkey" PRIMARY KEY ("bioguideId")
);
