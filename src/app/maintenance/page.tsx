import { MaintenanceGate } from "@/components/maintenance-gate";

export const metadata = {
  title: "Maintenance | animeTVplus",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MaintenancePage() {
  return <MaintenanceGate />;
}

