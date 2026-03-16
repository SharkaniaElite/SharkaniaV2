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
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <img
  src={url}
  alt={name}
  title={name}
  width={size * 1.33}
  height={size}
  className="transition-transform duration-150 ease-out group-hover:scale-110 ring-1 ring-black/20"
  style={{
    display: "inline-block",
    verticalAlign: "middle",
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
  }}
  onError={(e) => {
    (e.target as HTMLImageElement).src = "/flags/unknown.svg";
  }}
/>

      {showCode && (
        <span
          style={{
            fontSize: "11px",
            color: "var(--sk-text-3)",
            fontFamily: "monospace",
          }}
        >
          {countryCode.toUpperCase()}
        </span>
      )}
    </span>
  );
}