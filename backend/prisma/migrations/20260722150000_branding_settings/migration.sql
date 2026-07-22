-- CreateTable
CREATE TABLE "BrandingSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "accentColor" TEXT,
    "logoStorageKey" TEXT,
    "logoFilename" TEXT,
    "logoMime" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandingSettings_pkey" PRIMARY KEY ("id")
);
