// Getting things out of Haku and back in: WAV, MIDI, and the project file itself.

import { buildArrangementScore, buildSceneScore, findScene, makeId, parseProject, scoreToMidi, type Project } from '@haku/core';
// The wav subpath, not the barrel: the barrel pulls Tone.js into the main bundle.
import { encodeWav } from '@haku/audio/wav';
import { engine } from './audio/engine.ts';

export type ExportScope = 'scene' | 'song';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'haku';

function download(data: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Give the browser a moment to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function baseName(project: Project, scope: ExportScope) {
  return scope === 'song' ? slug(project.name) : `${slug(project.name)}-${slug(findScene(project).name)}`;
}

/** A scene renders twice through so the loop's reverb tail has something to land on. */
export async function exportWav(project: Project, scope: ExportScope): Promise<string> {
  const audio = await engine.render(project, scope === 'song' ? { scope: 'song' } : { scope: 'scene', loops: 2 });
  const filename = `${baseName(project, scope)}.wav`;
  download(encodeWav(audio).slice().buffer, 'audio/wav', filename);
  return filename;
}

export function exportMidi(project: Project, scope: ExportScope): string {
  const score = scope === 'song' ? buildArrangementScore(project) : buildSceneScore(project);
  const filename = `${baseName(project, scope)}.mid`;
  download(scoreToMidi(project, score).slice().buffer, 'audio/midi', filename);
  return filename;
}

export function exportProjectFile(project: Project): string {
  const filename = `${slug(project.name)}.haku.json`;
  download(JSON.stringify(project, null, 2), 'application/json', filename);
  return filename;
}

/** Reads a project file. It gets a fresh id so importing never overwrites a saved project. */
export async function importProjectFile(file: File): Promise<Project> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error(`${file.name} isn't a JSON file`);
  }
  const project = parseProject(data);
  return { ...project, id: makeId('p'), updatedAt: new Date().toISOString() };
}
