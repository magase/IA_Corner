-- AlterTable
ALTER TABLE `NutritionPlan` ADD COLUMN `guidelines` JSON NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `PlanSessionExercise` ADD COLUMN `block` VARCHAR(20) NOT NULL DEFAULT 'MAIN';

-- AlterTable
ALTER TABLE `TrainingPlan` ADD COLUMN `generatorVersion` VARCHAR(20) NULL,
    ADD COLUMN `params` JSON NULL;
