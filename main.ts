// Hand-in driver for this entry: `node main.ts`.
//
// Two jobs, in this order. First, stage what the entry ships: this directory's game/ folder (the
// playable game, plain static files a desktop browser opens offline, no build step) and, when it is
// there, this directory's screenshots/ folder, both copied whole into the output directory. Second,
// summarise that staged copy as dossier.json, the document the judge reads, using the make.fun
// library vendored beside this file.
//
// The output directory is /output inside the grader's container. Set MAKEFUN_OUTPUT_DIR to point
// the same run somewhere else when trying it locally:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// To play the game locally, run `node serve.ts` and open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The directory holding main.ts, and so game/, screenshots/ and vendor/ as well. */
const entryRoot = fileURLToPath(new URL('.', import.meta.url));

/** Where the staged entry and its dossier land: the grader's /output unless the environment says otherwise. */
const targetRoot = process.env.MAKEFUN_OUTPUT_DIR || '/output';

/**
 * The limits the scorer holds an entry to (its gate.json): the dossier's text may run to 160 KiB, at
 * most four screenshots of 256 KiB each, and game/ may hold 993 entries, 48 MiB in all, with no path
 * over 1000 bytes. buildDossier uses only text_max_bytes to size what it writes; the remaining four
 * exist so this program refuses an entry in exactly the places the scorer would.
 */
const limits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// The staging area itself, before anything is put in it.
mkdirSync(targetRoot, { recursive: true });

// game/ is the one required folder, so it is copied without a check: if it is missing, that is an
// error worth hearing about, not something to skip past.
cpSync(join(entryRoot, 'game'), join(targetRoot, 'game'), { recursive: true });

// screenshots/ gets its place in the output either way; only the copy depends on the source existing.
const shotsSource = join(entryRoot, 'screenshots');
const shotsTarget = join(targetRoot, 'screenshots');
mkdirSync(shotsTarget, { recursive: true });
if (existsSync(shotsSource)) cpSync(shotsSource, shotsTarget, { recursive: true });

// The dossier is written last, from the staged copy rather than from this directory, so it describes
// exactly the bytes being handed in.
writeFileSync(join(targetRoot, 'dossier.json'), buildDossier(targetRoot, limits));
