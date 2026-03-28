// src/components/shop/coin-balance.tsx
import { useAuthStore } from "../../stores/auth-store";
import { Link } from "react-router-dom";

export function CoinBalance() {
  const profile = useAuthStore((s) => s.profile);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated || !profile) return null;

  return (
    <Link
      to="/wallet"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sk-bg-3 border border-sk-border-1 hover:border-sk-accent/40 transition-colors group"
      title="Mis SharkCoins"
    >
      <span className="text-sm">🪙</span>
      <span className="font-mono text-xs font-bold text-sk-accent group-hover:text-sk-text-1 transition-colors">
        {profile.shark_coins_balance.toLocaleString()}
      </span>
    </Link>
  );
}