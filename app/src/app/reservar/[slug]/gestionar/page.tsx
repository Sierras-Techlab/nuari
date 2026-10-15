import type { Metadata } from "next";

import { PublicBookingManagementScreen } from "@/features/public-booking/public-booking-management-screen";

export const metadata: Metadata = {
  title: "Gestionar reserva | Nuari",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PublicBookingManagementPage({ params }: PageProps<"/reservar/[slug]/gestionar">) {
  const { slug } = await params;
  return <PublicBookingManagementScreen key={slug} slug={slug} />;
}
