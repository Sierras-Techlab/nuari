import type { Metadata } from "next";

import { CashScreen } from "@/features/workspace/cash-screen";

export const metadata: Metadata = { title: "Caja | Nuari", description: "Registro de movimientos de caja de Nuari." };

export default function CashPage() { return <CashScreen />; }
