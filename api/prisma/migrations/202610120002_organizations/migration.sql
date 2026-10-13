CREATE TYPE "BusinessType" AS ENUM ('SERVICES', 'COMMERCE', 'HOSPITALITY');
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'EMPLOYEE');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TABLE "Organization" (
  "id" UUID PRIMARY KEY, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "businessType" "BusinessType" NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Organization_slug_valid" CHECK (length("slug") BETWEEN 3 AND 63 AND "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND "slug" NOT IN ('api','app','login','register','onboarding','admin','www','support','nuari')),
  CONSTRAINT "Organization_name_length" CHECK (length("name") BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE TABLE "OrganizationMember" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "role" "OrganizationRole" NOT NULL, "status" "MembershipStatus" NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "OrganizationMember_userId_organizationId_key" ON "OrganizationMember"("userId", "organizationId");
CREATE INDEX "OrganizationMember_userId_status_idx" ON "OrganizationMember"("userId", "status");
CREATE INDEX "OrganizationMember_organizationId_status_idx" ON "OrganizationMember"("organizationId", "status");
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
