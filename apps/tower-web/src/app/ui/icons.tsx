import type { SVGProps } from 'react';

/** Small stroke icons, drawn in the current colour (the display font has no arrows). */

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.1em"
      height="1.1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export const ArrowLeftIcon = () => (
  <Icon>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);
export const ArrowRightIcon = () => (
  <Icon>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);
export const ArrowDownIcon = () => (
  <Icon>
    <path d="M12 4v15M6 13l6 6 6-6" />
  </Icon>
);
export const ArrowUpIcon = () => (
  <Icon>
    <path d="M12 20V5M6 11l6-6 6 6" />
  </Icon>
);
/** Counter-clockwise. */
export const RotateLeftIcon = () => (
  <Icon>
    <path d="M4 5v5h5" />
    <path d="M5.5 15a7.5 7.5 0 1 0 1.3-8.3L4 10" />
  </Icon>
);
/** Clockwise. */
export const RotateRightIcon = () => (
  <Icon>
    <path d="M20 5v5h-5" />
    <path d="M18.5 15a7.5 7.5 0 1 1-1.3-8.3L20 10" />
  </Icon>
);
export const UndoIcon = () => (
  <Icon>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);
/** A tipped paint can, its drip in the chosen colour. */
export const BucketIcon = ({ color }: { color: string }) => (
  <Icon strokeWidth={2}>
    <path d="M11 3.5l7.5 7.5-6.5 6.5a2 2 0 0 1-2.8 0L4.5 12.8a2 2 0 0 1 0-2.8z" />
    <path d="M4.5 11.5h13.8" />
    <path
      d="M20 14.5c1 1.6 1.5 2.6 1.5 3.3a1.5 1.5 0 0 1-3 0c0-.7.5-1.7 1.5-3.3z"
      fill={color}
      stroke={color}
    />
  </Icon>
);
/** A speaker, with sound waves, or crossed out when muted. */
export const SpeakerIcon = ({ muted = false }: { muted?: boolean }) => (
  <Icon strokeWidth={2.2}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
    {muted ? (
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    ) : (
      <path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    )}
  </Icon>
);
