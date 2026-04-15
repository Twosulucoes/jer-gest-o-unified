import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Code2 } from "lucide-react";

interface RuleJsonAccordionProps {
  label?: string;
  data: Record<string, unknown> | null | undefined;
}

export function RuleJsonAccordion({ label = "JSON bruto", data }: RuleJsonAccordionProps) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="json">
        <AccordionTrigger className="text-xs text-muted-foreground py-2">
          <span className="flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5" />
            {label}
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <pre className="text-[11px] bg-muted/50 p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
