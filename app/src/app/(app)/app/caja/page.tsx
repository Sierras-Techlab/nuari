import type { Metadata } from "next";

import { CashScreen } from "@/features/workspace/cash-screen";
import { guardPage } from "@/lib/auth/server";
import { AccessError } from "@/features/access/access-error";

export const metadata: Metadata = { title: "Caja | Nuari", description: "Registro de movimientos de caja de Nuari." };

export default async function CashPage() { if (!await guardPage("business")) return <AccessError />; return <CashScreen />; }
