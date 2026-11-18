/*
 * Cronograma institucional CCDB · Lógica pura (sin DOM).
 *
 * Actividad: { titulo, area, inicio, fin, horaInicio }.
 * Fechas siempre como texto local "AAAA-MM-DD" y horas como "HH:MM".
 * Los cálculos de calendario se hacen con Date.UTC para que la zona
 * horaria del equipo nunca corra un día.
 *
 * Funciona como script clásico en el navegador (expone window.CCDBLogic)
 * y como módulo CommonJS en Node (para las pruebas con `node --test`).
 */
(function (raiz) {
  'use strict';

  var MS_DIA = 86400000;

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  // Índice 0 = lunes … 6 = domingo (semana colombiana de calendario).
  var DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  var DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

  var MAX_TITULO = 140;
  var DURACION_CRUCE = 60; // minutos que se asumen para revisar cruces

  /* ------------------------------------------------------------------ */
  /* Fechas                                                              */
  /* ------------------------------------------------------------------ */

  function dos(n) { return (n < 10 ? '0' : '') + n; }

  /** Convierte año, mes (1-12) y día en "AAAA-MM-DD". */
  function aTexto(a, m, d) {
    return String(a).padStart(4, '0') + '-' + dos(m) + '-' + dos(d);
  }

  /** Lee "AAAA-MM-DD" y devuelve {a, m, d} o null si no es una fecha real. */
  function leerFecha(texto) {
    if (typeof texto !== 'string') return null;
    var r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!r) return null;
    var a = +r[1], m = +r[2], d = +r[3];
    if (m < 1 || m > 12 || d < 1 || d > diasDelMes(a, m)) return null;
    return { a: a, m: m, d: d };
  }

  function esFechaValida(texto) { return leerFecha(texto) !== null; }

  function aDiaSerial(texto) {
    var f = leerFecha(texto);
    if (!f) throw new Error('Fecha no válida: ' + texto);
    return Math.round(Date.UTC(f.a, f.m - 1, f.d) / MS_DIA);
  }

  function desdeDiaSerial(n) {
    var dt = new Date(n * MS_DIA);
    return aTexto(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  function diasDelMes(a, m) {
    return new Date(Date.UTC(a, m, 0)).getUTCDate();
  }

  function sumarDias(texto, n) { return desdeDiaSerial(aDiaSerial(texto) + n); }

  /** Días entre dos fechas (b − a). */
  function diferenciaDias(a, b) { return aDiaSerial(b) - aDiaSerial(a); }

  /** Día de la semana: 0 = lunes … 6 = domingo. */
  function diaSemana(texto) {
    var f = leerFecha(texto);
    var js = new Date(Date.UTC(f.a, f.m - 1, f.d)).getUTCDay(); // 0 = domingo
    return (js + 6) % 7;
  }

  function esFinDeSemana(texto) { return diaSemana(texto) >= 5; }

  /** Lunes de la semana que contiene la fecha. */
  function inicioSemana(texto) { return sumarDias(texto, -diaSemana(texto)); }

  /** Los 7 días (lunes a domingo) de la semana que contiene la fecha. */
  function diasDeSemana(texto) {
    var lunes = inicioSemana(texto), r = [];
    for (var i = 0; i < 7; i++) r.push(sumarDias(lunes, i));
    return r;
  }

  /** n días seguidos desde la fecha. */
  function rangoDias(desde, n) {
    var r = [];
    for (var i = 0; i < n; i++) r.push(sumarDias(desde, i));
    return r;
  }

  /** Suma meses a {a, m} y devuelve {a, m}. */
  function sumarMeses(a, m, n) {
    var t = a * 12 + (m - 1) + n;
    return { a: Math.floor(t / 12), m: (t % 12 + 12) % 12 + 1 };
  }

  /**
   * Matriz del mes: semanas (lunes a domingo) que cubren el mes completo.
   * Cada semana es un arreglo de 7 fechas; tiene entre 4 y 6 filas.
   */
  function matrizMes(a, m) {
    var primero = aTexto(a, m, 1);
    var ultimo = aTexto(a, m, diasDelMes(a, m));
    var dia = inicioSemana(primero);
    var semanas = [];
    while (dia <= ultimo) {
      var semana = [];
      for (var i = 0; i < 7; i++) { semana.push(dia); dia = sumarDias(dia, 1); }
      semanas.push(semana);
    }
    return semanas;
  }

  /** Fecha de hoy en hora local del equipo, como "AAAA-MM-DD". */
  function hoy(ahora) {
    var d = ahora || new Date();
    return aTexto(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  /* ------------------------------------------------------------------ */
  /* Horas                                                               */
  /* ------------------------------------------------------------------ */

  function esHoraValida(texto) {
    return typeof texto === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(texto);
  }

  function aMinutos(texto) {
    return +texto.slice(0, 2) * 60 + +texto.slice(3, 5);
  }

  /* ------------------------------------------------------------------ */
  /* Actividades                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Normaliza una actividad: recorta textos y completa la fecha final.
   * Campos: titulo, area, inicio, fin, horaInicio (opcional).
   */
  function normalizar(act) {
    var inicio = String(act.inicio || '').trim();
    return {
      titulo: String(act.titulo || '').trim().replace(/\s+/g, ' '),
      area: String(act.area || '').trim(),
      inicio: inicio,
      fin: String(act.fin || '').trim() || inicio,
      horaInicio: String(act.horaInicio || '').trim()
    };
  }

  /**
   * Valida una actividad (ya normalizada o no).
   * opciones: { areas: ['sst', …], maxDias: 60 }
   * Devuelve { ok, errores: { campo: 'mensaje' } }.
   */
  function validar(act, opciones) {
    var op = opciones || {};
    var maxDias = op.maxDias || 60;
    var a = normalizar(act);
    var e = {};

    if (!a.area) e.area = 'Elige el área que organiza la actividad.';
    else if (op.areas && op.areas.indexOf(a.area) === -1) e.area = 'El área elegida no existe.';

    if (!a.titulo) e.titulo = 'Escribe el nombre de la actividad.';
    else if (a.titulo.length > MAX_TITULO) e.titulo = 'El nombre puede tener máximo ' + MAX_TITULO + ' caracteres.';

    if (!a.inicio) e.inicio = 'Indica la fecha de inicio.';
    else if (!esFechaValida(a.inicio)) e.inicio = 'La fecha de inicio no es válida.';

    if (!e.inicio) {
      if (!esFechaValida(a.fin)) e.fin = 'La fecha final no es válida.';
      else if (a.fin < a.inicio) e.fin = 'La fecha final no puede ser anterior a la de inicio.';
      else if (diferenciaDias(a.inicio, a.fin) + 1 > maxDias) {
        e.fin = 'Una actividad puede durar máximo ' + maxDias + ' días.';
      }
    }

    if (a.horaInicio && !esHoraValida(a.horaInicio)) e.horaInicio = 'La hora no es válida.';

    return { ok: Object.keys(e).length === 0, errores: e };
  }

  /**
   * Valida un lote de filas del formulario (todas de la misma área).
   * fila: { inicio, titulo, varios (bool), fin, horaInicio }
   * Las filas sin nombre, sin hora y sin "varios días" se ignoran.
   * Devuelve { ok, actividades: [{ fila, actividad }], errores: { fila: {campo: msg} }, general }.
   */
  function validarLote(area, filas, opciones) {
    var op = opciones || {};
    var r = { ok: false, actividades: [], errores: {}, general: '' };
    filas.forEach(function (f, i) {
      var titulo = String(f.titulo || '').trim();
      if (!titulo && !f.horaInicio && !f.varios) return; // fila vacía
      var act = normalizar({
        area: area, titulo: titulo, inicio: f.inicio,
        fin: f.varios ? f.fin : f.inicio, horaInicio: f.horaInicio
      });
      var v = validar(act, op);
      var e = v.errores;
      if (f.varios && !String(f.fin || '').trim()) e.fin = 'Indica la fecha final.';
      if (e.area) { r.general = e.area; delete e.area; }
      if (Object.keys(e).length) r.errores[i] = e;
      else r.actividades.push({ fila: i, actividad: act });
    });
    if (!r.general && !r.actividades.length && !Object.keys(r.errores).length) {
      r.general = 'Escribe al menos una actividad.';
    }
    r.ok = !r.general && !Object.keys(r.errores).length;
    return r;
  }

  /** ¿La actividad ocurre (total o parcialmente) en ese día? */
  function ocurreEn(act, dia) {
    return act.inicio <= dia && (act.fin || act.inicio) >= dia;
  }

  /** ¿La actividad toca el rango [desde, hasta]? */
  function tocaRango(act, desde, hasta) {
    return act.inicio <= hasta && (act.fin || act.inicio) >= desde;
  }

  /** Orden: primero las que no tienen hora, luego por hora, luego por nombre. */
  function comparar(x, y) {
    var hx = x.horaInicio || '', hy = y.horaInicio || '';
    if (!hx !== !hy) return hx ? 1 : -1;
    if (hx !== hy) return hx < hy ? -1 : 1;
    if (x.inicio !== y.inicio) return x.inicio < y.inicio ? -1 : 1;
    return String(x.titulo).localeCompare(String(y.titulo), 'es');
  }

  /**
   * Actividades que se MUESTRAN en un día del calendario general (mes y
   * semana): cada actividad aparece una sola vez, el día en que empieza.
   * Si empezó antes del primer día visible, aparece en ese primer día.
   */
  function actividadesQueInician(lista, dia, primerDiaVisible) {
    return lista.filter(function (a) {
      if (a.inicio === dia) return true;
      return dia === primerDiaVisible && a.inicio < dia && (a.fin || a.inicio) >= dia;
    }).sort(comparar);
  }

  /** Actividades de un día, ordenadas. */
  function actividadesDelDia(lista, dia) {
    return lista.filter(function (a) { return ocurreEn(a, dia); }).sort(comparar);
  }

  /* ------------------------------------------------------------------ */
  /* Cruces                                                              */
  /* ------------------------------------------------------------------ */

  /** Intervalo en minutos [ini, ini + 1 h) de una actividad con hora, o null. */
  function intervalo(act) {
    if (!act.horaInicio || !esHoraValida(act.horaInicio)) return null;
    var ini = aMinutos(act.horaInicio);
    return [ini, ini + DURACION_CRUCE];
  }

  /**
   * Busca cruces de `act` con las actividades de `lista`.
   * - Sin hora: no hay cruces.
   * - Cada actividad con hora se asume de 1 hora.
   * - Solo tocarse en el borde no es cruce.
   * - Una actividad no se cruza consigo misma (mismo id).
   * La franja horaria se aplica en cada día que abarca la actividad.
   */
  function buscarCruces(act, lista) {
    var i1 = intervalo(act);
    if (!i1) return [];
    var fin1 = act.fin || act.inicio;
    return lista.filter(function (otra) {
      if (act.id && otra.id === act.id) return false;
      var i2 = intervalo(otra);
      if (!i2) return false;
      if (!(otra.inicio <= fin1 && (otra.fin || otra.inicio) >= act.inicio)) return false;
      return i1[0] < i2[1] && i2[0] < i1[1];
    }).sort(comparar);
  }

  /* ------------------------------------------------------------------ */
  /* Formatos                                                            */
  /* ------------------------------------------------------------------ */

  function nombreMes(m) { return MESES[m - 1]; }

  function mayuscula(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }

  /** "noviembre de 2026" */
  function formatoMes(a, m) { return nombreMes(m) + ' de ' + a; }

  /** "martes 17 de noviembre de 2026" */
  function formatoFechaLarga(texto) {
    var f = leerFecha(texto);
    return DIAS[diaSemana(texto)] + ' ' + f.d + ' de ' + nombreMes(f.m) + ' de ' + f.a;
  }

  /** "mar 17 nov" */
  function formatoFechaCorta(texto) {
    var f = leerFecha(texto);
    return DIAS_CORTOS[diaSemana(texto)] + ' ' + f.d + ' ' + nombreMes(f.m).slice(0, 3) + ' ' + f.a;
  }

  /** "17 de noviembre" (+ año si se pide) */
  function formatoDiaMes(texto, conAnio) {
    var f = leerFecha(texto);
    return f.d + ' de ' + nombreMes(f.m) + (conAnio ? ' de ' + f.a : '');
  }

  /** "8:00 a. m." */
  function formatoHora(texto) {
    if (!esHoraValida(texto)) return '';
    var h = +texto.slice(0, 2), min = texto.slice(3, 5);
    var sufijo = h < 12 ? 'a. m.' : 'p. m.';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + min + ' ' + sufijo;
  }

  /** "8:00 a. m." o texto vacío si la actividad no tiene hora. */
  function formatoHorario(act) {
    return act.horaInicio ? formatoHora(act.horaInicio) : '';
  }

  /** "Del 3 al 6 de noviembre", "Del 28 de noviembre al 2 de diciembre". */
  function formatoRango(inicio, fin) {
    if (!fin || fin === inicio) return mayuscula(formatoFechaLarga(inicio));
    var a = leerFecha(inicio), b = leerFecha(fin);
    if (a.a !== b.a) return 'Del ' + formatoDiaMes(inicio, true) + ' al ' + formatoDiaMes(fin, true);
    if (a.m !== b.m) return 'Del ' + formatoDiaMes(inicio) + ' al ' + formatoDiaMes(fin, true);
    return 'Del ' + a.d + ' al ' + b.d + ' de ' + nombreMes(a.m) + ' de ' + a.a;
  }

  /** "Del 3 al 7 de noviembre" (sin año, salvo que cambie de año). */
  function formatoRangoCorto(inicio, fin) {
    var a = leerFecha(inicio), b = leerFecha(fin);
    if (a.a !== b.a) return 'Del ' + formatoDiaMes(inicio, true) + ' al ' + formatoDiaMes(fin, true);
    if (a.m !== b.m) return 'Del ' + formatoDiaMes(inicio) + ' al ' + formatoDiaMes(fin);
    return 'Del ' + a.d + ' al ' + b.d + ' de ' + nombreMes(a.m);
  }

  /**
   * Horas para elegir: desde y hasta ("HH:MM"), cada n minutos.
   * opcionesHora('07:00', '17:00', 30) → ['07:00', '07:30', …, '17:00']
   */
  function opcionesHora(desde, hasta, cadaMinutos) {
    var r = [], paso = cadaMinutos || 30;
    for (var m = aMinutos(desde); m <= aMinutos(hasta); m += paso) {
      r.push(dos(Math.floor(m / 60)) + ':' + dos(m % 60));
    }
    return r;
  }

  /** Identificador corto y aleatorio. */
  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  var API = {
    MESES: MESES, DIAS: DIAS, DIAS_CORTOS: DIAS_CORTOS,
    MAX_TITULO: MAX_TITULO,
    aTexto: aTexto, leerFecha: leerFecha, esFechaValida: esFechaValida,
    diasDelMes: diasDelMes, sumarDias: sumarDias, diferenciaDias: diferenciaDias,
    diaSemana: diaSemana, esFinDeSemana: esFinDeSemana, inicioSemana: inicioSemana,
    diasDeSemana: diasDeSemana, rangoDias: rangoDias, sumarMeses: sumarMeses,
    matrizMes: matrizMes, hoy: hoy,
    esHoraValida: esHoraValida, aMinutos: aMinutos,
    normalizar: normalizar, validar: validar, validarLote: validarLote, ocurreEn: ocurreEn, tocaRango: tocaRango,
    comparar: comparar, actividadesDelDia: actividadesDelDia, actividadesQueInician: actividadesQueInician,
    buscarCruces: buscarCruces,
    nombreMes: nombreMes, mayuscula: mayuscula, formatoMes: formatoMes,
    formatoFechaLarga: formatoFechaLarga, formatoFechaCorta: formatoFechaCorta, formatoDiaMes: formatoDiaMes,
    formatoHora: formatoHora, formatoHorario: formatoHorario, formatoRango: formatoRango,
    formatoRangoCorto: formatoRangoCorto, opcionesHora: opcionesHora,
    nuevoId: nuevoId
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.CCDBLogic = API;
})(typeof window !== 'undefined' ? window : this);
