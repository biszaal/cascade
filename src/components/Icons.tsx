import Svg, { Path, Rect } from 'react-native-svg';
import { surface } from '@/design/tokens';

interface IconProps {
  size?: number;
  color?: string;
}

/** Line icons, drawn to match the board's ink weight. No icon font, no emoji. */

export function UndoIcon({ size = 20, color = surface.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 14L4 9l5-5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 9h9a7 7 0 010 14h-3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function RestartIcon({ size = 20, color = surface.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 12a8 8 0 11-2.6-5.9M20 3v5h-5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HintIcon({ size = 20, color = surface.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a6 6 0 00-3.6 10.8c.5.4.8 1 .9 1.6l.1.6h5.2l.1-.6c.1-.6.4-1.2.9-1.6A6 6 0 0012 3z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M10 19h4M10.5 21.5h3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function BackIcon({ size = 20, color = surface.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5l-7 7 7 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LockIcon({ size = 16, color = surface.graphite }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 11h12v9H6zM9 11V7a3 3 0 016 0v4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A filled padlock, for badges too small for the stroked LockIcon to read. */
export function PadlockSolidIcon({ size = 12, color = surface.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M8 11V8a4 4 0 018 0v3"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
        fill="none"
      />
      <Rect x={4.5} y={10} width={15} height={11.5} rx={2.5} fill={color} />
    </Svg>
  );
}

export function ChevronIcon({ size = 20, color = surface.graphite }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5l7 7-7 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
