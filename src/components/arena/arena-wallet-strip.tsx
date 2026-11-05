import { useAuthStore } from "../../stores/auth-store";
import { useSharkCoinsBalance } from "../../hooks/use-shop";
/** Conserva la consulta y visualización anterior del saldo del jugador. Solo lectura. */
export function ArenaWalletStrip() {
  const user = useAuthStore((state) => state.user);
  const { data: balance } = useSharkCoinsBalance();
  if (!user) return null;
  return <div className="arena-utility-strip" aria-label="Saldo de tu cuenta Sharkania">
    <p>Tu cuenta SHARKANIA <strong>Shark Coins disponibles</strong></p>
    <span className="arena-wallet-balance">
      {balance ?? 0}
      <img src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif" alt="Shark Coins" loading="lazy" decoding="async" width={28} height={28} />
    </span>
  </div>;
}
