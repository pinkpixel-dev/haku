import { useEffect, useRef, useState } from 'react';
import { Headphones, Plus, Trash2, VolumeX } from 'lucide-react';
import { DRUM_KITS, HARMONY_MODES, INSTRUMENT_IDS, INSTRUMENTS, type InstrumentId, type Scene } from '@haku/core';
import type { Command } from '@haku/protocol';
import { IconButton, Select, Slider, titleCase } from './controls.tsx';
import { Sprig } from './room/art.tsx';

interface Props {
  scene: Scene;
  activeLayerId: string | null;
  onSelect: (id: string) => void;
  run: (cmd: Command) => void;
}

const instrumentOptions = INSTRUMENT_IDS.map((id) => ({ value: id, label: INSTRUMENTS[id].label }));
const OCTAVES = ['-2', '-1', '0', '1', '2'] as const;

export function LayerPanel({ scene, activeLayerId, onSelect, run }: Props) {
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!adding) return;
    addRef.current?.querySelector<HTMLButtonElement>('.add-layer__option')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setAdding(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAdding(false);
        addButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [adding]);

  const addLayer = (instrument: InstrumentId) => {
    run({ type: 'add_layer', instrument, scene: scene.id });
    setAdding(false);
    addButtonRef.current?.focus();
  };
  const update = (layer: string, patch: Omit<Extract<Command, { type: 'update_layer' }>, 'type' | 'layer'>) => run({ type: 'update_layer', layer, scene: scene.id, ...patch });

  return (
    <section className="panel layers" aria-labelledby="layers-title">
      <h2 id="layers-title" className="panel__title">
        Layers <Sprig />
      </h2>

      <ul className="layer-list">
        {scene.layers.map((layer) => {
          const active = layer.id === activeLayerId;
          const drums = INSTRUMENTS[layer.instrument].kind === 'drums';
          return (
            <li key={layer.id} className={`layer ${active ? 'layer--active' : ''} ${layer.muted ? 'layer--muted' : ''}`}>
              <div className="layer__row">
                <button type="button" className="layer__select" aria-pressed={active} onClick={() => onSelect(layer.id)}>
                  <span className="layer__swatch" style={{ background: layer.color }} aria-hidden="true" />
                  <span className="layer__text">
                    <span className="layer__name">{layer.name}</span>
                    <span className="layer__meta">
                      {INSTRUMENTS[layer.instrument].label} · {layer.strokes.length} {layer.strokes.length === 1 ? 'stroke' : 'strokes'}
                    </span>
                  </span>
                </button>
                <IconButton label={layer.muted ? `Unmute ${layer.name}` : `Mute ${layer.name}`} pressed={layer.muted} onClick={() => update(layer.id, { muted: !layer.muted })}>
                  <VolumeX size={15} />
                </IconButton>
                <IconButton label={layer.solo ? `Unsolo ${layer.name}` : `Solo ${layer.name}`} pressed={layer.solo} onClick={() => update(layer.id, { solo: !layer.solo })}>
                  <Headphones size={15} />
                </IconButton>
              </div>

              {active && (
                <div className="layer__detail">
                  <Slider label="Volume" value={layer.volume} onChange={(volume) => update(layer.id, { volume })} />
                  <Slider
                    label="Pan"
                    value={layer.pan}
                    min={-1}
                    max={1}
                    format={(v) => (Math.abs(v) < 0.02 ? 'C' : `${v < 0 ? 'L' : 'R'}${Math.round(Math.abs(v) * 100)}`)}
                    onChange={(pan) => update(layer.id, { pan })}
                  />
                  <Select label="Instrument" value={layer.instrument} options={instrumentOptions} onChange={(instrument) => update(layer.id, { instrument })} />
                  {drums ? (
                    <Select label="Kit" value={layer.kit} options={DRUM_KITS.map((k) => ({ value: k, label: titleCase(k) }))} onChange={(kit) => update(layer.id, { kit })} />
                  ) : (
                    <div className="field-row">
                      <Select label="Harmony" value={layer.harmony} options={HARMONY_MODES.map((m) => ({ value: m, label: titleCase(m) }))} onChange={(harmony) => update(layer.id, { harmony })} />
                      <Select
                        label="Octave"
                        value={String(layer.octave) as (typeof OCTAVES)[number]}
                        options={OCTAVES.map((o) => ({ value: o, label: Number(o) > 0 ? `+${o}` : o }))}
                        onChange={(o) => update(layer.id, { octave: Number(o) })}
                      />
                    </div>
                  )}
                  <button type="button" className="text-btn text-btn--danger" onClick={() => run({ type: 'remove_layer', layer: layer.id, scene: scene.id })}>
                    <Trash2 size={14} /> Remove layer
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="add-layer" ref={addRef}>
        <button
          ref={addButtonRef}
          type="button"
          className="btn btn--primary add-layer__button"
          aria-expanded={adding}
          aria-controls="add-layer-menu"
          onClick={() => setAdding((a) => !a)}
        >
          <Plus size={16} aria-hidden="true" /> Add layer
        </button>
        {adding && (
          <div id="add-layer-menu" className="add-layer__menu" role="group" aria-label="Pick an instrument for the new layer">
            {INSTRUMENT_IDS.map((id) => (
              <button key={id} type="button" className="add-layer__option" onClick={() => addLayer(id)}>
                {INSTRUMENTS[id].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
