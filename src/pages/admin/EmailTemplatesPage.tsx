import { useState } from "react";
import { toast } from "sonner";
import { EMAIL_TEMPLATES, SUPABASE_CHECKLIST, type EmailTemplate } from "@/lib/emailTemplates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Mail, FileText, Code } from "lucide-react";

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiado!`),
    () => toast.error("Falha ao copiar. Copie manualmente.")
  );
}

function CodeBlock({ content, label }: { content: string; label: string }) {
  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 text-xs"
        onClick={() => copyToClipboard(content, label)}
      >
        <Copy className="h-3 w-3 mr-1" /> Copiar
      </Button>
      <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap break-all text-foreground/80">
        {content}
      </pre>
    </div>
  );
}

function TemplateCard({ template }: { template: EmailTemplate }) {
  const [innerTab, setInnerTab] = useState("html");

  const copyAll = () => {
    const all = `=== SUBJECT ===\n${template.subject}\n\n=== HTML ===\n${template.html}\n\n=== TEXTO PURO ===\n${template.text}`;
    copyToClipboard(all, "Tudo");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-semibold">{template.label}</CardTitle>
          <Button variant="outline" size="sm" onClick={copyAll} className="text-xs">
            <Copy className="h-3 w-3 mr-1" /> Copiar tudo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subject */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => copyToClipboard(template.subject, "Subject")}>
              <Copy className="h-3 w-3 mr-1" /> Copiar
            </Button>
          </div>
          <div className="bg-muted rounded-md px-3 py-2 font-mono text-sm">{template.subject}</div>
        </div>

        {/* HTML / Texto */}
        <Tabs value={innerTab} onValueChange={setInnerTab}>
          <TabsList className="h-8">
            <TabsTrigger value="html" className="text-xs px-3 h-7">
              <Code className="h-3 w-3 mr-1" /> HTML
            </TabsTrigger>
            <TabsTrigger value="text" className="text-xs px-3 h-7">
              <FileText className="h-3 w-3 mr-1" /> Texto puro
            </TabsTrigger>
          </TabsList>
          <TabsContent value="html" className="mt-2">
            <CodeBlock content={template.html} label="HTML" />
          </TabsContent>
          <TabsContent value="text" className="mt-2">
            <CodeBlock content={template.text} label="Texto puro" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function EmailTemplatesPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Templates de E-mail (Auth)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Templates prontos para colar no Supabase Authentication → Email Templates.
        </p>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">
            <Mail className="h-4 w-4 mr-1.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <Check className="h-4 w-4 mr-1.5" /> Como Configurar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          {EMAIL_TEMPLATES.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </TabsContent>

        <TabsContent value="checklist">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Checklist de Configuração</CardTitle>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => copyToClipboard(SUPABASE_CHECKLIST, "Checklist")}>
                  <Copy className="h-3 w-3 mr-1" /> Copiar checklist
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-foreground/80">
                <h3 className="text-sm font-semibold mt-0 mb-2">1. Authentication → URL Configuration</h3>
                <ul className="text-sm space-y-1 list-disc pl-4">
                  <li><strong>Site URL:</strong> <code className="text-xs bg-muted px-1 rounded">https://adm.jers.com.br</code></li>
                  <li><strong>Additional Redirect URLs:</strong>
                    <ul className="mt-1 space-y-0.5 list-disc pl-4">
                      <li><code className="text-xs bg-muted px-1 rounded">https://adm.jers.com.br/**</code></li>
                      <li><code className="text-xs bg-muted px-1 rounded">https://adm.jers.com.br/auth/callback</code></li>
                      <li><code className="text-xs bg-muted px-1 rounded">https://adm.jers.com.br/reset-senha</code></li>
                      <li><code className="text-xs bg-muted px-1 rounded">https://adm.jers.com.br/confirmar-email</code></li>
                      <li><code className="text-xs bg-muted px-1 rounded">https://adm.jers.com.br/convite</code></li>
                    </ul>
                  </li>
                </ul>

                <h3 className="text-sm font-semibold mt-4 mb-2">2. Authentication → Email Templates</h3>
                <p className="text-sm">Para cada template, copie o <strong>Subject</strong>, o <strong>HTML Body</strong> e o <strong>Message</strong> (texto puro) e cole na aba correspondente:</p>
                <ul className="text-sm space-y-1 list-disc pl-4">
                  <li><strong>Confirm signup</strong> → "Confirmar E-mail"</li>
                  <li><strong>Magic Link</strong> → "Link de Acesso"</li>
                  <li><strong>Reset Password</strong> → "Redefinir Senha"</li>
                  <li><strong>Invite</strong> → "Convite de Acesso"</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
