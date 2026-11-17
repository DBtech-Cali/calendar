/*
 * Cronograma institucional CCDB · Lógica pura (sin DOM).
 *
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

  var LIMITE_REPETICIONES = 400;
  var MAX_TITULO = 140;
  var MAX_RESPONSABLE = 80;

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

  /** Normaliza una actividad: recorta textos y completa la fecha final. */
  function normalizar(act) {
    var titulo = String(act.titulo || '').trim();
    var inicio = String(act.inicio || '').trim();
    var fin = String(act.fin || '').trim() || inicio;
    var horaInicio = String(act.horaInicio || '').trim();
    var horaFin = horaInicio ? String(act.horaFin || '').trim() : '';
    return {
      titulo: titulo,
      area: String(act.area || '').trim(),
      inicio: inicio,
      fin: fin,
      horaInicio: horaInicio,
      horaFin: horaFin,
      responsable: String(act.responsable || '').trim(),
      serie: String(act.serie || '').trim()
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

    if (a.horaInicio && !esHoraValida(a.horaInicio)) e.horaInicio = 'La hora de inicio no es válida.';
    if (!a.horaInicio && act.horaFin) e.horaFin = 'Para poner hora final, indica primero la hora de inicio.';
    if (a.horaFin) {
      if (!esHoraValida(a.horaFin)) e.horaFin = 'La hora final no es válida.';
      else if (!e.horaInicio && esHoraValida(a.horaInicio) && aMinutos(a.horaFin) <= aMinutos(a.horaInicio)) {
        e.horaFin = 'La hora final debe ser posterior a la de inicio.';
      }
    }

    if (a.responsable.length > MAX_RESPONSABLE) {
      e.responsable = 'El responsable puede tener máximo ' + MAX_RESPONSABLE + ' caracteres.';
    }

    return { ok: Object.keys(e).length === 0, errores: e };
  }

  /** ¿La actividad ocurre (total o parcialmente) en ese día? */
  function ocurreEn(act, dia) {
    return act.inicio <= dia && (act.fin || act.inicio) >= dia;
  }

  /** ¿La actividad toca el rango [desde, hasta]? */
  function tocaRango(act, desde, hasta) {
    return act.inicio <= hasta && (act.fin || act.inicio) >= desde;
  }

  /** Orden: primero "todo el día", luego por hora, luego por nombre. */
  function comparar(x, y) {
    var hx = x.horaInicio || '', hy = y.horaInicio || '';
    if (!hx !== !hy) return hx ? 1 : -1;
    if (hx !== hy) return hx < hy ? -1 : 1;
    if (x.inicio !== y.inicio) return x.inicio < y.inicio ? -1 : 1;
    return String(x.titulo).localeCompare(String(y.titulo), 'es');
  }

  /** Actividades de un día, ordenadas. */
  function actividadesDelDia(lista, dia) {
    return lista.filter(function (a) { return ocurreEn(a, dia); }).sort(comparar);
  }

  /* ------------------------------------------------------------------ */
  /* Cruces                                                              */
  /* ------------------------------------------------------------------ */

  /** Intervalo en minutos [ini, fin) de una actividad con hora, o null. */
  function intervalo(act) {
    if (!act.horaInicio || !esHoraValida(act.horaInicio)) return null;
    var ini = aMinutos(act.horaInicio);
    var fin = act.horaFin && esHoraValida(act.horaFin) ? aMinutos(act.horaFin) : ini + 60;
    if (fin <= ini) fin = ini + 60;
    return [ini, fin];
  }

  /**
   * Busca cruces de `act` con las actividades de `lista`.
   * - Sin hora: no hay cruces.
   * - Sin hora final: se asume 1 hora.
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
  /* Repeticiones                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Fechas de inicio de una repetición.
   * regla semanal: { tipo: 'semanal', dias: [0..6], cada: 1-4, hasta }
   * regla mensual: { tipo: 'mensual', dia: 1-31, finDeSemana: 'omitir'|'lunes'|'viernes', hasta }
   * Devuelve { fechas, error }. La primera fecha nunca es anterior a `inicio`.
   */
  function generarRepeticion(inicio, regla) {
    if (!esFechaValida(inicio)) return { fechas: [], error: 'La fecha de inicio no es válida.' };
    if (!regla || !esFechaValida(regla.hasta)) return { fechas: [], error: 'Indica hasta qué fecha se repite.' };
    if (regla.hasta < inicio) return { fechas: [], error: 'La fecha "hasta" no puede ser anterior a la de inicio.' };
    var maximo = sumarAnios(inicio, 1);
    if (regla.hasta > maximo) {
      return { fechas: [], error: 'La repetición puede ir máximo un año hacia adelante (hasta el ' + formatoFechaCorta(maximo) + ').' };
    }

    var fechas = [];
    if (regla.tipo === 'semanal') {
      var dias = (regla.dias || []).filter(function (d) { return d >= 0 && d <= 6; });
      var cada = Math.floor(+regla.cada || 1);
      if (!dias.length) return { fechas: [], error: 'Elige al menos un día de la semana.' };
      if (cada < 1 || cada > 4) return { fechas: [], error: 'La repetición semanal va de cada 1 a cada 4 semanas.' };
      var lunes0 = inicioSemana(inicio);
      for (var dia = inicio; dia <= regla.hasta; dia = sumarDias(dia, 1)) {
        var semana = Math.floor(diferenciaDias(lunes0, dia) / 7);
        if (semana % cada === 0 && dias.indexOf(diaSemana(dia)) !== -1) fechas.push(dia);
        if (fechas.length > LIMITE_REPETICIONES) break;
      }
    } else if (regla.tipo === 'mensual') {
      var diaMes = Math.floor(+regla.dia);
      if (!(diaMes >= 1 && diaMes <= 31)) return { fechas: [], error: 'Elige un día del mes entre 1 y 31.' };
      var modo = regla.finDeSemana || 'omitir';
      if (['omitir', 'lunes', 'viernes'].indexOf(modo) === -1) return { fechas: [], error: 'Opción de fin de semana no válida.' };
      var f0 = leerFecha(inicio);
      for (var k = 0; ; k++) {
        var mes = sumarMeses(f0.a, f0.m, k);
        var primero = aTexto(mes.a, mes.m, 1);
        if (primero > regla.hasta) break;
        var fecha = aTexto(mes.a, mes.m, Math.min(diaMes, diasDelMes(mes.a, mes.m)));
        var ds = diaSemana(fecha);
        if (ds >= 5) {
          if (modo === 'omitir') continue;
          fecha = modo === 'lunes' ? sumarDias(fecha, 7 - ds) : sumarDias(fecha, 4 - ds);
        }
        if (fecha >= inicio && fecha <= regla.hasta) fechas.push(fecha);
        if (fechas.length > LIMITE_REPETICIONES) break;
      }
    } else {
      return { fechas: [], error: 'Tipo de repetición no válido.' };
    }

    if (fechas.length > LIMITE_REPETICIONES) {
      return { fechas: [], error: 'Se crearían más de ' + LIMITE_REPETICIONES + ' actividades. Acorta la repetición.' };
    }
    if (!fechas.length) return { fechas: [], error: 'Con estas opciones no se crea ninguna actividad.' };
    return { fechas: fechas, error: '' };
  }

  /** Suma años conservando el día (29-feb pasa a 28-feb si hace falta). */
  function sumarAnios(texto, n) {
    var f = leerFecha(texto);
    var a = f.a + n;
    return aTexto(a, f.m, Math.min(f.d, diasDelMes(a, f.m)));
  }

  /**
   * Expande una actividad base en una actividad por fecha, conservando la
   * duración en días. Todas comparten el mismo identificador de serie.
   */
  function expandirSerie(base, fechas, serie) {
    var duracion = diferenciaDias(base.inicio, base.fin || base.inicio);
    return fechas.map(function (f) {
      var a = normalizar(base);
      a.inicio = f;
      a.fin = sumarDias(f, duracion);
      a.serie = serie;
      return a;
    });
  }

  /**
   * Qué actividades de una serie se eliminan.
   * modo: 'solo' | 'siguientes' | 'serie'
   */
  function seleccionarSerie(lista, act, modo) {
    if (modo === 'solo' || !act.serie) return lista.filter(function (x) { return x.id === act.id; });
    return lista.filter(function (x) {
      if (x.serie !== act.serie) return false;
      return modo === 'serie' || x.inicio >= act.inicio;
    });
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

  /** "8:00 a. m. – 9:30 a. m.", "Desde 8:00 a. m." o "Todo el día". */
  function formatoHorario(act) {
    if (!act.horaInicio) return 'Todo el día';
    if (!act.horaFin) return formatoHora(act.horaInicio);
    return formatoHora(act.horaInicio) + ' – ' + formatoHora(act.horaFin);
  }

  /** "Del 3 al 6 de noviembre", "Del 28 de noviembre al 2 de diciembre". */
  function formatoRango(inicio, fin) {
    if (!fin || fin === inicio) return mayuscula(formatoFechaLarga(inicio));
    var a = leerFecha(inicio), b = leerFecha(fin);
    if (a.a !== b.a) return 'Del ' + formatoDiaMes(inicio, true) + ' al ' + formatoDiaMes(fin, true);
    if (a.m !== b.m) return 'Del ' + formatoDiaMes(inicio) + ' al ' + formatoDiaMes(fin, true);
    return 'Del ' + a.d + ' al ' + b.d + ' de ' + nombreMes(a.m) + ' de ' + a.a;
  }

  /** Texto de vista previa de una repetición. */
  function textoVistaPrevia(fechas) {
    if (!fechas.length) return '';
    var n = fechas.length;
    if (n === 1) return 'Se creará 1 actividad, el ' + formatoFechaLarga(fechas[0]) + '.';
    return 'Se crearán ' + n + ' actividades, desde el ' + formatoFechaLarga(fechas[0]) +
      ' hasta el ' + formatoFechaLarga(fechas[n - 1]) + '.';
  }

  /** Identificador corto y aleatorio. */
  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  var API = {
    MESES: MESES, DIAS: DIAS, DIAS_CORTOS: DIAS_CORTOS,
    LIMITE_REPETICIONES: LIMITE_REPETICIONES, MAX_TITULO: MAX_TITULO, MAX_RESPONSABLE: MAX_RESPONSABLE,
    aTexto: aTexto, leerFecha: leerFecha, esFechaValida: esFechaValida,
    diasDelMes: diasDelMes, sumarDias: sumarDias, diferenciaDias: diferenciaDias,
    diaSemana: diaSemana, esFinDeSemana: esFinDeSemana, inicioSemana: inicioSemana,
    diasDeSemana: diasDeSemana, rangoDias: rangoDias, sumarMeses: sumarMeses, sumarAnios: sumarAnios,
    matrizMes: matrizMes, hoy: hoy,
    esHoraValida: esHoraValida, aMinutos: aMinutos,
    normalizar: normalizar, validar: validar, ocurreEn: ocurreEn, tocaRango: tocaRango,
    comparar: comparar, actividadesDelDia: actividadesDelDia,
    buscarCruces: buscarCruces,
    generarRepeticion: generarRepeticion, expandirSerie: expandirSerie, seleccionarSerie: seleccionarSerie,
    nombreMes: nombreMes, mayuscula: mayuscula, formatoMes: formatoMes,
    formatoFechaLarga: formatoFechaLarga, formatoFechaCorta: formatoFechaCorta, formatoDiaMes: formatoDiaMes,
    formatoHora: formatoHora, formatoHorario: formatoHorario, formatoRango: formatoRango,
    textoVistaPrevia: textoVistaPrevia, nuevoId: nuevoId
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.CCDBLogic = API;
})(typeof window !== 'undefined' ? window : this);
