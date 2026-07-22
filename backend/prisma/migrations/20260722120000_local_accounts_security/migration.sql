-- Rename LocalAdminAccount -> LocalAccount, migrate id to TEXT, add MFA/role columns
ALTER TABLE "LocalAdminAccount" RENAME TO "LocalAccount";
ALTER TABLE "LocalAccount" RENAME CONSTRAINT "LocalAdminAccount_pkey" TO "LocalAccount_pkey";
ALTER INDEX "LocalAdminAccount_username_key" RENAME TO "LocalAccount_username_key";

ALTER TABLE "LocalAccount" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "LocalAccount" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;
ALTER TABLE "LocalAccount" ALTER COLUMN "username" DROP DEFAULT;

ALTER TABLE "LocalAccount" ADD COLUMN "name" TEXT;
ALTER TABLE "LocalAccount" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'AUDITOR';
ALTER TABLE "LocalAccount" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LocalAccount" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "LocalAccount" ADD COLUMN "mfaBackupCodes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "LocalAccount" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "LocalAccount" SET "role" = 'ADMIN' WHERE "username" = 'admin';

-- CreateTable
CREATE TABLE "SecuritySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "passwordRequireUppercase" BOOLEAN NOT NULL DEFAULT false,
    "passwordRequireNumber" BOOLEAN NOT NULL DEFAULT false,
    "passwordRequireSymbol" BOOLEAN NOT NULL DEFAULT false,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecuritySettings_pkey" PRIMARY KEY ("id")
);
