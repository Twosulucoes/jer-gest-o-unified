import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Share2, Copy, Trophy, Calendar, MapPin, Dumbbell, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VisualIdentity } from "@/components/public/VisualIdentity";

interface AthleteProfile {
  athlete: {
    full_name: string;
    gender: string;
    birth_year: number;
    photo_url: string | null;
    participant_type: string;
    status: string;
  };
  delegation: {
    name: string;
    city: string | null;
    state: string | null;
  };
  modalities: Array<{
    sport_name: string;
    event_name: string;
    category_name: string;
    is_collective: boolean;
    enrollment_status: string;
  }>;
  schedule_next: Array<{
    sport_name: string;
    event_name: string;
    match_date: string | null;
    start_time: string | null;
    venue_name: string | null;
  }>;
  results_public: Array<{
    sport_name: string;
    event_name: string;
    position: number | null;
    score: string | null;
    result_text: string | null;
    outcome: string | null;
    match_date: string | null;
  }>;
  updated_at: string;
  error?: string;
  message?: string;
}

const genderLabel: Record<string, string> = { M: "Masculino", F: "Feminino", X: "Outro" };
const typeLabel: Record<string, string> = {
  athlete: "Atleta", coach: "Técnico", head_of_delegation: "Chefe de Delegação", staff: "Staff"
};

export default function AtletaPublicProfilePage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["athlete-public-profile", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_athlete_public_profile", {
        p_token: token!,
      });
      if (error) throw error;
      return data as unknown as AthleteProfile;
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: data?.athlete?.full_name ?? "Perfil do Atleta", url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copiado!");
  };

  if (isLoading) return <ProfileSkeleton />;

  if (isError || !data || data.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-xl font-bold text-foreground">QR inválido ou expirado</h1>
            <p className="text-muted-foreground text-sm">
              Este link não é mais válido. Solicite um novo QR Code à organização do evento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { athlete, delegation, modalities, schedule_next, results_public, updated_at } = data;
  const initials = athlete.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex justify-center">
        <VisualIdentity size="sm" subtitle="Perfil Público" />
      </div>

      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto flex flex-col items-center text-center gap-3">
          <Avatar className="h-24 w-24 border-4 border-primary-foreground/20">
            {athlete.photo_url ? (
              <AvatarImage src={athlete.photo_url} alt={athlete.full_name} />
            ) : null}
            <AvatarFallback className="text-2xl font-bold bg-primary-foreground/10 text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold">{athlete.full_name}</h1>
          <div className="flex flex-wrap gap-2 justify-center">
            <Badge variant="secondary" className="bg-primary-foreground/15 text-primary-foreground border-0">
              {typeLabel[athlete.participant_type] ?? athlete.participant_type}
            </Badge>
            <Badge variant="secondary" className="bg-primary-foreground/15 text-primary-foreground border-0">
              {genderLabel[athlete.gender] ?? athlete.gender}
            </Badge>
            {athlete.birth_year && (
              <Badge variant="secondary" className="bg-primary-foreground/15 text-primary-foreground border-0">
                Nasc. {athlete.birth_year}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4 pb-8">
        {/* Delegation */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Delegação / Escola
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-foreground">{delegation.name}</p>
            {(delegation.city || delegation.state) && (
              <p className="text-sm text-muted-foreground">
                {[delegation.city, delegation.state].filter(Boolean).join(" — ")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Modalities */}
        {modalities && modalities.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Dumbbell className="h-4 w-4" /> Modalidades e Provas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {modalities.map((m, i) => (
                <div key={i} className="flex items-start justify-between gap-2 p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-foreground">{m.sport_name}</p>
                    <p className="text-sm text-muted-foreground">{m.event_name} — {m.category_name}</p>
                  </div>
                  <Badge variant={m.enrollment_status === "confirmed" ? "default" : "secondary"} className="text-xs shrink-0">
                    {m.enrollment_status === "confirmed" ? "Confirmado" : m.enrollment_status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Schedule */}
        {schedule_next && schedule_next.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Próximas Atividades
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {schedule_next.map((s, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground">{s.sport_name} — {s.event_name}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    {s.match_date && (
                      <span>{format(new Date(s.match_date), "dd/MM", { locale: ptBR })}</span>
                    )}
                    {s.start_time && <span>{s.start_time.slice(0, 5)}</span>}
                    {s.venue_name && <span>📍 {s.venue_name}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {results_public && results_public.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Resultados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {results_public.map((r, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{r.sport_name} — {r.event_name}</p>
                    {r.match_date && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.match_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {r.position && (
                      <Badge variant={r.position <= 3 ? "default" : "secondary"}>
                        {r.position}º
                      </Badge>
                    )}
                    {r.score && <p className="text-sm font-medium">{r.score}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Atualizado em {format(new Date(updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-1" /> Compartilhar
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-1" /> Copiar link
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-3">
          <Skeleton className="h-24 w-24 rounded-full bg-primary-foreground/10" />
          <Skeleton className="h-7 w-48 bg-primary-foreground/10" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full bg-primary-foreground/10" />
            <Skeleton className="h-5 w-20 rounded-full bg-primary-foreground/10" />
          </div>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
