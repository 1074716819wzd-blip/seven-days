// Checks the real production build in an isolated browser profile and origin.
// Version A/B differ only by a service-worker comment, simulating a new deployment.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const base = '/seven-days/';
const output = path.join(root, 'test-results');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(output, 'pwa-deployment-'));
let version = 'A';
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!urlPath.startsWith(base)) { res.writeHead(404).end(); return; }
    const relativePath = urlPath.slice(base.length) || 'index.html';
    const filename = path.resolve(dist, relativePath);
    if (!filename.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
    let bytes = await readFile(filename);
    if (relativePath === 'sw.js') bytes = Buffer.concat([bytes, Buffer.from(`\n// Deployment verification version ${version}\n`)]);
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${base}`;
let browser;
try {
  const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(new URL(manifest.start_url, url).pathname, base);
  assert.equal(new URL(manifest.scope, url).pathname, base);
  const html = await (await fetch(url)).text();
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const asset = new URL(match[1], url);
    assert.ok(asset.pathname.startsWith(base), `Asset outside base: ${asset}`);
    assert.equal((await fetch(asset)).status, 200, `Missing asset: ${asset}`);
  }
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
    assert.ok(icon);
    assert.equal((await fetch(new URL(icon.src, url))).status, 200);
    const png = await readFile(path.join(dist, icon.src));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  browser = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true, viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  const page = await browser.newPage();
  await page.goto(url);
  await page.getByRole('button', { name: '开始我的第一个 7 天' }).click();
  await page.getByRole('button', { name: '打开今天' }).click();
  await page.getByRole('textbox', { name: '新任务', exact: true }).fill('更新后保留的任务');
  await page.getByRole('button', { name: '添加任务', exact: true }).click();
  await page.getByRole('checkbox', { name: '完成：更新后保留的任务', exact: true }).click();
  await page.getByRole('textbox', { name: '消费金额' }).fill('126.50');
  await page.getByRole('button', { name: '保存金额' }).click();
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent.includes('已保存在本机'));
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const registration = await page.evaluate(async () => {
    const sw = await navigator.serviceWorker.ready;
    return { scope: sw.scope, scriptURL: sw.active.scriptURL };
  });
  assert.equal(registration.scope, url);
  assert.equal(registration.scriptURL, new URL('sw.js', url).href);
  const snapshot = () => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('seven-days', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('app', 'readonly').objectStore('app').get('data');
      get.onsuccess = () => { resolve({ version: db.version, data: get.result }); db.close(); };
      get.onerror = () => reject(get.error);
    };
  }));
  const before = await snapshot();
  await page.getByRole('button', { name: '数据与安装' }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出备份', exact: true }).click();
  const backup = JSON.parse(await readFile(await (await downloadEvent).path(), 'utf8'));
  const { exportedAt, ...backupData } = backup;
  assert.ok(exportedAt);
  assert.deepEqual(backupData, before.data);
  await page.getByLabel('选择 JSON 备份').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: '确认替换并恢复' }).click();
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent.includes('已保存在本机'));
  assert.deepEqual(await snapshot(), before);
  const cdp = await browser.newCDPSession(page);
  const installability = await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(installability.installabilityErrors, []);
  version = 'B';
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state === 'installed');
  await page.getByRole('button', { name: '数据与安装' }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: '更新应用（记录会保留）', exact: true }).click()
  ]);
  await page.getByRole('checkbox', { name: '取消完成：更新后保留的任务', exact: true }).waitFor();
  const after = await snapshot();
  assert.deepEqual(after, before);
  await browser.setOffline(true);
  await page.reload();
  await page.getByRole('checkbox', { name: '取消完成：更新后保留的任务', exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: '消费金额' }).inputValue(), '126.50');
  await page.getByRole('textbox', { name: '新任务', exact: true }).fill('正式构建离线记录');
  await page.getByRole('button', { name: '添加任务', exact: true }).click();
  await page.getByRole('button', { name: '修改：正式构建离线记录', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '修改：正式构建离线记录', exact: true }).waitFor();
  const report = { checkedAt: new Date().toISOString(), environment: 'Isolated localhost (not a production HTTPS URL)', base, manifest: 'passed', assetPaths: 'passed', serviceWorkerScope: registration.scope, jsonBackupRoundTrip: true, pngIcons: '192x192 and 512x512 passed', installabilityErrors: [], serviceWorkerUpdate: 'A installed, B waiting, application update button activated B', indexedDBUnchangedAcrossUpdate: true, offlineReloadAndEdit: true, physicalPhoneInstallation: 'not tested' };
  await writeFile(path.join(output, 'pwa-deployment-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  const resolved = path.resolve(profile);
  if (resolved.startsWith(path.resolve(output) + path.sep + 'pwa-deployment-')) await rm(resolved, { recursive: true, force: true });
}
