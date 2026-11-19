/*
 * Fondo de escritorio · arma la franja de los próximos 7 días (sin domingo)
 * sobre el arte del mes. Cuando termina, marca <html data-listo="1"> para que
 * el proceso automático tome la "foto".
 *
 * Parámetros: ?fecha=AAAA-MM-DD (simular otro día) · ?demo=1 (datos de ejemplo)
 */
(function () {
  'use strict';

  var C = window.CCDB_CONFIG;
  var L = window.CCDBLogic;
  var params = new URLSearchParams(location.search);
  var demo = params.get('demo') === '1';
  var datos = window.CCDBData.crear(demo ? Object.assign({}, C, { firebase: null }) : C);

  var AREAS = {};
  C.areas.forEach(function (a) { AREAS[a.id] = a; });

  var hoy = L.esFechaValida(params.get('fecha') || '') ? params.get('fecha') : L.hoy();
  var dias = L.proximosDiasSinDomingo(hoy, 7);
  var listo = { arte: false, datos: false };

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
  function area(id) { return AREAS[id] || { id: id, nombre: 'Área', color: '#848484' }; }

  function avisarListo() {
    if (listo.arte && listo.datos) document.documentElement.setAttribute('data-listo', '1');
  }

  /* ---------- Arte del mes: AAAA-MM.jpg, .png, o el predeterminado ---------- */
  function cargarArte() {
    var f = L.leerFecha(hoy);
    var mes = f.a + '-' + String(f.m).padStart(2, '0');
    var opciones = [mes + '.jpg', mes + '.png', 'predeterminado.jpg', 'predeterminado.png'];
    var img = $('arte');
    var i = 0;
    function intentar() {
      if (i >= opciones.length) { listo.arte = true; avisarListo(); return; } // sin arte: fondo negro
      img.src = 'assets/fondos/' + opciones[i++];
    }
    img.onload = function () { img.hidden = false; listo.arte = true; avisarListo(); };
    img.onerror = intentar;
    intentar();
  }

  /* ---------- Franja ---------- */
  function dibujar(lista) {
    var cont = $('dias');
    cont.textContent = '';
    dias.forEach(function (dia) {
      var fd = L.leerFecha(dia);
      var esHoy = dia === hoy;
      // En la franja, una actividad de varios días aparece en cada día que dura.
      var delDia = L.actividadesDelDia(lista, dia);
      var ul = el('ul', { clase: 'dia__lista' });
      if (!delDia.length) ul.appendChild(el('li', { clase: 'dia__vacio', texto: 'Sin actividades' }));
      delDia.forEach(function (a) {
        var varios = a.fin && a.fin !== a.inicio;
        ul.appendChild(el('li', { clase: 'act', estilo: '--color-area:' + area(a.area).color }, [
          el('span', { clase: 'act__area' }, [
            el('span', { clase: 'punto', estilo: '--color-area:' + area(a.area).color }),
            area(a.area).corto || area(a.area).nombre
          ]),
          ' ',
          el('span', { clase: 'act__titulo', texto: a.titulo }),
          a.horaInicio ? ' ' : null,
          a.horaInicio ? el('span', { clase: 'act__hora', texto: L.formatoHora(a.horaInicio) }) : null,
          varios ? ' ' : null,
          varios ? el('span', { clase: 'act__rango', texto: L.formatoRangoBreve(a.inicio, a.fin) }) : null
        ]));
      });
      cont.appendChild(el('section', { clase: 'dia' + (esHoy ? ' dia--hoy' : '') }, [
        el('h2', { clase: 'dia__cabeza' }, [
          L.mayuscula(L.DIAS[L.diaSemana(dia)]),
          el('span', { clase: 'dia__fecha', texto: fd.d + ' ' + L.nombreMes(fd.m).slice(0, 3) }),
          esHoy ? el('span', { clase: 'dia__hoy', texto: 'Hoy' }) : null
        ]),
        ul
      ]));
    });
    var ahora = new Date();
    var hora = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
    $('pie').textContent = 'Actualizado: ' + L.formatoFechaLarga(L.hoy(ahora)) + ', ' + L.formatoHora(hora);
    ajustar();
    listo.datos = true;
    avisarListo();
  }

  /**
   * Si no cabe todo: primero reduce la letra hasta un mínimo legible; si aun
   * así no cabe, oculta las últimas actividades del día más cargado y pone
   * "+N más".
   */
  function ajustar() {
    var franja = $('franja');
    var cont = $('dias');
    var u = window.innerHeight / 1080;
    var maximo = 19 * u;
    var minimo = Math.max(11, 13 * u);
    var desborda = function () { return cont.scrollHeight > cont.clientHeight + 1; };
    for (var t = maximo; t >= minimo; t -= 0.5) {
      franja.style.setProperty('--letra', t + 'px');
      if (!desborda()) return;
    }
    var seguridad = 200;
    while (desborda() && seguridad-- > 0) {
      var listas = Array.prototype.slice.call(cont.querySelectorAll('.dia__lista'));
      var mayor = null, max = 1;
      listas.forEach(function (ul) {
        var n = ul.querySelectorAll('.act:not([hidden])').length;
        if (n > max) { max = n; mayor = ul; }
      });
      if (!mayor) return;
      var visibles = mayor.querySelectorAll('.act:not([hidden])');
      visibles[visibles.length - 1].hidden = true;
      var ocultas = mayor.querySelectorAll('.act[hidden]').length;
      var mas = mayor.querySelector('.act__mas') || mayor.appendChild(el('li', { clase: 'act__mas' }));
      mas.textContent = '+' + ocultas + ' más · ver el cronograma';
    }
  }

  function fallar(err) {
    $('pie').textContent = 'No se pudieron cargar las actividades. ' + (err && err.message ? err.message : '');
    document.documentElement.setAttribute('data-error', '1');
    listo.datos = true;
    avisarListo();
  }

  cargarArte();
  datos.iniciar({ conSesion: false }).then(function () {
    datos.suscribir(dias[0], dias[dias.length - 1], dibujar, fallar);
  }).catch(fallar);
})();
