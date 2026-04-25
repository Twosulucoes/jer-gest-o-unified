import { CheckCircle2, Smartphone, Trophy, Users, Paperclip, Send, LogIn, Mail, MessageCircle } from "lucide-react";

const PRIMARY = "#0B2B5A";
const BLUE = "#0F5AA6";
const TEAL = "#0BA3A3";
const GREEN = "#33B249";
const LIME = "#B5E12A";

const SYSTEM_URL = typeof window !== "undefined" ? window.location.origin : "";

const features = [
  {
    icon: Trophy,
    color: BLUE,
    title: "Lançamento de Resultados",
    description:
      "Lance placar e resultado de cada partida por modalidade. Suporte a esportes coletivos e individuais.",
    badge: "Novo",
    badgeColor: GREEN,
  },
  {
    icon: Users,
    color: TEAL,
    title: "Equipe de Arbitragem",
    description:
      "Registre árbitros, mesários, delegados e cronometristas vinculados a cada partida.",
  },
  {
    icon: Paperclip,
    color: "#8B5CF6",
    title: "Súmulas e Fotos",
    description:
      "Anexe súmulas em PDF e fotos da partida diretamente no sistema, organizadas por jogo.",
  },
  {
    icon: Send,
    color: "#F59E0B",
    title: "Publicação no Portal",
    description:
      "Com um toque, publique os resultados no portal público e inclua no Boletim do Dia.",
  },
];

const steps = [
  { number: "01", text: "Acesse o link do sistema no seu celular ou computador." },
  { number: "02", text: "Entre com as credenciais fornecidas pela equipe técnica." },
  { number: "03", text: "Selecione a modalidade que você coordena." },
  { number: "04", text: "Abra a partida e lance o resultado em segundos." },
];

export default function EntregaTecnicaPage() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#F6F8FC", minHeight: "100vh", color: "#0B1220" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <header style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${BLUE} 55%, ${TEAL} 100%)`, padding: "0 1rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 0 3rem" }}>
          {/* Logo row */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <img
              src="/brand/logo.png"
              alt="JER Gestão"
              style={{ height: 48, objectFit: "contain", filter: "brightness(0) invert(1)" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.3)" }} />
            <div>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
                53º Jogos Escolares de Roraima
              </p>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, margin: 0 }}>IDJUV · Instituto Acolher</p>
            </div>
          </div>

          {/* Badge */}
          <span style={{
            display: "inline-block", background: LIME, color: PRIMARY,
            fontSize: 11, fontWeight: 800, letterSpacing: "0.06em",
            textTransform: "uppercase", padding: "4px 12px", borderRadius: 99, marginBottom: "1rem",
          }}>
            Módulo entregue ✓
          </span>

          <h1 style={{ color: "#fff", fontSize: "clamp(1.6rem, 5vw, 2.4rem)", fontWeight: 800, margin: "0 0 0.75rem", lineHeight: 1.2, fontFamily: "'Montserrat', sans-serif" }}>
            Sistema de Gestão de<br />Resultados — JERs 2026
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1rem", margin: "0 0 2rem", maxWidth: 500, lineHeight: 1.6 }}>
            O módulo de lançamento de resultados está pronto para uso nos 53ºJERs.
            Acesse pelo celular, registre os dados e publique em tempo real.
          </p>

          <a
            href="/pwa/login"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#fff", color: PRIMARY,
              fontWeight: 700, fontSize: "0.95rem",
              padding: "0.8rem 1.8rem", borderRadius: 10, textDecoration: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
          >
            <LogIn size={18} />
            Acessar o sistema
          </a>
        </div>
      </header>

      {/* ── Funcionalidades ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1rem 2rem" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: PRIMARY, marginBottom: "0.4rem", fontFamily: "'Montserrat', sans-serif" }}>
          O que está disponível
        </h2>
        <p style={{ color: "#64748B", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
          Quatro funcionalidades integradas, todas acessíveis pelo celular.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} style={{
                background: "#fff", borderRadius: 14, padding: "1.25rem",
                border: "1px solid #E2E8F0", position: "relative", overflow: "hidden",
              }}>
                {f.badge && (
                  <span style={{
                    position: "absolute", top: 12, right: 12,
                    background: f.badgeColor, color: "#fff",
                    fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99,
                  }}>{f.badge}</span>
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, marginBottom: "0.75rem",
                  background: `${f.color}18`, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={20} color={f.color} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: "0.95rem", margin: "0 0 0.4rem", color: "#0B1220" }}>{f.title}</h3>
                <p style={{ color: "#64748B", fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>{f.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Acesso pelo celular ───────────────────────────────────────────────── */}
      <section style={{ background: "#fff", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 1rem", display: "grid", gridTemplateColumns: "auto 1fr", gap: "2rem", alignItems: "center" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: `linear-gradient(135deg, ${PRIMARY}, ${TEAL})`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Smartphone size={36} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: "1.15rem", margin: "0 0 0.4rem", color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
              100% mobile — funciona no celular
            </h2>
            <p style={{ color: "#64748B", fontSize: "0.9rem", margin: "0 0 1rem", lineHeight: 1.6 }}>
              Desenvolvido para uso na beira da quadra. Abra pelo navegador do seu celular, sem precisar instalar nada.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {["Seletor de modalidade", "Placar por toque", "Upload de súmula", "Publicação imediata"].map((tag) => (
                <span key={tag} style={{
                  background: "#F1F5F9", color: "#475569", fontSize: 12,
                  fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Como usar ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 1rem" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: PRIMARY, marginBottom: "1.5rem", fontFamily: "'Montserrat', sans-serif" }}>
          Como acessar
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {steps.map((s) => (
            <div key={s.number} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: PRIMARY,
                color: LIME, fontSize: 12, fontWeight: 900,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>{s.number}</div>
              <div style={{ paddingTop: 8, color: "#334155", fontSize: "0.92rem", lineHeight: 1.5 }}>{s.text}</div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: "2rem", background: `${PRIMARY}08`, border: `1.5px solid ${PRIMARY}20`,
          borderRadius: 12, padding: "1.25rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <CheckCircle2 size={16} color={GREEN} />
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: PRIMARY }}>Link de acesso</span>
          </div>
          <a
            href="/pwa/login"
            style={{ color: BLUE, fontWeight: 600, fontSize: "0.95rem", wordBreak: "break-all" }}
          >
            {SYSTEM_URL || "https://tecnica.jers.com.br"}/pwa/login
          </a>
          <p style={{ color: "#64748B", fontSize: "0.82rem", margin: "0.5rem 0 0" }}>
            As credenciais de acesso foram enviadas separadamente por e-mail.
          </p>
        </div>
      </section>

      {/* ── Suporte ───────────────────────────────────────────────────────────── */}
      <section style={{ background: PRIMARY, padding: "0 1rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 0" }}>
          <h2 style={{ color: "#fff", fontWeight: 800, fontSize: "1.15rem", margin: "0 0 0.5rem", fontFamily: "'Montserrat', sans-serif" }}>
            Precisa de ajuda?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", margin: "0 0 1.5rem" }}>
            Nossa equipe está disponível durante todo o evento.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <a href="mailto:institutoacolherr@gmail.com" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.12)", color: "#fff",
              padding: "0.6rem 1.2rem", borderRadius: 8, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600,
            }}>
              <Mail size={15} />
              institutoacolherr@gmail.com
            </a>
            <a href="mailto:caiocorrea.ctb@gmail.com" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.12)", color: "#fff",
              padding: "0.6rem 1.2rem", borderRadius: 8, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600,
            }}>
              <Mail size={15} />
              caiocorrea.ctb@gmail.com
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{ background: "#0A1F40", padding: "1.5rem 1rem", textAlign: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", margin: 0 }}>
          53º Jogos Escolares de Roraima · IDJUV · Instituto Acolher
          <br />
          <span style={{ fontSize: "0.72rem" }}>Plataforma desenvolvida por Two Soluções · twosulucoes.com.br</span>
        </p>
      </footer>

    </div>
  );
}
