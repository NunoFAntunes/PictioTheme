import { useEffect } from 'react';
import { startHomeMusic } from '../home-music';
import { SoundSettingsButton } from './SoundSettingsButton';

/** The home page's tune, and the 🔊 button in its top corner to turn it down or off. */
export function HomeMusic() {
  useEffect(() => startHomeMusic(), []);
  return (
    <div className="absolute top-3 right-3 z-20 rounded-lg bg-paper/80 backdrop-blur-sm sm:top-4 sm:right-4">
      <SoundSettingsButton />
    </div>
  );
}
