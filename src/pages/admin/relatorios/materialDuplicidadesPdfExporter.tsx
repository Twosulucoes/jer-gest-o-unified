import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { EventBrandingResolved } from "@/hooks/useEventBranding";
import {
  ptLabel,
  classificacaoLabel,
  formatDeltaSegundos,
  ERRO_TECNICO_JANELA_SEGUNDOS,
  type MaterialDuplicidadeRow,
} from "./useMaterialDuplicidadesRelatorio";

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9 },
  headerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 8, gap: 12 },
  logo: { height: 40, objectFit: "contain" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "center", marginTop: 4 },
  subtitle: { fontSize: 10, textAlign: "center", color: "#444" },
  meta: { fontSize: 9, textAlign: "center", color: "#666", marginBottom: 8 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 6 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginTop: 10, marginBottom: 4, backgroundColor: "#f0f0f0", padding: 4 },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  kpi: { width: "31%", borderWidth: 0.5, borderColor: "#ccc", padding: 6 },
  kpiLabel: { fontSize: 7, color: "#666" },
  kpiValue: { fontSize: 13, fontWeight: "bold", marginTop: 2 },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", backgroundColor: "#fafafa", paddingVertical: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  trAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3, backgroundColor: "#fafafa" },
  th: { fontSize: 7.5, fontWeight: "bold" },
  td: { fontSize: 7.5 },
  tdAmber: { fontSize: 7.5, color: "#d97706" },
  tdGreen: { fontSize: 7.5, color: "#16a34a", fontWeight: "bold" },
  tdRed: { fontSize: 7.5, color: "#dc2626", fontWeight: "bold" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#888", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4 },
  note: { fontSize: 7, color: "#888", marginTop: 8, lineHeight: 1.4 },
  label: { fontSize: 8, color: "#666" },
  value: { fontSize: 10, fontWeight: "bold", marginBottom: 6 },
  paragraph: { fontSize: 9.5, lineHeight: 1.5, marginBottom: 8, textAlign: "justify" },
  box: { borderWidth: 0.5, borderColor: "#ccc", padding: 8, marginBottom: 8 },
  timelineRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  badge: { alignSelf: "flex-start", borderRadius: 2, paddingVertical: 3, paddingHorizontal: 8, fontSize: 9, fontWeight: "bold" },
});

interface Meta {
  eventName: string;
  branding?: EventBrandingResolved | null;
  generatedAt: Date;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ReportHeader({ meta, subtitleText }: { meta: Meta; subtitleText: string }) {
  const logos = (meta.branding?.logos || []).filter((l) => l.active).slice(0, 3);
  const headerTitle = meta.branding?.nome_oficial || meta.branding?.fallbackEventName || meta.eventName;
  const subtitle = meta.branding?.subtitulo || "";
  const dateStr = meta.generatedAt.toLocaleDateString("pt-BR");
  const timeStr = meta.generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {logos.length > 0 && (
        <View style={s.headerRow}>
          {logos.map((l, i) => (
            <Image key={i} src={l.url} style={s.logo} />
          ))}
        </View>
      )}
      <Text style={s.title}>{headerTitle}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      <Text style={s.meta}>
        {subtitleText} — {dateStr} às {timeStr}
      </Text>
      <View style={s.divider} />
    </>
  );
}

function ReportFooter({ meta }: { meta: Meta }) {
  const localAno = meta.branding?.local_ano || "";
  const rodape = meta.branding?.rodape_texto || "JER Gestão";
  const dateStr = meta.generatedAt.toLocaleDateString("pt-BR");
  const timeStr = meta.generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <Text style={s.footer}>
      {rodape}
      {localAno ? " • " + localAno : ""} • Gerado em {dateStr} às {timeStr}
    </Text>
  );
}

/** Nome do participante (ou identificação do crachá não vinculado) para exibição. */
function nomeExibicao(r: MaterialDuplicidadeRow) {
  return r.linked ? r.full_name || "—" : `Crachá não vinculado (${r.qr_code || "s/ código"})`;
}

// ─────────────────────────────────────────────────────────────────
// Relatório em lista — todas as tentativas de duplicidade do evento.
// ─────────────────────────────────────────────────────────────────

function MaterialDuplicidadesListDocument({ rows, meta }: { rows: MaterialDuplicidadeRow[]; meta: Meta }) {
  const erroTecnico = rows.filter((r) => r.classificacao === "erro_tecnico").length;
  const tentativaReal = rows.filter((r) => r.classificacao === "tentativa_real").length;
  const indeterminado = rows.filter((r) => r.classificacao === "indeterminado").length;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <ReportHeader meta={meta} subtitleText="RELATÓRIO DE TENTATIVAS DE DUPLICIDADE — ENTREGA DE MATERIAL" />

        <Text style={s.sectionTitle}>Indicadores Gerais</Text>
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Total de Tentativas</Text>
            <Text style={s.kpiValue}>{rows.length}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Erro Técnico (releitura)</Text>
            <Text style={[s.kpiValue, { color: "#d97706" }]}>{erroTecnico}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Tentativa Real de Reentrega</Text>
            <Text style={[s.kpiValue, { color: "#dc2626" }]}>{tentativaReal}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Detalhamento das Tentativas ({rows.length})</Text>
        <View style={s.thRow}>
          <Text style={[s.th, { width: "16%" }]}>Participante</Text>
          <Text style={[s.th, { width: "10%" }]}>CPF</Text>
          <Text style={[s.th, { width: "14%" }]}>Escola</Text>
          <Text style={[s.th, { width: "10%" }]}>Kit</Text>
          <Text style={[s.th, { width: "11%" }]}>Entrega Confirmada</Text>
          <Text style={[s.th, { width: "11%" }]}>Tentativa Bloqueada</Text>
          <Text style={[s.th, { width: "7%", textAlign: "center" }]}>Δ Tempo</Text>
          <Text style={[s.th, { width: "9%" }]}>Operador Entrega</Text>
          <Text style={[s.th, { width: "9%" }]}>Operador Tentativa</Text>
          <Text style={[s.th, { width: "13%" }]}>Classificação</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.id} style={i % 2 === 0 ? s.tr : s.trAlt}>
            <Text style={[r.linked ? s.td : s.tdAmber, { width: "16%" }]}>{nomeExibicao(r)}</Text>
            <Text style={[s.td, { width: "10%" }]}>{r.cpf || "—"}</Text>
            <Text style={[s.td, { width: "14%" }]}>{r.escola}</Text>
            <Text style={[s.td, { width: "10%" }]}>{r.kit_name}</Text>
            <Text style={[s.td, { width: "11%" }]}>{fmtDateTime(r.delivery_at)}</Text>
            <Text style={[s.td, { width: "11%" }]}>{fmtDateTime(r.attempt_at)}</Text>
            <Text style={[s.td, { width: "7%", textAlign: "center" }]}>{formatDeltaSegundos(r.delta_seconds)}</Text>
            <Text style={[s.td, { width: "9%" }]}>{r.delivery_operator_name || "—"}</Text>
            <Text style={[s.td, { width: "9%" }]}>{r.attempt_operator_name || "—"}</Text>
            <Text
              style={[
                r.classificacao === "erro_tecnico" ? s.tdAmber : r.classificacao === "tentativa_real" ? s.tdRed : s.td,
                { width: "13%" },
              ]}
            >
              {classificacaoLabel(r.classificacao)}
            </Text>
          </View>
        ))}
        {rows.length === 0 && <Text style={s.td}>Nenhuma tentativa de duplicidade registrada para os filtros selecionados.</Text>}

        <Text style={s.note}>
          Metodologia de classificação: uma tentativa é considerada "Erro técnico (releitura)" quando registrada pelo
          MESMO operador em até {ERRO_TECNICO_JANELA_SEGUNDOS} segundos após a entrega confirmada — padrão típico de o
          crachá permanecer diante do leitor/câmera e ser lido novamente. Fora dessa janela, ou com operador diferente,
          a tentativa é classificada como "Tentativa real de reentrega". Em ambos os casos, o material NÃO foi
          entregue em duplicidade — o sistema bloqueou o segundo registro automaticamente.
        </Text>

        <ReportFooter meta={meta} />
      </Page>
    </Document>
  );
}

export async function exportMaterialDuplicidadesListPdf(rows: MaterialDuplicidadeRow[], meta: Meta): Promise<Blob> {
  return await pdf(<MaterialDuplicidadesListDocument rows={rows} meta={meta} />).toBlob();
}

// ─────────────────────────────────────────────────────────────────
// Relatório individual — declaração técnica de um caso específico,
// pensada para ser entregue a professores/alunos como respaldo.
// ─────────────────────────────────────────────────────────────────

function narrativaCaso(r: MaterialDuplicidadeRow): string {
  const nome = nomeExibicao(r);
  const entrega = fmtDateTime(r.delivery_at);
  const tentativa = fmtDateTime(r.attempt_at);
  const delta = formatDeltaSegundos(r.delta_seconds);
  const operadorEntrega = r.delivery_operator_name || "operador não identificado";
  const operadorTentativa = r.attempt_operator_name || "operador não identificado";

  if (r.classificacao === "erro_tecnico") {
    return (
      `O sistema registra a entrega do kit "${r.kit_name}" para ${nome} com sucesso em ${entrega}, ` +
      `por ${operadorEntrega}. Apenas ${delta} depois, o mesmo crachá foi lido novamente pelo mesmo ` +
      `operador (${operadorTentativa}) — padrão característico de o crachá ter permanecido diante do ` +
      `leitor/câmera por tempo suficiente para uma nova leitura automática, e não de uma segunda tentativa ` +
      `deliberada de entrega. O sistema de controle de duplicidade identificou que o kit já constava como ` +
      `entregue e bloqueou automaticamente o registro de uma segunda entrega, sem qualquer intervenção manual. ` +
      `Não há, portanto, qualquer indício de que o material não tenha sido efetivamente recebido pelo participante.`
    );
  }

  if (r.classificacao === "tentativa_real") {
    return (
      `O sistema registra a entrega do kit "${r.kit_name}" para ${nome} com sucesso em ${entrega}, ` +
      `por ${operadorEntrega}. ${delta} depois, houve uma nova tentativa de entrega do mesmo kit para o ` +
      `mesmo participante, desta vez por ${operadorTentativa}. O sistema de controle de duplicidade ` +
      `identificou que o kit já constava como entregue e bloqueou automaticamente o registro de uma segunda ` +
      `entrega, sem qualquer intervenção manual. O material já havia sido recebido pelo participante na data e ` +
      `hora do primeiro registro; a segunda tentativa não representa uma nova entrega nem indica ausência de ` +
      `recebimento anterior.`
    );
  }

  return (
    `Foi localizada uma tentativa de reentrega do kit "${r.kit_name}" registrada em ${tentativa} por ` +
    `${operadorTentativa}, para ${nome}, mas não foi possível localizar o registro da entrega original ` +
    `correspondente para comparação automática. Recomenda-se conferência manual deste caso.`
  );
}

function MaterialDuplicidadeIndividualDocument({ row, meta }: { row: MaterialDuplicidadeRow; meta: Meta }) {
  const corClassificacao =
    row.classificacao === "erro_tecnico" ? "#d97706" : row.classificacao === "tentativa_real" ? "#dc2626" : "#666";
  const bgClassificacao =
    row.classificacao === "erro_tecnico" ? "#fef3c7" : row.classificacao === "tentativa_real" ? "#fee2e2" : "#f3f4f6";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <ReportHeader meta={meta} subtitleText="DECLARAÇÃO TÉCNICA — TENTATIVA DE DUPLICIDADE NA ENTREGA DE MATERIAL" />

        <Text style={s.sectionTitle}>Identificação</Text>
        <View style={s.box}>
          <Text style={s.label}>Participante</Text>
          <Text style={s.value}>{nomeExibicao(row)}</Text>
          <Text style={s.label}>CPF</Text>
          <Text style={s.value}>{row.cpf || "—"}</Text>
          <Text style={s.label}>Escola / Delegação</Text>
          <Text style={s.value}>{row.escola}</Text>
          <Text style={s.label}>Tipo de Participação</Text>
          <Text style={s.value}>{row.linked ? ptLabel(row.participant_type) : "—"}</Text>
          <Text style={s.label}>Kit de Material</Text>
          <Text style={s.value}>{row.kit_name}</Text>
        </View>

        <Text style={s.sectionTitle}>Linha do Tempo Registrada no Sistema</Text>
        <View style={s.box}>
          <View style={s.timelineRow}>
            <Text style={s.label}>Entrega confirmada (1º registro)</Text>
            <Text style={[s.value, { color: "#16a34a" }]}>{fmtDateTime(row.delivery_at)}</Text>
          </View>
          <Text style={s.label}>Operador responsável pela entrega: {row.delivery_operator_name || "não identificado"}</Text>
          <View style={[s.timelineRow, { marginTop: 8 }]}>
            <Text style={s.label}>Tentativa de nova entrega (bloqueada)</Text>
            <Text style={[s.value, { color: "#dc2626" }]}>{fmtDateTime(row.attempt_at)}</Text>
          </View>
          <Text style={s.label}>Operador da tentativa: {row.attempt_operator_name || "não identificado"}</Text>
          <View style={[s.timelineRow, { marginTop: 8 }]}>
            <Text style={s.label}>Intervalo entre os dois eventos</Text>
            <Text style={s.value}>{formatDeltaSegundos(row.delta_seconds)}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Classificação Técnica</Text>
        <View style={[s.box, { backgroundColor: bgClassificacao }]}>
          <Text style={[s.badge, { color: corClassificacao, backgroundColor: "#fff" }]}>
            {classificacaoLabel(row.classificacao)}
          </Text>
          <Text style={[s.paragraph, { marginTop: 8 }]}>{narrativaCaso(row)}</Text>
        </View>

        <Text style={s.note}>
          Metodologia: esta classificação é calculada automaticamente comparando o horário e o operador da entrega
          confirmada com o horário e o operador da tentativa bloqueada, ambos registrados pelo sistema (tabelas
          material_deliveries / material_deliveries_unlinked e audit_events). Tentativas do MESMO operador em até{" "}
          {ERRO_TECNICO_JANELA_SEGUNDOS} segundos após a entrega são classificadas como releitura técnica do crachá;
          as demais, como tentativa real de reentrega. Em nenhum dos dois casos houve entrega em duplicidade — o
          sistema impede tecnicamente que o mesmo kit seja registrado duas vezes para a mesma pessoa.
        </Text>

        <ReportFooter meta={meta} />
      </Page>
    </Document>
  );
}

export async function exportMaterialDuplicidadeIndividualPdf(row: MaterialDuplicidadeRow, meta: Meta): Promise<Blob> {
  return await pdf(<MaterialDuplicidadeIndividualDocument row={row} meta={meta} />).toBlob();
}
