/*
 * Genera el fondo de escritorio como imagen (lo ejecuta GitHub Actions).
 *
 *   node scripts/generar-fondo.js <carpeta-del-sitio> [--demo] [--fecha=AAAA-MM-DD]
 *
 * Abre fondo.html con un navegador invisible, como si estuviera publicado en
 * https://dbtech-cali.github.io/calendar/ (los archivos se sirven desde la
 * carpeta local), espera a que cargue el arte y las actividades, y guarda
 * las imágenes de HOY, MAÑANA y PASADO MAÑANA (hora de Colombia):
 *   <carpeta>/fondos/AAAA-MM-DD-1920x1080.jpg
 *   <carpeta>/fondos/AAAA-MM-DD-1366x768.jpg
 * Así, aunque GitHub ejecute este proceso con horas de retraso, la imagen de
 * cada día ya está publicada desde el día anterior. Cada computador descarga
 * la de su fecha.
 *
 * Por compatibilidad con instalaciones anteriores, también guarda la de hoy como:
 *   <carpeta>/fondos/actual-1920x1080.jpg, actual-1366x768.jpg y actual.json
 *
 * Si no se pueden leer las actividades, termina con error y no publica nada:
 * los computadores se quedan con el último fondo bueno.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ORIGEN = 'https://dbtech-cali.github.io/calendar/';
const ZONA = 'America/Bogota';
const TAMANOS = [[1920, 1080], [1366, 768]];
const DIAS_ADELANTE = 3; // hoy, mañana y pasado mañana
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json'
};

const args = process.argv.slice(2);
const sitio = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const demo = args.includes('--demo');
const fechaArg = (args.find((a) => a.startsWith('--fecha=')) || '').split('=')[1] || '';
// Solo para pruebas fuera de GitHub: carpeta local con el SDK de Firebase.
const sdkLocal = process.env.SDK_FIREBASE_LOCAL || '';

function sumarDias(fecha, n) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

function hoyEnColombia() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p; // AAAA-MM-DD
}

(async () => {
  const hoy = fechaArg || hoyEnColombia();
  const fechas = Array.from({ length: DIAS_ADELANTE }, (_, i) => sumarDias(hoy, i));
  const salida = path.join(sitio, 'fondos');
  fs.mkdirSync(salida, { recursive: true });
  const navegador = await chromium.launch();
  try {
    for (const fecha of fechas) for (const [ancho, alto] of TAMANOS) {
      const contexto = await navegador.newContext({
        viewport: { width: ancho, height: alto }, deviceScaleFactor: 1,
        timezoneId: ZONA, locale: 'es-CO'
      });
      const pagina = await contexto.newPage();
      const errores = [];
      pagina.on('pageerror', (e) => errores.push(e.message));

      // Servir los archivos del sitio como si vinieran de GitHub Pages.
      await pagina.route(ORIGEN + '**', async (ruta) => {
        const url = new URL(ruta.request().url());
        const rel = decodeURIComponent(url.pathname.replace('/calendar/', '')) || 'index.html';
        const archivo = path.join(sitio, rel);
        if (!archivo.startsWith(sitio) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
          return ruta.fulfill({ status: 404, body: 'No encontrado' });
        }
        return ruta.fulfill({ status: 200, contentType: TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(archivo) });
      });
      if (sdkLocal) {
        await pagina.route('https://www.gstatic.com/firebasejs/**', (ruta) =>
          ruta.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(sdkLocal, ruta.request().url().split('/').pop())) }));
      }

      const q = new URLSearchParams({ fecha });
      if (demo) q.set('demo', '1');
      await pagina.goto(ORIGEN + 'fondo.html?' + q.toString());
      await pagina.waitForSelector('html[data-listo="1"]', { timeout: 60000 });
      if (await pagina.evaluate(() => document.documentElement.hasAttribute('data-error'))) {
        const msg = await pagina.textContent('#pie');
        throw new Error('El fondo no pudo leer las actividades: ' + msg);
      }
      if (errores.length) throw new Error('Errores en la página: ' + errores.join(' | '));
      await pagina.evaluate(() => document.fonts.ready);
      const archivo = path.join(salida, `${fecha}-${ancho}x${alto}.jpg`);
      await pagina.screenshot({ path: archivo, type: 'jpeg', quality: 90 });
      const tamano = fs.statSync(archivo).size;
      // Los computadores rechazan imágenes de más de 3 MB.
      if (tamano > 3 * 1024 * 1024) throw new Error('La imagen generada pesa más de 3 MB: ' + archivo);
      console.log('Generado', archivo, Math.round(tamano / 1024) + ' KB');
      if (fecha === hoy) fs.copyFileSync(archivo, path.join(salida, `actual-${ancho}x${alto}.jpg`));
      await contexto.close();
    }
    const generado = new Date().toISOString();
    fs.writeFileSync(path.join(salida, 'actual.json'), JSON.stringify({ fecha: hoy, generado, version: 1 }) + '\n');
    fs.writeFileSync(path.join(salida, 'indice.json'), JSON.stringify({ fechas, generado, version: 2 }) + '\n');
    console.log('Listo:', JSON.stringify({ fechas, generado }));
  } finally {
    await navegador.close();
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
