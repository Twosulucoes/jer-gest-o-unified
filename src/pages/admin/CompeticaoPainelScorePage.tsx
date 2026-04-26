import { useParams } from "react-router-dom";
import ModuleHeader from "@/components/admin/ModuleHeader";

export default function CompeticaoPainelScorePage() {
  const { sportEventId } = useParams();
  
  return (
    <div className="space-y-6">
      <ModuleHeader 
        route="/admin/competicao/painel" 
        title="Painel Score"
        backFallbackTo="/admin/competicao/painel"
      />
      <div className="p-8 text-center border-2 border-dashed rounded-lg">
        Painel para a modalidade {sportEventId} em desenvolvimento...
      </div>
    </div>
  );
}
