-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `displayName` VARCHAR(80) NOT NULL,
    `locale` VARCHAR(5) NOT NULL DEFAULT 'es',
    `birthDate` DATE NOT NULL,
    `healthDataConsentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthIdentity` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `provider` ENUM('EMAIL', 'GOOGLE') NOT NULL,
    `providerId` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuthIdentity_userId_idx`(`userId`),
    UNIQUE INDEX `AuthIdentity_provider_providerId_key`(`provider`, `providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `familyId` CHAR(36) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userAgent` VARCHAR(255) NULL,

    UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `RefreshToken_userId_idx`(`userId`),
    INDEX `RefreshToken_familyId_idx`(`familyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tier` ENUM('FREE', 'PREMIUM') NOT NULL DEFAULT 'FREE',
    `status` ENUM('ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `provider` ENUM('FAKE', 'STRIPE', 'APPLE', 'GOOGLE_PLAY') NOT NULL DEFAULT 'FAKE',
    `externalId` VARCHAR(255) NULL,
    `currentPeriodEnd` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserAddOn` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `addOn` ENUM('RECIPES', 'FOOD_LOG') NOT NULL,
    `provider` ENUM('FAKE', 'STRIPE', 'APPLE', 'GOOGLE_PLAY') NOT NULL DEFAULT 'FAKE',
    `externalId` VARCHAR(255) NULL,
    `activeUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserAddOn_userId_addOn_key`(`userId`, `addOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AthleteProfile` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `sex` ENUM('MALE', 'FEMALE') NOT NULL,
    `heightCm` SMALLINT NOT NULL,
    `weightKg` DECIMAL(5, 2) NOT NULL,
    `bodyFatPct` DECIMAL(4, 1) NULL,
    `level` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITOR') NOT NULL,
    `goal` ENUM('GENERAL_FITNESS', 'STRENGTH_POWER', 'CONDITIONING', 'TECHNIQUE', 'BODY_COMPOSITION') NOT NULL,
    `activityLevel` ENUM('SEDENTARY', 'LIGHT', 'MODERATE', 'HIGH', 'VERY_HIGH') NOT NULL,
    `daysPerWeek` TINYINT NOT NULL,
    `sessionMinutes` SMALLINT NOT NULL,
    `injuriesNotes` VARCHAR(1000) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AthleteProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfileSport` (
    `profileId` CHAR(36) NOT NULL,
    `sportId` CHAR(36) NOT NULL,
    `level` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITOR') NOT NULL,

    PRIMARY KEY (`profileId`, `sportId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfileEquipment` (
    `profileId` CHAR(36) NOT NULL,
    `equipmentId` CHAR(36) NOT NULL,

    PRIMARY KEY (`profileId`, `equipmentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfileDietRestriction` (
    `profileId` CHAR(36) NOT NULL,
    `restriction` ENUM('VEGETARIAN', 'VEGAN', 'HALAL', 'KOSHER', 'GLUTEN_FREE', 'LACTOSE_FREE', 'NUT_ALLERGY', 'SHELLFISH_ALLERGY', 'EGG_ALLERGY') NOT NULL,

    PRIMARY KEY (`profileId`, `restriction`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sport` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `category` ENUM('STRIKING', 'GRAPPLING') NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Sport_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SportTranslation` (
    `sportId` CHAR(36) NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `description` TEXT NOT NULL,

    PRIMARY KEY (`sportId`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Equipment` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,

    UNIQUE INDEX `Equipment_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquipmentTranslation` (
    `equipmentId` CHAR(36) NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `name` VARCHAR(80) NOT NULL,

    PRIMARY KEY (`equipmentId`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Exercise` (
    `id` CHAR(36) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `category` ENUM('STRENGTH', 'PLYOMETRICS', 'MOBILITY', 'FLEXIBILITY', 'SPORT_DRILL') NOT NULL,
    `difficulty` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED') NOT NULL,
    `measureType` ENUM('REPS', 'TIME', 'ROUNDS', 'DISTANCE') NOT NULL,
    `primaryMuscles` JSON NOT NULL,
    `secondaryMuscles` JSON NOT NULL,
    `defaultSets` TINYINT NULL,
    `defaultReps` VARCHAR(20) NULL,
    `defaultSeconds` SMALLINT NULL,
    `defaultRestSec` SMALLINT NULL,
    `mediaUrl` VARCHAR(500) NULL,
    `mediaType` VARCHAR(10) NULL,
    `thumbnailUrl` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Exercise_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExerciseTranslation` (
    `exerciseId` CHAR(36) NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NOT NULL,
    `steps` JSON NOT NULL,
    `commonMistakes` JSON NOT NULL,
    `tips` JSON NULL,

    PRIMARY KEY (`exerciseId`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExerciseSport` (
    `exerciseId` CHAR(36) NOT NULL,
    `sportId` CHAR(36) NOT NULL,

    PRIMARY KEY (`exerciseId`, `sportId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExerciseEquipment` (
    `exerciseId` CHAR(36) NOT NULL,
    `equipmentId` CHAR(36) NOT NULL,

    PRIMARY KEY (`exerciseId`, `equipmentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanTemplate` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `goal` ENUM('GENERAL_FITNESS', 'STRENGTH_POWER', 'CONDITIONING', 'TECHNIQUE', 'BODY_COMPOSITION') NOT NULL,
    `level` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITOR') NOT NULL,
    `daysPerWeek` TINYINT NOT NULL,
    `definition` JSON NOT NULL,

    UNIQUE INDEX `PlanTemplate_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingPlan` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `source` ENUM('TEMPLATE', 'AI') NOT NULL,
    `templateId` CHAR(36) NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `name` VARCHAR(120) NOT NULL,
    `aiRationale` TEXT NULL,
    `startsOn` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TrainingPlan_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanSession` (
    `id` CHAR(36) NOT NULL,
    `planId` CHAR(36) NOT NULL,
    `dayOfWeek` TINYINT NOT NULL,
    `orderIndex` TINYINT NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `focus` VARCHAR(40) NOT NULL,

    INDEX `PlanSession_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanSessionExercise` (
    `id` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `exerciseId` CHAR(36) NOT NULL,
    `orderIndex` TINYINT NOT NULL,
    `sets` TINYINT NULL,
    `reps` VARCHAR(20) NULL,
    `seconds` SMALLINT NULL,
    `rounds` TINYINT NULL,
    `restSec` SMALLINT NULL,
    `notes` VARCHAR(500) NULL,

    INDEX `PlanSessionExercise_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutLog` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NULL,
    `performedAt` DATETIME(3) NOT NULL,
    `durationMin` SMALLINT NULL,
    `rpe` TINYINT NULL,
    `feeling` TINYINT NULL,
    `notes` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkoutLog_userId_performedAt_idx`(`userId`, `performedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutLogEntry` (
    `id` CHAR(36) NOT NULL,
    `logId` CHAR(36) NOT NULL,
    `exerciseId` CHAR(36) NOT NULL,
    `setIndex` TINYINT NOT NULL,
    `reps` SMALLINT NULL,
    `weightKg` DECIMAL(6, 2) NULL,
    `seconds` SMALLINT NULL,
    `rounds` TINYINT NULL,
    `rpe` TINYINT NULL,

    INDEX `WorkoutLogEntry_logId_idx`(`logId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BodyMetric` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `measuredOn` DATE NOT NULL,
    `weightKg` DECIMAL(5, 2) NULL,
    `bodyFatPct` DECIMAL(4, 1) NULL,
    `waistCm` DECIMAL(5, 1) NULL,
    `sleepHours` DECIMAL(3, 1) NULL,
    `fatigue` TINYINT NULL,
    `notes` VARCHAR(500) NULL,

    UNIQUE INDEX `BodyMetric_userId_measuredOn_key`(`userId`, `measuredOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NutritionPlan` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `kind` ENUM('GENERAL', 'CALCULATED') NOT NULL,
    `kcalTarget` SMALLINT NULL,
    `proteinG` SMALLINT NULL,
    `carbsG` SMALLINT NULL,
    `fatG` SMALLINT NULL,
    `menuTemplateId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NutritionPlan_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuTemplate` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `goal` ENUM('GENERAL_FITNESS', 'STRENGTH_POWER', 'CONDITIONING', 'TECHNIQUE', 'BODY_COMPOSITION') NOT NULL,

    UNIQUE INDEX `MenuTemplate_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuTemplateTranslation` (
    `menuTemplateId` CHAR(36) NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `content` JSON NOT NULL,

    PRIMARY KEY (`menuTemplateId`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanMeal` (
    `id` CHAR(36) NOT NULL,
    `planId` CHAR(36) NOT NULL,
    `dayIndex` TINYINT NOT NULL,
    `slot` VARCHAR(20) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `kcal` SMALLINT NULL,
    `recipeId` CHAR(36) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Recipe` (
    `id` CHAR(36) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `kcal` SMALLINT NOT NULL,
    `proteinG` SMALLINT NOT NULL,
    `carbsG` SMALLINT NOT NULL,
    `fatG` SMALLINT NOT NULL,
    `restrictions` JSON NOT NULL,

    UNIQUE INDEX `Recipe_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecipeTranslation` (
    `recipeId` CHAR(36) NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `ingredients` JSON NOT NULL,
    `steps` JSON NOT NULL,

    PRIMARY KEY (`recipeId`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FoodLogEntry` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `eatenAt` DATETIME(3) NOT NULL,
    `slot` VARCHAR(20) NOT NULL,
    `text` VARCHAR(500) NOT NULL,
    `kcal` SMALLINT NULL,
    `proteinG` SMALLINT NULL,
    `carbsG` SMALLINT NULL,
    `fatG` SMALLINT NULL,

    INDEX `FoodLogEntry_userId_eatenAt_idx`(`userId`, `eatenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WikiArticle` (
    `id` CHAR(36) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `category` ENUM('MACRONUTRIENT', 'MICRONUTRIENT', 'HYDRATION', 'SUPPLEMENT', 'TRAINING_CONCEPT') NOT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WikiArticle_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WikiArticleTranslation` (
    `articleId` CHAR(36) NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `summary` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,
    `sources` JSON NOT NULL,

    PRIMARY KEY (`articleId`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplement` (
    `id` CHAR(36) NOT NULL,
    `articleId` CHAR(36) NOT NULL,
    `evidenceLevel` ENUM('STRONG', 'MODERATE', 'LIMITED', 'INSUFFICIENT') NOT NULL,
    `wadaStatus` ENUM('PERMITTED', 'PROHIBITED', 'MONITORED', 'CHECK_PRODUCT') NOT NULL,

    UNIQUE INDEX `Supplement_articleId_key`(`articleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplementTranslation` (
    `supplementId` CHAR(36) NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `whatItIs` TEXT NOT NULL,
    `purpose` TEXT NOT NULL,
    `dosage` VARCHAR(500) NOT NULL,
    `timing` VARCHAR(500) NOT NULL,
    `sideEffects` TEXT NOT NULL,

    PRIMARY KEY (`supplementId`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NutritionPlanSupplement` (
    `planId` CHAR(36) NOT NULL,
    `supplementId` CHAR(36) NOT NULL,
    `reason` VARCHAR(300) NOT NULL,

    PRIMARY KEY (`planId`, `supplementId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthIdentity` ADD CONSTRAINT `AuthIdentity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserAddOn` ADD CONSTRAINT `UserAddOn_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AthleteProfile` ADD CONSTRAINT `AthleteProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileSport` ADD CONSTRAINT `ProfileSport_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `AthleteProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileSport` ADD CONSTRAINT `ProfileSport_sportId_fkey` FOREIGN KEY (`sportId`) REFERENCES `Sport`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileEquipment` ADD CONSTRAINT `ProfileEquipment_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `AthleteProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileEquipment` ADD CONSTRAINT `ProfileEquipment_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileDietRestriction` ADD CONSTRAINT `ProfileDietRestriction_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `AthleteProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SportTranslation` ADD CONSTRAINT `SportTranslation_sportId_fkey` FOREIGN KEY (`sportId`) REFERENCES `Sport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquipmentTranslation` ADD CONSTRAINT `EquipmentTranslation_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseTranslation` ADD CONSTRAINT `ExerciseTranslation_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseSport` ADD CONSTRAINT `ExerciseSport_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseSport` ADD CONSTRAINT `ExerciseSport_sportId_fkey` FOREIGN KEY (`sportId`) REFERENCES `Sport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseEquipment` ADD CONSTRAINT `ExerciseEquipment_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseEquipment` ADD CONSTRAINT `ExerciseEquipment_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingPlan` ADD CONSTRAINT `TrainingPlan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingPlan` ADD CONSTRAINT `TrainingPlan_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `PlanTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanSession` ADD CONSTRAINT `PlanSession_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `TrainingPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanSessionExercise` ADD CONSTRAINT `PlanSessionExercise_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PlanSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanSessionExercise` ADD CONSTRAINT `PlanSessionExercise_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutLog` ADD CONSTRAINT `WorkoutLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutLog` ADD CONSTRAINT `WorkoutLog_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PlanSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutLogEntry` ADD CONSTRAINT `WorkoutLogEntry_logId_fkey` FOREIGN KEY (`logId`) REFERENCES `WorkoutLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutLogEntry` ADD CONSTRAINT `WorkoutLogEntry_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BodyMetric` ADD CONSTRAINT `BodyMetric_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NutritionPlan` ADD CONSTRAINT `NutritionPlan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NutritionPlan` ADD CONSTRAINT `NutritionPlan_menuTemplateId_fkey` FOREIGN KEY (`menuTemplateId`) REFERENCES `MenuTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MenuTemplateTranslation` ADD CONSTRAINT `MenuTemplateTranslation_menuTemplateId_fkey` FOREIGN KEY (`menuTemplateId`) REFERENCES `MenuTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanMeal` ADD CONSTRAINT `PlanMeal_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `NutritionPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanMeal` ADD CONSTRAINT `PlanMeal_recipeId_fkey` FOREIGN KEY (`recipeId`) REFERENCES `Recipe`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecipeTranslation` ADD CONSTRAINT `RecipeTranslation_recipeId_fkey` FOREIGN KEY (`recipeId`) REFERENCES `Recipe`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FoodLogEntry` ADD CONSTRAINT `FoodLogEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WikiArticleTranslation` ADD CONSTRAINT `WikiArticleTranslation_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `WikiArticle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supplement` ADD CONSTRAINT `Supplement_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `WikiArticle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplementTranslation` ADD CONSTRAINT `SupplementTranslation_supplementId_fkey` FOREIGN KEY (`supplementId`) REFERENCES `Supplement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NutritionPlanSupplement` ADD CONSTRAINT `NutritionPlanSupplement_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `NutritionPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NutritionPlanSupplement` ADD CONSTRAINT `NutritionPlanSupplement_supplementId_fkey` FOREIGN KEY (`supplementId`) REFERENCES `Supplement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
