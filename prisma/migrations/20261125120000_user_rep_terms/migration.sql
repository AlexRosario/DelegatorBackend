-- CreateEnum
CREATE TYPE "RepEndReason" AS ENUM ('LEFT_OFFICE', 'REDISTRICTED', 'MOVED', 'OTHER');

-- CreateTable
CREATE TABLE "UserRepTerm" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "memberId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endReason" "RepEndReason",

    CONSTRAINT "UserRepTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRepTerm_userId_endedAt_idx" ON "UserRepTerm"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "UserRepTerm_memberId_idx" ON "UserRepTerm"("memberId");

-- AddForeignKey
ALTER TABLE "UserRepTerm" ADD CONSTRAINT "UserRepTerm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRepTerm" ADD CONSTRAINT "UserRepTerm_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every existing user→member link becomes an open span. startedAt is
-- unknown for these (delegationVerifiedAt is bumped on each reconcile, so it is
-- not a start date) and stays NULL. In "_UserMembers", A = Member.id, B = User.id.
INSERT INTO "UserRepTerm" ("userId", "memberId", "startedAt", "endedAt", "endReason")
SELECT um."B", um."A", NULL, NULL, NULL
FROM "_UserMembers" um;
