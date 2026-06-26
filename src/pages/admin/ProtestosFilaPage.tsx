import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { saveAs } from "file-saver";

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Gavel, FileText, Paperclip, RefreshCcw, ClipboardList, Clock, CheckCircle2, AlertTriangle, Users, Scale, Search, Eye, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "protocolado", label: "Protocolado" },
  { value: "em_analise", label: "Em análise" },
  { value: "aguardando_documentos", label: "Aguardando docs" },
  { value: "decidido", label: "Decidido" },
  { value: "arquivado", label: "Arquivado" },
];

const DECISION_OPTIONS = [
  { value: "deferido", label: "Deferido" },
  { value: "indeferido", label: "Indeferido" },
  { value: "parcial", label: "Parcialmente deferido" },
];

type CdeItem = {
  id: string;
  origem: "protests" | "cde_cases";
  protocolo: string;
  status: string;
  priority?: string | null;
  decision?: string | null;
  decision_reason?: string | null;
  created_at?: string | null;

  escola?: string | null;
  municipio?: string | null;
  modalidade?: string | null;
  categoria?: string | null;
  naipe?: string | null;
  professor_nome?: string | null;
  professor_email?: string | null;
  professor_telefone?: string | null;
  jogo_descricao?: string | null;
  tipo_recurso?: string | null;
  relato?: string | null;
  pedido?: string | null;
  public_token?: string | null;
  is_published?: boolean | null;
  published_at?: string | null;

  raw: any;
};

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
}

function decisionLabel(decision?: string | null) {
  if (!decision) return "";
  return DECISION_OPTIONS.find((d) => d.value === decision)?.label || decision;
}

function safeDate(date?: string | null) {
  if (!date) return "—";
  try {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function countByStatus(list: CdeItem[], status: string) {
  return list.filter((item) => item.status === status).length;
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="rounded-full bg-primary/10 p-3 text-primary">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

async function gerarDocumentoDecisao(item: CdeItem) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "COMISSÃO DISCIPLINAR ESPECIAL - CDE",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),

          new Paragraph({
            text: "JOGOS ESCOLARES DE RORAIMA",
            alignment: AlignmentType.CENTER,
          }),

          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({
                text: `DECISÃO DO PROCESSO Nº ${item.protocolo}`,
                bold: true,
              }),
            ],
          }),

          new Paragraph({
            text: `ORIGEM: ${
              item.origem === "cde_cases"
                ? "Recurso Público"
                : "Protesto PWA"
            }`,
          }),

          new Paragraph({
            text: `ESCOLA: ${item.escola || "-"}`,
          }),

          new Paragraph({
            text: `MODALIDADE: ${item.modalidade || "-"}`,
          }),

          new Paragraph({
            text: `CATEGORIA: ${item.categoria || "-"}`,
          }),

          new Paragraph({
            text: `NAIPE: ${item.naipe || "-"}`,
          }),

          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({
                text: "RELATO:",
                bold: true,
              }),
            ],
          }),

          new Paragraph({
            text: item.relato || "-",
          }),

          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({
                text: "DECISÃO:",
                bold: true,
              }),
            ],
          }),

          new Paragraph({
            text:
              item.decision === "deferido"
                ? "DEFERIDO"
                : item.decision === "indeferido"
                ? "INDEFERIDO"
                : "PARCIALMENTE DEFERIDO",
          }),

          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({
                text: "FUNDAMENTAÇÃO:",
                bold: true,
              }),
            ],
          }),

          new Paragraph({
            text: item.decision_reason || "-",
          }),

          new Paragraph({ text: "" }),

          new Paragraph({
            text: `Boa Vista/RR, ${safeDate(item.published_at || item.created_at)}`,
            alignment: AlignmentType.RIGHT,
          }),

          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),

          new Paragraph({
            text: "__________________________________",
            alignment: AlignmentType.CENTER,
          }),

          new Paragraph({
            text: "PRESIDENTE DA CDE",
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  saveAs(blob, `DECISAO-${item.protocolo}.docx`);
}


function escapeHtml(value?: string | null) {
  return String(value || "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function gerarPdfDecisao(item: CdeItem) {
  const decisaoTexto =
    item.decision === "deferido"
      ? "DEFERIDO"
      : item.decision === "indeferido"
      ? "INDEFERIDO"
      : item.decision === "parcial"
      ? "PARCIALMENTE DEFERIDO"
      : "—";

  const { data: signatures } = await (supabase as any)
    .from("cde_decision_signatures")
    .select("*")
    .eq("case_id", item.id)
    .order("signed_at", { ascending: true });

  const assinaturaHtml =
    signatures && signatures.length > 0
      ? signatures
          .map(
            (s: any) => `
        <div class="signature-item">
          <div class="signature-name">${escapeHtml(s.signer_name)}</div>
          <div class="signature-role">${escapeHtml(s.signer_role)}</div>
          <div class="signature-date">
            Assinado eletronicamente em
            ${escapeHtml(safeDate(s.signed_at))}
          </div>
        </div>
      `
          )
          .join("")
      : `
        <div class="signature-item">
          <div class="signature-name">Documento sem assinaturas eletrônicas registradas.</div>
        </div>
      `;

  const qrUrl = `${window.location.origin}/cde/consulta/${item.public_token}`;

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />

        <title>DECISÃO ${escapeHtml(item.protocolo)}</title>

        <style>
          @page {
            size: A4;
            margin: 20mm;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            font-size: 12px;
            line-height: 1.5;
          }

          .header {
            text-align: center;
            border-bottom: 2px solid #111827;
            padding-bottom: 14px;
            margin-bottom: 22px;
          }

          .header h1 {
            font-size: 18px;
            margin: 0;
          }

          .title {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            margin: 18px 0;
          }

          .box {
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 14px;
          }

          .section-title {
            font-weight: bold;
            margin-bottom: 8px;
            text-transform: uppercase;
          }

          .decision {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            border: 2px solid #111827;
            padding: 12px;
            margin: 14px 0;
          }

          .signature-area {
            margin-top: 40px;
          }

          .signature-item {
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
          }

          .signature-name {
            font-weight: bold;
            font-size: 14px;
          }

          .signature-role {
            margin-top: 4px;
            color: #374151;
          }

          .signature-date {
            margin-top: 6px;
            font-size: 11px;
            color: #6b7280;
          }

          .verify-box {
            margin-top: 30px;
            border-top: 1px solid #d1d5db;
            padding-top: 18px;
            text-align: center;
          }

          .verify-code {
            font-weight: bold;
            font-size: 13px;
            margin-top: 6px;
          }

          .qr {
            margin-top: 14px;
          }

          .footer {
            margin-top: 30px;
            font-size: 10px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <h1>COMISSÃO DISCIPLINAR ESPECIAL - CDE</h1>
          <div>Jogos Escolares de Roraima</div>
        </div>

        <div class="title">
          DECISÃO DO PROCESSO Nº ${escapeHtml(item.protocolo)}
        </div>

        <div class="box">
          <div><strong>Escola:</strong> ${escapeHtml(item.escola)}</div>
          <div><strong>Modalidade:</strong> ${escapeHtml(item.modalidade)}</div>
          <div><strong>Categoria:</strong> ${escapeHtml(item.categoria)}</div>
          <div><strong>Naipe:</strong> ${escapeHtml(item.naipe)}</div>
        </div>

        <div class="box">
          <div class="section-title">Relato</div>
          <div>${escapeHtml(item.relato).replaceAll("\n", "<br/>")}</div>
        </div>

        <div class="decision">
          ${decisaoTexto}
        </div>

        <div class="box">
          <div class="section-title">Fundamentação</div>
          <div>${escapeHtml(item.decision_reason).replaceAll("\n", "<br/>")}</div>
        </div>

        <div class="signature-area">
          <div class="section-title">
            ASSINATURAS ELETRÔNICAS
          </div>

          ${assinaturaHtml}
        </div>

        <div class="verify-box">
          <div>
            Documento assinado eletronicamente pela Comissão Disciplinar Especial.
          </div>

          <div class="verify-code">
            Código de validação:
            ${escapeHtml(item.protocolo)}
          </div>

          <div class="qr">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                qrUrl
              )}"
            />
          </div>

          <div style="margin-top:10px;">
            Verifique em:
            <br/>
            ${escapeHtml(qrUrl)}
          </div>
        </div>

        <div class="footer">
          Sistema JER Gestão — Comissão Disciplinar Especial
        </div>

        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=900,height=1200");

  if (!win) {
    toast({
      title: "Pop-up bloqueado",
      description: "Permita pop-ups para gerar o PDF oficial.",
      variant: "destructive",
    });
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
}

async function notificarDecisaoPublicada(item: CdeItem, decisao: string, parecer: string) {
  if (item.origem !== "cde_cases") return;

  const { error } = await supabase.functions.invoke(
    "send-cde-decision-notification",
    {
      body: {
        protocol: item.protocolo,
        public_token: item.public_token,
        professor_nome: item.professor_nome,
        professor_telefone: item.professor_telefone,
        status: decisao,
        parecer,
      },
    }
  );

  if (error) throw error;
}

async function gerarDocumentoRecurso(item: CdeItem) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "RECURSO RECEBIDO - CDE",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),

          new Paragraph({ text: "" }),

          new Paragraph({
            text: `PROTOCOLO: ${item.protocolo}`,
          }),

          new Paragraph({
            text: `PROFESSOR: ${item.professor_nome || "-"}`,
          }),

          new Paragraph({
            text: `EMAIL: ${item.professor_email || "-"}`,
          }),

          new Paragraph({
            text: `TELEFONE: ${item.professor_telefone || "-"}`,
          }),

          new Paragraph({
            text: `ESCOLA: ${item.escola || "-"}`,
          }),

          new Paragraph({
            text: `MUNICÍPIO: ${item.municipio || "-"}`,
          }),

          new Paragraph({
            text: `MODALIDADE: ${item.modalidade || "-"}`,
          }),

          new Paragraph({
            text: `CATEGORIA: ${item.categoria || "-"}`,
          }),

          new Paragraph({
            text: `NAIPE: ${item.naipe || "-"}`,
          }),

          new Paragraph({
            text: `JOGO: ${item.jogo_descricao || "-"}`,
          }),

          new Paragraph({
            text: `TIPO DE RECURSO: ${item.tipo_recurso || "-"}`,
          }),

          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({
                text: "RELATO:",
                bold: true,
              }),
            ],
          }),

          new Paragraph({
            text: item.relato || "-",
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  saveAs(blob, `RECURSO-${item.protocolo}.docx`);
}

export default function ProtestosFilaPage() {
  const [list, setList] = useState<CdeItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<CdeItem | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [decision, setDecision] = useState<string>("");
  const [reason, setReason] = useState("");
  const [newStatus, setNewStatus] = useState("decidido");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const consultaUrl = useMemo(() => {
    if (!selected?.public_token) return "";
    return `${window.location.origin}/cde/consulta/${selected.public_token}`;
  }, [selected]);

  const assinaturaUrl = useMemo(() => {
    if (!selected?.public_token) return "";
    return `${window.location.origin}/cde/assinar/${selected.public_token}`;
  }, [selected]);

  const dashboard = useMemo(() => {
    const total = list.length;
    const recursosPublicos = list.filter((item) => item.origem === "cde_cases").length;
    const protestosPwa = list.filter((item) => item.origem === "protests").length;
    const pendentes =
      countByStatus(list, "pendente") +
      countByStatus(list, "protocolado") +
      countByStatus(list, "aguardando_documentos");
    const emAnalise = countByStatus(list, "em_analise");
    const decididos = countByStatus(list, "decidido");
    const arquivados = countByStatus(list, "arquivado");
    const urgentes = list.filter((item) => item.priority === "urgente" || item.priority === "alta").length;
    const publicados = list.filter((item) => item.is_published).length;

    return {
      total,
      recursosPublicos,
      protestosPwa,
      pendentes,
      emAnalise,
      decididos,
      arquivados,
      urgentes,
      publicados,
    };
  }, [list]);

  const processosPendentes = useMemo(() => {
    return list.filter((item) =>
      ["pendente", "protocolado", "aguardando_documentos"].includes(item.status)
    );
  }, [list]);

  const ultimosDecididos = useMemo(() => {
    return list.filter((item) => item.status === "decidido").slice(0, 5);
  }, [list]);

  const filteredList = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return list;

    return list.filter((item) => {
      const searchable = [
        item.protocolo,
        item.escola,
        item.municipio,
        item.modalidade,
        item.categoria,
        item.naipe,
        item.professor_nome,
        item.tipo_recurso,
        item.status,
        item.priority,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [list, searchTerm]);

  const load = async () => {
    setLoading(true);

    try {
      let antigos: CdeItem[] = [];
      let novos: CdeItem[] = [];

      if (sourceFilter === "all" || sourceFilter === "protests") {
        let q = supabase
          .from("protests")
          .select(
            "*, delegations:delegation_id(institutions(name)), competition_matches:match_id(match_number, end_time)"
          )
          .order("created_at", { ascending: false });

        if (statusFilter !== "all") q = q.eq("status", statusFilter);

        const { data, error } = await q;

        if (!error && data) {
          antigos = data.map((p: any) => ({
            id: p.id,
            origem: "protests",
            protocolo: p.protocol_number || "SEM-PROTOCOLO",
            status: p.status || "protocolado",
            priority: p.priority || "normal",
            decision: p.decision,
            decision_reason: p.decision_reason,
            created_at: p.created_at,
            escola: p.delegations?.institutions?.name ?? "—",
            jogo_descricao: p.competition_matches?.match_number
              ? `Partida #${p.competition_matches.match_number}`
              : "—",
            tipo_recurso: "Protesto de partida",
            relato: p.fundamentation,
            pedido: p.request,
            raw: p,
          }));
        }
      }

      if (sourceFilter === "all" || sourceFilter === "cde_cases") {
        let q = (supabase as any)
          .from("cde_cases")
          .select("*")
          .order("created_at", { ascending: false });

        if (statusFilter !== "all") q = q.eq("status", statusFilter);

        const { data, error } = await q;

        if (!error && data) {
          novos = data.map((c: any) => ({
            id: c.id,
            origem: "cde_cases",
            protocolo: c.protocol || "SEM-PROTOCOLO",
            status: c.status || "pendente",
            priority: c.priority || "normal",
            decision: c.decision || null,
            decision_reason: c.decision_text || null,
            is_published: c.is_published ?? false,
            published_at: c.published_at ?? null,
            created_at: c.created_at,
            escola: c.escola,
            municipio: c.municipio,
            modalidade: c.modalidade,
            categoria: c.categoria,
            naipe: c.naipe,
            professor_nome: c.professor_nome,
            professor_email: c.professor_email,
            professor_telefone: c.professor_telefone,
            jogo_descricao: c.jogo_descricao,
            tipo_recurso: c.tipo_recurso,
            relato: c.relato,
            pedido: c.pedido,
            public_token: c.public_token,
            raw: c,
          }));
        }
      }

      const merged = [...novos, ...antigos].sort((a, b) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        return db - da;
      });

      setList(merged);
    } catch (e: any) {
      toast({
        title: "Erro ao carregar CDE",
        description: e?.message || "Não foi possível carregar a fila.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, sourceFilter]);

  const open = async (item: CdeItem) => {
    setSelected(item);
    setDecision(item.decision ?? "");
    setReason(item.decision_reason ?? "");
    setNewStatus(item.status || "em_analise");
    setAttachments([]);
    setHistory([]);

    if (item.origem === "protests") {
      const { data, error } = await supabase
        .from("protest_attachments")
        .select("*")
        .eq("protest_id", item.id);

      if (error) {
        toast({
          title: "Erro ao carregar anexos",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setAttachments(
        (data ?? []).map((a: any) => ({
          ...a,
          bucket: "protestos",
          path: a.storage_path,
          name: a.file_name,
        }))
      );
    }

    if (item.origem === "cde_cases") {
      const { data, error } = await (supabase as any)
        .from("cde_attachments")
        .select("*")
        .eq("case_id", item.id);

      if (error) {
        toast({
          title: "Erro ao carregar anexos",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setAttachments(
        (data ?? []).map((a: any) => ({
          ...a,
          bucket: "cde-attachments",
          path: a.file_path,
          name: a.file_name,
        }))
      );

      const { data: historyData, error: historyError } = await (supabase as any)
        .from("cde_case_history")
        .select("*")
        .eq("case_id", item.id)
        .order("created_at", { ascending: false });

      if (!historyError) {
        setHistory(historyData || []);
      }
    }
  };

  const downloadFile = async (bucket: string, path: string, name: string) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60);

    if (error) {
      toast({
        title: "Erro ao abrir anexo",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = name;
      a.target = "_blank";
      a.click();
    }
  };

  const publishDecision = async () => {
    if (!selected) return;

    if (selected.origem !== "cde_cases") {
      toast({
        title: "Publicação indisponível",
        description: "A publicação pública está disponível apenas para recursos públicos da CDE.",
        variant: "destructive",
      });
      return;
    }

    if (!decision || !reason.trim()) {
      toast({
        title: "Registre a decisão primeiro",
        description: "Informe a decisão e a fundamentação antes de publicar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const now = new Date().toISOString();

      const { error } = await (supabase as any)
        .from("cde_cases")
        .update({
          status: "decidido",
          decision: decision || null,
          decision_text: reason || null,
          decided_at: now,
          updated_at: now,
          is_published: true,
          published_at: now,
        })
        .eq("id", selected.id);

      if (error) throw error;

      await (supabase as any)
        .from("cde_case_history")
        .insert({
          case_id: selected.id,
          action_type: "publish",
          action_label: "Decisão publicada",
          action_description:
            "A decisão foi publicada oficialmente para consulta pública.",
          created_by: "Presidente CDE",
        });

      try {
        await notificarDecisaoPublicada(selected, decision, reason);

        await (supabase as any)
          .from("cde_case_history")
          .insert({
            case_id: selected.id,
            action_type: "notification",
            action_label: "Professor notificado por WhatsApp",
            action_description:
              "O professor foi notificado sobre a publicação da decisão.",
            created_by: "Sistema",
          });
      } catch (notifyError: any) {
        console.warn("Notificação de decisão não enviada.", notifyError);

        toast({
          title: "Decisão publicada",
          description:
            "A decisão foi publicada, mas a notificação por WhatsApp não foi enviada.",
          variant: "destructive",
        });
      }

      toast({
        title: "Decisão publicada",
        description: "A decisão foi publicada oficialmente para consulta pública.",
      });

      setSelected((prev) =>
        prev
          ? {
              ...prev,
              status: "decidido",
              decision: decision || null,
              decision_reason: reason || null,
              is_published: true,
              published_at: now,
            }
          : prev
      );

      load();
    } catch (e: any) {
      toast({
        title: "Erro ao publicar",
        description: e?.message || "Não foi possível publicar a decisão.",
        variant: "destructive",
      });
    }
  };

  const decide = async () => {
    if (!selected) return;

    if (newStatus === "decidido" && (!decision || !reason.trim())) {
      toast({
        title: "Preencha a decisão",
        description: "Para marcar como decidido, informe a decisão e a fundamentação.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      if (selected.origem === "protests") {
        const { error } = await supabase.rpc("rpc_decide_protest", {
          p_protest_id: selected.id,
          p_decision: decision || null,
          p_decision_reason: reason || null,
          p_new_status: newStatus,
        });

        if (error) throw error;
      }

      if (selected.origem === "cde_cases") {
        const payload: any = {
          status: newStatus,
          decision: decision || null,
          decision_text: reason || null,
          updated_at: new Date().toISOString(),
        };

        if (newStatus === "decidido") {
          payload.decided_at = new Date().toISOString();
        }

        const { error } = await (supabase as any)
          .from("cde_cases")
          .update(payload)
          .eq("id", selected.id);

        if (error) throw error;

        await (supabase as any)
          .from("cde_case_history")
          .insert({
            case_id: selected.id,
            action_type: "decision",
            action_label: "Julgamento registrado",
            action_description: reason || "Status atualizado pela Comissão Disciplinar Especial.",
            created_by: "Presidente CDE",
          });
      }

      toast({ title: "Julgamento registrado" });
      setSelected(null);
      load();
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Gavel className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Comissão Disciplinar Especial</h1>
            <p className="text-sm text-muted-foreground">
              Gestão de protestos, recursos e decisões oficiais dos Jogos Escolares.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="cde_cases">Recursos públicos</SelectItem>
              <SelectItem value="protests">Protestos PWA</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          title="Total de processos"
          value={dashboard.total}
          description="Recursos e protestos cadastrados"
          icon={<ClipboardList className="h-5 w-5" />}
        />

        <StatCard
          title="Pendentes"
          value={dashboard.pendentes}
          description="Aguardando análise da CDE"
          icon={<Clock className="h-5 w-5" />}
        />

        <StatCard
          title="Em análise"
          value={dashboard.emAnalise}
          description="Processos em julgamento"
          icon={<Scale className="h-5 w-5" />}
        />

        <StatCard
          title="Decididos"
          value={dashboard.decididos}
          description="Julgamentos finalizados"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />

        <StatCard
          title="Urgentes"
          value={dashboard.urgentes}
          description="Prioridade alta"
          icon={<AlertTriangle className="h-5 w-5" />}
        />

        <StatCard
          title="Publicados"
          value={dashboard.publicados}
          description="Decisões públicas"
          icon={<Send className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recursos públicos
              </p>
              <p className="text-2xl font-bold">{dashboard.recursosPublicos}</p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Protestos PWA
              </p>
              <p className="text-2xl font-bold">{dashboard.protestosPwa}</p>
            </div>
            <Gavel className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Arquivados
              </p>
              <p className="text-2xl font-bold">{dashboard.arquivados}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prioridade da CDE</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {processosPendentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum processo pendente no momento.
              </p>
            ) : (
              processosPendentes.slice(0, 5).map((item) => (
                <button
                  key={`pendente-${item.origem}-${item.id}`}
                  onClick={() => open(item)}
                  className="w-full rounded-lg border p-3 text-left transition hover:bg-muted"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">
                      {item.protocolo}
                    </span>
                    <Badge variant="outline">{statusLabel(item.status)}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-semibold">
                    {item.escola || "—"}
                    {item.modalidade ? ` — ${item.modalidade}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {safeDate(item.created_at)}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Últimas decisões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ultimosDecididos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma decisão registrada ainda.
              </p>
            ) : (
              ultimosDecididos.map((item) => (
                <button
                  key={`decidido-${item.origem}-${item.id}`}
                  onClick={() => open(item)}
                  className="w-full rounded-lg border p-3 text-left transition hover:bg-muted"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">
                      {item.protocolo}
                    </span>
                    {item.decision && (
                      <Badge variant="secondary">
                        {decisionLabel(item.decision)}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold">
                    {item.escola || "—"}
                    {item.modalidade ? ` — ${item.modalidade}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {safeDate(item.created_at)}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg">Fila de processos</CardTitle>
              <p className="text-sm text-muted-foreground">
                {filteredList.length} de {list.length} processo(s) encontrado(s)
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar protocolo, escola, modalidade..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredList.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {loading ? "Carregando..." : "Nenhum processo encontrado."}
            </div>
          ) : (
<div className="rounded-lg border overflow-hidden">
  <div className="overflow-auto max-h-[70vh]">
    <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Escola</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredList.slice(0, 100).map((p) => (
                    <TableRow key={`${p.origem}-${p.id}`}>
                      <TableCell className="font-mono font-semibold">
                        {p.protocolo}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">
                          {p.origem === "cde_cases" ? "Recurso público" : "Protesto PWA"}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-medium">
                        {p.escola || "—"}
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p>{p.modalidade || "—"}</p>
                          {(p.categoria || p.naipe) && (
                            <p className="text-xs text-muted-foreground">
                              {p.categoria || "—"} / {p.naipe || "—"}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge>{statusLabel(p.status)}</Badge>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            p.priority === "urgente" || p.priority === "alta"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {p.priority || "normal"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">
                        {safeDate(p.created_at)}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => open(p)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
  </div>
</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">
                  {selected.protocolo}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Origem</p>
                    <p className="font-semibold">
                      {selected.origem === "cde_cases"
                        ? "Recurso público"
                        : "Protesto PWA"}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Status atual</p>
                    <p className="font-semibold">{statusLabel(selected.status)}</p>
                    {selected.is_published && (
                      <p className="text-xs text-green-600 mt-1">
                        Publicado oficialmente em {safeDate(selected.published_at)}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-muted-foreground">Escola</p>
                    <p className="font-semibold">{selected.escola || "—"}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Município</p>
                    <p className="font-semibold">{selected.municipio || "—"}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Modalidade</p>
                    <p className="font-semibold">{selected.modalidade || "—"}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Categoria/Naipe</p>
                    <p className="font-semibold">
                      {selected.categoria || "—"} / {selected.naipe || "—"}
                    </p>
                  </div>

                  {selected.professor_nome && (
                    <>
                      <div>
                        <p className="text-muted-foreground">Professor</p>
                        <p className="font-semibold">{selected.professor_nome}</p>
                      </div>

                      <div>
                        <p className="text-muted-foreground">Contato</p>
                        <p className="font-semibold">
                          {selected.professor_email || "—"}
                          {selected.professor_telefone
                            ? ` / ${selected.professor_telefone}`
                            : ""}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {consultaUrl && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Consulta pública</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs break-all">
                      <p>{consultaUrl}</p>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(consultaUrl);
                          toast({
                            title: "Link copiado",
                            description: "Link de consulta pública copiado.",
                          });
                        }}
                      >
                        Copiar link de consulta
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {assinaturaUrl && selected.origem === "cde_cases" && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        Link de assinatura eletrônica
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-3 text-xs break-all">
                      <p>{assinaturaUrl}</p>

                      <p className="text-muted-foreground">
                        Envie este link para os membros da Comissão assinarem
                        eletronicamente a decisão. Cada pessoa irá informar nome,
                        função e confirmar a assinatura.
                      </p>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(assinaturaUrl);
                          toast({
                            title: "Link copiado",
                            description: "Link de assinatura copiado.",
                          });
                        }}
                      >
                        Copiar link de assinatura
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {selected.tipo_recurso || "Fundamentação"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm whitespace-pre-wrap">
                    {selected.relato || "—"}
                  </CardContent>
                </Card>

                {attachments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        Anexos do processo
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-2">
                      {attachments.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => downloadFile(a.bucket, a.path, a.name)}
                          className="flex w-full items-center justify-between gap-2 rounded-md border p-3 text-sm hover:bg-muted"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{a.name}</span>
                          </span>

                          <span className="text-xs text-primary">Abrir/Baixar</span>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {selected.origem === "cde_cases" && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Histórico do processo</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {history.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Nenhum histórico registrado.
                        </p>
                      )}

                      {history.map((h) => (
                        <div
                          key={h.id}
                          className="border-l-2 border-primary pl-4 py-1"
                        >
                          <p className="text-sm font-semibold">
                            {h.action_label}
                          </p>

                          {h.action_description && (
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {h.action_description}
                            </p>
                          )}

                          <p className="text-[11px] text-muted-foreground mt-1">
                            {safeDate(h.created_at)}
                            {" • "}
                            {h.created_by || "Sistema"}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-semibold">Julgamento</h3>

                  <div>
                    <Label>Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Decisão {newStatus === "decidido" && "*"}</Label>
                    <Select value={decision} onValueChange={setDecision}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DECISION_OPTIONS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>
                      Fundamentação da decisão {newStatus === "decidido" && "*"}
                    </Label>
                    <Textarea
                      rows={5}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Descreva a decisão da Comissão Disciplinar Especial..."
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cancelar
                </Button>

                <Button
  variant="outline"
  onClick={() => gerarDocumentoRecurso(selected)}
>
  Baixar recurso
</Button>

{selected.decision && (
  <>
    <Button
      variant="outline"
      onClick={() => gerarDocumentoDecisao(selected)}
    >
      Gerar decisão DOCX
    </Button>

    <Button
      variant="outline"
      onClick={() => gerarPdfDecisao(selected)}
    >
      Gerar PDF oficial
    </Button>
  </>
)}

                {selected.origem === "cde_cases" && !selected.is_published && (
                  <Button
                    variant="secondary"
                    onClick={publishDecision}
                    disabled={!decision || !reason.trim()}
                  >
                    Publicar decisão
                  </Button>
                )}

                <Button onClick={decide} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar julgamento"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
