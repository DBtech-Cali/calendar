/*
 * Capa de datos del Cronograma institucional CCDB.
 *
 * Dos modos con la misma interfaz:
 *   - Demostración: sin configuración de Firebase. Guarda en localStorage de
 *     este navegador, con datos de ejemplo y contraseña "demo".
 *   - Firebase: Firestore (colección "actividades") + Authentication con una
 *     única cuenta de edición. El SDK se carga desde gstatic solo si hay
 *     configuración.
 *
 * Interfaz:
 *   iniciar({ conSesion }) → Promise
 *   suscribir(desde, hasta, alRecibir, alFallar) → función para cancelar
 *   haySesion(), alCambiarSesion(fn), ingresar(clave), salir()
 *   crear(actividades), actualizar(id, datos), eliminar(ids)
 *   consultar(desde, hasta), actividadesDeSerie(serie)
 */
(function (raiz) {
  'use strict';

  var L = raiz.CCDBLogic;
  var COLECCION = 'actividades';
  var CLAVE_DATOS = 'ccdb-cronograma-demo-v1';
  var CLAVE_SESION = 'ccdb-cronograma-demo-sesion';
  var CLAVE_DEMO = 'demo';
  var MARGEN_DIAS = 60; // para traer actividades largas que empezaron antes del rango

  /* Acceso seguro a localStorage (puede estar bloqueado). */
  var memoria = {};
  var almacen = {
    leer: function (k) {
      try { return raiz.localStorage.getItem(k); } catch (e) { return memoria[k] || null; }
    },
    escribir: function (k, v) {
      try { raiz.localStorage.setItem(k, v); } catch (e) { memoria[k] = v; }
    },
    borrar: function (k) {
      try { raiz.localStorage.removeItem(k); } catch (e) { delete memoria[k]; }
    }
  };

  function limpiar(act) {
    var a = L.normalizar(act);
    return {
      titulo: a.titulo, area: a.area, inicio: a.inicio, fin: a.fin,
      horaInicio: a.horaInicio, horaFin: a.horaFin, responsable: a.responsable, serie: a.serie
    };
  }

  /* ================================================================== */
  /* Modo demostración                                                   */
  /* ================================================================== */

  /** Actividades inventadas alrededor del mes actual. */
  function datosDeEjemplo() {
    var hoy = L.hoy();
    var f = L.leerFecha(hoy);
    var lunes = L.inicioSemana(hoy);
    var d = function (n) { return L.sumarDias(lunes, n); };
    var lista = [
      { titulo: 'Reunión de líderes de proceso', area: 'administracion', inicio: d(0), horaInicio: '08:00', horaFin: '09:30', responsable: 'Coordinación administrativa' },
      { titulo: 'Eucaristía de inicio de semana', area: 'pastoral', inicio: d(0), horaInicio: '07:00', horaFin: '07:45' },
      { titulo: 'Visita inspectorial', area: 'inspectorial', inicio: d(1), fin: d(4), responsable: 'Equipo inspectorial' },
      { titulo: 'Capacitación en primeros auxilios', area: 'sst', inicio: d(2), horaInicio: '14:00', horaFin: '16:00', responsable: 'Brigada de emergencias' },
      { titulo: 'Comité de convivencia', area: 'gestion-humana', inicio: d(2), horaInicio: '15:00', horaFin: '16:00' },
      { titulo: 'Ensayo de la banda', area: 'musica', inicio: d(3), horaInicio: '16:00', horaFin: '18:00' },
      { titulo: 'Jornada recreativa', area: 'oratorio', inicio: d(5), horaInicio: '09:00', horaFin: '12:00' },
      { titulo: 'Auditoría interna de procesos', area: 'calidad', inicio: d(8), fin: d(9) },
      { titulo: 'Encuentro de familias', area: 'proteccion', inicio: d(10), horaInicio: '10:00' },
      { titulo: 'Inscripciones de nuevos estudiantes', area: 'etdh', inicio: d(7), fin: d(11), responsable: 'Secretaría académica' },
      { titulo: 'Salida pedagógica', area: 'externado', inicio: d(11), horaInicio: '07:30', horaFin: '13:00' },
      { titulo: 'Tarde de integración', area: 'bienestar', inicio: d(-3), horaInicio: '14:00', horaFin: '17:00' },
      { titulo: 'Entrega de informes de gestión', area: 'administracion', inicio: d(-5) },
      { titulo: 'Simulacro de evacuación', area: 'sst', inicio: d(16), horaInicio: '10:00', horaFin: '10:30' }
    ];

    // Una serie mensual: rosario el día 24, omitiendo fines de semana.
    var desde = L.aTexto(f.a, f.m, 1);
    var hasta = L.sumarDias(L.aTexto(L.sumarMeses(f.a, f.m, 3).a, L.sumarMeses(f.a, f.m, 3).m, 1), -1);
    var rosario = L.generarRepeticion(desde, { tipo: 'mensual', dia: 24, finDeSemana: 'omitir', hasta: hasta });
    lista = lista.concat(L.expandirSerie(
      { titulo: 'Rosario comunitario', area: 'pastoral', inicio: desde, horaInicio: '12:00', horaFin: '12:30' },
      rosario.fechas, 'ejemplo-rosario'));

    // Una serie semanal: pausa activa martes y jueves durante 6 semanas.
    var pausa = L.generarRepeticion(d(-7), { tipo: 'semanal', dias: [1, 3], cada: 1, hasta: d(34) });
    lista = lista.concat(L.expandirSerie(
      { titulo: 'Pausa activa', area: 'sst', inicio: d(-7), horaInicio: '10:00', horaFin: '10:15' },
      pausa.fechas, 'ejemplo-pausa'));

    return lista.map(function (a) {
      var x = limpiar(a);
      x.id = L.nuevoId();
      x.actualizado = Date.now();
      return x;
    });
  }

  function crearDemo() {
    var oyentes = [];
    var oyentesSesion = [];

    function leerTodo() {
      var crudo = almacen.leer(CLAVE_DATOS);
      if (crudo) {
        try { var o = JSON.parse(crudo); if (Array.isArray(o.actividades)) return o.actividades; } catch (e) { /* datos dañados: se regeneran */ }
      }
      var ejemplo = datosDeEjemplo();
      guardarTodo(ejemplo, true);
      return ejemplo;
    }

    function guardarTodo(lista, silencioso) {
      almacen.escribir(CLAVE_DATOS, JSON.stringify({ version: 1, actividades: lista }));
      if (!silencioso) avisar();
    }

    function avisar() {
      var todo = leerTodo();
      oyentes.forEach(function (o) { o.entregar(todo); });
    }

    // Cambios hechos en otra pestaña (por ejemplo, el widget abierto aparte).
    try {
      raiz.addEventListener('storage', function (ev) {
        if (ev.key === CLAVE_DATOS) avisar();
        if (ev.key === CLAVE_SESION) oyentesSesion.forEach(function (fn) { fn(haySesion()); });
      });
    } catch (e) { /* sin eventos de almacenamiento */ }

    function haySesion() { return almacen.leer(CLAVE_SESION) === '1'; }

    function exigirSesion() {
      if (!haySesion()) return Promise.reject(new Error('Necesitas ingresar con la contraseña para hacer cambios.'));
      return Promise.resolve();
    }

    return {
      modo: 'demo',
      iniciar: function () { leerTodo(); return Promise.resolve(); },

      suscribir: function (desde, hasta, alRecibir) {
        var oyente = {
          entregar: function (todo) {
            alRecibir(todo.filter(function (a) { return L.tocaRango(a, desde, hasta); }));
          }
        };
        oyentes.push(oyente);
        setTimeout(function () { oyente.entregar(leerTodo()); }, 0);
        return function () { oyentes = oyentes.filter(function (o) { return o !== oyente; }); };
      },

      haySesion: haySesion,
      alCambiarSesion: function (fn) { oyentesSesion.push(fn); },

      ingresar: function (clave) {
        if (clave !== CLAVE_DEMO) return Promise.reject(new Error('La contraseña no es correcta. En el modo demostración es "demo".'));
        almacen.escribir(CLAVE_SESION, '1');
        oyentesSesion.forEach(function (fn) { fn(true); });
        return Promise.resolve();
      },

      salir: function () {
        almacen.borrar(CLAVE_SESION);
        oyentesSesion.forEach(function (fn) { fn(false); });
        return Promise.resolve();
      },

      crear: function (actividades) {
        return exigirSesion().then(function () {
          var todo = leerTodo();
          actividades.forEach(function (a) {
            var x = limpiar(a); x.id = L.nuevoId(); x.actualizado = Date.now(); todo.push(x);
          });
          guardarTodo(todo);
        });
      },

      actualizar: function (id, datos) {
        return exigirSesion().then(function () {
          var todo = leerTodo();
          var i = todo.findIndex(function (a) { return a.id === id; });
          if (i === -1) throw new Error('La actividad ya no existe. Puede que alguien la haya eliminado.');
          var x = limpiar(datos); x.id = id; x.actualizado = Date.now(); todo[i] = x;
          guardarTodo(todo);
        });
      },

      eliminar: function (ids) {
        return exigirSesion().then(function () {
          guardarTodo(leerTodo().filter(function (a) { return ids.indexOf(a.id) === -1; }));
        });
      },

      consultar: function (desde, hasta) {
        return Promise.resolve(leerTodo().filter(function (a) { return L.tocaRango(a, desde, hasta); }));
      },

      actividadesDeSerie: function (serie) {
        return Promise.resolve(leerTodo().filter(function (a) { return a.serie === serie; }));
      },

      /* Solo demostración: volver a los datos de ejemplo. */
      reiniciar: function () { almacen.borrar(CLAVE_DATOS); avisar(); }
    };
  }

  /* ================================================================== */
  /* Modo Firebase                                                       */
  /* ================================================================== */

  function cargarScript(src) {
    return new Promise(function (ok, falla) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { ok(); };
      s.onerror = function () { falla(new Error('No se pudo cargar ' + src + '. Revisa la conexión a internet.')); };
      document.head.appendChild(s);
    });
  }

  function mensajeDeError(err) {
    var c = err && err.code ? err.code : '';
    if (c === 'auth/wrong-password' || c === 'auth/invalid-credential' || c === 'auth/invalid-login-credentials' || c === 'auth/user-not-found') {
      return 'La contraseña no es correcta.';
    }
    if (c === 'auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
    if (c === 'auth/network-request-failed' || c === 'unavailable') return 'No hay conexión con el servidor. Revisa internet e intenta de nuevo.';
    if (c === 'permission-denied') return 'No tienes permiso para hacer este cambio. Vuelve a ingresar con la contraseña.';
    return (err && err.message) || 'Ocurrió un error inesperado.';
  }

  function crearFirebase(config) {
    var fb, db, auth;
    var oyentesSesion = [];
    var usuario = null;

    function envolver(p) {
      return p.catch(function (err) { throw new Error(mensajeDeError(err)); });
    }

    function conMarca(act) {
      var x = limpiar(act);
      x.actualizado = fb.firestore.FieldValue.serverTimestamp();
      return x;
    }

    return {
      modo: 'firebase',

      iniciar: function (opciones) {
        var conSesion = !opciones || opciones.conSesion !== false;
        var base = 'https://www.gstatic.com/firebasejs/' + config.versionFirebase + '/';
        var p = cargarScript(base + 'firebase-app-compat.js');
        if (conSesion) p = p.then(function () { return cargarScript(base + 'firebase-auth-compat.js'); });
        return p.then(function () { return cargarScript(base + 'firebase-firestore-compat.js'); })
          .then(function () {
            fb = raiz.firebase;
            fb.initializeApp(config.firebase);
            db = fb.firestore();
            if (conSesion) {
              auth = fb.auth();
              return new Promise(function (ok) {
                var primera = true;
                auth.onAuthStateChanged(function (u) {
                  usuario = u;
                  oyentesSesion.forEach(function (fn) { fn(!!u); });
                  if (primera) { primera = false; ok(); }
                });
              });
            }
          });
      },

      suscribir: function (desde, hasta, alRecibir, alFallar) {
        return db.collection(COLECCION)
          .where('inicio', '>=', L.sumarDias(desde, -MARGEN_DIAS))
          .where('inicio', '<=', hasta)
          .onSnapshot(function (snap) {
            var lista = [];
            snap.forEach(function (doc) {
              var a = doc.data();
              a.id = doc.id;
              if ((a.fin || a.inicio) >= desde) lista.push(a);
            });
            alRecibir(lista);
          }, function (err) { if (alFallar) alFallar(new Error(mensajeDeError(err))); });
      },

      haySesion: function () { return !!usuario; },
      alCambiarSesion: function (fn) { oyentesSesion.push(fn); },

      ingresar: function (clave) {
        if (!config.correoEdicion) return Promise.reject(new Error('Falta el correo de la cuenta de edición en js/config.js.'));
        return envolver(auth.signInWithEmailAndPassword(config.correoEdicion, clave));
      },

      salir: function () { return envolver(auth.signOut()); },

      crear: function (actividades) {
        var lotes = [];
        for (var i = 0; i < actividades.length; i += 450) lotes.push(actividades.slice(i, i + 450));
        return envolver(lotes.reduce(function (p, lote) {
          return p.then(function () {
            var b = db.batch();
            lote.forEach(function (a) { b.set(db.collection(COLECCION).doc(), conMarca(a)); });
            return b.commit();
          });
        }, Promise.resolve()));
      },

      actualizar: function (id, datos) {
        return envolver(db.collection(COLECCION).doc(id).set(conMarca(datos)));
      },

      eliminar: function (ids) {
        var b = db.batch();
        ids.forEach(function (id) { b.delete(db.collection(COLECCION).doc(id)); });
        return envolver(b.commit());
      },

      consultar: function (desde, hasta) {
        return envolver(db.collection(COLECCION)
          .where('inicio', '>=', L.sumarDias(desde, -MARGEN_DIAS))
          .where('inicio', '<=', hasta)
          .get().then(function (snap) {
            var r = [];
            snap.forEach(function (doc) { var a = doc.data(); a.id = doc.id; if ((a.fin || a.inicio) >= desde) r.push(a); });
            return r;
          }));
      },

      actividadesDeSerie: function (serie) {
        return envolver(db.collection(COLECCION).where('serie', '==', serie).get().then(function (snap) {
          var r = [];
          snap.forEach(function (doc) { var a = doc.data(); a.id = doc.id; r.push(a); });
          return r;
        }));
      }
    };
  }

  raiz.CCDBData = {
    crear: function (config) {
      return config && config.firebase ? crearFirebase(config) : crearDemo();
    }
  };
})(window);
