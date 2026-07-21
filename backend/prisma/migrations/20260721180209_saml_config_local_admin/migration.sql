-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'AUDITOR', 'LEITOR');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('ABERTO', 'EM_TRATAMENTO', 'MITIGADO', 'ACEITO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "samlNameId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'AUDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Framework" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,

    CONSTRAINT "Framework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Control" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titlePt" TEXT NOT NULL,
    "descPt" TEXT NOT NULL,

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Safeguard" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titlePt" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "questionPt" TEXT NOT NULL,
    "examplesPt" TEXT[],
    "evidenceHintPt" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "securityFunction" TEXT NOT NULL,
    "ig1" BOOLEAN NOT NULL DEFAULT false,
    "ig2" BOOLEAN NOT NULL DEFAULT false,
    "ig3" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Safeguard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeIg" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentItem" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "safeguardId" TEXT NOT NULL,
    "maturity" INTEGER,
    "na" BOOLEAN NOT NULL DEFAULT false,
    "evidenceText" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT,
    "size" INTEGER,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "probInherent" INTEGER NOT NULL DEFAULT 3,
    "impactInherent" INTEGER NOT NULL DEFAULT 3,
    "probResidual" INTEGER NOT NULL DEFAULT 3,
    "impactResidual" INTEGER NOT NULL DEFAULT 3,
    "ownerName" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'ABERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskControl" (
    "riskId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,

    CONSTRAINT "RiskControl_pkey" PRIMARY KEY ("riskId","controlId")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assignee" TEXT,
    "dueDate" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SamlConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "entryPoint" TEXT,
    "issuer" TEXT NOT NULL DEFAULT 'sentinela-cis',
    "callbackUrl" TEXT,
    "idpCert" TEXT,
    "wantAssertionsSigned" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SamlConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalAdminAccount" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "username" TEXT NOT NULL DEFAULT 'admin',
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalAdminAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_samlNameId_key" ON "User"("samlNameId");

-- CreateIndex
CREATE UNIQUE INDEX "Framework_code_key" ON "Framework"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Control_frameworkId_number_key" ON "Control"("frameworkId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Safeguard_code_key" ON "Safeguard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentItem_assessmentId_safeguardId_key" ON "AssessmentItem"("assessmentId", "safeguardId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAdminAccount_username_key" ON "LocalAdminAccount"("username");

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Safeguard" ADD CONSTRAINT "Safeguard_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_safeguardId_fkey" FOREIGN KEY ("safeguardId") REFERENCES "Safeguard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AssessmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
