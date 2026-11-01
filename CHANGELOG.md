# Registro de cambios

Todos los cambios relevantes de LUKA se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[Versionado Semántico](https://semver.org/lang/es/).

> Las versiones anteriores a la 3.0.0 se numeraron después de ocurrir, al ordenar el historial
> (ver [docs/HISTORIAL.md](docs/HISTORIAL.md)). Las fechas son las del desarrollo real.

## [1.1.0] - 2026-11-01

### Añadido

- Presupuesto en el tutorial del primer ingreso.

### Cambiado

- Cada pantalla se pinta en su propio contenedor: una respuesta lenta ya no pisa la pestaña que abriste después.
- Al cambiar de usuario en el mismo navegador se reinician filtros, pestaña y selecciones.
- Servicios y vistas simplificados.

### Corregido

- Tarjetas y pantalla de acceso alineadas con el esquema real de la base de datos.

## [1.0.0] - 2026-10-31

### Añadido

- Registro de gastos e ingresos con una barra de registro rápido.
- Billeteras y categorías, con saldo por cuenta.
- Presupuestos mensuales por categoría.
- Tarjetas de crédito con cuotas, intereses y fecha de pago.
- Suscripciones con día de cobro, fondos de ahorro y vista de análisis.
- Tutorial del primer ingreso y tema claro u oscuro.
- Cuentas de usuario con Supabase Auth; despliegue en Vercel.

[1.1.0]: https://github.com/S3scobar/luka-finanzas/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/S3scobar/luka-finanzas/releases/tag/v1.0.0
