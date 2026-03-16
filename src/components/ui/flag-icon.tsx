import { getFlagUrl, getCountryName } from "../../lib/countries";

interface FlagIconProps {
  countryCode: string | null;
  size?: number;
  className?: string;
  showCode?: boolean;
}

export function FlagIcon({
  countryCode,
  size = 18,
  className,
  showCode = false,
}: FlagIconProps) {
  if (!countryCode) {
    return <span className={className}>🌍</span>;
  }

  const url = getFlagUrl(countryCode);
  const name = getCountryName(countryCode);

  return (
    <span className="flag-wind">
  <img
    src={url}
    alt={name}
    title={name}
    width={size * 1.33}
    height={size}
    onError={(e) => {
      (e.target as HTMLImageElement).src = "/flags/unknown.svg";
    }}
  />
</span>
  );
}