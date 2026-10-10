export type AppointmentStatus = "scheduled" | "cancelled";

export type StaffOption = {
  id: string;
  name: string;
  initials: string;
};

export type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
};

export type Appointment = {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes: string;
};

export type AppointmentInput = Omit<Appointment, "id" | "status">;

export type AppointmentSetup = {
  staff: StaffOption[];
  services: ServiceOption[];
  timeZone: string;
};

export type AppointmentSource = {
  getSetup(): Promise<AppointmentSetup>;
  list(date: string): Promise<Appointment[]>;
  create(input: AppointmentInput): Promise<Appointment>;
  reschedule(id: string, slot: Pick<Appointment, "date" | "time">): Promise<Appointment>;
  cancel(id: string): Promise<Appointment>;
};

export class AppointmentSourceError extends Error {
  constructor(
    public readonly code: "SLOT_TAKEN" | "NOT_FOUND" | "INVALID_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "AppointmentSourceError";
  }
}
