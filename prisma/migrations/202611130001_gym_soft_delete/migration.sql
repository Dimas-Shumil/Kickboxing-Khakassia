-- Non-destructive removal: existing rows and all history remain intact.
ALTER TABLE "Student" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "TrainingGroup" ADD COLUMN "deletedAt" DATETIME;
