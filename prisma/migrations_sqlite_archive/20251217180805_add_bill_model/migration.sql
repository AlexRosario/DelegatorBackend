-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "congress" INTEGER NOT NULL,
    "billType" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT,
    "introducedDate" DATETIME,
    "lastActionDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FieldOffice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberId" TEXT NOT NULL,
    CONSTRAINT "FieldOffice_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FieldOffice" ("id", "memberId") SELECT "id", "memberId" FROM "FieldOffice";
DROP TABLE "FieldOffice";
ALTER TABLE "new_FieldOffice" RENAME TO "FieldOffice";
CREATE TABLE "new_MemberVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "bioguideId" TEXT NOT NULL,
    CONSTRAINT "MemberVote_bioguideId_fkey" FOREIGN KEY ("bioguideId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberVote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MemberVote" ("billId", "bioguideId", "date", "id", "vote") SELECT "billId", "bioguideId", "date", "id", "vote" FROM "MemberVote";
DROP TABLE "MemberVote";
ALTER TABLE "new_MemberVote" RENAME TO "MemberVote";
CREATE UNIQUE INDEX "MemberVote_billId_bioguideId_key" ON "MemberVote"("billId", "bioguideId");
CREATE TABLE "new_Vote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "billId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Vote" ("billId", "date", "id", "userId", "vote") SELECT "billId", "date", "id", "userId", "vote" FROM "Vote";
DROP TABLE "Vote";
ALTER TABLE "new_Vote" RENAME TO "Vote";
CREATE UNIQUE INDEX "Vote_userId_billId_key" ON "Vote"("userId", "billId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Bill_congress_idx" ON "Bill"("congress");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_congress_billType_billNumber_key" ON "Bill"("congress", "billType", "billNumber");
