import { useState } from 'react';
import { User } from 'lucide-react';

export function MemberAvatar({
  name,
  photoUrl,
  photoVisibility = 'show',
  size = 'md',
}: {
  name: string;
  photoUrl?: string | null;
  photoVisibility?: 'show' | 'hide';
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-12 h-12 text-base'
      : size === 'lg'
        ? 'w-20 h-20 text-2xl'
        : 'w-16 h-16 text-xl';

  const canShowPhoto = Boolean(photoUrl && photoVisibility === 'show' && !failed);
  const initial = name.trim().charAt(0) || 'চ';

  return (
    <div
      className={`${dims} rounded-full bg-white text-blue-700 border-2 border-white/80 shadow-sm flex items-center justify-center overflow-hidden shrink-0 font-bold`}
    >
      {canShowPhoto ? (
        <img
          src={photoUrl!}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : initial ? (
        <span aria-hidden="true">{initial}</span>
      ) : (
        <User className="w-1/2 h-1/2 text-blue-600" />
      )}
    </div>
  );
}
