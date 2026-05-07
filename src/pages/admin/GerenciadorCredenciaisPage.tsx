import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function GerenciadorCredenciaisPage() {
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any[]>([]);

  async function buscarCredencial() {
    if (!codigo) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("external_credentials")
      .select(`
        id,
        credential_code,
        status,
        created_at,
        participant_id,
        event_id
      `)
      .eq("credential_code", codigo);

    if (error) {
      console.error(error);
      alert("Erro ao buscar credencial");
      setLoading(false);
      return;
    }

    setResultado(data || []);
    setLoading(false);
  }

  async function desativar(id: string) {
    const confirmar = confirm(
      "Deseja realmente desativar esta credencial?"
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("external_credentials")
      .update({
        status: "inactive",
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Erro ao desativar");
      return;
    }

    alert("Credencial desativada com sucesso");

    buscarCredencial();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Gerenciador de Credenciais
        </h1>

        <p className="text-muted-foreground mt-2">
          Consulte vínculos de pulseiras, QR e tags externas.
        </p>
      </div>

      <div className="flex gap-4">
        <input
          className="border rounded-md px-4 py-2 w-full bg-background"
          placeholder="Digite o número da credencial"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />

        <button
          onClick={buscarCredencial}
          className="bg-yellow-500 text-black px-6 py-2 rounded-md font-semibold"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      <div className="space-y-4">
        {resultado.length === 0 && !loading && (
          <div className="border rounded-lg p-6 text-center text-muted-foreground">
            Nenhuma credencial encontrada
          </div>
        )}

        {resultado.map((item) => (
          <div
            key={item.id}
            className="border rounded-xl p-5 bg-card"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Credencial
                </p>

                <p className="font-bold text-lg">
                  {item.credential_code}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Status
                </p>

                <p className="font-bold">
                  {item.status}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Participante
                </p>

                <p className="font-bold break-all">
                  {item.participant_id}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Evento
                </p>

                <p className="font-bold break-all">
                  {item.event_id}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Criado em
                </p>

                <p className="font-bold">
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={() => desativar(item.id)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
              >
                Desativar Credencial
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
