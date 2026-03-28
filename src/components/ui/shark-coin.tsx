import { cn } from "../../lib/cn"; // Asegúrate de que esta importación sea correcta en tu proyecto

const SHARK_COIN_URL =
  "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif";

interface SharkCoinProps {
  size?: number;
  className?: string;
}

export function SharkCoin({ size = 16, className = "" }: SharkCoinProps) {
  return (
    <img
      src={SHARK_COIN_URL}
      alt="SharkCoin"
      width={size}
      height={size}
      /* 👇 AQUÍ ESTÁ EL CAMBIO 👇 */
      className={cn(
        "object-contain inline-block shrink-0",
        "drop-shadow-[0_0_8px_rgba(0,255,204,0.4)]", // Brillo Cyan Sharkania
        className
      )}
      loading="eager"
    />
  );
}