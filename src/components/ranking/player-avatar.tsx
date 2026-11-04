import { FlagIcon } from "../ui/flag-icon";

interface PlayerAvatarProps {
  nickname: string;
  avatarUrl?: string | null;
  countryCode?: string | null;
  size?: "regular" | "large";
}

/** No third-party placeholder requests: initials are rendered locally. */
export function PlayerAvatar({ nickname, avatarUrl, countryCode, size = "regular" }: PlayerAvatarProps) {
  const initial = nickname.trim().charAt(0).toLocaleUpperCase() || "♠";
  return (
    <div className={`arena-ranking-avatar relative shrink-0 ${size === "large" ? "arena-ranking-avatar--large" : ""}`}>
      <div className="arena-ranking-avatar-frame">
        <span aria-hidden="true">{initial}</span>
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={size === "large" ? 42 : 32}
            height={size === "large" ? 42 : 32}
            onError={(event) => { event.currentTarget.style.display = "none"; }}
          />
        )}
      </div>
      <div className="arena-ranking-avatar-flag" aria-hidden="true">
        <FlagIcon countryCode={countryCode ?? null} size={13} />
      </div>
    </div>
  );
}
