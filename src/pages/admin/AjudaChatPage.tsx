import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Send, Loader2, Bot, User, CheckCircle2, XCircle,
  Zap, HelpCircle, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  provider?: string;
}

interface ProviderStatus {
  ok: boolean | null; // null = not tested yet
  error?: string;
  testing: boolean;
}

const PROVIDERS = [
  { id: "lovable", label: "Lovable AI", sub: "Gemini (padrão)" },
  { id: "claude", label: "Claude", sub: "Anthropic" },
  { id: "grok", label: "Grok", sub: "xAI" },
  { id: "deepseek", label: "DeepSeek", sub: "DeepSeek AI" },
] as const;

const PROVIDER_COLORS: Record<string, string> = {
  lovable: "bg-emerald-100 text-emerald-800 border-emerald-200",
  claude: "bg-violet-100 text-violet-800 border-violet-200",
  grok: "bg-blue-100 text-blue-800 border-blue-200",
  deepseek: "bg-teal-100 text-teal-800 border-teal-200",
};

const SUGGESTED_QUESTIONS = [
  "Como importar a planilha do SIGECOM?",
  "Como credenciar um atleta com QR externo?",
  "O que fazer quando aparece pendência de CPF inválido?",
  "Como funciona o filtro de provas por etapa?",
  "Como resolver a pendência TM 2012?",
  "Como liberar provas para competição?",
];

// ─── Component ────────────────────────────────────────────────────────

export default function AjudaChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>(
    Object.fromEntries(PROVIDERS.map((p) => [p.id, { ok: null, testing: false }])),
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Send message ──────────────────────────────────────────────────

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: newMessages.map(({ role, content }) => ({ role, content })) },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: (data as any).response as string,
          provider: (data as any).provider as string,
        },
      ]);
    } catch (e: any) {
      toast.error("Falha ao enviar: " + (e?.message ?? String(e)));
      setMessages((prev) => prev.slice(0, -1)); // remove user message on error
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  // ── Test provider ─────────────────────────────────────────────────

  async function testProvider(providerId: string) {
    setProviderStatus((prev) => ({ ...prev, [providerId]: { ok: null, testing: true } }));
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: [], test_provider: providerId },
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      setProviderStatus((prev) => ({
        ...prev,
        [providerId]: { ok: result.ok, error: result.error, testing: false },
      }));
    } catch (e: any) {
      setProviderStatus((prev) => ({
        ...prev,
        [providerId]: { ok: false, error: e?.message ?? String(e), testing: false },
      }));
    }
  }

  async function testAll() {
    for (const p of PROVIDERS) await testProvider(p.id);
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto py-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          Ajuda — Chat com IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tire dúvidas sobre o uso do sistema. A IA conhece todos os módulos do JER Gestão.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: chat */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Messages */}
          <Card className="flex-1">
            <ScrollArea className="h-[480px]">
              <div className="p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-12 space-y-3">
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Olá! Sou o assistente do JER Gestão.<br />
                      Pergunte sobre importação, credenciamento, competições e mais.
                    </p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[80%] space-y-1 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted rounded-tl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                      {msg.provider && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${PROVIDER_COLORS[msg.provider] ?? "bg-gray-100 text-gray-600"}`}>
                          {msg.provider}
                        </span>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-3 justify-start">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          </Card>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua dúvida sobre o sistema…"
              disabled={loading}
              className="flex-1"
              autoFocus
            />
            <Button type="submit" disabled={!input.trim() || loading} size="icon">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMessages([])}
                title="Limpar conversa"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </form>
        </div>

        {/* Right: sidebar */}
        <div className="space-y-4">
          {/* API test */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Testar APIs de IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {PROVIDERS.map((p) => {
                const status = providerStatus[p.id];
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {status.testing ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                      ) : status.ok === true ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : status.ok === false ? (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{p.label}</p>
                        <p className="text-[11px] text-muted-foreground">{p.sub}</p>
                        {status.ok === false && status.error && (
                          <p className="text-[10px] text-destructive truncate max-w-[140px]" title={status.error}>
                            {status.error}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 shrink-0"
                      onClick={() => testProvider(p.id)}
                      disabled={status.testing}
                    >
                      Testar
                    </Button>
                  </div>
                );
              })}
              <Separator />
              <Button
                className="w-full h-8 text-xs"
                variant="outline"
                onClick={testAll}
                disabled={PROVIDERS.some((p) => providerStatus[p.id].testing)}
              >
                Testar todos
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Ordem de fallback: Lovable AI → Claude → Grok → DeepSeek
              </p>
            </CardContent>
          </Card>

          {/* Suggested questions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                Perguntas frequentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={loading}
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
