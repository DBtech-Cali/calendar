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
  var MAX_CRUCES = 5;

  /* ---------- Estado ---------- */
  var estado = {
    vista: preferencia('vista', 'mes') === 'semana' ? 'semana' : 'mes',
    fecha: L.hoy(),              // fecha de referencia del periodo visible
    hoy: L.hoy(),
    actividades: [],
    ocultas: leerOcultas(),      // ids de áreas ocultas por el filtro
    cancelar: null,              // cancelar suscripción actual
    editando: null,              // actividad que se edita (o null si son nuevas)
    cruces: 0,                   // cuántas filas del formulario tienen cruces
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
        grilla.appendChild(celdaMes(dia, f.m, lista, semanas[0][0]));
      });
    });
    cont.appendChild(grilla);
  }

  function celdaMes(dia, mesVisible, lista, primerDia) {
    var fd = L.leerFecha(dia);
    // Las de varios días se muestran una sola vez, el día en que empiezan.
    var delDia = L.actividadesQueInician(lista, dia, primerDia);
    var clases = ['celda'];
    if (fd.m !== mesVisible) clases.push('celda--fuera');
    if (dia === estado.hoy) clases.push('celda--hoy');

    var etiquetaDia = L.mayuscula(L.formatoFechaLarga(dia)) + (dia === estado.hoy ? ' (hoy)' : '') +
      ', ' + (delDia.length === 0 ? 'sin actividades' : delDia.length === 1 ? '1 actividad' : delDia.length + ' actividades');

    var celda = el('div', { clase: clases.join(' ') });
    celda.appendChild(el('button', {
      type: 'button', clase: 'celda__numero', 'aria-label': etiquetaDia,
      onclick: function () { abrirDia(dia); }
    }, [el('span', { texto: String(fd.d) })]));

    // Escritorio: todas las actividades del día (la celda crece lo necesario).
    if (delDia.length) {
      var ul = el('ul', { clase: 'celda__lista' });
      delDia.forEach(function (a) { ul.appendChild(el('li', null, [ficha(a, 'ficha')])); });
      celda.appendChild(ul);
    }

    // Celular: un punto de color por actividad.
    if (delDia.length) {
      var puntos = el('div', { clase: 'celda__puntos', 'aria-hidden': 'true' });
      delDia.forEach(function (a) { puntos.appendChild(punto(a.area)); });
      celda.appendChild(puntos);
    }
    return celda;
  }

  /**
   * Ficha de una actividad: primero el área (color + nombre) y enseguida el
   * nombre de la actividad; debajo, solo si existen, la hora y el rango de días.
   * clase: 'ficha' (celda del mes) o 'tarjeta' (semana y lista del día).
   */
  function ficha(a, clase) {
    var varios = a.fin && a.fin !== a.inicio;
    var hora = a.horaInicio ? L.formatoHora(a.horaInicio) : '';
    var rango = varios ? L.formatoRangoBreve(a.inicio, a.fin) : '';
    var etiqueta = area(a.area).nombre + ': ' + a.titulo + (hora ? ', ' + hora : '') + (rango ? ', ' + rango : '');
    // Todo en una misma línea: ÁREA · actividad · hora · fechas (si existen).
    return el('button', {
      type: 'button', clase: clase, estilo: '--color-area:' + area(a.area).color,
      'aria-label': etiqueta,
      onclick: function () { abrirDetalle(a); }
    }, [
      el('span', { clase: clase + '__area' }, [punto(a.area), nombreCorto(a.area)]),
      ' ',
      el('span', { clase: clase + '__titulo', texto: a.titulo }),
      hora ? ' ' : null,
      hora ? el('span', { clase: clase + '__hora', texto: hora }) : null,
      rango ? ' ' : null,
      rango ? el('span', { clase: clase + '__rango', texto: rango }) : null
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
      var delDia = L.actividadesQueInician(lista, dia, dias[0]);
      var fd = L.leerFecha(dia);
      var esHoy = dia === estado.hoy;
      var col = el('section', {
        clase: 'columna' + (esHoy ? ' columna--hoy' : '') + (i === 6 ? ' columna--domingo' : ''),
        'aria-label': L.mayuscula(L.formatoFechaLarga(dia)) + (esHoy ? ' (hoy)' : '')
      });
      col.appendChild(el('header', { clase: 'columna__cabeza' }, [
        el('h3', { clase: 'columna__dia' }, [
          el('span', { clase: 'columna__nombre', texto: L.mayuscula(L.DIAS[i]) }),
          el('span', { clase: 'columna__numero' }, [
            fd.d + ' ' + L.nombreMes(fd.m).slice(0, 3),
            esHoy ? el('span', { clase: 'pildora-hoy', texto: 'Hoy' }) : null
          ])
        ]),
        el('button', {
          type: 'button', clase: 'boton boton--icono boton--agregar-dia',
          'aria-label': 'Agregar actividades el ' + L.formatoFechaLarga(dia),
          onclick: function () { pedirSesion(function () { abrirFormulario(null, dia); }); }
        }, [el('span', { 'aria-hidden': 'true', texto: '+' })])
      ]));
      var ul = el('ul', { clase: 'lista-actividades' });
      if (!delDia.length) ul.appendChild(el('li', { clase: 'vacio', texto: 'Sin actividades' }));
      delDia.forEach(function (a) { ul.appendChild(el('li', null, [ficha(a, 'tarjeta')])); });
      col.appendChild(ul);
      grilla.appendChild(col);
    });
    cont.appendChild(grilla);
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
    var delDia = L.actividadesQueInician(visibles(), dia, rangoVisible().desde);
    if (!delDia.length) ul.appendChild(el('li', { clase: 'vacio', texto: 'No hay actividades que empiecen este día.' }));
    delDia.forEach(function (a) { ul.appendChild(el('li', null, [ficha(a, 'tarjeta')])); });
  }

  /* ---------- Detalle ---------- */
  function abrirDetalle(a) {
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
    // La hora solo se muestra si existe.
    $('det-horario').textContent = L.formatoHorario(a);
    $('det-horario').hidden = !a.horaInicio;
    $('det-horario-t').hidden = !a.horaInicio;
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
      var p = estado.pendiente;
      estado.pendiente = null;
      cerrar($('dlg-clave'));
      notificar('Ingresaste. Ya puedes agregar y editar actividades.');
      if (p) p();
    }).catch(function (err) {
      $('e-clave').textContent = err.message;
      $('f-clave').select();
    }).then(function () { b.disabled = false; });
  }

  /* ---------- Formulario por filas ---------- */
  var CAMPOS_FILA = ['inicio', 'titulo', 'varios', 'fin', 'horaInicio'];
  var NOMBRES_CAMPO = { inicio: 'Fecha', titulo: 'Actividad', fin: 'Fecha final', horaInicio: 'Hora' };
  var contadorFilas = 0;
  var FILAS_INICIALES = 5;

  function filas() { return Array.prototype.slice.call($('filas').children); }
  function campo(fila, nombre) { return fila.querySelector('[data-campo="' + nombre + '"]'); }

  function leerFila(fila) {
    return {
      inicio: campo(fila, 'inicio').value,
      titulo: campo(fila, 'titulo').value,
      varios: campo(fila, 'varios').checked,
      fin: campo(fila, 'fin').value,
      horaInicio: campo(fila, 'horaInicio').value
    };
  }

  /** Agrega una fila al formulario y la devuelve. */
  function agregarFila(valores) {
    var v = valores || {};
    var fila = $('plantilla-fila').content.firstElementChild.cloneNode(true);
    var n = ++contadorFilas;
    llenarHoras(campo(fila, 'horaInicio'), v.horaInicio || '');
    CAMPOS_FILA.forEach(function (c) {
      var input = campo(fila, c);
      input.id = 'fila' + n + '-' + c;
      if (c === 'varios') input.checked = !!v.varios;
      else input.value = v[c] || '';
    });
    fila.querySelectorAll('label[data-para]').forEach(function (lab) {
      lab.setAttribute('for', 'fila' + n + '-' + lab.dataset.para);
    });
    var err = fila.querySelector('[data-error]');
    err.id = 'fila' + n + '-error';
    ['inicio', 'titulo', 'fin', 'horaInicio'].forEach(function (c) { campo(fila, c).setAttribute('aria-describedby', err.id); });
    mostrarFin(fila, !!v.varios);
    $('filas').appendChild(fila);
    numerarFilas();
    return fila;
  }

  /** Lista de horas de la jornada (opcional). Conserva una hora antigua que no esté en la lista. */
  var HORAS = L.opcionesHora(C.horario.desde, C.horario.hasta, C.horario.cadaMinutos);
  function llenarHoras(select, actual) {
    select.appendChild(el('option', { value: '', texto: 'Sin hora' }));
    var horas = HORAS.slice();
    if (actual && horas.indexOf(actual) === -1) { horas.push(actual); horas.sort(); }
    horas.forEach(function (h) { select.appendChild(el('option', { value: h, texto: L.formatoHora(h) })); });
  }

  /** Etiquetas accesibles con el número de fila ("Actividad 2"). */
  function numerarFilas() {
    var todas = filas();
    todas.forEach(function (fila, i) {
      var n = i + 1;
      fila.querySelectorAll('label[data-para]').forEach(function (lab) {
        var base = NOMBRES_CAMPO[lab.dataset.para];
        lab.textContent = '';
        lab.appendChild(document.createTextNode(lab.dataset.para === 'fin' ? 'Hasta' : base));
        lab.appendChild(el('span', { clase: 'oculto', texto: ' (actividad ' + n + ')' }));
      });
      campo(fila, 'varios').setAttribute('aria-label', 'Varios días (actividad ' + n + ')');
      var q = fila.querySelector('[data-quitar]');
      q.setAttribute('aria-label', 'Quitar la actividad ' + n);
      q.hidden = !!estado.editando;
    });
  }

  function mostrarFin(fila, visible) {
    var cont = fila.querySelector('.fila__fin');
    cont.hidden = !visible;
    fila.classList.toggle('fila--varios', visible);
    var inicio = campo(fila, 'inicio').value;
    var fin = campo(fila, 'fin');
    if (L.esFechaValida(inicio)) fin.min = inicio; else fin.removeAttribute('min');
  }

  function abrirFormulario(act, dia) {
    estado.editando = act || null;
    estado.cruces = 0;
    estado.confirmarCruce = false;
    estado.firmaCruces = '';
    var nueva = !act;
    $('form-titulo').textContent = nueva ? 'Agregar actividades' : 'Editar actividad';
    $('f-area').value = act ? act.area : preferencia('ultima-area', '');
    if (!AREAS[$('f-area').value]) $('f-area').value = '';
    $('f-area').removeAttribute('aria-invalid');
    $('e-area').textContent = '';
    $('e-general').textContent = '';
    $('filas').textContent = '';
    contadorFilas = 0;
    if (act) {
      agregarFila({ inicio: act.inicio, titulo: act.titulo, varios: act.fin && act.fin !== act.inicio, fin: act.fin !== act.inicio ? act.fin : '', horaInicio: act.horaInicio });
    } else {
      // Cinco filas listas; las que queden vacías se omiten al guardar.
      for (var k = 0; k < FILAS_INICIALES; k++) agregarFila({ inicio: dia || '' });
    }
    $('btn-agregar-fila').hidden = !nueva;
    $('ayuda-filas').hidden = !nueva;
    $('btn-guardar').textContent = 'Guardar';
    $('aviso-cruce').hidden = true;
    $('aviso-cruce').textContent = '';
    cerrar($('dlg-detalle'));
    cerrar($('dlg-dia'));
    abrir($('dlg-actividad'));
    if (!$('f-area').value) $('f-area').focus();
    else if (!dia && nueva) campo(filas()[0], 'inicio').focus();
    else campo(filas()[0], 'titulo').focus();
    revisarCruces();
  }

  /** Pasa a la fila siguiente (y la crea si es la última). */
  function siguienteFila(fila) {
    var todas = filas();
    var i = todas.indexOf(fila);
    var sig = todas[i + 1];
    if (!sig) {
      if (estado.editando) { $('btn-guardar').focus(); return; }
      sig = agregarFila({ inicio: campo(fila, 'inicio').value });
    }
    campo(sig, 'inicio').focus();
  }

  function quitarFila(fila) {
    var todas = filas();
    if (todas.length === 1) {
      ['inicio', 'titulo', 'fin', 'horaInicio'].forEach(function (c) { campo(fila, c).value = ''; });
      campo(fila, 'varios').checked = false;
      mostrarFin(fila, false);
      campo(fila, 'inicio').focus();
    } else {
      var i = todas.indexOf(fila);
      fila.remove();
      numerarFilas();
      var foco = filas()[Math.max(0, i - 1)];
      campo(foco, 'titulo').focus();
    }
    revisarCruces();
  }

  function limpiarErrores() {
    $('e-area').textContent = '';
    $('f-area').removeAttribute('aria-invalid');
    $('e-general').textContent = '';
    filas().forEach(function (fila) {
      fila.querySelector('[data-error]').textContent = '';
      fila.classList.remove('fila--error');
      fila.querySelectorAll('[aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); });
    });
  }

  function mostrarErrores(r) {
    limpiarErrores();
    var primero = null;
    if (r.general) {
      if (!$('f-area').value) {
        $('e-area').textContent = r.general;
        $('f-area').setAttribute('aria-invalid', 'true');
        primero = $('f-area');
      } else {
        $('e-general').textContent = r.general;
        primero = campo(filas()[0], 'titulo');
      }
    }
    var todas = filas();
    Object.keys(r.errores).forEach(function (i) {
      var fila = todas[i];
      var e = r.errores[i];
      fila.classList.add('fila--error');
      fila.querySelector('[data-error]').textContent = Object.keys(e).map(function (c) { return e[c]; }).join(' ');
      Object.keys(e).forEach(function (c) {
        var input = campo(fila, c);
        if (input) {
          input.setAttribute('aria-invalid', 'true');
          if (!primero) primero = input;
        }
      });
    });
    if (primero) primero.focus();
  }

  /* Cruces: solo advertencia, nunca impide guardar. */
  var tCruces, turnoCruces = 0;
  function revisarCruces() {
    clearTimeout(tCruces);
    tCruces = setTimeout(calcularCruces, 250);
  }

  /** Candidatas a revisar: filas con fecha válida y hora. */
  function candidatas() {
    var r = [];
    filas().forEach(function (fila, i) {
      var f = leerFila(fila);
      var inicio = f.inicio;
      var fin = f.varios && f.fin ? f.fin : inicio;
      if (!L.esFechaValida(inicio) || !L.esHoraValida(f.horaInicio) || !L.esFechaValida(fin) || fin < inicio) return;
      r.push({
        fila: fila, n: i + 1,
        act: {
          id: estado.editando ? estado.editando.id : 'fila-' + i,
          titulo: f.titulo.trim() || 'Actividad ' + (i + 1), area: $('f-area').value,
          inicio: inicio, fin: fin, horaInicio: f.horaInicio
        }
      });
    });
    return r;
  }

  function calcularCruces() {
    var cands = candidatas();
    if (!cands.length) { ponerCruces([]); return; }
    var desde = cands.reduce(function (m, c) { return c.act.inicio < m ? c.act.inicio : m; }, cands[0].act.inicio);
    var hasta = cands.reduce(function (m, c) { return c.act.fin > m ? c.act.fin : m; }, cands[0].act.fin);
    var turno = ++turnoCruces;
    datos.consultar(desde, hasta).then(function (lista) {
      if (turno !== turnoCruces) return;
      var otrasFilas = cands.map(function (c) { return c.act; });
      ponerCruces(cands.map(function (c) {
        var conDatos = L.buscarCruces(c.act, lista);
        var conFilas = L.buscarCruces(c.act, otrasFilas);
        return { cand: c, cruces: conDatos.concat(conFilas) };
      }).filter(function (x) { return x.cruces.length; }));
    }).catch(function () { /* sin aviso si no se puede consultar */ });
  }

  function textoCruce(c) {
    if (String(c.id).indexOf('fila-') === 0) return '«' + c.titulo + '» (otra fila de este formulario, ' + L.formatoHora(c.horaInicio) + ')';
    return '«' + c.titulo + '» (' + area(c.area).nombre + ', ' + L.formatoHora(c.horaInicio) + ')';
  }

  function ponerCruces(conCruce) {
    filas().forEach(function (fila) {
      var p = fila.querySelector('[data-cruce]');
      p.hidden = true; p.textContent = '';
      fila.classList.remove('fila--cruce');
    });
    conCruce.forEach(function (x) {
      var p = x.cand.fila.querySelector('[data-cruce]');
      var lista = x.cruces.slice(0, MAX_CRUCES).map(textoCruce).join('; ');
      if (x.cruces.length > MAX_CRUCES) lista += '… y ' + (x.cruces.length - MAX_CRUCES) + ' más';
      p.textContent = 'Se cruza en horario con ' + lista + '.';
      p.hidden = false;
      x.cand.fila.classList.add('fila--cruce');
    });

    var firma = conCruce.map(function (x) { return x.cand.n + ':' + x.cruces.map(function (c) { return c.id; }).join(','); }).join('|');
    if (firma !== estado.firmaCruces) {
      estado.firmaCruces = firma;
      estado.confirmarCruce = false;
      $('btn-guardar').textContent = 'Guardar';
    }
    estado.cruces = conCruce.length;

    var aviso = $('aviso-cruce');
    aviso.textContent = '';
    aviso.hidden = !conCruce.length;
    if (!conCruce.length) return;
    aviso.appendChild(el('p', null, [
      el('strong', { texto: 'Atención: ' }),
      conCruce.length === 1
        ? 'una actividad se cruza en horario con otra (se asume 1 hora de duración).'
        : conCruce.length + ' actividades se cruzan en horario con otras (se asume 1 hora de duración).'
    ]));
    aviso.appendChild(el('p', { clase: 'aviso-cruce__nota', texto: 'Revisa los detalles en cada fila. El cruce no impide guardar.' }));
  }

  function enviarFormulario(ev) {
    ev.preventDefault();
    var idArea = $('f-area').value;
    var r = L.validarLote(idArea, filas().map(leerFila), { areas: IDS_AREAS, maxDias: C.maxDiasDuracion });
    if (!r.ok) { mostrarErrores(r); return; }
    limpiarErrores();

    // Primer clic con cruces: advertir y cambiar el botón.
    if (estado.cruces && !estado.confirmarCruce) {
      estado.confirmarCruce = true;
      $('btn-guardar').textContent = 'Guardar de todos modos';
      $('aviso-cruce').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }

    var acts = r.actividades.map(function (x) { return x.actividad; });
    var b = $('btn-guardar');
    b.disabled = true;
    var editando = estado.editando;
    var promesa = editando ? datos.actualizar(editando.id, acts[0]) : datos.crear(acts);
    promesa.then(function () {
      guardarPreferencia('ultima-area', idArea);
      cerrar($('dlg-actividad'));
      notificar(editando ? 'Cambios guardados.' : acts.length === 1 ? 'Actividad guardada.' : 'Se guardaron ' + acts.length + ' actividades.');
      var primera = acts.map(function (a) { return a.inicio; }).sort()[0];
      var rv = rangoVisible();
      if (primera < rv.desde || primera > rv.hasta) irA(primera);
    }).catch(function (err) {
      $('e-general').textContent = 'No se pudo guardar. ' + err.message;
    }).then(function () { b.disabled = false; });
  }

  /* ---------- Eliminar ---------- */
  function abrirEliminar(a) {
    estado.detalle = a;
    $('eliminar-texto').textContent = '¿Seguro que quieres eliminar «' + a.titulo + '» (' +
      L.formatoRango(a.inicio, a.fin).toLowerCase() + ')? Esta acción no se puede deshacer.';
    $('e-eliminar').textContent = '';
    cerrar($('dlg-detalle'));
    abrir($('dlg-eliminar'));
  }

  function confirmarEliminar(ev) {
    ev.preventDefault();
    var a = estado.detalle;
    var b = $('btn-confirmar-eliminar');
    b.disabled = true;
    datos.eliminar([a.id]).then(function () {
      cerrar($('dlg-eliminar'));
      notificar('Actividad eliminada.');
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

    // Selectores de área y "Ir a".
    var selArea = $('f-area');
    selArea.appendChild(el('option', { value: '', texto: 'Elige un área' }));
    C.areas.forEach(function (a) { selArea.appendChild(el('option', { value: a.id, texto: a.nombre })); });

    L.MESES.forEach(function (m, i) { $('ir-mes').appendChild(el('option', { value: String(i + 1), texto: L.mayuscula(m) })); });
    var anioActual = L.leerFecha(estado.hoy).a;
    for (var a = anioActual - 3; a <= anioActual + 3; a++) $('ir-anio').appendChild(el('option', { value: String(a), texto: String(a) }));

    // Barra de navegación.
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
      // Cerrar al hacer clic en el fondo (no en el formulario, para no perder lo escrito).
      if (d.id === 'dlg-actividad') return;
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

    // Formulario por filas.
    $('form-actividad').addEventListener('submit', enviarFormulario);
    $('f-area').addEventListener('change', revisarCruces);
    $('btn-agregar-fila').addEventListener('click', function () {
      var ultima = filas()[filas().length - 1];
      var nueva = agregarFila({ inicio: ultima ? campo(ultima, 'inicio').value : '' });
      campo(nueva, 'inicio').focus();
    });
    var lista = $('filas');
    lista.addEventListener('change', function (ev) {
      var fila = ev.target.closest('.fila');
      if (!fila) return;
      var c = ev.target.dataset.campo;
      if (c === 'varios') {
        mostrarFin(fila, ev.target.checked);
        if (ev.target.checked) {
          var fin = campo(fila, 'fin');
          if (!fin.value) fin.value = campo(fila, 'inicio').value;
          fin.focus();
        }
      }
      if (c === 'inicio') {
        mostrarFin(fila, campo(fila, 'varios').checked);
        var f = campo(fila, 'fin');
        if (f.value && f.value < ev.target.value) f.value = ev.target.value;
      }
      revisarCruces();
    });
    lista.addEventListener('input', revisarCruces);
    lista.addEventListener('click', function (ev) {
      var q = ev.target.closest('[data-quitar]');
      if (q) quitarFila(q.closest('.fila'));
    });
    // Enter dentro de una fila pasa a la siguiente en lugar de guardar.
    lista.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || ev.target.tagName !== 'INPUT' || ev.target.type === 'checkbox') return;
      ev.preventDefault();
      siguienteFila(ev.target.closest('.fila'));
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

    // Atajos: ← → para cambiar de periodo.
    document.addEventListener('keydown', function (ev) {
      if (document.querySelector('dialog[open]')) return;
      var t = ev.target.tagName;
      if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || t === 'BUTTON' || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.key === 'ArrowLeft') mover(-1);
      else if (ev.key === 'ArrowRight') mover(1);
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
