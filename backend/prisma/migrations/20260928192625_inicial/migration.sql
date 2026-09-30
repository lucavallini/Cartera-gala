-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashPassword" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'USUARIO',
    "monedaBase" TEXT NOT NULL DEFAULT 'USD_MEP',
    "dolarReferencia" TEXT NOT NULL DEFAULT 'MEP',
    "metodoCosto" TEXT NOT NULL DEFAULT 'PRECIO_PROMEDIO',
    "preferencias" JSONB,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    "eliminadoEn" DATETIME
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEn" DATETIME NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "revocadaEn" DATETIME,
    "reemplazadaPorId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sesion_reemplazadaPorId_fkey" FOREIGN KEY ("reemplazadaPorId") REFERENCES "Sesion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cartera" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    "eliminadoEn" DATETIME,
    CONSTRAINT "Cartera_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "numeroComitente" TEXT,
    "alias" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    "eliminadoEn" DATETIME,
    CONSTRAINT "Cuenta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Instrumento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "nombre" TEXT,
    "tipo" TEXT NOT NULL,
    "mercado" TEXT NOT NULL,
    "emisor" TEXT,
    "sector" TEXT,
    "industria" TEXT,
    "pais" TEXT,
    "isin" TEXT,
    "tickerSubyacente" TEXT,
    "ratioCedear" TEXT,
    "simbolos" JSONB NOT NULL,
    "factorPrecio" DECIMAL NOT NULL DEFAULT 1,
    "valorNominal" DECIMAL,
    "fechaEmision" DATETIME,
    "fechaVencimiento" DATETIME,
    "tasaCupon" DECIMAL,
    "frecuenciaCupon" INTEGER,
    "ley" TEXT,
    "tipoAjuste" TEXT NOT NULL DEFAULT 'NINGUNO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "atributos" JSONB,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FlujoProgramado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrumentoId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "renta" DECIMAL NOT NULL DEFAULT 0,
    "amortizacion" DECIMAL NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL,
    "cargadoPorUsuarioId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "FlujoProgramado_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "Instrumento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FlujoProgramado_cargadoPorUsuarioId_fkey" FOREIGN KEY ("cargadoPorUsuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Operacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carteraId" TEXT NOT NULL,
    "cuentaId" TEXT,
    "instrumentoId" TEXT,
    "tipo" TEXT NOT NULL,
    "fechaConcertacion" DATETIME NOT NULL,
    "fechaLiquidacion" DATETIME,
    "cantidad" DECIMAL,
    "precio" DECIMAL,
    "moneda" TEXT NOT NULL,
    "tipoCambio" DECIMAL,
    "comision" DECIMAL NOT NULL DEFAULT 0,
    "derechosMercado" DECIMAL NOT NULL DEFAULT 0,
    "iva" DECIMAL NOT NULL DEFAULT 0,
    "otrosGastos" DECIMAL NOT NULL DEFAULT 0,
    "montoNeto" DECIMAL,
    "ratio" DECIMAL,
    "operacionRelacionadaId" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'MANUAL',
    "importacionId" TEXT,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    "eliminadoEn" DATETIME,
    CONSTRAINT "Operacion_carteraId_fkey" FOREIGN KEY ("carteraId") REFERENCES "Cartera" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Operacion_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Operacion_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "Instrumento" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Operacion_importacionId_fkey" FOREIGN KEY ("importacionId") REFERENCES "Importacion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Operacion_operacionRelacionadaId_fkey" FOREIGN KEY ("operacionRelacionadaId") REFERENCES "Operacion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrumentoId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "moneda" TEXT NOT NULL,
    "apertura" DECIMAL,
    "maximo" DECIMAL,
    "minimo" DECIMAL,
    "cierre" DECIMAL NOT NULL,
    "volumen" DECIMAL,
    "fuente" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Cotizacion_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "Instrumento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TipoCambio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fecha" DATETIME NOT NULL,
    "tipo" TEXT NOT NULL,
    "compra" DECIMAL,
    "venta" DECIMAL NOT NULL,
    "fuente" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IndiceEconomico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "valor" DECIMAL NOT NULL,
    "fuente" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SnapshotCartera" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carteraId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "valorArs" DECIMAL NOT NULL,
    "valorUsd" DECIMAL NOT NULL,
    "invertidoArs" DECIMAL NOT NULL,
    "invertidoUsd" DECIMAL NOT NULL,
    "efectivoArs" DECIMAL NOT NULL,
    "efectivoUsd" DECIMAL NOT NULL,
    "resultadoRealizadoUsd" DECIMAL NOT NULL,
    "resultadoNoRealizadoUsd" DECIMAL NOT NULL,
    "flujoNetoDelDiaUsd" DECIMAL NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "SnapshotCartera_carteraId_fkey" FOREIGN KEY ("carteraId") REFERENCES "Cartera" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstrumentoUsuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "enSeguimiento" BOOLEAN NOT NULL DEFAULT false,
    "precioObjetivo" DECIMAL,
    "notas" TEXT,
    "sectorPersonalizado" TEXT,
    "precioManual" DECIMAL,
    "precioManualMoneda" TEXT,
    "precioManualEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "InstrumentoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InstrumentoUsuario_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "Instrumento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Etiqueta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    "eliminadoEn" DATETIME,
    CONSTRAINT "Etiqueta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstrumentoEtiqueta" (
    "usuarioId" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,

    PRIMARY KEY ("usuarioId", "instrumentoId", "etiquetaId"),
    CONSTRAINT "InstrumentoEtiqueta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InstrumentoEtiqueta_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "Instrumento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InstrumentoEtiqueta_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "Etiqueta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObjetivoAsignacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carteraId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "porcentajeObjetivo" DECIMAL NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "ObjetivoAsignacion_carteraId_fkey" FOREIGN KEY ("carteraId") REFERENCES "Cartera" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "instrumentoId" TEXT,
    "tipo" TEXT NOT NULL,
    "umbral" DECIMAL,
    "canal" TEXT NOT NULL DEFAULT 'APP',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "ultimaDisparadaEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    "eliminadoEn" DATETIME,
    CONSTRAINT "Alerta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Alerta_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "Instrumento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "alertaId" TEXT,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "leidaEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Notificacion_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "Alerta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Noticia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "publicadaEn" DATETIME NOT NULL,
    "resumenIa" TEXT,
    "impacto" TEXT,
    "explicacionImpacto" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NoticiaInstrumento" (
    "noticiaId" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,

    PRIMARY KEY ("noticiaId", "instrumentoId"),
    CONSTRAINT "NoticiaInstrumento_noticiaId_fkey" FOREIGN KEY ("noticiaId") REFERENCES "Noticia" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NoticiaInstrumento_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "Instrumento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InformeNoticias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "carteraId" TEXT NOT NULL,
    "generadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumenGeneral" TEXT,
    "noticiaIds" JSONB NOT NULL,
    "iaDisponible" BOOLEAN NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "InformeNoticias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InformeNoticias_carteraId_fkey" FOREIGN KEY ("carteraId") REFERENCES "Cartera" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Importacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "carteraId" TEXT NOT NULL,
    "cuentaId" TEXT,
    "formato" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'VISTA_PREVIA',
    "filasLeidas" INTEGER NOT NULL DEFAULT 0,
    "filasImportadas" INTEGER NOT NULL DEFAULT 0,
    "filas" JSONB,
    "errores" JSONB,
    "confirmadaEn" DATETIME,
    "revertidaEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Importacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Importacion_carteraId_fkey" FOREIGN KEY ("carteraId") REFERENCES "Cartera" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Importacion_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "antes" JSONB,
    "despues" JSONB,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistroAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_tokenHash_key" ON "Sesion"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_reemplazadaPorId_key" ON "Sesion"("reemplazadaPorId");

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");

-- CreateIndex
CREATE INDEX "Cartera_usuarioId_idx" ON "Cartera"("usuarioId");

-- CreateIndex
CREATE INDEX "Cuenta_usuarioId_idx" ON "Cuenta"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Instrumento_ticker_mercado_key" ON "Instrumento"("ticker", "mercado");

-- CreateIndex
CREATE UNIQUE INDEX "FlujoProgramado_instrumentoId_fecha_key" ON "FlujoProgramado"("instrumentoId", "fecha");

-- CreateIndex
CREATE INDEX "Operacion_carteraId_fechaConcertacion_idx" ON "Operacion"("carteraId", "fechaConcertacion");

-- CreateIndex
CREATE INDEX "Operacion_instrumentoId_idx" ON "Operacion"("instrumentoId");

-- CreateIndex
CREATE INDEX "Operacion_importacionId_idx" ON "Operacion"("importacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_instrumentoId_fecha_moneda_key" ON "Cotizacion"("instrumentoId", "fecha", "moneda");

-- CreateIndex
CREATE UNIQUE INDEX "TipoCambio_fecha_tipo_key" ON "TipoCambio"("fecha", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "IndiceEconomico_tipo_fecha_key" ON "IndiceEconomico"("tipo", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotCartera_carteraId_fecha_key" ON "SnapshotCartera"("carteraId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentoUsuario_usuarioId_instrumentoId_key" ON "InstrumentoUsuario"("usuarioId", "instrumentoId");

-- CreateIndex
CREATE INDEX "Etiqueta_usuarioId_idx" ON "Etiqueta"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ObjetivoAsignacion_carteraId_dimension_clave_key" ON "ObjetivoAsignacion"("carteraId", "dimension", "clave");

-- CreateIndex
CREATE INDEX "Alerta_usuarioId_idx" ON "Alerta"("usuarioId");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_leidaEn_idx" ON "Notificacion"("usuarioId", "leidaEn");

-- CreateIndex
CREATE UNIQUE INDEX "Noticia_url_key" ON "Noticia"("url");

-- CreateIndex
CREATE INDEX "InformeNoticias_usuarioId_carteraId_idx" ON "InformeNoticias"("usuarioId", "carteraId");

-- CreateIndex
CREATE INDEX "Importacion_usuarioId_idx" ON "Importacion"("usuarioId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_entidad_entidadId_idx" ON "RegistroAuditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_usuarioId_idx" ON "RegistroAuditoria"("usuarioId");
