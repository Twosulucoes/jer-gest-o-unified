import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EnqueteDirecaoPage() {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>Painel da Direção — Enquete JER 2026</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Painel em construção.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
