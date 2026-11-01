// The cozy study behind the app: plank walls, the big window across the top, a hanging lantern,
// vines down both sides, and a desk with books, a mug, a pinned photo, sheet music, and petals.
// It's fixed behind everything and never takes pointer events. Geometric pieces are CSS (room.css),
// organic ones are inline SVG (art.tsx).

import type { Project } from '@haku/core';
import { WindowPanel } from '../window/WindowPanel.tsx';
import { MugFlowers, SheetNotes, SunsetPicture, Vine } from './art.tsx';

interface Props {
  project: Project;
  playing: boolean;
}

const PETALS = [
  { left: '19%', bottom: 40, r: -20 },
  { left: '24%', bottom: 18, r: 35 },
  { left: '47%', bottom: 52, r: 10 },
  { left: '71%', bottom: 30, r: -40 },
  { left: '75%', bottom: 46, r: 25 },
  { left: '88%', bottom: 24, r: -10 },
];

export function Room({ project, playing }: Props) {
  return (
    <div className="room" aria-hidden="true">
      <div className="room__beam" />
      <div className="room__brace room__brace--left" />
      <div className="room__brace room__brace--right" />
      <WindowPanel project={project} playing={playing} />
      <Vine className="room__garland" length={560} seed={3} horizontal />

      <Vine className="room__vine room__vine--left" length={760} seed={7} />
      <Vine className="room__vine room__vine--left-2" length={420} seed={19} />
      <Vine className="room__vine room__vine--right" length={680} seed={11} />
      <Vine className="room__vine room__vine--right-2" length={360} seed={23} />

      <div className="lantern">
        <span className="lantern__light lantern__light--wide" />
        <span className="lantern__light" />
        <span className="lantern__chain" />
        <span className="lantern__cap" />
        <span className="lantern__body">
          <span className="lantern__flame" />
        </span>
        <span className="lantern__base" />
      </div>

      <div className="photo">
        <span className="photo__pin" />
        <span className="photo__pin photo__pin--right" />
        <SunsetPicture />
      </div>

      <div className="desk">
        <span className="desk__sun desk__sun--a" />
        <span className="desk__sun desk__sun--b" />
        <span className="desk__sun desk__sun--c" />
        {PETALS.map((p, i) => (
          <span key={i} className="petal" style={{ left: p.left, bottom: p.bottom, rotate: `${p.r}deg` }} />
        ))}
      </div>

      <div className="books">
        <span className="book book--red" />
        <span className="book book--green" />
        <span className="book book--blue" />
        <span className="book book--plum" />
        <span className="book book--lean" />
      </div>

      <div className="mug">
        <span className="mug__saucer" />
        <span className="mug__handle" />
        <span className="mug__body">
          <MugFlowers />
        </span>
      </div>

      <div className="sheet">
        <span className="sheet__page sheet__page--left">
          <SheetNotes seed={5} />
        </span>
        <span className="sheet__page sheet__page--right">
          <SheetNotes seed={13} />
        </span>
      </div>
    </div>
  );
}
