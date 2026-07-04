import { useMemo } from 'react';

/**
 * Confete leve, 100% CSS, sem dependências. Renderiza N pedaços absolutos que
 * caem com leve rotação. Usado na tela de comemoração do form público gamificado.
 * `pointer-events-none` + overlay fixo para nunca bloquear a interface.
 */
export default function Confetti({ pieces = 80 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        // Determinístico por índice (evita re-render aleatório), mas variado.
        const rnd = (seed: number) => {
          const x = Math.sin(i * 99.13 + seed) * 10000;
          return x - Math.floor(x);
        };
        const colors = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];
        return {
          left: rnd(1) * 100,
          delay: rnd(2) * 0.6,
          duration: 2.2 + rnd(3) * 1.8,
          size: 6 + Math.floor(rnd(4) * 6),
          color: colors[Math.floor(rnd(5) * colors.length)],
          rotate: Math.floor(rnd(6) * 360),
          round: rnd(7) > 0.5,
        };
      }),
    [pieces],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes pesquisa-confetti-fall {
          0%   { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
        }
      `}</style>
      {items.map((it, idx) => (
        <span
          key={idx}
          style={{
            position: 'absolute',
            top: 0,
            left: `${it.left}%`,
            width: it.size,
            height: it.size,
            background: it.color,
            borderRadius: it.round ? '9999px' : '2px',
            transform: `rotate(${it.rotate}deg)`,
            animation: `pesquisa-confetti-fall ${it.duration}s linear ${it.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
