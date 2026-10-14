-- CreateEnum
CREATE TYPE "ServicePricingType" AS ENUM ('FIXED', 'FROM', 'ON_REQUEST');

-- CreateEnum
CREATE TYPE "StaffSelectionMode" AS ENUM ('CUSTOMER_CHOICE', 'AUTO_ASSIGN', 'NO_ASSIGNMENT');

-- CreateEnum
CREATE TYPE "ServiceModality" AS ENUM ('IN_PERSON');

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30),
    "phoneNormalized" VARCHAR(30),
    "email" VARCHAR(254),
    "notes" VARCHAR(4000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "nameKey" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "nameKey" VARCHAR(150) NOT NULL,
    "description" VARCHAR(2000),
    "durationMinutes" INTEGER NOT NULL,
    "pricingType" "ServicePricingType" NOT NULL DEFAULT 'ON_REQUEST',
    "price" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL,
    "categoryId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "staffSelectionMode" "StaffSelectionMode" NOT NULL,
    "modality" "ServiceModality" NOT NULL DEFAULT 'IN_PERSON',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(30),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "userId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffService" (
    "organizationId" UUID NOT NULL,
    "staffMemberId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffService_pkey" PRIMARY KEY ("organizationId","staffMemberId","serviceId")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_active_createdAt_id_idx" ON "Customer"("organizationId", "active", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Customer_organizationId_email_idx" ON "Customer"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Customer_organizationId_phoneNormalized_idx" ON "Customer"("organizationId", "phoneNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_id_key" ON "Customer"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ServiceCategory_organizationId_active_sortOrder_id_idx" ON "ServiceCategory"("organizationId", "active", "sortOrder", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_organizationId_id_key" ON "ServiceCategory"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_organizationId_nameKey_key" ON "ServiceCategory"("organizationId", "nameKey");

-- CreateIndex
CREATE INDEX "Service_organizationId_active_sortOrder_id_idx" ON "Service"("organizationId", "active", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "Service_organizationId_categoryId_active_idx" ON "Service"("organizationId", "categoryId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Service_organizationId_id_key" ON "Service"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Service_organizationId_nameKey_key" ON "Service"("organizationId", "nameKey");

-- CreateIndex
CREATE INDEX "StaffMember_organizationId_active_name_id_idx" ON "StaffMember"("organizationId", "active", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_organizationId_id_key" ON "StaffMember"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_organizationId_userId_key" ON "StaffMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "StaffService_organizationId_serviceId_staffMemberId_idx" ON "StaffService"("organizationId", "serviceId", "staffMemberId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_organizationId_categoryId_fkey" FOREIGN KEY ("organizationId", "categoryId") REFERENCES "ServiceCategory"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_organizationId_staffMemberId_fkey" FOREIGN KEY ("organizationId", "staffMemberId") REFERENCES "StaffMember"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_organizationId_serviceId_fkey" FOREIGN KEY ("organizationId", "serviceId") REFERENCES "Service"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Keep domain invariants enforced for direct SQL and future API paths.
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_name_nonempty_check" CHECK (char_length(btrim("name")) > 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_version_positive_check" CHECK ("version" >= 1);

ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_name_nonempty_check" CHECK (char_length(btrim("name")) > 0);
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_nameKey_nonempty_check" CHECK (char_length(btrim("nameKey")) > 0);
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_sortOrder_range_check" CHECK ("sortOrder" BETWEEN 0 AND 1000000);
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_version_positive_check" CHECK ("version" >= 1);

ALTER TABLE "Service" ADD CONSTRAINT "Service_name_nonempty_check" CHECK (char_length(btrim("name")) > 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_nameKey_nonempty_check" CHECK (char_length(btrim("nameKey")) > 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_durationMinutes_range_check" CHECK ("durationMinutes" BETWEEN 5 AND 720);
ALTER TABLE "Service" ADD CONSTRAINT "Service_currency_format_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "Service" ADD CONSTRAINT "Service_sortOrder_range_check" CHECK ("sortOrder" BETWEEN 0 AND 1000000);
ALTER TABLE "Service" ADD CONSTRAINT "Service_version_positive_check" CHECK ("version" >= 1);
ALTER TABLE "Service" ADD CONSTRAINT "Service_price_by_pricing_type_check" CHECK (
    ("pricingType" = 'ON_REQUEST' AND "price" IS NULL)
    OR ("pricingType" IN ('FIXED', 'FROM') AND "price" IS NOT NULL AND "price" >= 0 AND "price" <= 9999999999.99)
);

ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_name_nonempty_check" CHECK (char_length(btrim("name")) > 0);
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_version_positive_check" CHECK ("version" >= 1);
