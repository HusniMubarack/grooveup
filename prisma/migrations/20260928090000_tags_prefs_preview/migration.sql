-- Onboarding: the dance styles a student wants in their feed
ALTER TABLE "User" ADD COLUMN "danceStyles" TEXT NOT NULL DEFAULT '';

-- Lesson tags and the teacher-picked preview (plus its Mux clip)
ALTER TABLE "Service" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Service" ADD COLUMN "previewStartSec" INTEGER;
ALTER TABLE "Service" ADD COLUMN "previewEndSec" INTEGER;
ALTER TABLE "Service" ADD COLUMN "previewAssetId" TEXT;
ALTER TABLE "Service" ADD COLUMN "previewPlaybackId" TEXT;
ALTER TABLE "Service" ADD COLUMN "previewStatus" TEXT;
ALTER TABLE "Service" ADD COLUMN "previewRange" TEXT;

-- Teachers no longer list UPI details
ALTER TABLE "TeacherProfile" DROP COLUMN "upiId";
ALTER TABLE "TeacherProfile" DROP COLUMN "showUpiQr";
