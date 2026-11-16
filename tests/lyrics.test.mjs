// node --test tests   (no dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseLyrics } from '../src/lib/lyrics.js';

const first = (s) => s.te.split('\n')[0];

test('the old app\'s songs: ||marker|| repeats the chorus it names', () => {
  const file = new URL('../../experiment/projectorSettings.json', import.meta.url);
  if (!existsSync(file)) return; // only on the machine that has the old app
  const songs = JSON.parse(readFileSync(file, 'utf8')).songs;
  const yesayya = parseLyrics(songs.find((s) => s.title.startsWith('Yesayya')).lyrics);
  // 3 verses each end with ||యేసయ్య||, so the opening stanza comes back three times
  const again = yesayya.stanzas.filter((s) => s.repeat);
  assert.equal(again.length, 3);
  assert.ok(again.every((s) => first(s).startsWith('యేసయ్య నా ప్రాణమా')));
  assert.ok(yesayya.stanzas.every((s) => !s.te.includes('||')));
  // numbered stanzas keep their words without the number and are labelled
  assert.ok(yesayya.stanzas.some((s) => s.label === 'Verse 2' && first(s).startsWith('జీవజలముగా')));

  const mahima = parseLyrics(songs.find((s) => s.title.startsWith('mahima')).lyrics);
  const rep = mahima.stanzas.filter((s) => s.repeat);
  assert.equal(rep.length, 3);
  assert.ok(rep.every((s) => first(s).startsWith('ఆరాధనా')));
});

test('a website paste: title, credits, chords, headings and a transliteration', () => {
  const raw = `Naa Praanamaa
Lyrics: Bro. Example
Singer: Someone
https://example.org/song

Chorus:
G        D       Em
నా ప్రాణమా నా ప్రాణమా (2)
Naa praanamaa naa praanamaa (2)

Verse 1
నీవే నా ఆశ్రయము
Neeve naa aashrayamu
`;
  const r = parseLyrics(raw);
  assert.equal(r.title, 'Naa Praanamaa');
  assert.equal(r.author, 'Bro. Example');
  assert.equal(r.stanzas.length, 2);
  assert.equal(r.stanzas[0].label, 'Chorus');
  assert.equal(r.stanzas[0].te, 'నా ప్రాణమా నా ప్రాణమా (2)');
  assert.equal(r.stanzas[0].en, 'Naa praanamaa naa praanamaa (2)');
  assert.equal(r.stanzas[1].label, 'Verse 1');
});

test('joint credits ("Lyrics & Tune:") and a ||marker|| above its transliteration line', () => {
  const raw = `Sthuthi Paadana
Lyrics & Tune: Bro. Example
Singer: Example Singer

పల్లవి:
స్తుతి పాడనా నా యేసయ్యా (2)
Sthuthi paadana naa yesayyaa (2)

చరణం 1:
చీకటిలో నా దీపమై నిలిచావు
Cheekatilo naa deepamai nilichaavu
ఒంటరినైతే నా తోడుగా ఉన్నావు ||స్తుతి||
Ontarinaithe naa thoduga unnaavu

చరణం 2:
కన్నీటిలో నా కన్నులు తుడిచావు ||స్తుతి||
Kanneetilo naa kannulu tudichaavu`;
  const r = parseLyrics(raw);
  assert.equal(r.title, 'Sthuthi Paadana');
  assert.equal(r.author, 'Bro. Example');
  assert.deepEqual(r.stanzas.map((s) => s.label), ['Chorus', 'Verse 1', 'Chorus again', 'Verse 2', 'Chorus again']);
  assert.equal(r.stanzas[1].en, 'Cheekatilo naa deepamai nilichaavu\nOntarinaithe naa thoduga unnaavu');
});

test('repeat marks can be hidden; the second language can be hidden', () => {
  const r = parseLyrics('నా ప్రాణమా (2)\nNaa praanamaa x2', { marks: 'hide', second: 'hide' });
  assert.equal(r.stanzas[0].te, 'నా ప్రాణమా');
  assert.equal(r.stanzas[0].en, '');
});

test('a Telugu stanza followed by its English stanza becomes one slide', () => {
  const r = parseLyrics('యేసు నా ప్రాణము\nయేసు నా బలము\n\nJesus my life\nJesus my strength');
  assert.equal(r.stanzas.length, 1);
  assert.equal(r.stanzas[0].en, 'Jesus my life\nJesus my strength');
});

test('no empty lines at all: four lines a slide', () => {
  const r = parseLyrics(Array.from({ length: 10 }, (_, i) => `పాట పంక్తి ${i + 1}`).join('\n'));
  assert.deepEqual(r.stanzas.map((s) => s.te.split('\n').length), [4, 4, 2]);
});

test('an English-only song stays the main text', () => {
  const r = parseLyrics('Amazing grace how sweet the sound\nThat saved a wretch like me');
  assert.equal(r.stanzas[0].te, 'Amazing grace how sweet the sound\nThat saved a wretch like me');
  assert.equal(r.stanzas[0].en, '');
});

test('Telugu zero-width joiners survive cleaning', () => {
  const r = parseLyrics('గుణాతిశయముల్‌ ధరనే');
  assert.ok(r.stanzas[0].te.includes('‌'));
});
