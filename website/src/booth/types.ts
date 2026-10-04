import { layouts } from './core';
export type LayoutId = keyof typeof layouts;
export type Step = 'mode' | 'duo' | 'join' | 'room' | 'layout' | 'source' | 'design' | 'session' | 'upload' | 'export';
export interface CardState {
  layout: LayoutId;
  shots: string[];
  template: string | null;
  filter: string;
  color: string;
  caption: string;
  trackTitle?: string;
  trackSubtitle?: string;
  offsets?: { x: number; y: number }[];
  design: string;
}
