import type { EventStatistics } from "../../api/client";
import { dayLabel, periodPhrase } from "../../utils/eventDay";

/**
 * Faixa com o dia do evento em que o credenciamento está acontecendo
 * ("Dia 2 de 3 · 06/11"). Só aparece em evento com credenciamento por dia
 * (o COPOL); nos demais não renderiza nada.
 */
export function DayBanner({ stats }: { stats: EventStatistics | null }) {
  const multi = stats?.multiDay;
  if (!multi) return null;

  const today = multi.today;
  return (
    <div
      role="status"
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 16px",
        textAlign: "center",
        fontWeight: 800,
        fontSize: "clamp(15px, 4vw, 18px)",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        color: "#fff",
        backgroundColor: today ? "var(--primary)" : "var(--danger)",
      }}
    >
      {today ? (
        <>
          {dayLabel({ index: today.index, total: multi.total, date: today.date, period: today.period })}
          <span style={{ fontWeight: 600, opacity: 0.9, textTransform: "none", marginLeft: 10 }}>
            {today.period.checkedIn} credenciado(s) {periodPhrase(today.period)}
          </span>
        </>
      ) : (
        "Fora dos dias do evento — credenciamento indisponível"
      )}
    </div>
  );
}
