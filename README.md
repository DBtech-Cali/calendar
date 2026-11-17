# Cronograma institucional · Centro de Capacitación Don Bosco

Aplicación web sencilla para que cada área del Centro de Capacitación Don Bosco (CCDB) cargue sus actividades en un solo lugar y todo el personal las vea en un calendario.

- **Calendario** (`index.html`): vista de mes y de semana, filtros por área y navegación libre hacia meses pasados y futuros.
- **Pantalla de la semana** (`widget.html`): para dejarla abierta en un computador o proyectarla.
- **Ver** no pide clave. **Agregar, editar y eliminar** piden una única contraseña compartida por los líderes de proceso.

Está hecha con HTML, CSS y JavaScript sin frameworks ni compilación. Se publica gratis en GitHub Pages y guarda los datos en Firebase (plan gratuito).

---

## 1. Probarla ya (modo demostración)

Mientras no se configure Firebase, la aplicación funciona en **modo demostración**:

1. Descarga el repositorio y abre `index.html` con doble clic. No se necesita servidor.
2. Verás un aviso azul con la leyenda «Modo demostración». Las actividades que aparecen son **ejemplos inventados**.
3. Para agregar o editar, usa la contraseña **`demo`**.
4. Los cambios se guardan solo en ese navegador. El botón «Restablecer ejemplos» vuelve a los datos iniciales.

---

## 2. Poner la aplicación en funcionamiento con Firebase

Se hace una sola vez. Toma unos 20 minutos.

### 2.1 Crear el proyecto

1. Entra a <https://console.firebase.google.com> con una cuenta de Google de la institución.
2. **Crear un proyecto** → nómbralo, por ejemplo, `cronograma-ccdb`. Google Analytics no es necesario.
3. En la página del proyecto, pulsa el ícono **Web** (`</>`) para **agregar una app web**. Ponle un nombre (por ejemplo, «Cronograma») y **no** marques Firebase Hosting.
4. Firebase muestra un bloque `firebaseConfig = { apiKey: …, authDomain: …, … }`. **Cópialo**: lo usarás en el paso 2.4.

### 2.2 Crear la cuenta única de edición

1. En el menú lateral: **Compilación → Authentication → Comenzar**.
2. En **Método de acceso**, habilita **Correo electrónico/contraseña** (solo la primera opción) y guarda.
3. En **Usuarios → Agregar usuario**:
   - **Correo:** usa un correo **real de la institución** (por ejemplo, el del área de sistemas). Nadie lo escribe al ingresar; solo queda en la configuración.
   - **Contraseña:** la clave que compartirás con los líderes de proceso. Mínimo 6 caracteres; mejor 12 o más, con letras y números.
4. En **Authentication → Configuración → Dominios autorizados**, agrega el dominio donde quedará publicada la aplicación (ver el paso 3), por ejemplo `dbtech-cali.github.io`.

### 2.3 Crear la base de datos y publicar las reglas

1. **Compilación → Firestore Database → Crear base de datos**.
2. Elige una ubicación cercana (por ejemplo, `southamerica-east1` o `nam5`). Luego no se puede cambiar.
3. Empieza en **modo de producción**.
4. Abre la pestaña **Reglas**, borra lo que haya y pega el contenido del archivo [`firestore.rules`](firestore.rules).
5. En las reglas, cambia `CORREO_DE_EDICION@ejemplo.org` por el **mismo correo** del paso 2.2.
6. Pulsa **Publicar**.

Las reglas permiten que cualquiera **lea** las actividades, pero solo la cuenta de edición puede **escribirlas**. Además revisan que cada actividad tenga los campos correctos: nombre de máximo 140 caracteres, fechas válidas, fecha final igual o posterior a la inicial y un área existente.

### 2.4 Pegar la configuración

Abre [`js/config.js`](js/config.js) y completa dos datos:

```js
firebase: {
  apiKey: '…',
  authDomain: 'cronograma-ccdb.firebaseapp.com',
  projectId: 'cronograma-ccdb',
  storageBucket: '…',
  messagingSenderId: '…',
  appId: '…'
},

correoEdicion: 'el-correo-del-paso-2.2@…',
```

Guarda el archivo y súbelo al repositorio. Desde ese momento desaparece el aviso de demostración y la aplicación usa los datos reales.

> La configuración de Firebase (`apiKey`, etc.) **no es secreta**: identifica el proyecto, pero no da permisos. La protección está en las reglas y en la contraseña.

---

## 3. Publicar en GitHub Pages

1. En GitHub, abre el repositorio → **Settings → Pages**.
2. En **Build and deployment**, elige **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`. Guarda.
3. En uno o dos minutos la aplicación queda en una dirección como `https://dbtech-cali.github.io/calendar/`.
4. Agrega ese dominio en Firebase (paso 2.2, punto 4).

> En una organización con plan gratuito, GitHub Pages solo publica repositorios **públicos**. El código no contiene contraseñas, así que puede ser público sin problema.

Enlaces útiles para compartir:

| Qué | Dirección |
| --- | --- |
| Calendario | `…/calendar/` |
| Pantalla de la semana | `…/calendar/widget.html` |
| Semana de lunes a viernes | `…/calendar/widget.html?dias=5` |
| Próximos 7 días | `…/calendar/widget.html?modo=proximos` |
| Solo algunas áreas | `…/calendar/widget.html?area=sst,pastoral` |
| Tema oscuro (proyector) | `…/calendar/widget.html?tema=oscuro` |

Los parámetros se pueden combinar: `widget.html?modo=proximos&dias=5&tema=oscuro`.

---

## 4. Instalar la pantalla de la semana en Windows (Edge)

1. Abre `…/calendar/widget.html` en **Microsoft Edge**, con los parámetros que quieras.
2. Menú **⋯ → Aplicaciones → Instalar este sitio como aplicación**.
3. Ponle un nombre (por ejemplo, «Semana CCDB») y acepta.
4. Queda como una ventana propia, con ícono en el menú Inicio y en la barra de tareas. Para que abra al encender el equipo, en `edge://apps` marca **Iniciar automáticamente al iniciar sesión** en la aplicación.

La pantalla se actualiza sola cuando alguien agrega o cambia una actividad, y pasa al día siguiente a la medianoche. No envía recordatorios ni notificaciones.

---

## 5. Tareas frecuentes

### Cambiar la contraseña

1. En Firebase: **Authentication → Usuarios**.
2. En la fila de la cuenta de edición: **⋮ → Borrar cuenta**.
3. **Agregar usuario** con el **mismo correo** y la nueva contraseña.
4. Avisa la nueva contraseña a los líderes de proceso. Quien tenga la sesión abierta deberá ingresar de nuevo cuando la sesión venza o al pulsar «Salir».

Las actividades no se pierden, porque no dependen del usuario.

### Cambiar el nombre o el color de un área

Todo está en [`js/config.js`](js/config.js), en la lista `areas`:

```js
{ id: 'sst', nombre: 'SST', color: '#ff7110' },
```

- **nombre**: se puede cambiar libremente.
- **color**: debe ser uno de la paleta del manual (están en [`css/tokens.css`](css/tokens.css)).
- **id**: **no** lo cambies si el área ya tiene actividades guardadas.
- **corto** (opcional): nombre abreviado para espacios pequeños, por ejemplo `corto: 'G. Humana'`.

### Agregar o quitar un área

1. Agrégala o quítala en `areas` de `js/config.js`.
2. Actualiza también la lista de la función `areasValidas()` en `firestore.rules` y vuelve a publicar las reglas en Firebase (paso 2.3).

### Cambiar el logo

Las rutas están en `logo` dentro de `js/config.js`. Usa solo archivos oficiales de `assets/logos/`.

---

## 6. Cómo funciona

### Actividades

| Campo | Obligatorio | Notas |
| --- | --- | --- |
| Área | Sí | Una de las 12 áreas. |
| Nombre | Sí | Máximo 140 caracteres. |
| Fecha de inicio | Sí | |
| Fecha final | No | Por defecto, la misma de inicio. Máximo 60 días de duración (se cambia en `maxDiasDuracion`). |
| Hora de inicio y final | No | La hora final necesita hora de inicio y debe ser posterior. |
| Responsable | No | Máximo 80 caracteres. |

- Una actividad de varios días aparece en cada día que abarca. Si no tiene hora, aparece como «Todo el día».
- **Repetición** (solo al crear): cada semana (días elegidos, cada 1 a 4 semanas) o cada mes (día fijo; si cae en fin de semana se puede omitir, pasar al lunes siguiente o al viernes anterior). Máximo un año hacia adelante. Antes de guardar se muestra cuántas actividades se crearán.
- Editar una actividad repetida cambia solo esa fecha. Al eliminar se puede elegir: solo esta, esta y las siguientes, o toda la serie.
- **Cruces de horario:** si la actividad coincide en fecha y hora con otra, aparece un aviso. **Nunca impide guardar**: el botón cambia a «Guardar de todos modos».

### Estructura de archivos

```
index.html            calendario (mes y semana) y formularios
widget.html           pantalla de la semana
widget.webmanifest    datos para instalarla como aplicación
css/tokens.css        colores y tipografías del manual (única fuente de marca)
css/app.css           estilos del calendario
css/print.css         estilos de impresión
css/widget.css        estilos de la pantalla de la semana
js/config.js          configuración: Firebase, correo, áreas, logo
js/logic.js           lógica pura: fechas, repeticiones, cruces, validación
js/db.js              datos: modo demostración y Firebase
js/app.js             interfaz del calendario
js/widget.js          interfaz de la pantalla de la semana
tests/logic.test.js   pruebas automáticas de la lógica
firestore.rules       reglas de seguridad de Firestore
assets/logos/         logos oficiales del CCDB
assets/iconos/        ícono de la aplicación (logo vertical a 192 y 512 px)
assets/fonts/         tipografías autoalojadas y sus licencias
docs/identidad/       manual de identidad gráfica
```

### Datos en Firestore

Colección `actividades`. Cada documento tiene: `titulo`, `area`, `inicio` y `fin` (texto `AAAA-MM-DD`), `horaInicio` y `horaFin` (texto `HH:MM` o vacío), `responsable`, `serie` (vacío o identificador de la repetición) y `actualizado` (hora del servidor).

Las fechas se guardan como texto para evitar corrimientos por zona horaria. Cada pantalla consulta solo el periodo visible: desde 60 días antes, para incluir actividades largas que empezaron antes. Así el consumo queda dentro del plan gratuito.

### Imprimir

En la vista de mes, usa **Imprimir** del navegador (Ctrl + P). Se ocultan los botones y se imprime el mes en horizontal, con todas las actividades.

---

## 7. Para quien mantenga el código

- **Pruebas:** necesitas Node 18 o superior. En la carpeta del proyecto, ejecuta:

  ```bash
  node --test
  ```

  Cubren fechas, la matriz del mes, repeticiones (incluido el rosario del día 24), cruces y validaciones.
- No hay dependencias ni paso de compilación. El SDK de Firebase (versión fijada en `versionFirebase` de `js/config.js`) se carga desde `gstatic.com` solo si hay configuración.
- Todos los textos están en español de Colombia.

---

## 8. Identidad gráfica

La interfaz sigue el **Manual de Identidad Salesianos COM** (GMM004 V:03.07.25, en `docs/identidad/`):

- **Colores:** solo los de las paletas principal, complementaria y de apoyo del manual, definidos en `css/tokens.css`. El rojo `#e10613` es el color principal de las acciones. Texto blanco solo sobre rojo, rojo oscuro o marrón; texto `#2d2d2d` sobre ámbar y tonos claros.
- **Tipografías:** **Cal Sans** Regular para títulos y **Urbanist** Medium para el texto, autoalojadas en `assets/fonts/`.
- **Logo:** archivos oficiales de `assets/logos/`, sin deformar, recolorear ni añadir efectos. Se usa la versión a color sobre fondos claros y la blanca sobre el fondo oscuro. Respeta el tamaño mínimo (95 px de ancho en horizontal) y el área de protección (19 px alrededor).

### Licencias de las tipografías

- **Cal Sans**: Copyright 2021 The Cal Sans Project Authors (<https://github.com/calcom/font>). Licencia SIL Open Font License 1.1, ver [`assets/fonts/OFL-CalSans.txt`](assets/fonts/OFL-CalSans.txt).
- **Urbanist**: Copyright 2021 The Urbanist Project Authors (<https://github.com/coreyhu/Urbanist>). Licencia SIL Open Font License 1.1, ver [`assets/fonts/OFL-Urbanist.txt`](assets/fonts/OFL-Urbanist.txt).

La licencia OFL permite usar, incrustar y redistribuir las fuentes, incluso con fines comerciales, siempre que se conserve el aviso de licencia y no se vendan las fuentes por sí solas. Los archivos `woff2` son el subconjunto latino (incluye tildes, ñ, ¿ y ¡) que publica Google Fonts.
