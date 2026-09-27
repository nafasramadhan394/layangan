import type { Avatar } from '../lib/types';

export function AvatarBadge({ avatar, size = 56, online }: { avatar: Avatar; size?: number; online?: boolean }) {
  const { color, skin, hat } = avatar;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} className="rounded-full border-2 border-ink bg-sky">
        <circle cx="32" cy="32" r="31" fill="#bfe6ff" />
        <rect x="16" y="42" width="32" height="26" rx="10" fill={color} />
        <circle cx="32" cy="30" r="13" fill={skin} />
        <circle cx="27" cy="29" r="1.8" fill="#1f1a3d" />
        <circle cx="37" cy="29" r="1.8" fill="#1f1a3d" />
        <path d="M27 35 q5 4 10 0" stroke="#1f1a3d" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {hat === 'caping' && <path d="M8 24 L32 6 L56 24 Z" fill="#d9b36c" stroke="#a07a3a" strokeWidth="1.5" />}
        {hat === 'peci' && <rect x="20" y="12" width="24" height="9" rx="2" fill="#1b1b1b" />}
        {hat === 'cap' && (
          <g fill="#e63946">
            <path d="M19 24 a13 12 0 0 1 26 0 Z" />
            <rect x="32" y="21" width="20" height="4" rx="2" />
          </g>
        )}
        {hat === 'bandana' && <rect x="19" y="19" width="26" height="5" fill="#e63946" />}
      </svg>
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white ${online ? 'bg-good' : 'bg-muted'}`} />
      )}
    </div>
  );
}
