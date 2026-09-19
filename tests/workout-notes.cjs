const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');

// Run with Playwright available through node_modules or NODE_PATH.
const root = path.resolve(__dirname, '../MuscuApp');
const server = http.createServer(async (req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403).end(); return;
  }
  const target = file === root ? path.join(root, 'index.html') : file;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  try {
    res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
    res.end(await fs.readFile(target));
  } catch { res.writeHead(404).end(); }
});

(async () => {
  let browser;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
      localStorage.setItem('dako_onboarded', '1');
      localStorage.setItem('dako_lastbackup', new Date().toISOString().slice(0, 10));
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => typeof STORAGE_READY !== 'undefined' && STORAGE_READY);
    const ids = await page.evaluate(() => {
      const s = PROGRAM[0];
      go('seance', s.id); startWorkout(s.id);
      return { sid: s.id, ex: s.ex[0].id, other: s.ex[1].id, technical: s.ex[0].notes };
    });
    const field = page.locator('.session-note').first();
    const note = 'Isolation bonne\nRessenti correct <test> & "ok"';
    await field.fill(note);
    await page.locator('.session-note').nth(1).fill('Exercice non realise : fatigue');
    assert.equal(await page.evaluate(id => JSON.parse(localStorage.getItem('muscu_v3')).active.exNotes[id], ids.ex), note);
    await page.reload();
    await page.waitForFunction(() => typeof go === 'function');
    await page.locator('#splash').waitFor({ state: 'detached' });
    await page.evaluate(sid => { closeSheet(); go('seance', sid); }, ids.sid);
    assert.equal(await field.inputValue(), note);
    await page.evaluate(() => { togglePause(); togglePause(); });
    assert.equal(await field.inputValue(), note);
    for (const width of [360, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['dark', 'rose']) {
        await page.evaluate(theme => { SETTINGS.theme=theme; applyTheme(); render(); }, theme);
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.session-note').closest('.card')).opacity === '1');
        await field.evaluate(el => el.scrollIntoView({ block: 'center' }));
        assert(await field.evaluate(el => {
          const r=el.getBoundingClientRect(), p=el.closest('.card').getBoundingClientRect();
          return r.width>100 && r.left>=p.left && r.right<=p.right && r.right<=innerWidth;
        }));
        await page.screenshot({ path: path.join(os.tmpdir(), `dko-notes-${theme}-${width}.png`) });
      }
    }
    const card = page.locator('.card[data-ex]').first();
    await card.locator('.w').first().fill('20');
    await card.locator('.r').first().fill('10');
    await card.locator('.chk').first().click();
    await page.evaluate(() => { finishWorkout(); closeSheet(); go('suivi'); });
    let workouts = await page.evaluate(() => DB.workouts);
    assert.equal(workouts.length, 1);
    assert.equal(workouts[0].exNotes[ids.ex], note);
    assert.equal(workouts[0].exNotes[ids.other], 'Exercice non realise : fatigue');
    assert.equal(await page.evaluate(id => EXO[id].notes, ids.ex), ids.technical);
    assert((await page.evaluate(() => historyHTML())).includes('&lt;test&gt;'));
    assert((await page.evaluate(() => coachHistoryText())).includes(note));
    assert((await page.evaluate(id => progHTML(EXO[id]), ids.ex)).includes('Isolation bonne'));

    // A new workout on the same day must not inherit or overwrite its predecessor.
    await page.evaluate(sid => { go('seance', sid); startWorkout(sid); }, ids.sid);
    assert.equal(await field.inputValue(), '');
    await field.fill('Deuxieme seance');
    await card.locator('.chk').first().click();
    await page.evaluate(() => { finishWorkout(); closeSheet(); showEditWorkout(0); });
    await page.locator('.we-note').first().fill('Premiere seance corrigee');
    await page.locator('#wsave').click();
    workouts = await page.evaluate(() => DB.workouts);
    assert.equal(workouts[0].exNotes[ids.ex], 'Premiere seance corrigee');
    assert.equal(workouts[1].exNotes[ids.ex], 'Deuxieme seance');

    // Round-trip through the real backup importer, including note-only exercises.
    const backup = await page.evaluate(() => exportPayload());
    await page.evaluate(backup => {
      DB.workouts=[]; showData();
      document.getElementById('shArea').value=JSON.stringify(backup);
      doImport();
    }, backup);
    await page.locator('#importMerge').click();
    await page.waitForFunction(() => DB.workouts.length === 2 && !sheet.dataset.importing);
    assert.deepEqual(await page.evaluate(() => DB.workouts), workouts);
    await page.evaluate(() => { showEditWorkout(0); });
    await page.locator('.we-note').first().fill('');
    await page.locator('#wsave').click();
    assert.equal(await page.evaluate(id => workoutNote(DB.workouts[0], id), ids.ex), '');

    // Old workouts and already-running sessions have no exNotes field.
    await page.evaluate(sid => {
      delete DB.workouts[1].exNotes;
      go('seance', sid); startWorkout(sid); delete DB.active.exNotes; render();
    }, ids.sid);
    assert.equal(await field.inputValue(), '');
    await field.fill('Ancienne seance compatible');
    assert.equal(await page.evaluate(id => DB.active.exNotes[id], ids.ex), 'Ancienne seance compatible');
    assert.deepEqual(errors, []);
    console.log('PASS: autosave, reload, pause, themes/mobile/desktop, history/edit, same-day isolation, export/import, legacy compatibility, HTML escaping.');
    console.log('Screenshots: ' + path.join(os.tmpdir(), 'dko-notes-*.png'));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => { console.error(err); process.exitCode=1; });
