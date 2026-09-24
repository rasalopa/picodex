/**
 * Lists the strings of each translation that are older than their English text.
 *
 *   npm run i18n:outdated          every language
 *   npm run i18n:outdated -- ru    one language
 *
 * A string is outdated when git last changed its English line after its
 * translated line, so the translation may no longer say the same thing.
 * Run it before a release and send each translator their list.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { compareTranslation, keyTimes, parseBlame } from '../src/i18n/outdated.ts';

const DIR = 'src/i18n';

function blame(file) {
  const porcelain = execFileSync('git', ['blame', '--porcelain', '--', file], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return keyTimes(parseBlame(porcelain));
}

const day = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10);

const wanted = process.argv.slice(2);
const languages = readdirSync(DIR)
  .filter((name) => /^[a-z]{2}\.ts$/.test(name) && name !== 'en.ts')
  .map((name) => name.slice(0, 2))
  .filter((code) => wanted.length === 0 || wanted.includes(code));

const english = blame(`${DIR}/en.ts`);
for (const code of languages) {
  const { outdated, untranslated } = compareTranslation(english, blame(`${DIR}/${code}.ts`));
  console.log(`\n${code}: ${outdated.length} outdated, ${untranslated.length} not translated`);
  for (const { key, english: changed, translated } of outdated) {
    console.log(`  ${key}  (translated ${day(translated)}, English changed ${day(changed)})`);
  }
  if (untranslated.length > 0) {
    console.log(`  not translated, shown in English: ${untranslated.join(', ')}`);
  }
}
