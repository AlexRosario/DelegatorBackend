-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipcode" TEXT NOT NULL,
    "district" INTEGER,
    "derivedState" TEXT,
    "delegationVerifiedAt" TIMESTAMP(3),
    "verificationSource" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "attestedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "party" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "photoURL" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "district" INTEGER,
    "chamber" TEXT,
    "officeAddress" TEXT,
    "currentMember" BOOLEAN NOT NULL DEFAULT false,
    "area" TEXT,
    "reason" TEXT,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldOffice" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipcode" TEXT,
    "phone" TEXT,

    CONSTRAINT "FieldOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "congress" INTEGER NOT NULL,
    "billType" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "plainSummary" TEXT,
    "plainSummaryModel" TEXT,
    "plainSummaryAt" TIMESTAMP(3),
    "status" TEXT,
    "stage" TEXT,
    "actions" JSONB,
    "chamber" TEXT,
    "originChamber" TEXT,
    "policyArea" TEXT,
    "subjects" JSONB,
    "cosponsorCount" INTEGER,
    "congressGovUrl" TEXT,
    "textVersionUrl" TEXT,
    "latestActionText" TEXT,
    "latestActionDate" TIMESTAMP(3),
    "introducedDate" TIMESTAMP(3),
    "lastActionDate" TIMESTAMP(3),
    "sponsorBioguideId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "billId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberVote" (
    "id" SERIAL NOT NULL,
    "billId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "bioguideId" TEXT NOT NULL,

    CONSTRAINT "MemberVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RollCall" (
    "id" SERIAL NOT NULL,
    "billId" TEXT NOT NULL,
    "chamber" TEXT NOT NULL,
    "rollNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "question" TEXT NOT NULL,
    "result" TEXT NOT NULL,

    CONSTRAINT "RollCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RollCallVote" (
    "id" SERIAL NOT NULL,
    "rollCallId" INTEGER NOT NULL,
    "bioguideId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "vote" TEXT NOT NULL,

    CONSTRAINT "RollCallVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bioguideId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deliveryMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillComment" (
    "id" SERIAL NOT NULL,
    "billId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" SERIAL NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "message" TEXT,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillEnrichment" (
    "billId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillEnrichment_pkey" PRIMARY KEY ("billId")
);

-- CreateTable
CREATE TABLE "_UserMembers" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_UserMembers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_congress_billType_billNumber_key" ON "Bill"("congress", "billType", "billNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_billId_key" ON "Vote"("userId", "billId");

-- CreateIndex
CREATE UNIQUE INDEX "RollCall_billId_chamber_rollNumber_key" ON "RollCall"("billId", "chamber", "rollNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RollCallVote_rollCallId_bioguideId_key" ON "RollCallVote"("rollCallId", "bioguideId");

-- CreateIndex
CREATE INDEX "ContactMessage_billId_bioguideId_idx" ON "ContactMessage"("billId", "bioguideId");

-- CreateIndex
CREATE INDEX "ContactMessage_userId_createdAt_idx" ON "ContactMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BillComment_billId_createdAt_idx" ON "BillComment"("billId", "createdAt");

-- CreateIndex
CREATE INDEX "_UserMembers_B_index" ON "_UserMembers"("B");

-- AddForeignKey
ALTER TABLE "FieldOffice" ADD CONSTRAINT "FieldOffice_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_sponsorBioguideId_fkey" FOREIGN KEY ("sponsorBioguideId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberVote" ADD CONSTRAINT "MemberVote_bioguideId_fkey" FOREIGN KEY ("bioguideId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RollCall" ADD CONSTRAINT "RollCall_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RollCallVote" ADD CONSTRAINT "RollCallVote_rollCallId_fkey" FOREIGN KEY ("rollCallId") REFERENCES "RollCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RollCallVote" ADD CONSTRAINT "RollCallVote_bioguideId_fkey" FOREIGN KEY ("bioguideId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_bioguideId_fkey" FOREIGN KEY ("bioguideId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillComment" ADD CONSTRAINT "BillComment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillComment" ADD CONSTRAINT "BillComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillEnrichment" ADD CONSTRAINT "BillEnrichment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserMembers" ADD CONSTRAINT "_UserMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserMembers" ADD CONSTRAINT "_UserMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

