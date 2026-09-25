-- AlterTable
ALTER TABLE "Entitlement" ADD COLUMN "expiresAt" DATETIME;

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "serviceId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "paymentRef" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "accessUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "AccessRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teacherReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "teacherId" TEXT,
    "serviceId" TEXT,
    "method" TEXT NOT NULL DEFAULT 'MOCK',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("amountPaise", "createdAt", "id", "serviceId", "status", "studentId", "teacherId", "type") SELECT "amountPaise", "createdAt", "id", "serviceId", "status", "studentId", "teacherId", "type" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" DATETIME,
    CONSTRAINT "Subscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("currentPeriodEnd", "id", "status", "studentId", "teacherId") SELECT "currentPeriodEnd", "id", "status", "studentId", "teacherId" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE TABLE "new_TeacherProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "styles" TEXT NOT NULL DEFAULT '[]',
    "monthlyPricePaise" INTEGER NOT NULL DEFAULT 49900,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "upiId" TEXT,
    "showUpiQr" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeacherProfile" ("bio", "featured", "handle", "id", "monthlyPricePaise", "styles", "userId", "verified") SELECT "bio", "featured", "handle", "id", "monthlyPricePaise", "styles", "userId", "verified" FROM "TeacherProfile";
DROP TABLE "TeacherProfile";
ALTER TABLE "new_TeacherProfile" RENAME TO "TeacherProfile";
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");
CREATE UNIQUE INDEX "TeacherProfile_handle_key" ON "TeacherProfile"("handle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AccessRequest_teacherId_status_idx" ON "AccessRequest"("teacherId", "status");

-- CreateIndex
CREATE INDEX "AccessRequest_studentId_status_idx" ON "AccessRequest"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_studentId_teacherId_key" ON "Conversation"("studentId", "teacherId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
