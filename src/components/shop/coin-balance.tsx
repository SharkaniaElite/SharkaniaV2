import { useAuthStore } from "../../stores/auth-store";
import { Link } from "react-router-dom";
import { SharkCoin } from "../ui/shark-coin"; // 👈 Importamos la moneda oficial

export function CoinBalance() {
  const profile = useAuthStore((s) => s.profile);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated || !profile) return null;

  return (
    <Link
      to="/wallet"
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sk-bg-3 border border-sk-border-1 hover:border-sk-accent/40 transition-all group shadow-inner"
      title="Mis SharkCoins"
    >
      {/* 👇 La moneda con su glow cyan */}
      <SharkCoin size={16} className="group-hover:scale-110 transition-transform" />
      <span className="font-mono text-xs font-bold text-sk-text-1 group-hover:text-sk-accent transition-colors">
        {profile.shark_coins_balance.toLocaleString()}
      </span>
    </Link>
  );
}