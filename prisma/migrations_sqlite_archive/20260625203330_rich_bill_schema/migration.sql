/*
  Warnings:

  - Added the required column `updatedAt` to the `Member` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "RollCall" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billId" TEXT NOT NULL,
    "chamber" TEXT NOT NULL,
    "rollNumber" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "question" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    CONSTRAINT "RollCall_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RollCallVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rollCallId" INTEGER NOT NULL,
    "bioguideId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    CONSTRAINT "RollCallVote_rollCallId_fkey" FOREIGN KEY ("rollCallId") REFERENCES "RollCall" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RollCallVote_bioguideId_fkey" FOREIGN KEY ("bioguideId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "job" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL,
    "message" TEXT
);

-- CreateTable
CREATE TABLE "BillEnrichment" (
    "billId" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillEnrichment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "congress" INTEGER NOT NULL,
    "billType" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT,
    "chamber" TEXT,
    "originChamber" TEXT,
    "policyArea" TEXT,
    "subjects" JSONB,
    "cosponsorCount" INTEGER,
    "congressGovUrl" TEXT,
    "textVersionUrl" TEXT,
    "latestActionText" TEXT,
    "latestActionDate" DATETIME,
    "introducedDate" DATETIME,
    "lastActionDate" DATETIME,
    "sponsorBioguideId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bill_sponsorBioguideId_fkey" FOREIGN KEY ("sponsorBioguideId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bill" ("billNumber", "billType", "congress", "createdAt", "id", "introducedDate", "lastActionDate", "status", "summary", "title", "updatedAt") SELECT "billNumber", "billType", "congress", "createdAt", "id", "introducedDate", "lastActionDate", "status", "summary", "title", "updatedAt" FROM "Bill";
DROP TABLE "Bill";
ALTER TABLE "new_Bill" RENAME TO "Bill";
CREATE UNIQUE INDEX "Bill_congress_billType_billNumber_key" ON "Bill"("congress", "billType", "billNumber");
CREATE TABLE "new_FieldOffice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberId" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipcode" TEXT,
    "phone" TEXT,
    CONSTRAINT "FieldOffice_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FieldOffice" ("id", "memberId") SELECT "id", "memberId" FROM "FieldOffice";
DROP TABLE "FieldOffice";
ALTER TABLE "new_FieldOffice" RENAME TO "FieldOffice";
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "photoURL" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "district" INTEGER,
    "source" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Member" ("area", "district", "id", "name", "party", "phone", "photoURL", "reason", "state", "url", "updatedAt") SELECT "area", "district", "id", "name", "party", "phone", "photoURL", "reason", "state", "url", CURRENT_TIMESTAMP FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE TABLE "new_MemberVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "bioguideId" TEXT NOT NULL,
    CONSTRAINT "MemberVote_bioguideId_fkey" FOREIGN KEY ("bioguideId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MemberVote" ("billId", "bioguideId", "date", "id", "vote") SELECT "billId", "bioguideId", "date", "id", "vote" FROM "MemberVote";
DROP TABLE "MemberVote";
ALTER TABLE "new_MemberVote" RENAME TO "MemberVote";
CREATE TABLE "new_Vote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "billId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Vote" ("billId", "date", "id", "userId", "vote") SELECT "billId", "date", "id", "userId", "vote" FROM "Vote";
DROP TABLE "Vote";
ALTER TABLE "new_Vote" RENAME TO "Vote";
CREATE UNIQUE INDEX "Vote_userId_billId_key" ON "Vote"("userId", "billId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RollCall_billId_chamber_rollNumber_key" ON "RollCall"("billId", "chamber", "rollNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RollCallVote_rollCallId_bioguideId_key" ON "RollCallVote"("rollCallId", "bioguideId");
