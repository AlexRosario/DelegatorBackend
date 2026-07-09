-- CreateTable
CREATE TABLE "BillComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillComment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BillComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BillComment_billId_createdAt_idx" ON "BillComment"("billId", "createdAt");
