import { ArbitrosTab } from "@/components/admin/arbitragem/ArbitrosTab";
import ModuleHeader from "@/components/admin/ModuleHeader";

export default function ArbitrosPage() {
  return (
    <div className="space-y-6">
      <ModuleHeader route="/admin/arbitragem" />
      <ArbitrosTab />
    </div>
  );
}
