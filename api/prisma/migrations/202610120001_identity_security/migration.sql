CREATE TABLE "User" (
  "id" UUID PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
  "emailVerifiedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "User_email_normalized" CHECK ("email" = lower(btrim("email"))),
  CONSTRAINT "User_name_length" CHECK (length("name") BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "UserCredential" (
  "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "passwordHash" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "passwordChangedAt" TIMESTAMPTZ(3) NOT NULL, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "UserCredential_version_positive" CHECK ("version" > 0)
);
CREATE TABLE "Session" (
  "id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tokenHash" CHAR(64) NOT NULL, "credentialVersion" INTEGER NOT NULL, "activeOrganizationId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL, "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL, "revokedAt" TIMESTAMPTZ(3),
  CONSTRAINT "Session_version_positive" CHECK ("credentialVersion" > 0),
  CONSTRAINT "Session_expiration" CHECK ("expiresAt" > "createdAt")
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE TABLE "EmailVerificationToken" (
  "id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tokenHash" CHAR(64) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL, "consumedAt" TIMESTAMPTZ(3),
  CONSTRAINT "EmailVerificationToken_expiration" CHECK ("expiresAt" > "createdAt")
);
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_consumedAt_idx" ON "EmailVerificationToken"("userId", "consumedAt");
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");
CREATE TABLE "PasswordResetToken" (
  "id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tokenHash" CHAR(64) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL, "consumedAt" TIMESTAMPTZ(3),
  CONSTRAINT "PasswordResetToken_expiration" CHECK ("expiresAt" > "createdAt")
);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_consumedAt_idx" ON "PasswordResetToken"("userId", "consumedAt");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE TABLE "RateLimitBucket" (
  "scope" TEXT NOT NULL, "keyHash" CHAR(64) NOT NULL,
  "windowStartedAt" TIMESTAMPTZ(3) NOT NULL, "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("scope", "keyHash", "windowStartedAt"),
  CONSTRAINT "RateLimitBucket_count_positive" CHECK ("count" > 0)
);
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
