// src/components/ui/shark-coin.tsx

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
      className={`inline-block shrink-0 ${className}`}
      loading="eager"
    />
  );
}