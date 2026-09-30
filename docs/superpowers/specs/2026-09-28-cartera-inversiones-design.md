# Cartera de inversiones — Diseño

**Fecha:** 2026-09-28
**Stack:** Angular 22 · Node.js + Express 5 · TypeScript · Prisma 7.10 (SQLite → Postgres)
**Estado:** diseño aprobado por partes en conversación; pendiente revisión de este documento.

---

## 1. Contexto y objetivo

Un inversor argentino quiere una app donde cargar sus activos (acciones, CEDEARs,
obligaciones negociables, bonos, letras) y ver, al actualizar:

- el precio actual de cada activo;
- cuánto ganó o perdió por activo, en plata y en porcentaje;
- el rendimiento total de la cartera;
- la ponderación de cada activo en una torta;
- las noticias del día que afectan a los activos de su cartera.

Existen dos borradores HTML previos (`cartera (5).html`, hecho con Claude, y
`gemini-code-…html`, corregido con Gemini). Sus problemas, que este diseño resuelve:

| Problema del borrador | Causa | Solución en este diseño |
|---|---|---|
| La IA dejaba de funcionar fuera de Claude | Llamaba a `api.anthropic.com` desde el navegador sin API key y usaba `window.storage`, que solo existe dentro de los artifacts de Claude | Backend Express: las claves viven en el servidor; los datos, en una base |
| Precios lentos, caros y poco confiables | Se le pedían los precios a una IA con búsqueda web, en lotes de 6 | Precios de una fuente de mercado real (data912, BYMA). La IA solo resume noticias |
| Valores de bonos y ONs inflados ×100 (borrador 2) | No aplicaba la convención de renta fija (cotización cada 100 de valor nominal) | El factor de precio es un atributo del instrumento y lo aplica el motor de cálculo |
| Datos atados a un navegador | `localStorage` | Base de datos en el backend |

### Decisiones tomadas con el usuario

- **Usuarios:** uno al principio, varios después. La app nace multiusuario: email y
  contraseña obligatorios y login real desde la etapa 1, para no arrastrar deuda.
- **Calidad de código:** código limpio, modular, con abstracción, encapsulamiento,
  reutilización, herencia y polimorfismo donde el problema los justifica (ver 3.1).
- **Carga de activos:** manual, importación de archivos Excel/CSV exportados por el
  bróker (Bull Market y otros) y exportación de la cartera calculada a Excel/CSV.
- **Precios:** botón *Actualizar* + refresco automático mientras el mercado está abierto.
- **Noticias:** fuentes gratuitas (RSS) + resumen con una IA de plan gratuito.
- **Ejecución:** local ahora, online después.
- **Modelo de datos:** completo desde el inicio, para que las etapas futuras no requieran
  rediseñar tablas.
- **Enfoque:** TypeScript de punta a punta, Prisma con SQLite ahora y Postgres al pasar a
  online.

### Principio rector

**El backend hace todo el trabajo; el frontend solo pide y muestra.** Cálculos,
filtros, ordenamientos, paginación, cruces entre entidades, conversiones de moneda,
textos de resumen y del glosario se resuelven en el backend. Angular solo da formato
de presentación (separadores de miles, símbolo de moneda).

---

## 2. Usuarios y qué necesitan

La app sirve a dos perfiles con una sola interfaz:

**Inversor que sabe poco.** Quiere saber si gana o pierde, cuánto tiene en pesos y en
dólares, qué pasó hoy y cuándo cobra. Se confunde con la cotización cada 100
nominales, con MEP/CCL/oficial y con realizado/no realizado. Necesita lenguaje llano,
explicaciones y protección contra errores de carga.

**Inversor que sabe.** Quiere rendimiento real en dólares, comparación con la inflación
y el mercado, calendario de cobros, TIR, comisiones pagadas, resultado realizado del
año y rebalanceo. Necesita no cargar dos veces lo que ya está en el bróker y datos
confiables y actualizados.

Consecuencia de diseño: por defecto se muestra lo esencial y explicado; el detalle
avanzado está a un interruptor de distancia (vista Simple / Completa). Nada se bloquea.

### Reglas de claridad (aplican a todas las pantallas)

1. **Frase de resumen** arriba del inicio, armada por el backend. Ejemplo:
   *"Tu cartera vale US$ 48.320 (≈ $ 74,9 M). Desde que empezaste ganaste US$ 3.140
   (+6,9%). Hoy bajó 0,4%."*
2. **Cada número lleva su explicación** en castellano debajo del título
   (ej.: *Resultado no realizado — lo que ganarías si vendieras todo hoy*).
3. **Glosario integrado:** cada término técnico tiene un ícono (?) con una explicación
   corta y un ejemplo calculado con los datos del propio usuario. Los textos los sirve
   el backend (`GET /glosario`, y el ejemplo personalizado en `GET /glosario/:termino?instrumentoId=`).
4. **Unidades siempre visibles:** "US$ MEP", "$ (pesos)", "precio cada 100 nominales",
   "al dólar MEP de hoy: $ 1.550,60". Nunca un número sin unidad.
5. **Efecto antes de guardar:** todo formulario que crea, edita o borra muestra lo que va
   a pasar, calculado por el backend (endpoints de simulación). Ejemplo:
   *"Tu tenencia de AMZN pasa de 72 a 172 y tu precio promedio de $ 2.500 a $ 2.666."*
6. **Carga asistida:** buscador de ticker que sugiere el instrumento y completa tipo y
   moneda. Validaciones con mensajes que dicen qué está mal y cómo corregirlo.
7. **Color nunca solo:** verde/rojo siempre con ▲/▼ y signo +/−.
8. **Acciones parecidas separadas y explicadas:** cada una en su propio bloque, con un
   texto que dice exactamente qué produce (ej.: "Agregar activo que ya tengo" vs
   "Registrar una compra").
9. **Estados explícitos** en cada pantalla: cargando, vacío (con qué hacer), error (con
   mensaje y *Reintentar*), datos desactualizados (con la hora de los datos).

---

## 3. Arquitectura general

```
┌──────────────────────┐   HTTP/JSON   ┌───────────────────────────────────────────┐
│ Angular 22           │ ────────────▶ │ Express 5                                 │
│ (pide y muestra)     │ ◀──────────── │  rutas → controladores → servicios        │
└──────────────────────┘               │                 │            │            │
                                       │           repositorios   proveedores     │
                                       │            (Prisma)      (APIs externas)  │
                                       │                 │            │            │
                                       │   motor/ (funciones puras de cálculo)     │
                                       │   tareas/ (node-cron)                     │
                                       └─────────┬────────────────┬────────────────┘
                                                 │                │
                                          SQLite / Postgres   data912 · dolarapi ·
                                                              Google News RSS · Gemini/Groq
```

### Estructura del repositorio (npm workspaces)

```
Cartera-gala/
├── package.json                 workspaces + scripts globales (dev, test, lint, db:*)
├── backend/.env.example         todas las variables, documentadas (el .env vive en backend/)
├── contratos/                   tipos TypeScript compartidos (DTOs de request/response)
│   └── src/
├── backend/
│   ├── prisma/                  schema.prisma · migrations/ · seed.ts
│   └── src/
│       ├── app.ts · server.ts
│       ├── config/              variables de entorno validadas con zod al arrancar
│       ├── compartido/          errores, middlewares, utilidades Decimal, logger
│       ├── motor/               funciones puras de cálculo
│       ├── proveedores/         un subdirectorio por tipo, cada uno con su interfaz
│       ├── tareas/              trabajos programados
│       └── modulos/             un directorio por área de negocio
└── frontend/
    └── src/app/
        ├── nucleo/              servicios HTTP, interceptores, layout, barra superior
        ├── compartido/          componentes y pipes reutilizables
        └── pantallas/           una carpeta por pantalla, con rutas lazy
```

**Por qué `contratos/`:** backend y frontend importan los mismos tipos; un cambio en una
respuesta del backend rompe la compilación del frontend en lugar de romper en ejecución.

### 3.1 Principios de código y patrones

**Criterio general:** herencia donde hay comportamiento común real que compartir;
polimorfismo (interfaces + implementaciones intercambiables) donde hay variantes de un
mismo concepto; composición en todo lo demás. Ningún `switch` sobre un tipo de negocio
repartido por el código: cada variante es una clase que sabe comportarse.

**Herencia (comportamiento común compartido):**

| Clase base | Qué centraliza | Subclases |
|---|---|---|
| `RepositorioBase<T>` | Paginación, orden, borrado lógico (`eliminadoEn`), búsqueda por id con error `NoEncontrado` | Repositorios de entidades con borrado lógico (las tablas técnicas de solo agregar, como `Sesion` y `RegistroAuditoria`, usan repositorios simples) |
| `RepositorioDelUsuario<T>` (extiende la anterior) | Filtra **siempre** por el usuario dueño; imposible omitirlo | Carteras, cuentas, operaciones, importaciones, etiquetas, alertas… |
| `ServicioAuditado` | Crear/editar/borrar con registro automático en `RegistroAuditoria` dentro de la misma transacción | Servicios de entidades editables por el usuario |
| `ProveedorHttpBase` | Timeout, reintento, caché con TTL, degradación al último dato, logging | `Data912Proveedor`, `DolarApiProveedor`, `GoogleNewsRssProveedor` |
| `ProveedorIABase` | Armado del pedido de resumen, límite diario, validación de la respuesta con zod | `GeminiProveedor`, `GroqProveedor` |
| `ParserBrokerBase` | Método plantilla: leer archivo → mapear filas → validar → informar errores por fila | `PlantillaPropiaParser`, `BullMarketParser` |
| `TareaProgramada` | Nombre, expresión cron, bloqueo contra ejecuciones superpuestas, logging | `CierreDiarioTarea`, `CompletarHistorialTarea` |
| `ErrorApp` | Código, mensaje para el usuario, status HTTP | `ErrorValidacion`, `ErrorNoEncontrado`, `ErrorNoAutorizado`, `ErrorProhibido`, `ErrorConflicto`, `ErrorProveedorExterno` |

**Polimorfismo (variantes de un mismo concepto):**

| Interfaz | Implementaciones | Qué evita |
|---|---|---|
| `ManejadorOperacion` | Una clase por `TipoOperacion` (`CompraManejador`, `VentaManejador`, `DividendoManejador`, …), registradas en un `RegistroManejadores` | Un `switch` gigante: cada tipo sabe cómo afecta la tenencia y el efectivo, cómo se valida y cómo se describe en lenguaje llano |
| `EstrategiaCosto` | `PrecioPromedio`, `Fifo` | Condicionales por preferencia del usuario |
| `Valuador` | `ValuadorRentaVariable` (acciones, CEDEARs; factor 1), `ValuadorRentaFija` (bonos, ONs, letras; factor 1/100, cobros de renta y amortización), `ValuadorPlazoFijo` (tasa × días), elegidos por una fábrica según `TipoInstrumento` | Condicionales por tipo de instrumento dispersos |
| `Exportador` | `ExcelCompletoExportador`, `CsvTenenciasExportador`, `CsvOperacionesExportador` | Lógica de formato mezclada |
| `Proveedor*` | Ver 5.3 | Acoplarse a un servicio externo |

**Encapsulamiento y modularidad:**
- Cada módulo expone solo un `index.ts` con su API pública (rutas y servicio); sus
  repositorios y esquemas son internos. Una regla de ESLint (`eslint-plugin-boundaries`)
  impide saltarse capas: un controlador no puede importar un repositorio, el motor no
  puede importar Prisma ni proveedores.
- Las clases del motor no hacen I/O: reciben datos y devuelven resultados. Por eso se
  testean sin base ni red.

**Inyección de dependencias:** cada clase recibe sus dependencias por constructor. Un
único punto de composición (`backend/src/contenedor.ts`) crea las instancias y las
conecta. Sin framework de DI: explícito y fácil de seguir. En los tests se reemplaza
cualquier dependencia (por ejemplo, un proveedor) por un doble.

**Frontend:** en Angular se prefiere composición a herencia de componentes (así lo
recomienda el framework). La reutilización va por componentes compartidos, servicios y
una utilidad `recurso<T>()` basada en signals que encapsula los estados cargando /
vacío / error / desactualizado, usada por todas las pantallas.

**Código limpio:**
- TypeScript en modo `strict`, sin `any`. ESLint + Prettier en los tres paquetes, con
  verificación en `npm run lint`.
- Nombres de dominio en castellano, consistentes entre base, backend, contratos y
  frontend (`Operacion`, `Cartera`, `tenencia`); los sufijos técnicos siguen un patrón
  fijo (`.servicio.ts`, `.repositorio.ts`, `Manejador`, `Proveedor`).
- Funciones cortas con una sola responsabilidad; sin lógica duplicada; toda escritura
  que toca varias filas va en una transacción.
- Sin números mágicos: factores, TTLs, horarios de mercado y límites en constantes o en
  configuración.

---

## 4. Modelo de datos

Todas las tablas se crean en la etapa 1, aunque algunas se usen recién en etapas
posteriores. Los importes, cantidades, precios y tasas son `Decimal` (nunca `Float`).
Todas las tablas tienen `creadoEn` y `actualizadoEn`, salvo `RegistroAuditoria`, que es de
solo agregar y usa `fecha`. Las que el usuario puede borrar
tienen `eliminadoEn` (borrado lógico). Los identificadores son `cuid`.

### 4.1 Enums

| Enum | Valores |
|---|---|
| `Rol` | `ADMIN`, `USUARIO` |
| `Moneda` | `ARS`, `USD_MEP`, `USD_CCL`, `USD_EXTERIOR` |
| `TipoDolar` | `OFICIAL`, `MEP`, `CCL`, `BLUE`, `MAYORISTA`, `CRIPTO` |
| `MetodoCosto` | `PRECIO_PROMEDIO`, `FIFO` |
| `TipoInstrumento` | `ACCION`, `CEDEAR`, `ON`, `BONO`, `LETRA`, `FCI`, `ETF_EXTERIOR`, `CAUCION`, `PLAZO_FIJO`, `CRIPTO`, `OPCION`, `FUTURO`, `INDICE`, `OTRO` |
| `Mercado` | `BYMA`, `MAE`, `NYSE`, `NASDAQ`, `CRIPTO`, `FONDO`, `BANCO`, `OTRO` |
| `TipoAjuste` | `NINGUNO`, `CER`, `DOLAR_LINKED`, `TASA_FIJA`, `BADLAR`, `TAMAR`, `UVA`, `OTRO` |
| `Ley` | `ARGENTINA`, `NUEVA_YORK`, `OTRA` |
| `TipoOperacion` | `TENENCIA_INICIAL`, `COMPRA`, `VENTA`, `DIVIDENDO`, `RENTA`, `AMORTIZACION`, `SUSCRIPCION_FCI`, `RESCATE_FCI`, `DEPOSITO`, `EXTRACCION`, `COMPRA_MONEDA`, `VENTA_MONEDA`, `CAUCION_COLOCACION`, `CAUCION_VENCIMIENTO`, `COMISION`, `IMPUESTO`, `SPLIT`, `CANJE`, `TRANSFERENCIA_ENTRADA`, `TRANSFERENCIA_SALIDA`, `AJUSTE` |
| `OrigenOperacion` | `MANUAL`, `IMPORTACION`, `SISTEMA` |
| `DimensionAsignacion` | `TIPO`, `INSTRUMENTO`, `SECTOR`, `MONEDA`, `PAIS`, `ETIQUETA` |
| `TipoAlerta` | `PRECIO_MAYOR_A`, `PRECIO_MENOR_A`, `VARIACION_DIARIA`, `VENCIMIENTO`, `COBRO_PROXIMO`, `NOTICIA` |
| `CanalNotificacion` | `APP`, `EMAIL`, `TELEGRAM` |
| `Impacto` | `POSITIVO`, `NEGATIVO`, `NEUTRAL` |
| `EstadoImportacion` | `VISTA_PREVIA`, `CONFIRMADA`, `ERROR`, `REVERTIDA` |
| `TipoIndice` | `IPC`, `CER`, `UVA`, `BADLAR`, `TAMAR` |

### 4.2 Usuarios y acceso

**`Usuario`** — `id`, `nombre`, `email` (obligatorio, único, guardado en minúsculas),
`hashPassword` (obligatorio, argon2id), `rol`, `monedaBase` (`Moneda`, default `USD_MEP`),
`dolarReferencia` (`TipoDolar`, default `MEP`), `metodoCosto` (default
`PRECIO_PROMEDIO`), `preferencias` (JSON: vista simple/completa, columnas visibles,
guía de bienvenida vista, etc.), `eliminadoEn`.

**`Sesion`** — `id`, `usuarioId`, `tokenHash`, `expiraEn`, `userAgent`, `ip`,
`revocadaEn`, `reemplazadaPorId` (rotación de refresh tokens: permite detectar la
reutilización de un token robado y revocar toda la cadena).

### 4.3 Estructura de la cartera

**`Cartera`** — `id`, `usuarioId`, `nombre`, `descripcion`, `esPrincipal`,
`archivada`, `orden`, `eliminadoEn`. Nombre único por usuario entre las carteras no
eliminadas (lo valida el servicio; un índice único en la base impediría reutilizar el
nombre de una cartera borrada).

**`Cuenta`** — dónde está custodiado el activo. `id`, `usuarioId`, `broker` (texto:
"Bull Market", "IOL"…), `numeroComitente`, `alias`, `eliminadoEn`.

### 4.4 Catálogo de instrumentos (compartido entre usuarios)

**`Instrumento`** — `id`, `ticker`, `nombre`, `tipo`, `mercado`, `emisor`, `sector`,
`industria`, `pais`, `isin`, `tickerSubyacente` (CEDEAR), `ratioCedear` (texto, ej.
"144:1"), `simbolos` (JSON por moneda: `{ "ARS": "AMZN", "USD_MEP": "AMZND",
"USD_CCL": "AMZNC" }`), `factorPrecio` (Decimal: `0.01` para renta fija, `1` para el
resto), `valorNominal`, `fechaEmision`, `fechaVencimiento`, `tasaCupon`,
`frecuenciaCupon` (pagos por año), `ley`, `tipoAjuste`, `activo` (bool), `atributos`
(JSON para datos futuros sin migración). Único: `(ticker, mercado)`.

El catálogo se completa solo a partir de las listas de data912: la lista en la que
aparece un símbolo determina su `tipo` y su `factorPrecio`, y los sufijos `D`/`C`
determinan `simbolos`. `nombre`, `emisor` y `sector` arrancan vacíos y el usuario puede
completarlos desde la ficha del activo.

**`FlujoProgramado`** — cronograma de pagos de un bono u ON. `id`, `instrumentoId`,
`fecha`, `renta` (por cada 100 VN), `amortizacion` (por cada 100 VN), `moneda`,
`cargadoPorUsuarioId`. Único: `(instrumentoId, fecha)`.

### 4.5 Movimientos

**`Operacion`** — `id`, `carteraId`, `cuentaId` (opcional), `instrumentoId` (opcional:
vacío en movimientos solo de dinero), `tipo`, `fechaConcertacion`,
`fechaLiquidacion`, `cantidad`, `precio`, `moneda`, `tipoCambio` (dólar de referencia
de esa fecha, para medir el resultado en USD aunque la operación sea en pesos),
`comision`, `derechosMercado`, `iva`, `otrosGastos`, `montoNeto`, `ratio` (para
`SPLIT`/`CANJE`), `operacionRelacionadaId` (canjes, compra/venta de moneda,
transferencias), `origen`, `importacionId` (opcional), `notas`, `eliminadoEn`.

La **tenencia**, el **precio promedio** y el **efectivo disponible** no se guardan: se
calculan siempre a partir de las operaciones, así nunca pueden quedar descuadrados.

### 4.6 Datos de mercado e historia

**`Cotizacion`** — cierre diario. `id`, `instrumentoId`, `fecha`, `moneda`,
`apertura`, `maximo`, `minimo`, `cierre`, `volumen`, `fuente`.
Único: `(instrumentoId, fecha, moneda)`.

**`TipoCambio`** — `id`, `fecha`, `tipo` (`TipoDolar`), `compra`, `venta`, `fuente`.
Único: `(fecha, tipo)`.

**`IndiceEconomico`** — `id`, `tipo` (`TipoIndice`), `fecha`, `valor`, `fuente`.
Único: `(tipo, fecha)`.

**`SnapshotCartera`** — foto diaria. `id`, `carteraId`, `fecha`, `valorArs`,
`valorUsd`, `invertidoArs`, `invertidoUsd`, `efectivoArs`, `efectivoUsd`,
`resultadoRealizadoUsd`, `resultadoNoRealizadoUsd`, `flujoNetoDelDiaUsd` (depósitos
menos extracciones, necesario para el rendimiento ajustado). Único: `(carteraId, fecha)`.

### 4.7 Herramientas del inversor

**`InstrumentoUsuario`** — lo personal de un usuario sobre un activo. `id`,
`usuarioId`, `instrumentoId`, `enSeguimiento` (watchlist), `precioObjetivo`, `notas`,
`sectorPersonalizado`, `precioManual`, `precioManualMoneda`, `precioManualEn` (precio
cargado a mano cuando no hay cotización). Único: `(usuarioId, instrumentoId)`.

**`Etiqueta`** — `id`, `usuarioId`, `nombre`, `color`, `eliminadoEn`. Nombre único por
usuario entre las no eliminadas (lo valida el servicio).

**`InstrumentoEtiqueta`** — `usuarioId`, `instrumentoId`, `etiquetaId`. Clave compuesta.

**`ObjetivoAsignacion`** — `id`, `carteraId`, `dimension`, `clave` (ej. `"ON"`,
`"Energía"`), `porcentajeObjetivo`. Único: `(carteraId, dimension, clave)`.

**`Alerta`** — `id`, `usuarioId`, `instrumentoId` (opcional), `tipo`, `umbral`,
`canal`, `activa`, `ultimaDisparadaEn`.

**`Notificacion`** — `id`, `usuarioId`, `alertaId` (opcional), `titulo`, `cuerpo`,
`leidaEn`.

### 4.8 Noticias, importación y auditoría

**`Noticia`** — `id`, `url` (única), `titulo`, `fuente`, `publicadaEn`,
`resumenIa` (opcional), `impacto` (opcional), `explicacionImpacto` (opcional).
Compartida entre usuarios: cada nota se resume una sola vez.

**`NoticiaInstrumento`** — `noticiaId`, `instrumentoId`. Clave compuesta.

**`InformeNoticias`** — `id`, `usuarioId`, `carteraId`, `generadoEn`,
`resumenGeneral`, `noticiaIds` (JSON con el orden de las noticias), `iaDisponible` (bool).

**`Importacion`** — `id`, `usuarioId`, `carteraId`, `cuentaId` (opcional), `formato`
(`PLANTILLA`, `BULL_MARKET`, …), `nombreArchivo`, `estado`, `filasLeidas`,
`filasImportadas`, `filas` (JSON con las filas ya interpretadas, que esperan la
confirmación), `errores` (JSON: fila, campo, mensaje), `confirmadaEn`, `revertidaEn`.

**`RegistroAuditoria`** — `id`, `usuarioId`, `entidad`, `entidadId`, `accion`
(enum `AccionAuditoria`: `CREAR`/`EDITAR`/`BORRAR`/`RESTAURAR`), `antes` (JSON), `despues` (JSON), `fecha`.

---

## 5. Backend

### 5.1 Capas y responsabilidades

| Capa | Hace | No hace |
|---|---|---|
| `rutas` | Declara endpoints y middlewares | Lógica |
| `controlador` | Valida entrada con el esquema zod del módulo, llama al servicio, responde | Acceso a datos, cálculos |
| `servicio` | Lógica de negocio; orquesta repositorios, motor y proveedores; escribe auditoría | SQL, HTTP externo directo |
| `repositorio` | Único punto de acceso a Prisma del módulo | Reglas de negocio |
| `motor/` | Cálculos financieros puros (sin I/O) | Acceder a base o red |
| `proveedores/` | Único punto de acceso a APIs externas, detrás de una interfaz | Reglas de negocio |

Cada módulo en `modulos/<nombre>/` tiene los mismos archivos:
`<nombre>.rutas.ts`, `.controlador.ts`, `.servicio.ts`, `.repositorio.ts`, `.esquemas.ts`.

Módulos: `carteras`, `cuentas`, `instrumentos`, `operaciones`, `flujos`, `resumen`,
`cotizaciones`, `tipos-cambio`, `noticias`, `importacion`, `exportacion`, `glosario`,
`configuracion`.

Módulo adicional: `autenticacion` (ver 5.9). Un middleware verifica el token de acceso
e inyecta el usuario en `req.usuario`; todas las rutas salvo las de `/auth` lo exigen.
Los repositorios filtran siempre por el usuario dueño (ver 3.1, `RepositorioDelUsuario`),
así ningún usuario puede ver ni tocar datos de otro aunque un controlador se olvide de
chequearlo.

### 5.2 Motor de cálculo (`motor/`)

Clases y funciones sin I/O (ver 3.1) que reciben operaciones, precios y tipos de cambio, y devuelven
resultados. Todo en `Decimal`.

- `operaciones/`: los `ManejadorOperacion` (uno por tipo) y su `RegistroManejadores`.
- `valuadores/`: los `Valuador` por familia de instrumento y su fábrica.
- `tenencia.ts`: usando los manejadores, reconstruye la tenencia por instrumento, cuenta y moneda aplicando las
  operaciones en orden (compras, ventas, splits, canjes, transferencias).
- `costo.ts`: estrategia de costo intercambiable (`PRECIO_PROMEDIO` o `FIFO`), elegida
  por la preferencia del usuario. Devuelve costo de la tenencia y resultado realizado.
- `valuacion.ts`: `valor = cantidad × precio × factorPrecio`, con conversión a la moneda
  pedida usando el dólar de referencia.
- `cobros.ts`: dividendos, rentas y amortizaciones cobrados, y próximos cobros según los
  `FlujoProgramado` y la tenencia.
- `efectivo.ts`: saldo de efectivo por moneda a partir de todas las operaciones.
- `rendimiento.ts`: rendimiento simple, en ARS y USD; TWR (ajustado por depósitos y
  extracciones) y XIRR. Rendimiento real contra el IPC (etapa 2).
- `ponderacion.ts`: pesos por instrumento, tipo, sector, moneda, país o etiqueta.
- `simulacion.ts`: aplica una operación hipotética y devuelve el antes y el después
  (alimenta la regla "efecto antes de guardar").

### 5.3 Proveedores externos

| Interfaz | Implementación etapa 1 | Detalle |
|---|---|---|
| `ProveedorCotizaciones` | `Data912Proveedor` | `GET https://data912.com/live/{arg_stocks,arg_cedears,arg_bonds,arg_corp,arg_notes}` para precios en vivo; `GET /historical/{stocks,cedears,bonds}/{ticker}` para histórico diario |
| `ProveedorDolar` | `DolarApiProveedor` | `GET https://dolarapi.com/v1/dolares` (oficial, blue, bolsa = MEP, CCL, mayorista, cripto) |
| `ProveedorNoticias` | `GoogleNewsRssProveedor` | `https://news.google.com/rss/search?q=…&hl=es-419&gl=AR&ceid=AR:es-419`, más RSS de medios financieros configurables |
| `ProveedorIA` | `GeminiProveedor`, `GroqProveedor` | Se elige por `.env`. Solo recibe titulares y tickers, nunca montos ni tenencias |

Verificado el 2026-09-28: los 30 activos de la cartera del borrador 1 figuran en data912
en pesos y con sufijo `D` (dólar MEP), y el endpoint histórico devuelve series diarias.

**Caché:** las cinco listas de data912 y los tipos de cambio se guardan en memoria con
un TTL configurable (60 s por defecto). Cualquier cantidad de activos cuesta 5 + 1
pedidos por minuto como máximo. Si la fuente falla, se sirve el último dato con su
marca de hora y un indicador `desactualizado: true`.

**Elección de cotización:** se usa `Instrumento.simbolos[moneda]` de la operación. Si
no hay cotización, se usa `InstrumentoUsuario.precioManual`, mostrando la fecha en que
se cargó; si tampoco hay, se marca `sinCotizacion: true`
y la posición se valúa a costo, con la advertencia visible.

**IA:** cliente con timeout, reintento único y límite de pedidos por día configurable,
para no agotar el plan gratuito. Si la IA no responde, el informe se genera sin
resúmenes y con `iaDisponible: false`.

### 5.4 Tareas programadas (`tareas/`, con node-cron, zona horaria America/Argentina/Buenos_Aires)

- **Cierre diario** (días hábiles, 17:30): guarda `Cotizacion` de los instrumentos en
  cartera, `TipoCambio` del día y `SnapshotCartera` de cada cartera.
- **Completar historial** (al arrancar el backend): detecta días faltantes desde la
  primera operación y los completa con el histórico de data912, para que la app no
  necesite estar prendida todos los días.

### 5.5 Endpoints de la etapa 1

Prefijo `/api`. Todas las listas aceptan filtros, orden y paginación
(`?pagina=&porPagina=&orden=&direccion=`) resueltos en el backend.

| Método y ruta | Devuelve / hace |
|---|---|
| `POST /auth/registro` | Crea usuario (si `REGISTRO_HABILITADO`), con su cartera "Principal" |
| `POST /auth/login` | Devuelve token de acceso; deja el refresh token en cookie httpOnly |
| `POST /auth/refrescar` | Rota el refresh token y devuelve un token de acceso nuevo |
| `POST /auth/logout` | Revoca la sesión actual |
| `GET /auth/yo` | Datos del usuario logueado |
| `PATCH /auth/password` | Cambio de contraseña (pide la actual; revoca las demás sesiones) |
| `GET /resumen?carteraId=&moneda=` | Frase de resumen, tarjetas, tenencias calculadas, ponderaciones, `mercadoAbierto`, `proximaActualizacionEn`, `datosDe` |
| `GET /resumen/evolucion?carteraId=&rango=` | Serie de valor de la cartera desde los snapshots |
| `GET /activos/:instrumentoId?carteraId=` | Ficha del activo: tenencia, resultado, cobros, operaciones, histórico de precio con marcas de compra y venta |
| `GET/POST/PATCH/DELETE /carteras` | ABM de carteras |
| `GET/POST/PATCH/DELETE /cuentas` | ABM de cuentas |
| `GET /instrumentos/buscar?q=` | Sugerencias para el buscador de ticker (tipo y monedas disponibles incluidos) |
| `PATCH /instrumentos/:id` | Completar nombre, emisor, sector |
| `PUT /instrumentos/:id/precio-manual` | Precio manual cuando no hay cotización |
| `GET/POST/PATCH/DELETE /operaciones` | ABM de operaciones; el cuerpo es una unión discriminada por `tipo` |
| `POST /operaciones/simular` | Efecto de crear, editar o borrar una operación (antes/después) |
| `GET/PUT/DELETE /instrumentos/:id/flujos` | Cronograma de pagos del instrumento |
| `GET /calendario?carteraId=&desde=&hasta=` | Próximos cobros y vencimientos, con montos según la tenencia |
| `POST /cotizaciones/actualizar` | Fuerza el refresco ignorando la caché |
| `GET /noticias?carteraId=&instrumentoId=` | Último informe guardado |
| `POST /noticias/actualizar?carteraId=` | Busca, vincula, resume y guarda un informe nuevo |
| `POST /importaciones` | Sube archivo → crea importación en `VISTA_PREVIA` con filas y errores |
| `POST /importaciones/:id/confirmar` | Crea las operaciones |
| `POST /importaciones/:id/revertir` | Borra (lógicamente) las operaciones de esa importación |
| `GET /importaciones` | Historial |
| `GET /importaciones/plantilla` | Descarga la plantilla Excel |
| `GET /exportaciones/{completo.xlsx,tenencias.csv,operaciones.csv}?carteraId=` | Archivos generados |
| `GET /glosario` · `GET /glosario/:termino?instrumentoId=` | Textos del glosario, con ejemplo personalizado |
| `GET/PATCH /configuracion` | Preferencias del usuario |
| `POST /configuracion/probar-ia` | Prueba la conexión con la IA configurada |

**Uniones discriminadas:** los esquemas de `Operacion` (zod en el backend, tipos en
`contratos/`) son una unión discriminada por `tipo`: cada variante declara sus campos
obligatorios (ej. `COMPRA` exige cantidad y precio; `DEPOSITO` solo monto y moneda).

### 5.6 Importación y exportación

- Lectura y escritura con `exceljs` (xlsx) y parser CSV.
- Un `ParserBroker` por formato detrás de una interfaz común:
  `detectar(archivo) → boolean`, `leer(archivo) → FilaImportada[]`.
  Etapa 1: `PlantillaPropiaParser`. Etapa 2: `BullMarketParser`, construido a partir de
  un archivo real exportado por el bróker (requisito: conseguir ese archivo).
- La plantilla propia tiene una hoja de instrucciones con un ejemplo por tipo de operación.
- La importación nunca escribe directo: primero `VISTA_PREVIA`, después `CONFIRMADA`.

### 5.7 Errores

- Clase `ErrorApp` con `codigo` (constante en mayúsculas), `mensaje` (castellano, legible
  por el usuario final) y `status` HTTP.
- Un único middleware responde siempre `{ "error": { "codigo", "mensaje", "detalles"? } }`.
  Los errores de validación zod se traducen a mensajes por campo.
- Fallas de proveedores externos no son errores de la API: se degradan a datos
  anteriores con indicador de desactualización.
- Las operaciones que tocan varias filas (confirmar o revertir una importación, canjes,
  compra/venta de moneda) van en una transacción de Prisma.

### 5.8 Configuración (`.env`)

`DATABASE_URL`, `PORT`, `CORS_ORIGEN`, `IA_PROVEEDOR` (`gemini`|`groq`|`ninguno`),
`GEMINI_API_KEY`, `GROQ_API_KEY`, `IA_LIMITE_DIARIO`, `CACHE_COTIZACIONES_SEGUNDOS`,
`NOTICIAS_RSS_EXTRA` (lista de URLs), `ZONA_HORARIA`, `JWT_SECRETO`,
`JWT_ACCESO_MINUTOS`, `REFRESH_DIAS`, `REGISTRO_HABILITADO`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD` (solo los usa el seed), `TRUST_PROXY` (true solo detrás de un proxy, para
que el límite de intentos vea la IP real). Los valores de ejemplo del `.env.example` empiezan
con `cambiar-` y se rechazan al arrancar. Se validan con zod al arrancar; si falta algo
obligatorio, el backend no arranca y dice qué falta.

### 5.9 Autenticación y seguridad

- **Contraseñas:** argon2id. Mínimo 10 caracteres. Nunca se loguean ni se devuelven.
- **Tokens:** token de acceso JWT de vida corta (15 min por defecto), que el frontend
  guarda solo en memoria. Refresh token opaco en cookie `httpOnly`, `Secure` (en
  producción) y `SameSite=Strict`, guardado hasheado en `Sesion` y **rotado** en cada uso.
  Si llega un refresh token ya usado, se revoca toda la cadena de esa sesión.
- **Protección:** `helmet`, CORS restringido a `CORS_ORIGEN`, límite de intentos en
  `/auth/login` y `/auth/registro` (`express-rate-limit`), mensajes de login genéricos
  ("email o contraseña incorrectos") para no revelar qué emails existen.
- **Autorización:** por propiedad del dato (cada usuario solo ve lo suyo, garantizado en
  la capa de repositorios) y por rol (`ADMIN` para gestión de usuarios y catálogo).
- **Primer usuario:** el seed crea el administrador con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
- **Recuperación de contraseña por email:** etapa 3 (requiere envío de correos). Hasta
  entonces, un administrador puede restablecerla.

---

## 6. Frontend

### 6.1 Base técnica

Angular 22 con standalone components, signals y rutas lazy. Angular Material para
formularios, tablas y diálogos, con tema oscuro propio inspirado en el borrador 1
(estética "pizarra", números en IBM Plex Mono, títulos en Space Grotesk). Gráficos con
Chart.js vía `ng2-charts`. Diseño responsive, usable desde el celular.

- `nucleo/`: un servicio HTTP por módulo del backend (tipado con `contratos/`),
  `SesionServicio` (token de acceso en memoria, usuario actual como signal),
  interceptor de autenticación (adjunta el token y, ante un 401, refresca una sola vez y
  reintenta; los refrescos se serializan para que haya uno solo en vuelo, y si `/auth/refrescar`
  responde `REFRESH_YA_ROTADO` —otra pestaña ya renovó— reintenta el refresco una vez en lugar
  de mandar al login), interceptor de errores (convierte `{ error }` en un estado mostrable),
  guard de rutas, layout.
- `compartido/`: `TarjetaDato` (título + valor + explicación + ayuda), `AyudaTermino`
  (el ícono (?) que consulta el glosario), `EstadoCarga` (cargando / vacío / error /
  desactualizado), `ValorConSigno` (▲▼ + color + signo), pipes de formato es-AR.
- `pantallas/`: una carpeta por pantalla.

Angular no calcula, no filtra ni ordena listas en memoria: todo cambio de filtro u orden
es un nuevo pedido al backend.

**Refresco automático:** la pantalla de resumen vuelve a pedir `GET /resumen` cuando
llega `proximaActualizacionEn`; si el backend responde `mercadoAbierto: false`, deja de
pedir hasta que el usuario toque *Actualizar precios*.

### 6.2 Barra superior (siempre visible)

Selector de cartera (una o "Todas"), selector de moneda de visualización (ARS / USD),
interruptor vista Simple / Completa, estado del mercado (abierto/cerrado) con la hora de
los datos, botón *Actualizar precios*.

### 6.3 Pantallas de la etapa 1

0. **Ingresar / Crear cuenta**: formularios de login y registro con validaciones
   explicadas (ej.: "La contraseña necesita al menos 10 caracteres"). Menú de usuario en
   la barra superior con *Cambiar contraseña* y *Salir*.
1. **Bienvenida** (primera vez, se puede saltear): 1) crear cartera, 2) cargar activos
   (a mano o importando), 3) ver el resumen.
2. **Resumen**: frase de resumen; tarjetas (valor actual, invertido, resultado no
   realizado, resultado realizado, rendimiento total, variación del día); tabla de
   tenencias (vista Simple: activo, valor, resultado $ y %, peso; vista Completa suma
   cantidad, precio promedio, precio actual, variación diaria, realizado, comisiones);
   tortas por activo y por tipo; gráfico de evolución (1M/3M/1A/Todo). Activos sin
   cotización resaltados en ámbar con acceso a cargar precio manual.
3. **Ficha del activo**: histórico de precio con compras y ventas marcadas, resultado
   del activo, cobros recibidos, cronograma de pagos (ver y cargar), operaciones del
   activo, noticias del activo, datos editables (nombre, emisor, sector, notas).
4. **Operaciones**: listado filtrable; dos accesos separados y explicados —
   *"Agregar activo que ya tengo"* (tenencia inicial con precio promedio) y
   *"Registrar un movimiento"* (formulario cuyos campos cambian según el tipo, con una
   línea que explica cada tipo); vista previa del efecto antes de guardar y de borrar.
5. **Calendario de cobros**: próximos cupones, amortizaciones y vencimientos con monto
   estimado según la tenencia; aviso para los activos de renta fija sin cronograma
   cargado, con acceso directo a cargarlo.
6. **Importar y exportar**: importación en tres pasos (subir → vista previa con errores
   por fila → confirmar), descarga de plantilla, historial con *Deshacer*; exportación
   en tarjetas separadas, cada una diciendo qué contiene.
7. **Noticias**: *Actualizar noticias*, resumen general, tarjetas (titular, fuente,
   fecha, activos afectados, impacto, explicación, link a la nota), filtro por activo;
   aviso si la IA no estuvo disponible.
8. **Carteras y cuentas**: crear, renombrar, archivar.
9. **Configuración**: moneda base, dólar de referencia, método de costo, estado de la IA
   con botón *Probar*.

---

## 7. Etapas

| Etapa | Alcance |
|---|---|
| **1** | Todo el modelo de datos creado. Registro, login, sesiones con refresh token rotado, cambio de contraseña, aislamiento de datos por usuario. Carteras y cuentas. Operaciones: tenencia inicial, compra, venta, dividendo, renta, amortización, depósito, extracción, comisión. Precios automáticos (data912) + manual. Tipos de cambio (dolarapi). Resumen con frase, tarjetas, tabla, tortas por activo y tipo, evolución. Ficha de activo. Cronograma de pagos manual y calendario de cobros. Noticias RSS + IA gratuita. Importación con plantilla propia, exportación Excel/CSV. Glosario, vista Simple/Completa, bienvenida. Tareas de cierre diario y completar historial. |
| **2** | Importador Bull Market (con archivo real). Resto de tipos de operación (split, canje, transferencias, compra/venta de moneda, caución, FCI). Watchlist y notas. Etiquetas. Alertas y notificaciones en la app. TIR por instrumento. Índices económicos y rendimiento real contra inflación. Comparación contra Merval, S&P 500 y dólar. Objetivos de asignación y sugerencias de rebalanceo. Reporte anual de resultado realizado. |
| **3** | Recuperación de contraseña por email y administración de usuarios. Migración a Postgres y deploy online. Precios de FCI (CAFCI) y cripto. Otros brókers. Avisos por email y Telegram. Fuente automática de cronogramas de pago. |

---

## 8. Testing

Vitest en los tres paquetes.

- **`motor/`** (cobertura prioritaria): casos armados a mano para precio promedio y
  FIFO, ventas parciales y totales, factor 1/100, mezcla de monedas con tipo de cambio
  histórico, cobros de renta y amortización, efectivo, TWR y XIRR, simulación.
- **`proveedores/`**: contra respuestas reales guardadas como fixtures (sin red en los
  tests), incluyendo fallas y respuestas vacías.
- **Módulos**: tests de API con `supertest` sobre una base SQLite temporal, incluyendo
  validaciones, errores y transacciones (confirmar/revertir importación).
- **Autenticación y aislamiento**: login correcto e incorrecto, rotación y reutilización
  de refresh tokens, límite de intentos, y que un usuario no pueda leer ni modificar
  carteras, operaciones o importaciones de otro (un test por módulo).
- **Frontend**: componentes compartidos y los cuatro estados de cada pantalla.

---

## 9. Cómo se levanta (local)

Requisitos: Node 22 o superior.

```bash
npm install
cp backend/.env.example backend/.env   # completar GEMINI_API_KEY o GROQ_API_KEY (opcional)
npm run db:migrate          # crea la base SQLite y aplica migraciones
npm run db:seed             # administrador (ADMIN_EMAIL/ADMIN_PASSWORD) + cartera "Principal"
npm run dev                 # backend (:3000) y frontend (:4200) juntos
```

---

## 10. Riesgos y dependencias

| Riesgo | Mitigación |
|---|---|
| data912 es un servicio gratuito de terceros, sin garantía | Proveedor detrás de interfaz; caché con último dato conocido; precio manual como respaldo |
| El plan gratuito de la IA cambia sus límites sin aviso | Proveedor intercambiable (Gemini/Groq), límite diario propio, noticias sin resumen como degradación |
| El feed de Google News es para uso personal y no comercial | Válido para la etapa local de un solo usuario; revisar antes de abrir la app a más usuarios en la etapa 3 |
| Cada bróker exporta un formato distinto | Parser por bróker detrás de interfaz; plantilla propia siempre disponible; se requiere un archivo real por bróker |
| Cronogramas de pago no disponibles en data912 | Carga manual en la etapa 1; fuente automática en la etapa 3 |
| Nombres de instrumentos no vienen en data912 | Editables por el usuario desde la ficha del activo |
