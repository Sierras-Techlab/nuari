CREATE TYPE "PlanCode" AS ENUM ('BASIC', 'PRO', 'BUSINESS', 'TOURISM');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'EXPIRED', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TABLE "Subscription" (
  "id" UUID PRIMARY KEY, "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "planCode" "PlanCode" NOT NULL, "status" "SubscriptionStatus" NOT NULL,
  "trialStartedAt" TIMESTAMPTZ(3) NOT NULL, "trialEndsAt" TIMESTAMPTZ(3) NOT NULL, "paidThrough" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Subscription_exact_trial" CHECK ("trialEndsAt" = "trialStartedAt" + interval '336 hours'),
  CONSTRAINT "Subscription_active_paid" CHECK ("status" <> 'ACTIVE' OR "paidThrough" IS NOT NULL)
);
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");
CREATE INDEX "Subscription_status_trialEndsAt_idx" ON "Subscription"("status", "trialEndsAt");
CREATE TABLE "TrialGrant" (
  "id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "grantedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "TrialGrant_userId_key" ON "TrialGrant"("userId");
CREATE UNIQUE INDEX "TrialGrant_organizationId_key" ON "TrialGrant"("organizationId");
CREATE TABLE "OnboardingSubmission" (
  "id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "key" UUID NOT NULL, "requestHash" CHAR(64) NOT NULL CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "OnboardingSubmission_userId_key_key" ON "OnboardingSubmission"("userId", "key");
CREATE UNIQUE INDEX "OnboardingSubmission_organizationId_key" ON "OnboardingSubmission"("organizationId");
