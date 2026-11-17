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
  assert.equal(L.sumarAnios('2028-02-29', 1), '2029-02-28');
});

const rosario = (finDeSemana) =>
  L.generarRepeticion('2026-11-01', { tipo: 'mensual', dia: 24, finDeSemana, hasta: '2027-03-31' });

test('rosario del día 24 omitiendo fines de semana', () => {
  assert.equal(L.diaSemana('2027-01-24'), 6, 'el 24 de enero de 2027 es domingo');
  const r = rosario('omitir');
  assert.equal(r.error, '');
  assert.deepEqual(r.fechas, ['2026-11-24', '2026-12-24', '2027-02-24', '2027-03-24']);
});

test('rosario del día 24 pasando al lunes siguiente', () => {
  assert.deepEqual(rosario('lunes').fechas,
    ['2026-11-24', '2026-12-24', '2027-01-25', '2027-02-24', '2027-03-24']);
});

test('rosario del día 24 pasando al viernes anterior', () => {
  assert.deepEqual(rosario('viernes').fechas,
    ['2026-11-24', '2026-12-24', '2027-01-22', '2027-02-24', '2027-03-24']);
});

test('día 31 en meses cortos usa el último día del mes', () => {
  const r = L.generarRepeticion('2027-01-01', { tipo: 'mensual', dia: 31, finDeSemana: 'lunes', hasta: '2027-06-30' });
  // ene 31 = domingo → lun 1-feb; feb 28 = domingo → lun 1-mar; mar 31 mié;
  // abr 30 vie; may 31 lun; jun 30 mié.
  assert.deepEqual(r.fechas,
    ['2027-02-01', '2027-03-01', '2027-03-31', '2027-04-30', '2027-05-31', '2027-06-30']);
  const omitir = L.generarRepeticion('2027-01-01', { tipo: 'mensual', dia: 31, finDeSemana: 'omitir', hasta: '2027-06-30' });
  assert.deepEqual(omitir.fechas, ['2027-03-31', '2027-04-30', '2027-05-31', '2027-06-30']);
});

test('mensual no devuelve fechas anteriores al inicio', () => {
  const r = L.generarRepeticion('2026-11-25', { tipo: 'mensual', dia: 24, finDeSemana: 'omitir', hasta: '2027-01-10' });
  assert.deepEqual(r.fechas, ['2026-12-24']);
});

test('semanal cada 2 semanas en martes y jueves', () => {
  const r = L.generarRepeticion('2026-11-17', { tipo: 'semanal', dias: [1, 3], cada: 2, hasta: '2026-12-20' });
  assert.deepEqual(r.fechas, ['2026-11-17', '2026-11-19', '2026-12-01', '2026-12-03', '2026-12-15', '2026-12-17']);
});

test('semanal empieza desde la fecha de inicio aunque la semana ya haya empezado', () => {
  const r = L.generarRepeticion('2026-11-18', { tipo: 'semanal', dias: [0, 2], cada: 1, hasta: '2026-11-30' });
  assert.deepEqual(r.fechas, ['2026-11-18', '2026-11-23', '2026-11-25', '2026-11-30']);
});

test('límites de repetición: un año y 400 actividades', () => {
  assert.match(L.generarRepeticion('2026-11-01', { tipo: 'semanal', dias: [0], cada: 1, hasta: '2027-11-02' }).error, /un año/);
  assert.equal(L.generarRepeticion('2026-11-01', { tipo: 'semanal', dias: [0], cada: 1, hasta: '2027-11-01' }).error, '');
  const todos = L.generarRepeticion('2026-11-01', { tipo: 'semanal', dias: [0, 1, 2, 3, 4, 5, 6], cada: 1, hasta: '2027-11-01' });
  // Con el tope de un año, ni repitiendo a diario se pasa de 400 (máximo 366).
  assert.equal(todos.error, '');
  assert.equal(todos.fechas.length, 366);
  assert.ok(todos.fechas.length <= L.LIMITE_REPETICIONES);
  assert.match(L.generarRepeticion('2026-11-01', { tipo: 'semanal', dias: [], cada: 1, hasta: '2026-12-01' }).error, /al menos un día/);
  assert.match(L.generarRepeticion('2026-11-01', { tipo: 'semanal', dias: [0], cada: 5, hasta: '2026-12-01' }).error, /cada 1 a cada 4/);
});

test('expandir serie conserva la duración y comparte el identificador', () => {
  const base = { titulo: 'Visita', area: 'inspectorial', inicio: '2026-11-02', fin: '2026-11-05' };
  const r = L.expandirSerie(base, ['2026-11-02', '2026-12-07'], 's1');
  assert.equal(r.length, 2);
  assert.equal(r[1].inicio, '2026-12-07');
  assert.equal(r[1].fin, '2026-12-10');
  assert.ok(r.every((a) => a.serie === 's1'));
});

test('eliminar en una serie: solo esta, esta y las siguientes, toda la serie', () => {
  const lista = [
    { id: 'a', serie: 's', inicio: '2026-11-03' },
    { id: 'b', serie: 's', inicio: '2026-11-10' },
    { id: 'c', serie: 's', inicio: '2026-11-17' },
    { id: 'x', serie: '', inicio: '2026-11-10' }
  ];
  const ids = (r) => r.map((a) => a.id);
  assert.deepEqual(ids(L.seleccionarSerie(lista, lista[1], 'solo')), ['b']);
  assert.deepEqual(ids(L.seleccionarSerie(lista, lista[1], 'siguientes')), ['b', 'c']);
  assert.deepEqual(ids(L.seleccionarSerie(lista, lista[1], 'serie')), ['a', 'b', 'c']);
  assert.deepEqual(ids(L.seleccionarSerie(lista, lista[3], 'serie')), ['x']);
});

const act = (o) => Object.assign({ id: Math.random().toString(), titulo: 't', area: 'sst', inicio: '2026-11-17', fin: '2026-11-17', horaInicio: '', horaFin: '' }, o);

test('cruces: se solapan', () => {
  const otra = act({ id: 'o', horaInicio: '09:00', horaFin: '11:00' });
  assert.equal(L.buscarCruces(act({ horaInicio: '10:00', horaFin: '12:00' }), [otra]).length, 1);
  // Sin hora final se asume 1 hora: 08:30–09:30 cruza con 09:00–11:00.
  assert.equal(L.buscarCruces(act({ horaInicio: '08:30' }), [otra]).length, 1);
});

test('cruces: solo se tocan en el borde', () => {
  const otra = act({ id: 'o', horaInicio: '09:00', horaFin: '11:00' });
  assert.equal(L.buscarCruces(act({ horaInicio: '11:00', horaFin: '12:00' }), [otra]).length, 0);
  assert.equal(L.buscarCruces(act({ horaInicio: '08:00' }), [otra]).length, 0, '08:00 + 1 h termina justo a las 09:00');
});

test('cruces: actividades sin hora no generan cruces', () => {
  const sinHora = act({ id: 'o' });
  assert.equal(L.buscarCruces(act({ horaInicio: '10:00' }), [sinHora]).length, 0);
  assert.equal(L.buscarCruces(act({}), [act({ horaInicio: '10:00' })]).length, 0);
});

test('cruces: al editar no se compara consigo misma', () => {
  const misma = act({ id: 'm', horaInicio: '10:00', horaFin: '11:00' });
  assert.equal(L.buscarCruces(Object.assign({}, misma, { horaFin: '11:30' }), [misma]).length, 0);
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
  assert.ok(e({ horaFin: '10:00' }).horaFin, 'hora final sin hora de inicio');
  assert.ok(e({ horaInicio: '10:00', horaFin: '10:00' }).horaFin);
  assert.ok(e({ horaInicio: '25:00' }).horaInicio);
  assert.ok(e({ responsable: 'x'.repeat(81) }).responsable);
  assert.ok(L.validar(Object.assign({}, ok, { responsable: '' })).ok, 'sin responsable no hay problema');
});

test('normalizar completa la fecha final y recorta textos', () => {
  const n = L.normalizar({ titulo: '  Misa  ', area: 'pastoral', inicio: '2026-11-17', horaFin: '10:00' });
  assert.equal(n.titulo, 'Misa');
  assert.equal(n.fin, '2026-11-17');
  assert.equal(n.horaFin, '', 'sin hora de inicio no se guarda hora final');
  assert.equal(n.responsable, '');
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
  assert.equal(L.formatoHorario({ horaInicio: '' }), 'Todo el día');
  assert.equal(L.formatoHorario({ horaInicio: '14:00', horaFin: '15:30' }), '2:00 p. m. – 3:30 p. m.');
  assert.equal(L.formatoRango('2026-11-03', '2026-11-06'), 'Del 3 al 6 de noviembre de 2026');
  assert.equal(L.formatoRango('2026-11-28', '2026-12-02'), 'Del 28 de noviembre al 2 de diciembre de 2026');
  assert.equal(L.formatoRango('2026-12-30', '2027-01-02'), 'Del 30 de diciembre de 2026 al 2 de enero de 2027');
  assert.equal(L.textoVistaPrevia(['2026-11-24', '2027-03-24']),
    'Se crearán 2 actividades, desde el martes 24 de noviembre de 2026 hasta el miércoles 24 de marzo de 2027.');
});
