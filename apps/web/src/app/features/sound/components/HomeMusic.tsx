import { useEffect } from 'react';
import { startHomeMusic } from '../home-music';
import { SoundSettingsButton } from './SoundSettingsButton';

/** The home page's tune, and the speaker in its top corner to turn it down or off. */
export function HomeMusic() {
  useEffect(() => startHomeMusic(), []);
  return (
    <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
      <SoundSettingsButton onDesk />
    </div>
  );
}
