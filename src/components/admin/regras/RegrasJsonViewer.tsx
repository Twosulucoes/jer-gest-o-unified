import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { SectionDef } from "./sectionCatalog";

interface Props {
  sectionDef: SectionDef;
  data: any;
}

function isPlainObject(val: any): val is Record<string, any> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function isArrayOfObjects(val: any): boolean {
  return Array.isArray(val) && val.length > 0 && isPlainObject(val[0]);
}

function isPrimitive(val: any): boolean {
  return val === null || val === undefined || typeof val !== "object";
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  if (typeof val === "number") return val.toLocaleString("pt-BR");
  return String(val);
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Renders a table from an array of objects */
function ArrayTable({ data }: { data: Record<string, any>[] }) {
  const allKeys = Array.from(new Set(data.flatMap((row) => Object.keys(row))));
  // Filter out complex nested objects for table display
  const simpleKeys = allKeys.filter((k) => data.every((row) => isPrimitive(row[k])));
  const complexKeys = allKeys.filter((k) => !simpleKeys.includes(k));

  return (
    <div className="space-y-3">
      {simpleKeys.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {simpleKeys.map((k) => (
                  <TableHead key={k} className="text-xs whitespace-nowrap">{formatKey(k)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  {simpleKeys.map((k) => (
                    <TableCell key={k} className="text-sm">{formatValue(row[k])}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {complexKeys.length > 0 && data.map((row, i) => (
        <div key={i} className="space-y-2">
          {complexKeys.map((k) => (
            <div key={k}>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{formatKey(k)} (item {i + 1})</p>
              <DataRenderer data={row[k]} depth={1} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Renders an array of primitives as badges */
function PrimitiveArray({ data }: { data: any[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {data.map((item, i) => (
        <Badge key={i} variant="secondary" className="text-xs font-normal">
          {formatValue(item)}
        </Badge>
      ))}
    </div>
  );
}

/** Renders key-value pairs from an object */
function ObjectFields({ data }: { data: Record<string, any> }) {
  const entries = Object.entries(data);
  const simpleEntries = entries.filter(([, v]) => isPrimitive(v));
  const complexEntries = entries.filter(([, v]) => !isPrimitive(v));

  return (
    <div className="space-y-3">
      {simpleEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
          {simpleEntries.map(([key, val]) => (
            <div key={key} className="flex items-baseline gap-2 py-1 border-b border-dashed border-muted last:border-0">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatKey(key)}:</span>
              <span className="text-sm font-medium truncate">{formatValue(val)}</span>
            </div>
          ))}
        </div>
      )}
      {complexEntries.length > 0 && (
        <Accordion type="multiple" className="w-full">
          {complexEntries.map(([key, val]) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="text-sm py-2">
                <div className="flex items-center gap-2">
                  {formatKey(key)}
                  {Array.isArray(val) && (
                    <Badge variant="outline" className="text-[10px]">{val.length}</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <DataRenderer data={val} depth={1} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

/** Recursive data renderer */
function DataRenderer({ data, depth = 0 }: { data: any; depth?: number }) {
  if (isPrimitive(data)) {
    return <span className="text-sm">{formatValue(data)}</span>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-sm text-muted-foreground">Lista vazia</span>;
    if (isArrayOfObjects(data)) return <ArrayTable data={data} />;
    return <PrimitiveArray data={data} />;
  }
  if (isPlainObject(data)) {
    return <ObjectFields data={data} />;
  }
  return <span className="text-sm">{String(data)}</span>;
}

export default function RegrasJsonViewer({ sectionDef, data }: Props) {
  if (!data || (isPlainObject(data) && Object.keys(data).length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{sectionDef.label}</CardTitle>
          <CardDescription>{sectionDef.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma parametrização cadastrada para esta seção.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{sectionDef.label}</CardTitle>
        <CardDescription>{sectionDef.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataRenderer data={data} />
      </CardContent>
    </Card>
  );
}
