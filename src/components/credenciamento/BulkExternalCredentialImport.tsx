import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { read, utils } from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface BulkExternalCredentialImportProps {
  eventId: string;
  onSuccess: () => void;
}

// Normaliza cabeçalho da planilha: remove acentos, traços/underscores e
// caixa. "Código", "CÓDIGO", "credencial", "Credential-Code" → todos
// caem em "CODIGO" / "CREDENCIALCODE" / "CREDENCIAL" / etc.
const normalizeHeader = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

const CPF_HEADER_TOKENS = new Set(["CPF"]);
const CODE_HEADER_TOKENS = new Set([
  "CREDENTIAL",
  "CREDENTIALCODE",
  "CODIGO",
  "CODIGOCREDENCIAL",
  "CREDENCIAL",
  "CODIGODACREDENCIAL",
  "CODIGOCRED",
]);

export function BulkExternalCredentialImport({ eventId, onSuccess }: BulkExternalCredentialImportProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    setResults(null);
    const errors: Array<{ row: number; error: string }> = [];
    let successCount = 0;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = utils.sheet_to_json(sheet) as any[];

      if (rows.length === 0) {
        toast.error("Planilha vazia");
        setLoading(false);
        return;
      }

      // Procura por colunas de identificação. Normaliza headers para
      // tolerar acentos ("CÓDIGO"), espaços ("Credential Code") e
      // separadores ("Credential-Code"). Sem isso, planilhas exportadas
      // com cabeçalho em português eram silenciosamente rejeitadas.
      const firstRow = rows[0];
      const headerKeys = Object.keys(firstRow);
      const cpfCol = headerKeys.find((k) => CPF_HEADER_TOKENS.has(normalizeHeader(k)));
      const codeCol = headerKeys.find((k) => CODE_HEADER_TOKENS.has(normalizeHeader(k)));

      if (!cpfCol || !codeCol) {
        toast.error(
          `Colunas obrigatórias não encontradas. Esperado 'CPF' e 'CREDENCIAL' (ou CÓDIGO). Cabeçalhos lidos: ${headerKeys.join(", ") || "(vazio)"}`,
          { duration: 8000 },
        );
        setLoading(false);
        return;
      }

      for (let i = 0; i < rows.length; i++) {
        const rowData = rows[i];
        const cpfRaw = String(rowData[cpfCol]).replace(/\D/g, "");
        const code = String(rowData[codeCol]).trim();

        if (!cpfRaw || !code) {
          errors.push({ row: i + 2, error: "CPF ou Código ausente" });
          continue;
        }

        // 1. Buscar participante pelo CPF
        const { data: person, error: personError } = await supabase
          .from("people")
          .select("id")
          .eq("cpf", cpfRaw)
          .maybeSingle();

        if (personError || !person) {
          errors.push({ row: i + 2, error: `Pessoa com CPF ${cpfRaw} não encontrada` });
          continue;
        }

        // Pode haver mais de 1 participação por pessoa no mesmo evento
        // (atleta+técnico, atleta+chefe). maybeSingle() falhava em
        // "more than one row" e a linha era rejeitada como "não é
        // participante". Agora pegamos todos e tratamos os 3 casos.
        const { data: participantRows, error: partError } = await supabase
          .from("participants")
          .select("id, participant_type, is_active")
          .eq("person_id", person.id)
          .eq("event_id", eventId);

        if (partError) {
          errors.push({ row: i + 2, error: `Erro ao buscar participação (CPF ${cpfRaw}): ${partError.message}` });
          continue;
        }

        const activeRows = (participantRows ?? []).filter((p: any) => p.is_active !== false);
        if (activeRows.length === 0) {
          errors.push({ row: i + 2, error: `Pessoa com CPF ${cpfRaw} não é participante deste evento` });
          continue;
        }
        if (activeRows.length > 1) {
          const types = activeRows.map((p: any) => p.participant_type).join(", ");
          errors.push({
            row: i + 2,
            error: `Pessoa com CPF ${cpfRaw} tem ${activeRows.length} participações ativas (${types}). Vincule manualmente para escolher qual receberá a credencial.`,
          });
          continue;
        }
        const participant = activeRows[0];

        // 2. Verificar se já possui credencial externa ativa neste evento.
        // Faltava o .eq('event_id') — sem ele, podia pegar credencial
        // de outro evento e passar como p_replace_id (corrupção de estado).
        const { data: existingCred } = await supabase
          .from("external_credentials")
          .select("id")
          .eq("participant_id", participant.id)
          .eq("event_id", eventId)
          .eq("status", "active")
          .maybeSingle();

        // 3. Vincular credencial usando a RPC. Após L2, a RPC já devolve
        // mensagens humanas via EXCEPTION handler — confiamos em
        // error.message direto, sem string-matching de constraint name.
        const { error: linkError } = await (supabase as any).rpc("link_external_credential", {
          p_event_id: eventId,
          p_participant_id: participant.id,
          p_credential_code: code,
          p_user_id: user.id,
          p_replace_id: existingCred?.id ?? null,
          p_is_internal_mode: false,
        });

        if (linkError) {
          errors.push({ row: i + 2, error: linkError.message || "Erro desconhecido" });
        } else {
          successCount++;
        }
      }

      setResults({ success: successCount, errors });
      if (successCount > 0) {
        toast.success(`${successCount} credenciais vinculadas com sucesso!`);
        onSuccess();
      }
    } catch (err: any) {
      toast.error(`Erro ao processar arquivo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileUp className="h-4 w-4" />
          Importar em Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Importar Credenciais Externas</DialogTitle>
          <DialogDescription>
            Faça upload de uma planilha (XLSX/CSV) com as colunas <strong>CPF</strong> e <strong>CREDENCIAL</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!results ? (
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <label htmlFor="bulk-file" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Planilha de Vínculo
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="bulk-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{results.success} vínculos realizados com sucesso.</span>
              </div>
              
              {results.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600 font-medium">
                    <AlertCircle className="h-5 w-5" />
                    <span>{results.errors.length} falhas encontradas:</span>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto rounded-md border p-2 text-xs space-y-1">
                    {results.errors.map((err, idx) => (
                      <div key={idx} className="text-muted-foreground">
                        Linha {err.row}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button className="w-full" onClick={() => { setResults(null); setOpen(false); }}>
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
