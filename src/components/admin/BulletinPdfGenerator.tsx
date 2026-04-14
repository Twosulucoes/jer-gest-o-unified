import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { pdf, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { supabase } from "@/integrations/supabase/client";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10 },
  header: { textAlign: "center" as const, marginBottom: 20 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 12, color: "#555", marginBottom: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 6 },
  row: { flexDirection: "row" as const, justifyContent: "space-between" as const, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  label: { fontWeight: "bold", width: "40%" },
  value: { width: "60%" },
  resultRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  footer: { position: "absolute" as const, bottom: 40, left: 40, right: 40 },
  sigLine: { borderTopWidth: 1, borderTopColor: "#333", marginTop: 40, paddingTop: 4, width: "45%", textAlign: "center" as const },
  sigRow: { flexDirection: "row" as const, justifyContent: "space-between" as const },
  small: { fontSize: 8, color: "#888", textAlign: "center" as const, marginTop: 20 },
});

interface BulletinEntry {
  name: string;
  outcome?: string;
  score?: string;
  position?: number;
  time_ms?: number;
  distance_cm?: number;
  points?: number;
}

interface BulletinPdfProps {
  bulletinNumber: number;
  bulletinTitle: string;
  eventName: string;
  sportName: string;
  categoryName: string;
  gender: string;
  phaseName?: string;
  entries: BulletinEntry[];
  publishedAt: string;
  bulletinId: string;
}

function BulletinDocument({
  bulletinNumber, bulletinTitle, eventName, sportName, categoryName, gender,
  phaseName, entries, publishedAt,
}: BulletinPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>BOLETIM OFICIAL Nº {bulletinNumber}</Text>
          <Text style={styles.subtitle}>{eventName}</Text>
          <Text style={styles.subtitle}>{bulletinTitle}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados da Prova</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Modalidade:</Text>
            <Text style={styles.value}>{sportName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Categoria:</Text>
            <Text style={styles.value}>{categoryName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Gênero:</Text>
            <Text style={styles.value}>{gender === "M" ? "Masculino" : gender === "F" ? "Feminino" : "Misto"}</Text>
          </View>
          {phaseName && (
            <View style={styles.row}>
              <Text style={styles.label}>Fase:</Text>
              <Text style={styles.value}>{phaseName}</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resultados</Text>
          {entries.map((entry, idx) => (
            <View key={idx} style={styles.resultRow}>
              <Text style={{ width: "8%" }}>{entry.position ? `${entry.position}º` : `${idx + 1}`}</Text>
              <Text style={{ width: "42%", fontWeight: "bold" }}>{entry.name}</Text>
              <Text style={{ width: "15%" }}>{entry.outcome || "—"}</Text>
              <Text style={{ width: "15%" }}>{entry.score || "—"}</Text>
              <Text style={{ width: "20%", textAlign: "right" as const }}>
                {entry.time_ms != null ? `${(entry.time_ms / 1000).toFixed(2)}s` : ""}
                {entry.distance_cm != null ? `${(entry.distance_cm / 100).toFixed(2)}m` : ""}
                {entry.points != null ? `${entry.points} pts` : ""}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.sigRow}>
            <View style={styles.sigLine}>
              <Text>Coordenador Técnico</Text>
            </View>
            <View style={styles.sigLine}>
              <Text>Mesário / Árbitro</Text>
            </View>
          </View>
          <Text style={styles.small}>
            Publicado em {new Date(publishedAt).toLocaleString("pt-BR")} — JER Gestão
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export function useBulletinPdfGenerator() {
  const [generating, setGenerating] = useState(false);

  const generateAndDownload = async (props: BulletinPdfProps) => {
    setGenerating(true);
    try {
      const blob = await pdf(<BulletinDocument {...props} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boletim-${props.bulletinNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // Save pdf_url to bulletin (as data URL for now; in production use storage)
      await supabase
        .from("official_bulletins")
        .update({ pdf_url: `boletim-${props.bulletinNumber}.pdf` })
        .eq("id", props.bulletinId);

      toast.success("Boletim PDF gerado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF do boletim.");
    } finally {
      setGenerating(false);
    }
  };

  return { generateAndDownload, generating };
}

export function BulletinPdfButton({ props }: { props: BulletinPdfProps }) {
  const { generateAndDownload, generating } = useBulletinPdfGenerator();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => generateAndDownload(props)}
      disabled={generating}
    >
      {generating ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4 mr-1" />
      )}
      Gerar PDF
    </Button>
  );
}
