// Pruebas de la lógica pura. Ejecutar con: node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

test('el 30 de noviembre de 2026 es lunes y noviembre de 2026 necesita 6 filas', () => {
  assert.equal(L.diaSemana('2026-11-30'), 0);
  const m = L.matrizMes(2026, 11);
  assert.equal(m.length, 6);
  assert.equal(m[0][0], '2026-10-26');
  assert.equal(m[5][0], '2026-11-30');
  assert.equal(m[5][6], '2026-12-06');
});

test('febrero de 2027 empieza lunes y cabe en 4 filas', () => {
  assert.equal(L.diaSemana('2027-02-01'), 0);
  assert.equal(L.matrizMes(2027, 2).length, 4);
});

test('fechas: validación, años bisiestos y sumas', () => {
  assert.ok(L.esFechaValida('2028-02-29'));
  assert.ok(!L.esFechaValida('2027-02-29'));
  assert.ok(!L.esFechaValida('2026-13-01'));
  assert.ok(!L.esFechaValida('2026-1-01'));
  assert.equal(L.sumarDias('2026-12-30', 3), '2027-01-02');
  assert.equal(L.diferenciaDias('2026-11-01', '2027-03-31'), 150);
  assert.equal(L.inicioSemana('2026-11-22'), '2026-11-16');
});

const act = (o) => Object.assign({ id: Math.random().toString(), titulo: 't', area: 'sst', inicio: '2026-11-17', fin: '2026-11-17', horaInicio: '' }, o);

test('cruces: se solapan (cada actividad se asume de 1 hora)', () => {
  const otra = act({ id: 'o', horaInicio: '09:00' });
  assert.equal(L.buscarCruces(act({ horaInicio: '09:00' }), [otra]).length, 1);
  assert.equal(L.buscarCruces(act({ horaInicio: '09:30' }), [otra]).length, 1);
  assert.equal(L.buscarCruces(act({ horaInicio: '08:30' }), [otra]).length, 1);
});

test('cruces: solo se tocan en el borde', () => {
  const otra = act({ id: 'o', horaInicio: '09:00' });
  assert.equal(L.buscarCruces(act({ horaInicio: '10:00' }), [otra]).length, 0, '09:00 + 1 h termina justo a las 10:00');
  assert.equal(L.buscarCruces(act({ horaInicio: '08:00' }), [otra]).length, 0, '08:00 + 1 h termina justo a las 09:00');
});

test('cruces: actividades sin hora no generan cruces', () => {
  const sinHora = act({ id: 'o' });
  assert.equal(L.buscarCruces(act({ horaInicio: '10:00' }), [sinHora]).length, 0);
  assert.equal(L.buscarCruces(act({}), [act({ horaInicio: '10:00' })]).length, 0);
});

test('cruces: al editar no se compara consigo misma', () => {
  const misma = act({ id: 'm', horaInicio: '10:00' });
  assert.equal(L.buscarCruces(Object.assign({}, misma, { horaInicio: '10:30' }), [misma]).length, 0);
});

test('cruces: otra fecha no cruza y varios días sí', () => {
  const otra = act({ id: 'o', inicio: '2026-11-19', fin: '2026-11-19', horaInicio: '10:00' });
  assert.equal(L.buscarCruces(act({ horaInicio: '10:00' }), [otra]).length, 0);
  assert.equal(L.buscarCruces(act({ fin: '2026-11-20', horaInicio: '10:00' }), [otra]).length, 1);
});

test('validaciones con mensajes claros', () => {
  const ok = { titulo: 'Reunión', area: 'sst', inicio: '2026-11-17' };
  assert.ok(L.validar(ok, { areas: ['sst'] }).ok);
  const e = (o, op) => L.validar(Object.assign({}, ok, o), op).errores;
  assert.ok(e({ titulo: '  ' }).titulo);
  assert.ok(e({ titulo: 'x'.repeat(141) }).titulo);
  assert.ok(e({ area: '' }).area);
  assert.ok(e({ area: 'otra' }, { areas: ['sst'] }).area);
  assert.ok(e({ inicio: '2026-02-30' }).inicio);
  assert.ok(e({ fin: '2026-11-16' }).fin);
  assert.ok(!e({ fin: '2027-01-15' }).fin, '60 días exactos se permiten');
  assert.ok(e({ fin: '2027-01-16' }).fin);
  assert.ok(e({ fin: '2026-11-30' }, { maxDias: 10 }).fin);
  assert.ok(e({ horaInicio: '25:00' }).horaInicio);
  assert.ok(L.validar(Object.assign({}, ok, { horaInicio: '07:00' })).ok);
  assert.ok(L.validar(Object.assign({}, ok, { horaInicio: '' })).ok, 'la hora es opcional');
});

test('normalizar completa la fecha final, recorta textos y solo deja los campos del modelo', () => {
  const n = L.normalizar({ titulo: '  Misa   de  envío ', area: 'pastoral', inicio: '2026-11-17', responsable: 'x', serie: 'y' });
  assert.deepEqual(n, { titulo: 'Misa de envío', area: 'pastoral', inicio: '2026-11-17', fin: '2026-11-17', horaInicio: '' });
});

test('una visita de 4 días aparece en los 4 días', () => {
  const visita = act({ id: 'v', inicio: '2026-11-23', fin: '2026-11-26' });
  const dias = L.rangoDias('2026-11-22', 6).filter((d) => L.actividadesDelDia([visita], d).length);
  assert.deepEqual(dias, ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']);
});

test('orden del día: primero todo el día y luego por hora', () => {
  const lista = [act({ titulo: 'B', horaInicio: '14:00' }), act({ titulo: 'A', horaInicio: '08:00' }), act({ titulo: 'C' })];
  assert.deepEqual(L.actividadesDelDia(lista, '2026-11-17').map((a) => a.titulo), ['C', 'A', 'B']);
});

test('formatos en español', () => {
  assert.equal(L.formatoFechaLarga('2026-11-17'), 'martes 17 de noviembre de 2026');
  assert.equal(L.formatoHora('08:05'), '8:05 a. m.');
  assert.equal(L.formatoHora('12:00'), '12:00 p. m.');
  assert.equal(L.formatoHora('00:30'), '12:30 a. m.');
  assert.equal(L.formatoHorario({ horaInicio: '' }), '', 'sin hora no se muestra nada (nunca "Todo el día")');
  assert.equal(L.formatoHorario({ horaInicio: '14:00' }), '2:00 p. m.');
  assert.equal(L.formatoRango('2026-11-03', '2026-11-06'), 'Del 3 al 6 de noviembre de 2026');
  assert.equal(L.formatoRango('2026-11-28', '2026-12-02'), 'Del 28 de noviembre al 2 de diciembre de 2026');
  assert.equal(L.formatoRango('2026-12-30', '2027-01-02'), 'Del 30 de diciembre de 2026 al 2 de enero de 2027');
});

test('formulario por lote: ignora filas vacías y arma las actividades', () => {
  const r = L.validarLote('pastoral', [
    { inicio: '2026-11-22', titulo: 'Eucaristía', horaInicio: '07:00' },
    { inicio: '2026-11-25', titulo: 'Visita del delegado inspectorial de pastoral', varios: true, fin: '2026-11-28' },
    { inicio: '2026-11-25', titulo: '   ' }
  ], { areas: ['pastoral'] });
  assert.ok(r.ok);
  assert.equal(r.actividades.length, 2);
  assert.deepEqual(r.actividades[1].actividad,
    { titulo: 'Visita del delegado inspectorial de pastoral', area: 'pastoral', inicio: '2026-11-25', fin: '2026-11-28', horaInicio: '' });
  assert.equal(r.actividades[0].actividad.fin, '2026-11-22', 'un solo día: fin = inicio');
});

test('formulario por lote: errores por fila, área y lote vacío', () => {
  const r = L.validarLote('pastoral', [
    { inicio: '', titulo: 'Sin fecha' },
    { inicio: '2026-11-25', titulo: 'Varios sin fin', varios: true, fin: '' },
    { inicio: '2026-11-25', titulo: 'Fin antes', varios: true, fin: '2026-11-20' },
    { inicio: '2026-11-25', titulo: 'Bien' }
  ], { areas: ['pastoral'] });
  assert.ok(!r.ok);
  assert.ok(r.errores[0].inicio);
  assert.equal(r.errores[1].fin, 'Indica la fecha final.');
  assert.ok(r.errores[2].fin);
  assert.ok(!r.errores[3]);
  assert.match(L.validarLote('', [{ inicio: '2026-11-25', titulo: 'x' }]).general, /área/);
  assert.match(L.validarLote('pastoral', [{ inicio: '2026-11-25', titulo: '' }]).general, /al menos una/);
  // Una fila sin nombre pero con hora sí se valida (falta el nombre).
  assert.ok(L.validarLote('pastoral', [{ inicio: '2026-11-25', titulo: '', horaInicio: '08:00' }]).errores[0].titulo);
});

test('calendario general: una actividad de varios días aparece solo el día en que empieza', () => {
  const visita = act({ id: 'v', inicio: '2026-11-03', fin: '2026-11-07' });
  const misa = act({ id: 'm', inicio: '2026-11-05' });
  const primer = '2026-10-26'; // primer día de la cuadrícula de noviembre
  const dias = L.rangoDias(primer, 42).filter((d) => L.actividadesQueInician([visita], d, primer).length);
  assert.deepEqual(dias, ['2026-11-03']);
  assert.deepEqual(L.actividadesQueInician([visita, misa], '2026-11-05', primer).map((a) => a.id), ['m']);
  // En el widget sí aparece en cada día.
  assert.equal(L.rangoDias('2026-11-02', 7).filter((d) => L.actividadesDelDia([visita], d).length).length, 5);
});

test('calendario general: si empezó antes de lo visible, aparece el primer día visible', () => {
  const larga = act({ id: 'l', inicio: '2026-10-20', fin: '2026-10-28' });
  assert.equal(L.actividadesQueInician([larga], '2026-10-26', '2026-10-26').length, 1);
  assert.equal(L.actividadesQueInician([larga], '2026-10-27', '2026-10-26').length, 0);
  // Ya terminó antes de lo visible: no aparece.
  assert.equal(L.actividadesQueInician([act({ inicio: '2026-10-01', fin: '2026-10-05' })], '2026-10-26', '2026-10-26').length, 0);
});

test('rango corto y horas de la jornada', () => {
  assert.equal(L.formatoRangoCorto('2026-11-03', '2026-11-07'), 'Del 3 al 7 de noviembre');
  assert.equal(L.formatoRangoCorto('2026-11-28', '2026-12-02'), 'Del 28 de noviembre al 2 de diciembre');
  assert.equal(L.formatoRangoCorto('2026-12-30', '2027-01-02'), 'Del 30 de diciembre de 2026 al 2 de enero de 2027');
  const h = L.opcionesHora('07:00', '17:00', 30);
  assert.equal(h.length, 21);
  assert.deepEqual(h.slice(0, 3), ['07:00', '07:30', '08:00']);
  assert.equal(h[h.length - 1], '17:00');
  assert.ok(h.every((x) => /:(00|30)$/.test(x)));
});

test('rango breve para ir en la misma línea', () => {
  assert.equal(L.formatoRangoBreve('2026-11-03', '2026-11-07'), 'del 3 al 7 nov');
  assert.equal(L.formatoRangoBreve('2026-11-28', '2026-12-02'), 'del 28 nov al 2 dic');
  assert.equal(L.formatoRangoBreve('2026-12-30', '2027-01-02'), 'del 30 dic 2026 al 2 ene 2027');
});

test('próximos 7 días sin domingo (franja del fondo y widget)', () => {
  // Miércoles 25 nov 2026 → hasta el miércoles 2 dic, sin el domingo 29.
  assert.deepEqual(L.proximosDiasSinDomingo('2026-11-25', 7),
    ['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-30', '2026-12-01', '2026-12-02']);
  // Jueves → hasta el jueves siguiente.
  const jue = L.proximosDiasSinDomingo('2026-11-26', 7);
  assert.equal(jue[0], '2026-11-26');
  assert.equal(jue[6], '2026-12-03');
  // Domingo → empieza el lunes y termina el lunes siguiente.
  assert.deepEqual(L.proximosDiasSinDomingo('2026-11-29', 7),
    ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-07']);
  assert.ok(L.proximosDiasSinDomingo('2026-11-25', 7).every((d) => L.diaSemana(d) !== 6));
});
