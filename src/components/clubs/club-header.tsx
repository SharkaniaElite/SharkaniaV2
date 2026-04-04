// src/components/clubs/club-header.tsx
import { getCountryName } from "../../lib/countries";
import { FlagIcon } from "../ui/flag-icon";
import { Chip } from "../ui/chip";
import type { ClubWithRooms } from "../../types";

interface ClubHeaderProps {
  club: ClubWithRooms;
}

export function ClubHeader({ club }: ClubHeaderProps) {
  const rooms = club.club_rooms?.map((cr) => cr.poker_rooms?.name).filter(Boolean) ?? [];

  const bgPos = club.banner_url ? (club.banner_url.match(/#pos=(\d+)/)?.[1] ?? 50) : 50;
  const cleanUrl = club.banner_url?.split('#')[0];

  return (
    <div 
      className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 relative overflow-hidden"
      style={club.banner_url ? {
        backgroundImage: `linear-gradient(to right, rgba(12,13,16,0.9) 20%, rgba(12,13,16,0.4) 100%), url('${cleanUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: `center ${bgPos}%`
      } : undefined}
    >
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="text-4xl"><FlagIcon countryCode={club.country_code} size={48} /></div>
        <div className="flex-1">
          <h1 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight mb-1 drop-shadow-md">
            {club.name}
          </h1>
          <p className="text-sk-sm text-sk-text-2 mb-3">
            {club.description}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Chip>{getCountryName(club.country_code)}</Chip>
            {rooms.map((r) => (
              <Chip key={r}>{r}</Chip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}