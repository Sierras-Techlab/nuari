import type { Metadata } from "next";

import { PublicBookingScreen } from "@/features/public-booking/public-booking-screen";

export const metadata: Metadata = {
  title: "Reservar turno | Nuari",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PublicBookingPage({ params }: PageProps<"/reservar/[slug]">) {
  const { slug } = await params;
  return <PublicBookingScreen key={slug} slug={slug} />;
}
