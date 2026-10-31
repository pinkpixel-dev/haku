import { Brush, Eraser, Highlighter, Pencil, SprayCan, Stamp, Trash2, type LucideIcon } from 'lucide-react';
import { BRUSH_IDS, BRUSHES, type BrushId } from '@haku/core';
import type { Tool } from '../canvas/DrawCanvas.tsx';
import { IconButton, Slider } from './controls.tsx';

export const BRUSH_ICONS: Record<BrushId, LucideIcon> = {
  pencil: Pencil,
  brush: Brush,
  chalk: Highlighter,
  spray: SprayCan,
  stamp: Stamp,
};

interface Props {
  brush: BrushId;
  size: number;
  tool: Tool;
  canClear: boolean;
  onBrush: (b: BrushId) => void;
  onSize: (s: number) => void;
  onTool: (t: Tool) => void;
  onClear: () => void;
}

export function ToolBar({ brush, size, tool, canClear, onBrush, onSize, onTool, onClear }: Props) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Drawing tools">
      <div className="segmented" role="group" aria-label="Brush">
        {BRUSH_IDS.map((id, i) => {
          const Icon = BRUSH_ICONS[id];
          return (
            <IconButton
              key={id}
              label={`${BRUSHES[id].label}: ${BRUSHES[id].note} (${i + 1})`}
              pressed={tool === 'draw' && brush === id}
              onClick={() => {
                onBrush(id);
                onTool('draw');
              }}
            >
              <Icon size={16} />
            </IconButton>
          );
        })}
      </div>
      <IconButton label="Eraser: drag a box over strokes (E)" pressed={tool === 'erase'} onClick={() => onTool(tool === 'erase' ? 'draw' : 'erase')}>
        <Eraser size={16} />
      </IconButton>
      <div className="toolbar__size">
        <Slider label="Size" value={size} onChange={onSize} format={(v) => (v < 0.34 ? 'Thin' : v < 0.67 ? 'Medium' : 'Thick')} />
      </div>
      <span className="toolbar__spacer" />
      <button type="button" className="text-btn" disabled={!canClear} onClick={onClear}>
        <Trash2 size={14} /> Clear layer
      </button>
    </div>
  );
}
