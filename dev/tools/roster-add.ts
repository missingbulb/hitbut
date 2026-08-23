// Drafts a roster entry. Adding a person to the roster is a reviewed change (#31), so this
// prints an entry to paste and review — it does not write the file.
//
// What it is actually for is the id: the slug is minted once, here, against the ids the
// roster already holds, and from then on it is the person's citation and never moves.
//
// Usage: node dev/tools/roster-add.ts --name "שם מלא" --role "תפקיד" [--source <module>] [--from YYYY-MM-DD]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mintFigureId } from '../../src/backend/corpus/ids.ts';
import { readRoster } from '../../src/backend/corpus/roster.ts';

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const name = argument('name');
const role = argument('role');
if (!name || !role) {
  console.error('roster-add: needs --name and --role');
  process.exit(2);
}

const path = fileURLToPath(new URL('../../data/roster.json', import.meta.url));
const { entries: roster } = readRoster(JSON.parse(readFileSync(path, 'utf8')));

const clash = roster.find((entry) => entry.displayName === name || entry.aliases.includes(name));
if (clash) {
  console.error(`roster-add: "${name}" is already on the roster as ${clash.id}. Edit that entry rather than adding a second.`);
  process.exit(1);
}

const entry = {
  id: mintFigureId(name, roster.map((existing) => existing.id)),
  displayName: name,
  role,
  aliases: [],
  qualifies: 'TODO — what put this person in the public eye, in the capacity we track them in.',
  coverage: [{ sourceModule: argument('source') ?? 'TODO', from: argument('from') ?? 'TODO' }],
  status: 'active',
};

console.log(`\nPaste into the "entries" array of data/roster.json, then fill in every TODO:\n`);
console.log(JSON.stringify(entry, null, 2).split('\n').map((line) => `    ${line}`).join('\n'));
console.log(`\nThe id is minted once and is this person's citation from now on — review it before it lands.\n`);
