// Your saved projects: open, delete, start a new one from a mood, or bring one in from a file.

import { useEffect, useRef, useState } from 'react';
import { FileDown, FileUp, Plus, Trash2 } from 'lucide-react';
import { MOOD_IDS, MOODS, type MoodId, type Project } from '@haku/core';
import { exportProjectFile, importProjectFile } from '../export.ts';
import { deleteProject, listProjects, loadProject, type ProjectSummary } from '../state/storage.ts';
import { Dialog } from './Dialog.tsx';
import { Select } from './controls.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
  current: Project;
  onOpen: (project: Project, message?: string) => void;
  onNew: (mood: MoodId) => void;
  notify: (message: string, isError?: boolean) => void;
}

const when = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function ProjectsDialog({ open, onClose, current, onOpen, onNew, notify }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodId>('rainy-study');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => listProjects().then(setProjects, () => setProjects([]));

  useEffect(() => {
    if (!open) return;
    setConfirming(null);
    void refresh();
  }, [open]);

  const openOne = async (id: string) => {
    if (id === current.id) return onClose();
    try {
      const p = await loadProject(id);
      if (!p) throw new Error('That project is gone');
      onOpen(p);
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), true);
    }
  };

  const remove = async (id: string) => {
    await deleteProject(id);
    setConfirming(null);
    await refresh();
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const p = await importProjectFile(file);
      onOpen(p, `Imported "${p.name}".`);
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), true);
    }
  };

  return (
    <Dialog open={open} title="Projects" onClose={onClose} wide>
      <div className="projects__new">
        <Select label="Mood for a new loop" value={mood} options={MOOD_IDS.map((id) => ({ value: id, label: MOODS[id].label }))} onChange={setMood} />
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            onNew(mood);
            onClose();
          }}
        >
          <Plus size={15} /> New loop
        </button>
      </div>

      <ul className="project-list" aria-label="Saved projects">
        {projects === null && <li className="project-list__empty">Loading…</li>}
        {projects?.length === 0 && <li className="project-list__empty">Nothing saved yet.</li>}
        {projects?.map((p) => {
          const isCurrent = p.id === current.id;
          return (
            <li key={p.id} className={`project-row ${isCurrent ? 'project-row--current' : ''}`}>
              <button type="button" className="project-row__open" onClick={() => void openOne(p.id)}>
                <span className="project-row__name">{isCurrent ? current.name : p.name}</span>
                <span className="project-row__meta">
                  {p.mood ? (MOODS[p.mood as MoodId]?.label ?? p.mood) : 'No mood'} · {p.scenes} {p.scenes === 1 ? 'scene' : 'scenes'} · {when(p.updatedAt)}
                  {isCurrent && ' · open now'}
                </span>
              </button>
              {confirming === p.id ? (
                <span className="project-row__confirm">
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => void remove(p.id)}>
                    Delete
                  </button>
                  <button type="button" className="btn btn--sm" onClick={() => setConfirming(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="icon-btn icon-btn--ghost"
                  aria-label={`Delete ${p.name}`}
                  // A native title here: a CSS tip would overflow the scrolling list.
                  title={isCurrent ? "Can't delete the open project" : `Delete ${p.name}`}
                  disabled={isCurrent}
                  onClick={() => setConfirming(p.id)}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="dialog__actions">
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          <FileUp size={15} /> Import file
        </button>
        <button type="button" className="btn" onClick={() => notify(`Saved ${exportProjectFile(current)}.`)}>
          <FileDown size={15} /> Save as file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </Dialog>
  );
}
