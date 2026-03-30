-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('idle', 'generating', 'active', 'solved', 'failed');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'suspect', 'system');

-- CreateTable
CREATE TABLE "MurderCase" (
    "id" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "storySummary" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "victimName" TEXT NOT NULL,
    "victimBodyFoundRoom" TEXT NOT NULL,
    "victimTimeOfDeath" TEXT NOT NULL,
    "victimMurderWound" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'generating',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solvedAt" TIMESTAMP(3),
    "finalOutcome" TEXT,
    "generationProgress" INTEGER NOT NULL DEFAULT 0,
    "generationStepLabel" TEXT NOT NULL,

    CONSTRAINT "MurderCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suspect" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isGuilty" BOOLEAN NOT NULL,
    "relationshipToVictim" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "quirkBehavior" TEXT,
    "motive" TEXT NOT NULL,
    "alibi" TEXT NOT NULL,
    "privateBackstory" TEXT NOT NULL,
    "publicDemeanor" TEXT NOT NULL,
    "knowsMotiveOfSuspectName" TEXT NOT NULL,

    CONSTRAINT "Suspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Weapon" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "belongsToSuspectId" TEXT,
    "seenBySuspectNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isMurderWeapon" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Weapon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveredWeapon" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "weaponId" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discoveredBySuspectId" TEXT,

    CONSTRAINT "DiscoveredWeapon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuessAttempt" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "guessedSuspectId" TEXT NOT NULL,
    "guessedWeaponId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "guessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuessAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuessCooldown" (
    "caseId" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "GuessCooldown_pkey" PRIMARY KEY ("caseId")
);

-- CreateTable
CREATE TABLE "SuspectRelationship" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "suspectId" TEXT NOT NULL,
    "relatedSuspectId" TEXT NOT NULL,
    "relationshipDescription" TEXT NOT NULL,

    CONSTRAINT "SuspectRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "suspectId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suspect_caseId_idx" ON "Suspect"("caseId");

-- CreateIndex
CREATE INDEX "Weapon_caseId_idx" ON "Weapon"("caseId");

-- CreateIndex
CREATE INDEX "Weapon_belongsToSuspectId_idx" ON "Weapon"("belongsToSuspectId");

-- CreateIndex
CREATE INDEX "DiscoveredWeapon_caseId_idx" ON "DiscoveredWeapon"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredWeapon_caseId_weaponId_key" ON "DiscoveredWeapon"("caseId", "weaponId");

-- CreateIndex
CREATE INDEX "GuessAttempt_caseId_idx" ON "GuessAttempt"("caseId");

-- CreateIndex
CREATE INDEX "GuessAttempt_guessedAt_idx" ON "GuessAttempt"("guessedAt");

-- CreateIndex
CREATE INDEX "GuessCooldown_lockedUntil_idx" ON "GuessCooldown"("lockedUntil");

-- CreateIndex
CREATE INDEX "SuspectRelationship_caseId_idx" ON "SuspectRelationship"("caseId");

-- CreateIndex
CREATE INDEX "SuspectRelationship_suspectId_idx" ON "SuspectRelationship"("suspectId");

-- CreateIndex
CREATE INDEX "SuspectRelationship_relatedSuspectId_idx" ON "SuspectRelationship"("relatedSuspectId");

-- CreateIndex
CREATE INDEX "ChatMessage_caseId_suspectId_createdAt_idx" ON "ChatMessage"("caseId", "suspectId", "createdAt");

-- AddForeignKey
ALTER TABLE "Suspect" ADD CONSTRAINT "Suspect_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MurderCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weapon" ADD CONSTRAINT "Weapon_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MurderCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weapon" ADD CONSTRAINT "Weapon_belongsToSuspectId_fkey" FOREIGN KEY ("belongsToSuspectId") REFERENCES "Suspect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredWeapon" ADD CONSTRAINT "DiscoveredWeapon_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MurderCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredWeapon" ADD CONSTRAINT "DiscoveredWeapon_weaponId_fkey" FOREIGN KEY ("weaponId") REFERENCES "Weapon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuessAttempt" ADD CONSTRAINT "GuessAttempt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MurderCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuessCooldown" ADD CONSTRAINT "GuessCooldown_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MurderCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspectRelationship" ADD CONSTRAINT "SuspectRelationship_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MurderCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspectRelationship" ADD CONSTRAINT "SuspectRelationship_suspectId_fkey" FOREIGN KEY ("suspectId") REFERENCES "Suspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspectRelationship" ADD CONSTRAINT "SuspectRelationship_relatedSuspectId_fkey" FOREIGN KEY ("relatedSuspectId") REFERENCES "Suspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MurderCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_suspectId_fkey" FOREIGN KEY ("suspectId") REFERENCES "Suspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
