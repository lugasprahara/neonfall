// NEONFALL — hand-in program for the make.fun best-game-01 bounty.
//
// The game itself is the static site in game/ (plain files, no build step:
// game/index.html plus its ES modules, playable offline in a desktop
// browser). This program is the courier: it copies game/ and screenshots/
// from beside this file into the output directory and writes
// /output/dossier.json with buildDossier from the vendored make.fun
// library, so the scorer can rebuild the same dossier and compare bytes.
//
// Run it locally the same way the grader does, with MAKEFUN_OUTPUT_DIR
// standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with:  node serve.ts   (then open the printed URL)

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy a directory tree if it exists; report how many entries moved.
function copyTree(from: string, to: string): number {
  if (!existsSync(from)) return 0;
  cpSync(from, to, { recursive: true });
  return readdirSync(to, { recursive: true }).length;
}

mkdirSync(outputDir, { recursive: true });
const gameEntries = copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));
const shotEntries = copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));

// The gate's own limits, passed to the library so the dossier it writes is
// exactly the one the scorer rebuilds: source text capped at 160 KiB, at
// most 4 screenshots of 256 KiB each, game/ at most 993 entries / 48 MiB
// with no path longer than 1000 bytes.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`NEONFALL handed in: ${gameEntries} game entries, ${shotEntries} screenshots, dossier ${dossier.length} bytes -> ${outputDir}`);
