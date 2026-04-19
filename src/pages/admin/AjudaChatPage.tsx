import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Loader2, Bot, User, HelpCircle, RefreshCw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Como importar minha planilha de inscrições?",
  "Como credenciar um participante?",
  "Meu atleta não aparece na competição. O que faço?",
  "Como corrigir pendências da importação?",
  "Como liberar provas para iniciar competição?",
  "Como publicar os resultados?",
];

export default function AjudaChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

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
        { role: "assistant", content: (data as any).response as string },
      ]);
      setRetryCount(0);
    } catch {
      const next = retryCount + 1;
      setRetryCount(next);
      toast.error(
        next >= 2
          ? "Ainda com instabilidade. Se preferir, acione o suporte da sua equipe organizadora."
          : "Não consegui responder agora. Tente novamente em instantes.",
      );
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          Central de Ajuda
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tire dúvidas sobre o uso do sistema em linguagem simples.<br />
          Descreva o que você precisa fazer e eu te guio passo a passo.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: chat */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <Card className="flex-1">
            <ScrollArea className="h-[480px]">
              <div className="p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-12 space-y-3">
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Olá! 👋<br />
                      Posso te ajudar com importação, credenciamento, competição e resultados.<br />
                      Me diga o que você precisa fazer.
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
                    <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted rounded-tl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
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
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Estou preparando sua resposta...</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          </Card>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Ex.: "Não estou conseguindo credenciar um atleta"'
              disabled={loading}
              className="flex-1"
              autoFocus
            />
            <Button type="submit" disabled={!input.trim() || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Enviar dúvida</>}
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => { setMessages([]); setRetryCount(0); }}
                title="Limpar conversa"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </form>
        </div>

        {/* Right: suggested questions only */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Perguntas rápidas</h2>
            </div>
            <div className="space-y-2">
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
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
