/*
 * Configuración del Cronograma institucional CCDB.
 *
 * Este es el único archivo que hay que tocar para:
 *   - conectar Firebase (pegar la configuración del proyecto),
 *   - indicar el correo de la cuenta de edición,
 *   - cambiar nombres o colores de las áreas,
 *   - cambiar el logo.
 *
 * Mientras `firebase` sea null, la aplicación funciona en MODO DEMOSTRACIÓN:
 * guarda datos de ejemplo en este navegador y la contraseña es "demo".
 */
window.CCDB_CONFIG = {
  /*
   * Configuración de Firebase. Se copia desde la consola de Firebase:
   * Configuración del proyecto → Tus apps → Configuración del SDK.
   * Ejemplo:
   * firebase: {
   *   apiKey: '…',
   *   authDomain: 'tu-proyecto.firebaseapp.com',
   *   projectId: 'tu-proyecto',
   *   storageBucket: 'tu-proyecto.appspot.com',
   *   messagingSenderId: '…',
   *   appId: '…'
   * },
   */
  firebase: null,

  /* Correo de la cuenta única de edición (no se muestra en la pantalla).
   * Debe coincidir con el correo escrito en firestore.rules. */
  correoEdicion: '',

  /* Versión fijada del SDK de Firebase (compat) que se carga desde gstatic. */
  versionFirebase: '10.14.1',

  /* Duración máxima de una actividad, en días. */
  maxDiasDuracion: 60,

  /* Horas que se pueden elegir en el formulario (la hora es opcional).
   * Jornada laboral, cada 30 minutos: 7:00 a. m., 7:30 a. m. … 5:00 p. m. */
  horario: { desde: '07:00', hasta: '17:00', cadaMinutos: 30 },

  /* Textos institucionales. */
  institucion: {
    nombreApp: 'Cronograma institucional',
    nombreCentro: 'Centro de Capacitación Don Bosco'
  },

  /* Rutas del logo oficial (assets/logos). No se redibuja ni se modifica. */
  logo: {
    color: 'assets/logos/LOGOS 2025 - FULLCOLOR - HORIZONTAL.png',
    blanco: 'assets/logos/LOGOS 2025 - BLANCO - HORIZONTAL.png',
    alt: 'Centro de Capacitación Don Bosco · Salesianos de Don Bosco – Cali'
  },

  /*
   * Áreas. El id no se debe cambiar después de tener datos guardados
   * (también está en firestore.rules). El color solo puede ser uno de la
   * paleta del manual (ver css/tokens.css). `corto` es opcional: nombre
   * abreviado para espacios pequeños (celdas del mes, widget).
   */
  areas: [
    { id: 'inspectorial', nombre: 'Inspectorial', color: '#91422b' },
    { id: 'administracion', nombre: 'Administración', color: '#848484' },
    { id: 'sst', nombre: 'SST', color: '#ff7110' },
    { id: 'gestion-humana', nombre: 'Gestión Humana', corto: 'G. Humana', color: '#63c67f' },
    { id: 'pastoral', nombre: 'Pastoral', color: '#e10613' },
    { id: 'etdh', nombre: 'ETDH', color: '#a1c7ff' },
    { id: 'bienestar', nombre: 'Bienestar', color: '#efa4ff' },
    { id: 'proteccion', nombre: 'Casa de Protección', corto: 'Protección', color: '#FFBBC6' },
    { id: 'externado', nombre: 'Externado Media Jornada', corto: 'Externado', color: '#ffa415' },
    { id: 'calidad', nombre: 'Calidad', color: '#2d2d2d' },
    { id: 'oratorio', nombre: 'Oratorio', color: '#53f271' },
    { id: 'musica', nombre: 'Música', color: '#ae0f0a' }
  ]
};
