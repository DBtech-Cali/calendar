/*
 * Cronograma institucional CCDB · Widget de la semana (solo lectura).
 *
 * Parámetros opcionales en la dirección:
 *   ?modo=semana|proximos   semana actual (lunes a domingo) o próximos 7 días
 *   ?dias=5                 solo lunes a viernes
 *   ?area=sst,pastoral      solo esas áreas
 *   ?tema=oscuro            fondo oscuro
 */
(function () {
  'use strict';

  var C = window.CCDB_CONFIG;
  var L = window.CCDBLogic;
  var datos = window.CCDBData.crear(C);

  var AREAS = {};
  C.areas.forEach(function (a) { AREAS[a.id] = a; });

  var params = new URLSearchParams(location.search);
  var estado = {
    modo: params.get('modo') === 'proximos' ? 'proximos' : 'semana',
    soloHabiles: params.get('dias') === '5',
    areas: (params.get('area') || '').split(',').map(function (s) { return s.trim(); }).filter(function (id) { return AREAS[id]; }),
    oscuro: params.get('tema') === 'oscuro',
    hoy: L.hoy(),
    actividades: [],
    cancelar: null,
    rango: null
  };

  function $(id) { return document.getElementById(id); }

  function el(etiqueta, atributos, hijos) {
    var n = document.createElement(etiqueta);
    Object.keys(atributos || {}).forEach(function (k) {
      var v = atributos[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'texto') n.textContent = v;
      else if (k === 'clase') n.className = v;
      else if (k === 'estilo') n.setAttribute('style', v);
      else n.setAttribute(k, v);
    });
    (hijos || []).forEach(function (h) {
      if (h === null || h === undefined) return;
      n.appendChild(typeof h === 'string' ? document.createTextNode(h) : h);
    });
    return n;
  }

  function area(id) { return AREAS[id] || { id: id, nombre: 'Área sin configurar', color: '#848484' }; }

  function punto(id) {
    return el('span', { clase: 'punto', 'aria-hidden': 'true', estilo: '--color-area:' + area(id).color });
  }

  /* ---------- Días visibles ---------- */
  function diasVisibles() {
    var dias;
    if (estado.modo === 'semana') {
      dias = L.diasDeSemana(estado.hoy);
      if (estado.soloHabiles) dias = dias.slice(0, 5);
    } else {
      dias = [];
      for (var d = estado.hoy; dias.length < (estado.soloHabiles ? 5 : 7); d = L.sumarDias(d, 1)) {
        if (!estado.soloHabiles || !L.esFinDeSemana(d)) dias.push(d);
      }
    }
    return dias;
  }

  function suscribir() {
    var dias = diasVisibles();
    var rango = dias[0] + '|' + dias[dias.length - 1];
    if (rango === estado.rango) return;
    estado.rango = rango;
    if (estado.cancelar) estado.cancelar();
    estado.cancelar = datos.suscribir(dias[0], dias[dias.length - 1], function (lista) {
      estado.actividades = lista;
      $('w-aviso').hidden = datos.modo !== 'demo';
      if (datos.modo === 'demo') $('w-aviso').textContent = 'Modo demostración: actividades de ejemplo.';
      $('w-actualizado').textContent = 'Actualizado a las ' + horaActual();
      dibujar();
    }, function (err) {
      $('w-aviso').hidden = false;
      $('w-aviso').textContent = 'No se pudieron cargar las actividades. ' + err.message;
    });
  }

  function horaActual() {
    var d = new Date();
    return L.formatoHora(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
  }

  /* ---------- Dibujo ---------- */
  function dibujar() {
    var dias = diasVisibles();
    $('w-titulo').textContent = estado.modo === 'semana' ? 'Esta semana' : 'Próximos días';
    $('w-rango').textContent = L.formatoRango(dias[0], dias[dias.length - 1]);
    document.querySelectorAll('.w-modo__opcion').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.modo === estado.modo));
    });

    var lista = estado.actividades.filter(function (a) {
      return !estado.areas.length || estado.areas.indexOf(a.area) !== -1;
    });

    var cont = $('w-dias');
    cont.textContent = '';
    cont.style.setProperty('--columnas', String(dias.length));
    dias.forEach(function (dia) {
      var delDia = L.actividadesDelDia(lista, dia);
      var fd = L.leerFecha(dia);
      var esHoy = dia === estado.hoy;
      var pasado = dia < estado.hoy;
      var col = el('section', {
        clase: 'w-dia' + (esHoy ? ' w-dia--hoy' : '') + (pasado ? ' w-dia--pasado' : ''),
        'aria-label': L.mayuscula(L.formatoFechaLarga(dia)) + (esHoy ? ' (hoy)' : pasado ? ' (ya pasó)' : '')
      }, [
        el('h2', { clase: 'w-dia__cabeza' }, [
          el('span', { clase: 'w-dia__nombre', texto: L.mayuscula(L.DIAS[L.diaSemana(dia)]) }),
          el('span', { clase: 'w-dia__numero', texto: fd.d + ' ' + L.nombreMes(fd.m).slice(0, 3) }),
          esHoy ? el('span', { clase: 'w-hoy', texto: 'Hoy' }) : null
        ])
      ]);
      var ul = el('ul', { clase: 'w-lista' });
      if (!delDia.length) ul.appendChild(el('li', { clase: 'w-vacio', texto: 'Sin actividades' }));
      delDia.forEach(function (a) {
        // Primero el área y enseguida la actividad; la hora solo si existe.
        ul.appendChild(el('li', { clase: 'w-act', estilo: '--color-area:' + area(a.area).color }, [
          el('span', { clase: 'w-act__linea' }, [
            el('span', { clase: 'w-act__area' }, [punto(a.area), area(a.area).corto || area(a.area).nombre]),
            ' ',
            el('span', { clase: 'w-act__titulo', texto: a.titulo })
          ]),
          a.horaInicio ? el('span', { clase: 'w-act__hora', texto: L.formatoHora(a.horaInicio) }) : null
        ]));
      });
      col.appendChild(ul);
      cont.appendChild(col);
    });

    // Leyenda: áreas filtradas (o todas).
    var leyenda = $('w-leyenda');
    leyenda.textContent = '';
    C.areas.filter(function (a) { return !estado.areas.length || estado.areas.indexOf(a.id) !== -1; })
      .forEach(function (a) { leyenda.appendChild(el('li', null, [punto(a.id), a.nombre])); });
  }

  function reloj() {
    var ahora = new Date();
    $('w-hora').textContent = horaActual();
    $('w-fecha').textContent = L.mayuscula(L.formatoFechaLarga(L.hoy(ahora)));
    // Cambio de día a medianoche: nuevo rango y nueva suscripción.
    var h = L.hoy(ahora);
    if (h !== estado.hoy) {
      estado.hoy = h;
      suscribir();
      dibujar();
    }
  }

  function cambiarModo(modo) {
    estado.modo = modo;
    params.set('modo', modo);
    try { history.replaceState(null, '', '?' + params.toString()); } catch (e) { /* file:// sin historial */ }
    suscribir();
    dibujar();
  }

  /* ---------- Inicio ---------- */
  if (estado.oscuro) {
    document.documentElement.setAttribute('data-tema', 'oscuro');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', '#2d2d2d');
  }
  $('logo').src = estado.oscuro ? C.logo.blanco : C.logo.color;
  $('logo').alt = C.logo.alt;
  document.querySelectorAll('.w-modo__opcion').forEach(function (b) {
    b.addEventListener('click', function () { cambiarModo(b.dataset.modo); });
  });

  reloj();
  dibujar();
  // El reloj se ajusta al inicio de cada minuto.
  setTimeout(function () { reloj(); setInterval(reloj, 60000); }, (60 - new Date().getSeconds()) * 1000 + 50);
  // Al volver a la pestaña o reactivar el equipo, revisar la fecha.
  document.addEventListener('visibilitychange', function () { if (!document.hidden) reloj(); });

  datos.iniciar({ conSesion: false }).then(suscribir).catch(function (err) {
    $('w-aviso').hidden = false;
    $('w-aviso').textContent = 'No se pudo conectar con la base de datos. ' + err.message;
  });
})();
