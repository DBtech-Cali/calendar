/*
 * Cronograma institucional CCDB · Interfaz principal (mes, semana, formulario).
 */
(function () {
  'use strict';

  var C = window.CCDB_CONFIG;
  var L = window.CCDBLogic;
  var datos = window.CCDBData.crear(C);

  var AREAS = {};
  C.areas.forEach(function (a) { AREAS[a.id] = a; });
  var IDS_AREAS = C.areas.map(function (a) { return a.id; });
  var MAX_POR_CELDA = 3;
  var MAX_CRUCES = 5;

  /* ---------- Estado ---------- */
  var estado = {
    vista: preferencia('vista', 'mes') === 'semana' ? 'semana' : 'mes',
    fecha: L.hoy(),              // fecha de referencia del periodo visible
    hoy: L.hoy(),
    actividades: [],
    ocultas: leerOcultas(),      // ids de áreas ocultas por el filtro
    cancelar: null,              // cancelar suscripción actual
    editando: null,              // actividad que se edita (o null si es nueva)
    cruces: [],
    confirmarCruce: false,
    firmaCruces: '',
    detalle: null,
    pendiente: null              // acción que espera la contraseña
  };

  /* ---------- Utilidades ---------- */
  function $(id) { return document.getElementById(id); }

  function el(etiqueta, atributos, hijos) {
    var n = document.createElement(etiqueta);
    if (atributos) {
      Object.keys(atributos).forEach(function (k) {
        var v = atributos[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'texto') n.textContent = v;
        else if (k === 'clase') n.className = v;
        else if (k === 'estilo') n.setAttribute('style', v);
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      });
    }
    (hijos || []).forEach(function (h) {
      if (h === null || h === undefined) return;
      n.appendChild(typeof h === 'string' ? document.createTextNode(h) : h);
    });
    return n;
  }

  function preferencia(clave, porDefecto) {
    try { return localStorage.getItem('ccdb-pref-' + clave) || porDefecto; } catch (e) { return porDefecto; }
  }
  function guardarPreferencia(clave, valor) {
    try { localStorage.setItem('ccdb-pref-' + clave, valor); } catch (e) { /* sin almacenamiento */ }
  }
  function leerOcultas() {
    try { return JSON.parse(preferencia('ocultas', '[]')).filter(function (id) { return AREAS[id]; }); } catch (e) { return []; }
  }

  function area(id) {
    return AREAS[id] || { id: id, nombre: 'Área sin configurar', color: '#848484' };
  }
  function nombreCorto(id) { var a = area(id); return a.corto || a.nombre; }

  function punto(idArea) {
    return el('span', { clase: 'punto', 'aria-hidden': 'true', estilo: '--color-area:' + area(idArea).color });
  }

  function etiquetaArea(idArea, corto) {
    return el('span', { clase: 'etiqueta-area', estilo: '--color-area:' + area(idArea).color },
      [punto(idArea), corto ? nombreCorto(idArea) : area(idArea).nombre]);
  }

  function visibles() {
    return estado.actividades.filter(function (a) { return estado.ocultas.indexOf(a.area) === -1; });
  }

  var tNotificacion;
  function notificar(texto) {
    var n = $('notificacion');
    n.textContent = texto;
    n.classList.add('notificacion--visible');
    clearTimeout(tNotificacion);
    tNotificacion = setTimeout(function () { n.classList.remove('notificacion--visible'); }, 3500);
  }

  function mostrarError(texto) {
    var a = $('aviso-error');
    a.textContent = texto || '';
    a.hidden = !texto;
  }

  function abrir(dlg) { if (!dlg.open) dlg.showModal(); }
  function cerrar(dlg) { if (dlg.open) dlg.close(); }

  /* ---------- Periodo visible ---------- */
  function rangoVisible() {
    if (estado.vista === 'semana') {
      var dias = L.diasDeSemana(estado.fecha);
      return { desde: dias[0], hasta: dias[6] };
    }
    var f = L.leerFecha(estado.fecha);
    var m = L.matrizMes(f.a, f.m);
    return { desde: m[0][0], hasta: m[m.length - 1][6] };
  }

  function suscribir() {
    if (estado.cancelar) estado.cancelar();
    var r = rangoVisible();
    estado.cancelar = datos.suscribir(r.desde, r.hasta, function (lista) {
      estado.actividades = lista;
      mostrarError('');
      dibujar();
    }, function (err) {
      mostrarError('No se pudieron cargar las actividades. ' + err.message);
    });
  }

  function irA(fecha) {
    var antes = rangoVisible();
    estado.fecha = fecha;
    var despues = rangoVisible();
    if (antes.desde !== despues.desde || antes.hasta !== despues.hasta) suscribir();
    dibujar();
  }

  function mover(paso) {
    if (estado.vista === 'semana') { irA(L.sumarDias(estado.fecha, 7 * paso)); return; }
    var f = L.leerFecha(estado.fecha);
    var m = L.sumarMeses(f.a, f.m, paso);
    irA(L.aTexto(m.a, m.m, 1));
  }

  function cambiarVista(vista) {
    if (vista === estado.vista) return;
    // Al pasar de mes a semana: si el mes visible es el actual, ir a la
    // semana de hoy; si no, a la primera semana del mes visible.
    if (vista === 'semana') {
      var fr = L.leerFecha(estado.fecha), fh = L.leerFecha(estado.hoy);
      if (fr.a === fh.a && fr.m === fh.m) estado.fecha = estado.hoy;
    }
    estado.vista = vista;
    guardarPreferencia('vista', vista);
    suscribir();
    dibujar();
  }

  /* ---------- Dibujo general ---------- */
  function dibujar() {
    var f = L.leerFecha(estado.fecha);
    var titulo;
    if (estado.vista === 'mes') {
      titulo = L.mayuscula(L.formatoMes(f.a, f.m));
    } else {
      var d = L.diasDeSemana(estado.fecha);
      titulo = 'Semana: ' + L.formatoRango(d[0], d[6]).replace(/^Del /, 'del ');
    }
    $('titulo-periodo').textContent = titulo;
    document.title = titulo + ' · ' + C.institucion.nombreApp;

    $('btn-anterior').setAttribute('aria-label', estado.vista === 'mes' ? 'Mes anterior' : 'Semana anterior');
    $('btn-siguiente').setAttribute('aria-label', estado.vista === 'mes' ? 'Mes siguiente' : 'Semana siguiente');
    document.querySelectorAll('.selector-vista__opcion').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.vista === estado.vista));
    });
    $('ir-mes').value = String(f.m);
    asegurarAnio(f.a);
    $('ir-anio').value = String(f.a);

    $('vista-mes').hidden = estado.vista !== 'mes';
    $('vista-semana').hidden = estado.vista !== 'semana';
    if (estado.vista === 'mes') dibujarMes(); else dibujarSemana();
    dibujarFiltros();

    // Mantener actualizadas las listas abiertas.
    if ($('dlg-dia').open && $('dlg-dia').dataset.dia) llenarDia($('dlg-dia').dataset.dia);
    if ($('dlg-detalle').open && estado.detalle) {
      var actual = estado.actividades.filter(function (a) { return a.id === estado.detalle.id; })[0];
      if (actual) llenarDetalle(actual);
    }
  }

  /* ---------- Vista del mes ---------- */
  function dibujarMes() {
    var f = L.leerFecha(estado.fecha);
    var semanas = L.matrizMes(f.a, f.m);
    var lista = visibles();
    var cont = $('vista-mes');
    cont.textContent = '';

    var cabeza = el('div', { clase: 'mes__cabeza', 'aria-hidden': 'true' },
      L.DIAS.map(function (d, i) {
        return el('div', { clase: 'mes__dia-nombre' + (i >= 5 ? ' es-fds' : '') }, [
          el('span', { clase: 'largo', texto: L.mayuscula(d) }),
          el('span', { clase: 'corto', texto: L.mayuscula(L.DIAS_CORTOS[i]) })
        ]);
      }));
    cont.appendChild(cabeza);

    var grilla = el('div', { clase: 'mes__grilla', estilo: '--filas:' + semanas.length });
    semanas.forEach(function (semana) {
      semana.forEach(function (dia) {
        grilla.appendChild(celdaMes(dia, f.m, lista));
      });
    });
    cont.appendChild(grilla);
  }

  function celdaMes(dia, mesVisible, lista) {
    var fd = L.leerFecha(dia);
    var delDia = L.actividadesDelDia(lista, dia);
    var clases = ['celda'];
    if (fd.m !== mesVisible) clases.push('celda--fuera');
    if (dia === estado.hoy) clases.push('celda--hoy');
    if (L.esFinDeSemana(dia)) clases.push('celda--fds');

    var etiquetaDia = L.mayuscula(L.formatoFechaLarga(dia)) + (dia === estado.hoy ? ' (hoy)' : '') +
      ', ' + (delDia.length === 0 ? 'sin actividades' : delDia.length === 1 ? '1 actividad' : delDia.length + ' actividades');

    var celda = el('div', { clase: clases.join(' ') });
    celda.appendChild(el('button', {
      type: 'button', clase: 'celda__numero', 'aria-label': etiquetaDia,
      onclick: function () { abrirDia(dia); }
    }, [el('span', { texto: String(fd.d) })]));

    // Escritorio: hasta 3 actividades y "+N más".
    var ul = el('ul', { clase: 'celda__lista' });
    // Las que no caben quedan ocultas en pantalla, pero se imprimen.
    delDia.forEach(function (a, i) {
      ul.appendChild(el('li', { clase: i < MAX_POR_CELDA ? null : 'solo-impresion' }, [fichaMes(a)]));
    });
    celda.appendChild(ul);
    if (delDia.length > MAX_POR_CELDA) {
      var resto = delDia.length - MAX_POR_CELDA;
      celda.appendChild(el('button', {
        type: 'button', clase: 'celda__mas',
        'aria-label': 'Ver ' + resto + ' actividades más del ' + L.formatoFechaLarga(dia),
        onclick: function () { abrirDia(dia); }
      }, ['+' + resto + ' más']));
    }

    // Celular: puntos de color por área.
    if (delDia.length) {
      var puntos = el('div', { clase: 'celda__puntos', 'aria-hidden': 'true' });
      delDia.slice(0, 4).forEach(function (a) { puntos.appendChild(punto(a.area)); });
      if (delDia.length > 4) puntos.appendChild(el('span', { clase: 'celda__puntos-mas', texto: '+' + (delDia.length - 4) }));
      celda.appendChild(puntos);
    }
    return celda;
  }

  function fichaMes(a) {
    var varios = a.fin && a.fin !== a.inicio;
    var hora = a.horaInicio ? L.formatoHora(a.horaInicio) : (varios ? 'Todo el día' : '');
    return el('button', {
      type: 'button', clase: 'ficha', estilo: '--color-area:' + area(a.area).color,
      'aria-label': a.titulo + '. ' + area(a.area).nombre + '. ' + L.formatoHorario(a),
      onclick: function () { abrirDetalle(a); }
    }, [
      el('span', { clase: 'ficha__area' }, [punto(a.area), nombreCorto(a.area)]),
      el('span', { clase: 'ficha__titulo' }, [hora ? el('span', { clase: 'ficha__hora', texto: hora + ' · ' }) : null, a.titulo])
    ]);
  }

  /* ---------- Vista de la semana ---------- */
  function dibujarSemana() {
    var dias = L.diasDeSemana(estado.fecha);
    var lista = visibles();
    var cont = $('vista-semana');
    cont.textContent = '';
    var grilla = el('div', { clase: 'semana__grilla' });
    dias.forEach(function (dia, i) {
      var delDia = L.actividadesDelDia(lista, dia);
      var fd = L.leerFecha(dia);
      var esHoy = dia === estado.hoy;
      var col = el('section', {
        clase: 'columna' + (esHoy ? ' columna--hoy' : '') + (dia < estado.hoy ? ' columna--pasado' : ''),
        'aria-label': L.mayuscula(L.formatoFechaLarga(dia)) + (esHoy ? ' (hoy)' : '')
      });
      col.appendChild(el('header', { clase: 'columna__cabeza' }, [
        el('h3', { clase: 'columna__dia' }, [
          el('span', { clase: 'columna__nombre', texto: L.mayuscula(L.DIAS[i]) }),
          el('span', { clase: 'columna__numero', texto: fd.d + ' ' + L.nombreMes(fd.m).slice(0, 3) })
        ]),
        esHoy ? el('span', { clase: 'pildora-hoy', texto: 'Hoy' }) : null,
        el('button', {
          type: 'button', clase: 'boton boton--icono boton--agregar-dia',
          'aria-label': 'Agregar actividad el ' + L.formatoFechaLarga(dia),
          onclick: function () { pedirSesion(function () { abrirFormulario(null, dia); }); }
        }, [el('span', { 'aria-hidden': 'true', texto: '+' })])
      ]));
      var ul = el('ul', { clase: 'lista-actividades' });
      if (!delDia.length) ul.appendChild(el('li', { clase: 'vacio', texto: 'Sin actividades' }));
      delDia.forEach(function (a) { ul.appendChild(el('li', null, [tarjeta(a)])); });
      col.appendChild(ul);
      grilla.appendChild(col);
    });
    cont.appendChild(grilla);
  }

  /** Tarjeta de actividad: hora, nombre, área y responsable. */
  function tarjeta(a) {
    var varios = a.fin && a.fin !== a.inicio;
    return el('button', {
      type: 'button', clase: 'tarjeta', estilo: '--color-area:' + area(a.area).color,
      onclick: function () { abrirDetalle(a); }
    }, [
      el('span', { clase: 'tarjeta__hora', texto: L.formatoHorario(a) }),
      el('span', { clase: 'tarjeta__titulo', texto: a.titulo }),
      etiquetaArea(a.area),
      a.responsable ? el('span', { clase: 'tarjeta__responsable', texto: a.responsable }) : null,
      varios ? el('span', { clase: 'tarjeta__rango', texto: L.formatoRango(a.inicio, a.fin) }) : null
    ]);
  }

  /* ---------- Filtros ---------- */
  function dibujarFiltros() {
    var cont = $('filtros');
    cont.textContent = '';
    C.areas.forEach(function (a) {
      var activa = estado.ocultas.indexOf(a.id) === -1;
      cont.appendChild(el('button', {
        type: 'button', clase: 'filtro', 'aria-pressed': String(activa),
        estilo: '--color-area:' + a.color,
        title: activa ? 'Ocultar ' + a.nombre : 'Mostrar ' + a.nombre,
        onclick: function () { alternarArea(a.id); }
      }, [punto(a.id), a.nombre]));
    });
    cont.appendChild(el('button', {
      type: 'button', clase: 'filtro filtro--todas',
      disabled: estado.ocultas.length === 0,
      onclick: function () { estado.ocultas = []; guardarOcultas(); dibujar(); }
    }, ['Mostrar todas']));
  }

  function alternarArea(id) {
    var i = estado.ocultas.indexOf(id);
    if (i === -1) estado.ocultas.push(id); else estado.ocultas.splice(i, 1);
    guardarOcultas();
    dibujar();
  }
  function guardarOcultas() { guardarPreferencia('ocultas', JSON.stringify(estado.ocultas)); }

  /* ---------- Lista del día ---------- */
  function abrirDia(dia) {
    var dlg = $('dlg-dia');
    dlg.dataset.dia = dia;
    llenarDia(dia);
    abrir(dlg);
  }

  function llenarDia(dia) {
    $('dlg-dia-titulo').textContent = L.mayuscula(L.formatoFechaLarga(dia));
    var ul = $('dlg-dia-lista');
    ul.textContent = '';
    var delDia = L.actividadesDelDia(visibles(), dia);
    if (!delDia.length) ul.appendChild(el('li', { clase: 'vacio', texto: 'No hay actividades este día.' }));
    delDia.forEach(function (a) { ul.appendChild(el('li', null, [tarjeta(a)])); });
  }

  /* ---------- Detalle ---------- */
  function abrirDetalle(a) {
    estado.detalle = a;
    llenarDetalle(a);
    abrir($('dlg-detalle'));
  }

  function llenarDetalle(a) {
    estado.detalle = a;
    var etq = $('det-area');
    etq.textContent = '';
    etq.style.setProperty('--color-area', area(a.area).color);
    etq.appendChild(punto(a.area));
    etq.appendChild(document.createTextNode(area(a.area).nombre));
    $('det-titulo').textContent = a.titulo;
    $('det-fecha').textContent = L.formatoRango(a.inicio, a.fin);
    $('det-horario').textContent = L.formatoHorario(a);
    $('det-responsable').textContent = a.responsable || 'Sin responsable indicado';
    $('det-serie').hidden = !a.serie;
  }

  /* ---------- Sesión ---------- */
  function actualizarSesion() {
    var activa = datos.haySesion();
    var b = $('btn-sesion');
    b.textContent = activa ? 'Salir' : 'Ingresar para editar';
    b.setAttribute('aria-label', activa ? 'Salir del modo de edición' : 'Ingresar con la contraseña para editar');
  }

  /** Ejecuta `accion` si hay sesión; si no, pide la contraseña primero. */
  function pedirSesion(accion) {
    if (datos.haySesion()) { accion(); return; }
    estado.pendiente = accion;
    $('f-clave').value = '';
    $('e-clave').textContent = '';
    abrir($('dlg-clave'));
    $('f-clave').focus();
  }

  function enviarClave(ev) {
    ev.preventDefault();
    var clave = $('f-clave').value;
    if (!clave) { $('e-clave').textContent = 'Escribe la contraseña.'; return; }
    var b = $('btn-ingresar');
    b.disabled = true;
    datos.ingresar(clave).then(function () {
      cerrar($('dlg-clave'));
      notificar('Ingresaste. Ya puedes agregar y editar actividades.');
      var p = estado.pendiente; estado.pendiente = null;
      if (p) p();
    }).catch(function (err) {
      $('e-clave').textContent = err.message;
      $('f-clave').select();
    }).then(function () { b.disabled = false; });
  }

  /* ---------- Formulario ---------- */
  var CAMPOS = ['area', 'titulo', 'inicio', 'fin', 'horaInicio', 'horaFin', 'responsable'];
  var ENTRADAS = { area: 'f-area', titulo: 'f-titulo', inicio: 'f-inicio', fin: 'f-fin', horaInicio: 'f-hora-inicio', horaFin: 'f-hora-fin', responsable: 'f-responsable' };

  function abrirFormulario(act, dia) {
    estado.editando = act || null;
    estado.confirmarCruce = false;
    estado.firmaCruces = '';
    var nueva = !act;
    $('form-titulo').textContent = nueva ? 'Agregar actividad' : 'Editar actividad';
    var base = act || { area: '', titulo: '', inicio: dia || estado.hoy, fin: dia || estado.hoy, horaInicio: '', horaFin: '', responsable: '' };
    CAMPOS.forEach(function (c) { $(ENTRADAS[c]).value = base[c] || ''; });
    if (!base.fin) $('f-fin').value = base.inicio;
    limpiarErrores();
    actualizarContador();

    $('repetir').hidden = !nueva;
    $('f-repetir').value = 'no';
    $('rep-cada').value = '1';
    $('rep-hasta').value = '';
    document.querySelector('input[name="rep-fds"][value="omitir"]').checked = true;
    prepararRepeticion();
    $('btn-guardar').textContent = 'Guardar';
    $('aviso-cruce').hidden = true;
    $('aviso-cruce').textContent = '';
    $('nota-serie').hidden = !(act && act.serie);
    cerrar($('dlg-detalle'));
    cerrar($('dlg-dia'));
    abrir($('dlg-actividad'));
    $(nueva ? 'f-area' : 'f-titulo').focus();
    revisarCruces();
  }

  function leerFormulario() {
    var a = {};
    CAMPOS.forEach(function (c) { a[c] = $(ENTRADAS[c]).value; });
    return a;
  }

  function limpiarErrores() {
    CAMPOS.forEach(function (c) {
      $('e-' + c).textContent = '';
      $(ENTRADAS[c]).removeAttribute('aria-invalid');
    });
    $('e-general').textContent = '';
  }

  function mostrarErrores(errores) {
    limpiarErrores();
    var primero = null;
    CAMPOS.forEach(function (c) {
      if (errores[c]) {
        $('e-' + c).textContent = errores[c];
        $(ENTRADAS[c]).setAttribute('aria-invalid', 'true');
        if (!primero) primero = ENTRADAS[c];
      }
    });
    if (primero) $(primero).focus();
  }

  function actualizarContador() {
    $('c-titulo').textContent = $('f-titulo').value.length + ' de ' + L.MAX_TITULO + ' caracteres';
  }

  /* Repetición */
  function prepararRepeticion() {
    var tipo = $('f-repetir').value;
    $('rep-semanal').hidden = tipo !== 'semanal';
    $('rep-mensual').hidden = tipo !== 'mensual';
    $('rep-hasta-campo').hidden = tipo === 'no';
    var inicio = $('f-inicio').value;
    if (tipo !== 'no' && L.esFechaValida(inicio)) {
      if (!$('rep-hasta').value) {
        var f = L.leerFecha(inicio);
        var m = L.sumarMeses(f.a, f.m, tipo === 'mensual' ? 6 : 3);
        $('rep-hasta').value = L.sumarDias(L.aTexto(m.a, m.m, 1), -1);
      }
      $('rep-hasta').min = inicio;
      $('rep-hasta').max = L.sumarAnios(inicio, 1);
      if (tipo === 'semanal' && !document.querySelector('#rep-dias input:checked')) {
        var cb = document.querySelector('#rep-dias input[value="' + L.diaSemana(inicio) + '"]');
        if (cb) cb.checked = true;
      }
      if (tipo === 'mensual' && !$('rep-dia').value) $('rep-dia').value = String(L.leerFecha(inicio).d);
    }
    if (tipo === 'no') {
      document.querySelectorAll('#rep-dias input').forEach(function (c) { c.checked = false; });
      $('rep-dia').value = '';
    }
    actualizarVistaPrevia();
  }

  function reglaRepeticion() {
    var tipo = $('f-repetir').value;
    if (tipo === 'no' || estado.editando) return null;
    if (tipo === 'semanal') {
      return {
        tipo: 'semanal',
        dias: Array.prototype.map.call(document.querySelectorAll('#rep-dias input:checked'), function (c) { return +c.value; }),
        cada: +$('rep-cada').value,
        hasta: $('rep-hasta').value
      };
    }
    return {
      tipo: 'mensual',
      dia: +$('rep-dia').value,
      finDeSemana: document.querySelector('input[name="rep-fds"]:checked').value,
      hasta: $('rep-hasta').value
    };
  }

  /** Devuelve { fechas, error } de la repetición actual (o una sola fecha). */
  function fechasDelFormulario() {
    var inicio = $('f-inicio').value;
    var regla = reglaRepeticion();
    if (!regla) return { fechas: L.esFechaValida(inicio) ? [inicio] : [], error: '' };
    return L.generarRepeticion(inicio, regla);
  }

  function actualizarVistaPrevia() {
    var vp = $('rep-vista-previa');
    if (!reglaRepeticion()) { vp.textContent = ''; vp.classList.remove('vista-previa--error'); return; }
    var r = fechasDelFormulario();
    vp.textContent = r.error || L.textoVistaPrevia(r.fechas);
    vp.classList.toggle('vista-previa--error', !!r.error);
  }

  /* Cruces: solo advertencia */
  var tCruces, turnoCruces = 0;
  function revisarCruces() {
    clearTimeout(tCruces);
    tCruces = setTimeout(calcularCruces, 250);
  }

  function calcularCruces() {
    var a = L.normalizar(leerFormulario());
    var r = fechasDelFormulario();
    if (!a.horaInicio || !L.esHoraValida(a.horaInicio) || !r.fechas.length || !L.esFechaValida(a.fin) || a.fin < a.inicio) {
      ponerCruces([]);
      return;
    }
    var duracion = L.diferenciaDias(a.inicio, a.fin);
    var desde = r.fechas[0];
    var hasta = L.sumarDias(r.fechas[r.fechas.length - 1], duracion);
    var turno = ++turnoCruces;
    datos.consultar(desde, hasta).then(function (lista) {
      if (turno !== turnoCruces) return;
      var vistos = {}, cruces = [];
      r.fechas.forEach(function (f) {
        var candidata = Object.assign({}, a, { inicio: f, fin: L.sumarDias(f, duracion), id: estado.editando ? estado.editando.id : '' });
        L.buscarCruces(candidata, lista).forEach(function (c) {
          if (!vistos[c.id]) { vistos[c.id] = true; cruces.push(c); }
        });
      });
      cruces.sort(function (x, y) { return x.inicio < y.inicio ? -1 : x.inicio > y.inicio ? 1 : L.comparar(x, y); });
      ponerCruces(cruces);
    }).catch(function () { /* sin aviso si no se puede consultar */ });
  }

  function ponerCruces(cruces) {
    estado.cruces = cruces;
    var firma = cruces.map(function (c) { return c.id; }).join(',');
    if (firma !== estado.firmaCruces) {
      estado.firmaCruces = firma;
      estado.confirmarCruce = false;
      $('btn-guardar').textContent = 'Guardar';
    }
    var aviso = $('aviso-cruce');
    aviso.textContent = '';
    if (!cruces.length) { aviso.hidden = true; return; }
    aviso.hidden = false;
    aviso.appendChild(el('p', { clase: 'aviso-cruce__titulo' }, [
      el('strong', { texto: 'Atención: ' }),
      cruces.length === 1 ? 'esta actividad se cruza en horario con otra.' : 'esta actividad se cruza en horario con otras ' + cruces.length + '.'
    ]));
    var ul = el('ul');
    cruces.slice(0, MAX_CRUCES).forEach(function (c) {
      ul.appendChild(el('li', null, [
        el('span', { clase: 'aviso-cruce__cuando', texto: L.mayuscula(L.formatoFechaCorta(c.inicio)) + ', ' + L.formatoHorario(c) + ': ' }),
        c.titulo + ' ',
        etiquetaArea(c.area, true)
      ]));
    });
    if (cruces.length > MAX_CRUCES) ul.appendChild(el('li', { texto: '… y ' + (cruces.length - MAX_CRUCES) + ' más' }));
    aviso.appendChild(ul);
    aviso.appendChild(el('p', { clase: 'aviso-cruce__nota', texto: 'Puedes guardar de todos modos; el cruce no impide guardar.' }));
  }

  function enviarFormulario(ev) {
    ev.preventDefault();
    var a = L.normalizar(leerFormulario());
    var v = L.validar(a, { areas: IDS_AREAS, maxDias: C.maxDiasDuracion });
    if (!v.ok) { mostrarErrores(v.errores); return; }
    limpiarErrores();
    var r = fechasDelFormulario();
    if (r.error) { $('e-general').textContent = r.error; $('f-repetir').focus(); return; }

    // Primer clic con cruces: advertir y cambiar el botón.
    clearTimeout(tCruces);
    if (estado.cruces.length && !estado.confirmarCruce) {
      estado.confirmarCruce = true;
      $('btn-guardar').textContent = 'Guardar de todos modos';
      $('aviso-cruce').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }

    var b = $('btn-guardar');
    b.disabled = true;
    var promesa;
    if (estado.editando) {
      a.serie = estado.editando.serie || '';
      promesa = datos.actualizar(estado.editando.id, a);
    } else if (r.fechas.length > 1) {
      promesa = datos.crear(L.expandirSerie(a, r.fechas, L.nuevoId()));
    } else {
      promesa = datos.crear([a]);
    }
    promesa.then(function () {
      cerrar($('dlg-actividad'));
      notificar(estado.editando ? 'Cambios guardados.' : r.fechas.length > 1 ? 'Se crearon ' + r.fechas.length + ' actividades.' : 'Actividad guardada.');
      if (!estado.editando) irA(a.inicio);
    }).catch(function (err) {
      $('e-general').textContent = 'No se pudo guardar. ' + err.message;
    }).then(function () { b.disabled = false; });
  }

  /* ---------- Eliminar ---------- */
  function abrirEliminar(a) {
    estado.detalle = a;
    $('eliminar-texto').textContent = '¿Seguro que quieres eliminar «' + a.titulo + '» (' + L.formatoRango(a.inicio, a.fin).toLowerCase() + ')? Esta acción no se puede deshacer.';
    $('eliminar-opciones').hidden = !a.serie;
    document.querySelector('input[name="eliminar-modo"][value="solo"]').checked = true;
    $('e-eliminar').textContent = '';
    cerrar($('dlg-detalle'));
    abrir($('dlg-eliminar'));
  }

  function confirmarEliminar(ev) {
    ev.preventDefault();
    var a = estado.detalle;
    var modo = a.serie ? document.querySelector('input[name="eliminar-modo"]:checked').value : 'solo';
    var b = $('btn-confirmar-eliminar');
    b.disabled = true;
    var p = modo === 'solo' ? Promise.resolve([a]) : datos.actividadesDeSerie(a.serie);
    p.then(function (lista) {
      var ids = L.seleccionarSerie(lista, a, modo).map(function (x) { return x.id; });
      if (!ids.length) ids = [a.id];
      return datos.eliminar(ids).then(function () { return ids.length; });
    }).then(function (n) {
      cerrar($('dlg-eliminar'));
      notificar(n === 1 ? 'Actividad eliminada.' : 'Se eliminaron ' + n + ' actividades.');
    }).catch(function (err) {
      $('e-eliminar').textContent = 'No se pudo eliminar. ' + err.message;
    }).then(function () { b.disabled = false; });
  }

  /* ---------- "Ir a" ---------- */
  function asegurarAnio(a) {
    var sel = $('ir-anio');
    var anios = Array.prototype.map.call(sel.options, function (o) { return +o.value; });
    if (anios.indexOf(a) !== -1) return;
    anios.push(a);
    anios.sort(function (x, y) { return x - y; });
    sel.textContent = '';
    anios.forEach(function (n) { sel.appendChild(el('option', { value: String(n), texto: String(n) })); });
  }

  /* ---------- Inicio ---------- */
  function preparar() {
    var logo = $('logo');
    logo.src = C.logo.color;
    logo.alt = C.logo.alt;

    // Selectores de área, días y "Ir a".
    var selArea = $('f-area');
    selArea.appendChild(el('option', { value: '', texto: 'Elige un área' }));
    C.areas.forEach(function (a) { selArea.appendChild(el('option', { value: a.id, texto: a.nombre })); });

    var dias = $('rep-dias');
    L.DIAS.forEach(function (d, i) {
      dias.appendChild(el('label', { clase: 'dia-check' }, [
        el('input', { type: 'checkbox', value: String(i), onchange: function () { actualizarVistaPrevia(); revisarCruces(); } }),
        el('span', { texto: L.mayuscula(L.DIAS_CORTOS[i]), title: L.mayuscula(d) })
      ]));
    });

    L.MESES.forEach(function (m, i) { $('ir-mes').appendChild(el('option', { value: String(i + 1), texto: L.mayuscula(m) })); });
    var anioActual = L.leerFecha(estado.hoy).a;
    for (var a = anioActual - 3; a <= anioActual + 3; a++) $('ir-anio').appendChild(el('option', { value: String(a), texto: String(a) }));

    // Eventos de la barra.
    $('btn-anterior').addEventListener('click', function () { mover(-1); });
    $('btn-siguiente').addEventListener('click', function () { mover(1); });
    $('btn-hoy').addEventListener('click', function () { irA(estado.hoy); });
    $('form-ir-a').addEventListener('submit', function (ev) {
      ev.preventDefault();
      irA(L.aTexto(+$('ir-anio').value, +$('ir-mes').value, 1));
    });
    document.querySelectorAll('.selector-vista__opcion').forEach(function (b) {
      b.addEventListener('click', function () { cambiarVista(b.dataset.vista); });
    });

    // Sesión.
    $('btn-agregar').addEventListener('click', function () { pedirSesion(function () { abrirFormulario(null, null); }); });
    $('btn-sesion').addEventListener('click', function () {
      if (datos.haySesion()) datos.salir().then(function () { notificar('Saliste del modo de edición.'); });
      else pedirSesion(function () {});
    });
    $('form-clave').addEventListener('submit', enviarClave);
    datos.alCambiarSesion(actualizarSesion);

    // Diálogos.
    document.querySelectorAll('[data-cerrar]').forEach(function (b) {
      b.addEventListener('click', function () { cerrar(b.closest('dialog')); });
    });
    document.querySelectorAll('dialog').forEach(function (d) {
      // Cerrar al hacer clic en el fondo.
      d.addEventListener('click', function (ev) { if (ev.target === d) cerrar(d); });
    });
    $('dlg-clave').addEventListener('close', function () { estado.pendiente = null; });
    $('dlg-dia-agregar').addEventListener('click', function () {
      var dia = $('dlg-dia').dataset.dia;
      pedirSesion(function () { abrirFormulario(null, dia); });
    });
    $('det-editar').addEventListener('click', function () {
      var a = estado.detalle;
      pedirSesion(function () { abrirFormulario(a, null); });
    });
    $('det-eliminar').addEventListener('click', function () {
      var a = estado.detalle;
      pedirSesion(function () { abrirEliminar(a); });
    });
    $('form-eliminar').addEventListener('submit', confirmarEliminar);

    // Formulario.
    $('form-actividad').addEventListener('submit', enviarFormulario);
    $('f-titulo').addEventListener('input', actualizarContador);
    var inicioAnterior = '';
    $('f-inicio').addEventListener('focus', function () { inicioAnterior = $('f-inicio').value; });
    $('f-inicio').addEventListener('change', function () {
      // Si la fecha final era igual a la inicial (o anterior), moverla junto con ella.
      var fin = $('f-fin').value;
      if (!fin || fin === inicioAnterior || fin < $('f-inicio').value) $('f-fin').value = $('f-inicio').value;
      inicioAnterior = $('f-inicio').value;
      $('rep-hasta').value = '';
      $('rep-dia').value = '';
      prepararRepeticion();
    });
    ['f-inicio', 'f-fin', 'f-hora-inicio', 'f-hora-fin'].forEach(function (id) {
      $(id).addEventListener('input', revisarCruces);
      $(id).addEventListener('change', revisarCruces);
    });
    $('f-repetir').addEventListener('change', function () { prepararRepeticion(); revisarCruces(); });
    ['rep-cada', 'rep-hasta', 'rep-dia'].forEach(function (id) {
      $(id).addEventListener('input', function () { actualizarVistaPrevia(); revisarCruces(); });
      $(id).addEventListener('change', function () { actualizarVistaPrevia(); revisarCruces(); });
    });
    document.querySelectorAll('input[name="rep-fds"]').forEach(function (r) {
      r.addEventListener('change', function () { actualizarVistaPrevia(); revisarCruces(); });
    });

    // Modo demostración.
    if (datos.modo === 'demo') {
      $('aviso-demo').hidden = false;
      $('btn-reiniciar-demo').addEventListener('click', function () {
        if (window.confirm('¿Volver a los datos de ejemplo? Se perderán los cambios hechos en este navegador.')) {
          datos.reiniciar();
          notificar('Se restablecieron los datos de ejemplo.');
        }
      });
    }

    // Cambio de día (si la página queda abierta después de medianoche).
    setInterval(function () {
      var h = L.hoy();
      if (h !== estado.hoy) { estado.hoy = h; dibujar(); }
    }, 60000);

    // Atajos de teclado: ← → para cambiar de periodo, "h" para hoy.
    document.addEventListener('keydown', function (ev) {
      if (document.querySelector('dialog[open]')) return;
      var t = ev.target.tagName;
      if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.key === 'ArrowLeft' && t !== 'BUTTON') mover(-1);
      else if (ev.key === 'ArrowRight' && t !== 'BUTTON') mover(1);
    });
  }

  preparar();
  actualizarSesion();
  dibujar();
  datos.iniciar({ conSesion: true }).then(function () {
    actualizarSesion();
    suscribir();
  }).catch(function (err) {
    mostrarError('No se pudo conectar con la base de datos. ' + err.message);
  });
})();
