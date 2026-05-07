import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ResultadoCredencial = {
  id: string;
  credential_code: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  participant_id: string | null;
  event_id: string | null;
  events?: {
    id: string;
    name: string;
  } | null;
  participants?: {
    id: string;
    participant_type: string | null;
    people?: {
      id: string;
      full_name: string | null;
      cpf: string | null;
    } | null;
  } | null;
};

export default function GerenciadorCredenciaisPage() {
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCredencial[]>([]);
  const [buscou, setBuscou] = useState(false);

  function limparCodigo(valor: string) {
    return valor.trim();
  }

  async function buscarCredencial() {
    const code = limparCodigo(codigo);

    if (!code) {
      alert("Digite o número da credencial.");
      return;
    }

    setLoading(true);
    setBuscou(true);
    setResultado([]);

    const { data, error } = await supabase
      .from("external_credentials")
      .select(`
        id,
        credential_code,
        status,
        created_at,
        updated_at,
        participant_id,
        event_id,
        events:event_id (
          id,
          name
        ),
        participants:participant_id (
          id,
          participant_type,
          people:person_id (
            id,
            full_name,
            cpf
          )
        )
      `)
      .ilike("credential_code", `%${code}%`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Erro ao buscar credencial.");
      setLoading(false);
      return;
    }

    setResultado((data || []) as ResultadoCredencial[]);
    setLoading(false);
  }

  async function desativar(id: string) {
    const confirmar = confirm(
      "Deseja realmente desativar esta credencial? Ela deixará de ficar ativa para este participante."
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
      alert("Erro ao desativar credencial.");
      return;
    }

    alert("Credencial desativada com sucesso.");
    buscarCredencial();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gerenciador de Credenciais</h1>

        <p className="text-muted-foreground mt-2">
          Consulte onde uma pulseira, QR ou tag externa está vinculada no banco.
        </p>
      </div>

      <div className="flex gap-4">
        <input
          className="border rounded-md px-4 py-2 w-full bg-background"
          placeholder="Digite o número da credencial. Ex: 05979090"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") buscarCredencial();
          }}
        />

        <button
          onClick={buscarCredencial}
          disabled={loading}
          className="bg-yellow-500 text-black px-6 py-2 rounded-md font-semibold disabled:opacity-60"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      <div className="space-y-4">
        {buscou && resultado.length === 0 && !loading && (
          <div className="border rounded-lg p-6 text-center text-muted-foreground">
            Nenhuma credencial encontrada.
          </div>
        )}

        {resultado.map((item) => {
          const pessoa = item.participants?.people;
          const evento = item.events;
          const ativo = item.status === "active";

          return (
            <div key={item.id} className="border rounded-xl p-5 bg-card">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <p className="text-sm text-muted-foreground">Credencial</p>
                  <p className="font-bold text-2xl">{item.credential_code}</p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold ${
                    ativo
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {ativo ? "ATIVA" : item.status?.toUpperCase()}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Participante</p>
                  <p className="font-bold">
                    {pessoa?.full_name || "Participante não encontrado"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">CPF</p>
                  <p className="font-bold">{pessoa?.cpf || "CPF não encontrado"}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="font-bold">
                    {item.participants?.participant_type || "Não informado"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Evento</p>
                  <p className="font-bold">
                    {evento?.name || "Evento não encontrado"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    ID do participante
                  </p>
                  <p className="font-mono text-xs break-all">
                    {item.participant_id || "Sem participante"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">ID do evento</p>
                  <p className="font-mono text-xs break-all">
                    {item.event_id || "Sem evento"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Criado em</p>
                  <p className="font-bold">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString("pt-BR")
                      : "-"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Atualizado em</p>
                  <p className="font-bold">
                    {item.updated_at
                      ? new Date(item.updated_at).toLocaleString("pt-BR")
                      : "-"}
                  </p>
                </div>
              </div>

              {ativo && (
                <div className="mt-5">
                  <button
                    onClick={() => desativar(item.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
                  >
                    Desativar Credencial
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
