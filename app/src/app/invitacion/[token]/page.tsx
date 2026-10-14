import type { Metadata } from "next";

import { InvitationScreen } from "@/features/invitations/invitation-screen";

export const metadata: Metadata = {
  title: "Aceptar Invitación | Nuari",
  description: "Unite a tu equipo y comenzá a operar en Nuari.",
};

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitationScreen token={token} />;
}
