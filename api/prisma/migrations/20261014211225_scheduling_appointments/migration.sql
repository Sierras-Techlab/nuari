-- Required for tenant-scoped GiST exclusion constraints below.
-- Applying this migration requires CREATE privilege for btree_gist.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingAssignmentKind" AS ENUM ('SPECIFIC', 'ANY', 'NONE');

-- CreateEnum
CREATE TYPE "BookingActorType" AS ENUM ('MEMBER', 'PUBLIC');

-- CreateEnum
CREATE TYPE "BookingCalendarKind" AS ENUM ('BUSINESS', 'STAFF');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "publicBookable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "staffMemberId" UUID,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "schedulingPolicyVersion" INTEGER NOT NULL,
    "slotStepMinutesSnapshot" INTEGER NOT NULL,
    "publicMinNoticeMinutesSnapshot" INTEGER NOT NULL,
    "publicMaxAdvanceDaysSnapshot" INTEGER NOT NULL,
    "publicCancelNoticeMinutesSnapshot" INTEGER NOT NULL,
    "timezoneSnapshot" VARCHAR(100) NOT NULL,
    "serviceSelectionModeSnapshot" "StaffSelectionMode" NOT NULL,
    "assignmentKind" "BookingAssignmentKind" NOT NULL,
    "customerNameSnapshot" VARCHAR(150) NOT NULL,
    "customerPhoneSnapshot" VARCHAR(30),
    "customerEmailSnapshot" VARCHAR(254),
    "serviceNameSnapshot" VARCHAR(150) NOT NULL,
    "staffNameSnapshot" VARCHAR(150),
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "BookingActorType" NOT NULL,
    "createdByMembershipId" UUID,
    "internalNotes" VARCHAR(4000),
    "managementTokenHash" CHAR(64),
    "managementTokenKeyVersion" INTEGER,
    "managementTokenVersion" INTEGER NOT NULL DEFAULT 1,
    "managementTokenExpiresAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "actorType" "BookingActorType" NOT NULL,
    "actorMembershipId" UUID,
    "action" VARCHAR(30) NOT NULL,
    "reasonCode" VARCHAR(40),
    "before" JSONB,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSubmission" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "actorScope" VARCHAR(80) NOT NULL,
    "keyHash" CHAR(64) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "requestHashKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "appointmentId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingCalendar" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "kind" "BookingCalendarKind" NOT NULL,
    "staffMemberId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BookingCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarWeeklyWindow" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "calendarId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "CalendarWeeklyWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarDayOverride" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "calendarId" UUID NOT NULL,
    "localDate" DATE NOT NULL,

    CONSTRAINT "CalendarDayOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarOverrideWindow" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "overrideId" UUID NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "CalendarOverrideWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarTimeOff" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "calendarId" UUID NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "reasonCode" VARCHAR(40) NOT NULL,

    CONSTRAINT "CalendarTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulingSettings" (
    "organizationId" UUID NOT NULL,
    "publicBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "slotStepMinutes" INTEGER NOT NULL DEFAULT 15,
    "publicMinNoticeMinutes" INTEGER NOT NULL DEFAULT 120,
    "publicMaxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "publicCancelNoticeMinutes" INTEGER NOT NULL DEFAULT 120,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SchedulingSettings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_managementTokenHash_key" ON "Appointment"("managementTokenHash");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_startAt_id_idx" ON "Appointment"("organizationId", "startAt", "id");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_staffMemberId_startAt_idx" ON "Appointment"("organizationId", "staffMemberId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_customerId_startAt_id_idx" ON "Appointment"("organizationId", "customerId", "startAt", "id");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_status_startAt_idx" ON "Appointment"("organizationId", "status", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_organizationId_id_key" ON "Appointment"("organizationId", "id");

-- CreateIndex
CREATE INDEX "AppointmentEvent_organizationId_appointmentId_createdAt_id_idx" ON "AppointmentEvent"("organizationId", "appointmentId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "BookingSubmission_organizationId_appointmentId_idx" ON "BookingSubmission"("organizationId", "appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSubmission_organizationId_actorScope_keyHash_key" ON "BookingSubmission"("organizationId", "actorScope", "keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "BookingCalendar_organizationId_id_key" ON "BookingCalendar"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BookingCalendar_organizationId_staffMemberId_key" ON "BookingCalendar"("organizationId", "staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarWeeklyWindow_organizationId_calendarId_weekday_star_key" ON "CalendarWeeklyWindow"("organizationId", "calendarId", "weekday", "startMinute");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDayOverride_organizationId_id_key" ON "CalendarDayOverride"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDayOverride_organizationId_calendarId_localDate_key" ON "CalendarDayOverride"("organizationId", "calendarId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarOverrideWindow_organizationId_overrideId_startMinut_key" ON "CalendarOverrideWindow"("organizationId", "overrideId", "startMinute");

-- CreateIndex
CREATE INDEX "CalendarTimeOff_organizationId_calendarId_startAt_idx" ON "CalendarTimeOff"("organizationId", "calendarId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_id_key" ON "OrganizationMember"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_customerId_fkey" FOREIGN KEY ("organizationId", "customerId") REFERENCES "Customer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_serviceId_fkey" FOREIGN KEY ("organizationId", "serviceId") REFERENCES "Service"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_staffMemberId_fkey" FOREIGN KEY ("organizationId", "staffMemberId") REFERENCES "StaffMember"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_createdByMembershipId_fkey" FOREIGN KEY ("organizationId", "createdByMembershipId") REFERENCES "OrganizationMember"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_organizationId_appointmentId_fkey" FOREIGN KEY ("organizationId", "appointmentId") REFERENCES "Appointment"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_organizationId_actorMembershipId_fkey" FOREIGN KEY ("organizationId", "actorMembershipId") REFERENCES "OrganizationMember"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BookingSubmission" ADD CONSTRAINT "BookingSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BookingSubmission" ADD CONSTRAINT "BookingSubmission_organizationId_appointmentId_fkey" FOREIGN KEY ("organizationId", "appointmentId") REFERENCES "Appointment"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BookingCalendar" ADD CONSTRAINT "BookingCalendar_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BookingCalendar" ADD CONSTRAINT "BookingCalendar_organizationId_staffMemberId_fkey" FOREIGN KEY ("organizationId", "staffMemberId") REFERENCES "StaffMember"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CalendarWeeklyWindow" ADD CONSTRAINT "CalendarWeeklyWindow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CalendarWeeklyWindow" ADD CONSTRAINT "CalendarWeeklyWindow_organizationId_calendarId_fkey" FOREIGN KEY ("organizationId", "calendarId") REFERENCES "BookingCalendar"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CalendarDayOverride" ADD CONSTRAINT "CalendarDayOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CalendarDayOverride" ADD CONSTRAINT "CalendarDayOverride_organizationId_calendarId_fkey" FOREIGN KEY ("organizationId", "calendarId") REFERENCES "BookingCalendar"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CalendarOverrideWindow" ADD CONSTRAINT "CalendarOverrideWindow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CalendarOverrideWindow" ADD CONSTRAINT "CalendarOverrideWindow_organizationId_overrideId_fkey" FOREIGN KEY ("organizationId", "overrideId") REFERENCES "CalendarDayOverride"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CalendarTimeOff" ADD CONSTRAINT "CalendarTimeOff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CalendarTimeOff" ADD CONSTRAINT "CalendarTimeOff_organizationId_calendarId_fkey" FOREIGN KEY ("organizationId", "calendarId") REFERENCES "BookingCalendar"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SchedulingSettings" ADD CONSTRAINT "SchedulingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Domain checks that Prisma cannot express in schema.prisma.
ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_positive_duration"
    CHECK ("endAt" > "startAt"
      AND "durationMinutes" BETWEEN 5 AND 720
      AND "endAt" = "startAt" + "durationMinutes" * INTERVAL '1 minute'),
  ADD CONSTRAINT "appointment_assignment_shape"
    CHECK (("assignmentKind" = 'NONE'
        AND "staffMemberId" IS NULL
        AND "serviceSelectionModeSnapshot" = 'NO_ASSIGNMENT')
      OR ("assignmentKind" IN ('SPECIFIC', 'ANY')
        AND "staffMemberId" IS NOT NULL
        AND "serviceSelectionModeSnapshot" IN ('CUSTOMER_CHOICE', 'AUTO_ASSIGN')
        AND ("serviceSelectionModeSnapshot" <> 'AUTO_ASSIGN' OR "assignmentKind" = 'ANY'))),
  ADD CONSTRAINT "appointment_policy_snapshot_bounds"
    CHECK ("schedulingPolicyVersion" > 0
      AND "slotStepMinutesSnapshot" IN (5, 10, 15, 30)
      AND "publicMinNoticeMinutesSnapshot" BETWEEN 0 AND 43200
      AND "publicMaxAdvanceDaysSnapshot" BETWEEN 1 AND 365
      AND "publicCancelNoticeMinutesSnapshot" BETWEEN 0 AND 43200),
  ADD CONSTRAINT "appointment_version_positive"
    CHECK ("version" > 0 AND "managementTokenVersion" > 0
      AND ("managementTokenKeyVersion" IS NULL OR "managementTokenKeyVersion" > 0)),
  ADD CONSTRAINT "appointment_token_fields_coherent"
    CHECK (("managementTokenHash" IS NULL
        AND "managementTokenKeyVersion" IS NULL
        AND "managementTokenExpiresAt" IS NULL)
      OR ("managementTokenHash" IS NOT NULL
        AND "managementTokenKeyVersion" IS NOT NULL
        AND "managementTokenHash" ~ '^[0-9a-f]{64}$'
        AND "managementTokenExpiresAt" IS NOT NULL)),
  ADD CONSTRAINT "appointment_token_expiry_bound"
    CHECK ("managementTokenExpiresAt" IS NULL
      OR ("managementTokenExpiresAt" >= "endAt"
        AND "managementTokenExpiresAt" <= "endAt" + INTERVAL '720 hours')),
  ADD CONSTRAINT "appointment_source_actor_shape"
    CHECK (("source" = 'MEMBER'
        AND "createdByMembershipId" IS NOT NULL
        AND "managementTokenHash" IS NULL)
      OR ("source" = 'PUBLIC' AND "createdByMembershipId" IS NULL));

ALTER TABLE "AppointmentEvent"
  ADD CONSTRAINT "appointment_event_actor_shape"
    CHECK (("actorType" = 'MEMBER' AND "actorMembershipId" IS NOT NULL)
      OR ("actorType" = 'PUBLIC' AND "actorMembershipId" IS NULL)),
  ADD CONSTRAINT "appointment_event_action_allowed"
    CHECK ("action" IN ('CREATED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'CORRECTED', 'MANAGEMENT_LINK_REVOKED')),
  ADD CONSTRAINT "appointment_event_correction_audited"
    CHECK ("action" <> 'CORRECTED'
      OR ("actorType" = 'MEMBER' AND "actorMembershipId" IS NOT NULL
        AND "reasonCode" IS NOT NULL AND length(btrim("reasonCode")) > 0));

ALTER TABLE "BookingSubmission"
  ADD CONSTRAINT "booking_submission_scope_valid"
    CHECK ("actorScope" = 'PUBLIC'
      OR "actorScope" ~ '^MEMBER:[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'),
  ADD CONSTRAINT "booking_submission_hashes_sha256"
    CHECK ("keyHash" ~ '^[0-9a-f]{64}$' AND "requestHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "booking_submission_key_version_positive"
    CHECK ("requestHashKeyVersion" > 0);

ALTER TABLE "BookingCalendar"
  ADD CONSTRAINT "booking_calendar_kind_staff_shape"
    CHECK (("kind" = 'BUSINESS' AND "staffMemberId" IS NULL)
      OR ("kind" = 'STAFF' AND "staffMemberId" IS NOT NULL)),
  ADD CONSTRAINT "booking_calendar_version_positive" CHECK ("version" > 0);

CREATE UNIQUE INDEX "BookingCalendar_one_business_per_organization"
  ON "BookingCalendar" ("organizationId") WHERE "kind" = 'BUSINESS';

ALTER TABLE "CalendarWeeklyWindow"
  ADD CONSTRAINT "calendar_weekly_window_bounds"
    CHECK ("weekday" BETWEEN 0 AND 6
      AND "startMinute" BETWEEN 0 AND 1439
      AND "endMinute" BETWEEN 1 AND 1440
      AND "endMinute" > "startMinute");

ALTER TABLE "CalendarOverrideWindow"
  ADD CONSTRAINT "calendar_override_window_bounds"
    CHECK ("startMinute" BETWEEN 0 AND 1439
      AND "endMinute" BETWEEN 1 AND 1440
      AND "endMinute" > "startMinute");

ALTER TABLE "CalendarTimeOff"
  ADD CONSTRAINT "calendar_time_off_positive_duration"
    CHECK ("endAt" > "startAt"
      AND length(btrim("reasonCode")) > 0);

ALTER TABLE "SchedulingSettings"
  ADD CONSTRAINT "scheduling_settings_values_valid"
    CHECK ("slotStepMinutes" IN (5, 10, 15, 30)
      AND "publicMinNoticeMinutes" BETWEEN 0 AND 43200
      AND "publicMaxAdvanceDays" BETWEEN 1 AND 365
      AND "publicCancelNoticeMinutes" BETWEEN 0 AND 43200
      AND "version" > 0);

ALTER TABLE "CalendarWeeklyWindow"
  ADD CONSTRAINT "calendar_weekly_window_no_overlap"
    EXCLUDE USING gist (
      "organizationId" WITH =,
      "calendarId" WITH =,
      "weekday" WITH =,
      int4range("startMinute", "endMinute", '[)') WITH &&
    );

ALTER TABLE "CalendarOverrideWindow"
  ADD CONSTRAINT "calendar_override_window_no_overlap"
    EXCLUDE USING gist (
      "organizationId" WITH =,
      "overrideId" WITH =,
      int4range("startMinute", "endMinute", '[)') WITH &&
    );

ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_staff_no_overlap"
    EXCLUDE USING gist (
      "organizationId" WITH =,
      "staffMemberId" WITH =,
      tstzrange("startAt", "endAt", '[)') WITH &&
    ) WHERE ("staffMemberId" IS NOT NULL AND "status" <> 'CANCELLED'),
  ADD CONSTRAINT "appointment_unassigned_service_no_overlap"
    EXCLUDE USING gist (
      "organizationId" WITH =,
      "serviceId" WITH =,
      tstzrange("startAt", "endAt", '[)') WITH &&
    ) WHERE ("assignmentKind" = 'NONE' AND "status" <> 'CANCELLED');

-- Supports the approved daily balancing count by business-local start range.
CREATE INDEX "Appointment_assignment_daily_load_idx"
  ON "Appointment" ("organizationId", "staffMemberId", "startAt")
  WHERE "status" IN ('CONFIRMED', 'COMPLETED');

