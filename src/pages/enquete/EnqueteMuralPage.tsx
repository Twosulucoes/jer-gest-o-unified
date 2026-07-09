import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EnqueteMuralPage() {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>Mural — Enquete JER 2026</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Mural em construção.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
