-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
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
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Member" ("area", "createdAt", "district", "id", "name", "party", "phone", "photoURL", "reason", "source", "state", "updatedAt", "url") SELECT "area", "createdAt", "district", "id", "name", "party", "phone", "photoURL", "reason", "source", "state", "updatedAt", "url" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
