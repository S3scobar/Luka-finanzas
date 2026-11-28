# Registro de cambios

Todos los cambios relevantes de LUKA se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[Versionado Semántico](https://semver.org/lang/es/).

> Las versiones anteriores a la 3.0.0 se numeraron después de ocurrir, al ordenar el historial
> (ver [docs/HISTORIAL.md](docs/HISTORIAL.md)). Las fechas son las del desarrollo real.

## [3.4.2] - 2026-11-27

### Añadido

- Guía de flujo de trabajo (CONTRIBUTING), plantillas de pull request e issues, y nota sobre el historial.
- La CI también corre al integrar en develop.

### Cambiado

- La licencia pasa de MIT a una licencia de código visible: se puede leer y evaluar, no reutilizar.
- El pie de página y los términos de la app reflejan la nueva licencia.

## [3.4.1] - 2026-11-27

### Corregido

- La hoja de pago de tarjetas rompía la pestaña Crédito antes de cargar los datos.

## [3.4.0] - 2026-11-27

### Añadido

- Borrar movimientos deslizando.

### Cambiado

- La guía y los atajos se configuran desde el perfil.

### Corregido

- Los pagos de préstamo y de tarjeta tienen su propia categoría y ya no se mezclan con los gastos comunes.

## [3.3.0] - 2026-11-25

### Añadido

- Atajos de la barra de abajo elegidos por cada persona.

### Cambiado

- Pulido de la interfaz en móvil y escritorio con la identidad actual.

## [3.2.0] - 2026-11-23

### Añadido

- Manual de identidad de marca en docs/brand.
- Botón oficial de Google en el acceso.

### Cambiado

- Colores alineados con la paleta y los contrastes del manual de marca.
- Nueva pantalla de apertura en liquid glass.
- Registro rápido rediseñado.

### Seguridad

- La URL y la clave de Supabase ya no llegan al navegador: se sirven detrás del dominio de LUKA con /sb.

## [3.1.0] - 2026-11-23

### Añadido

- Perfil con el estilo de la moneda base y la opción «Borrar registro» para empezar de cero sin borrar la cuenta.
- Avisos en la barra del celular.
- Panel financiero para computador.
- Análisis con hallazgos automáticos y gráficas útiles.
- Presupuesto con anillo de progreso y gasto diario sugerido; Suscripciones con orden por fecha de cobro y costo anual.

### Cambiado

- Inicio, Billeteras, Presupuesto, Crédito, Suscripciones, Análisis y Ahorros ahora son componentes Svelte.
- Pruebas automáticas de análisis, panel y ahorros.

### Corregido

- El perfil seguía visible al cerrarlo.

## [3.0.0] - 2026-11-23

### Añadido

- Páginas de privacidad y términos, enlazadas desde el pie.

### Cambiado

- **Incompatible:** la app pasa a SvelteKit 3 con rutas prerenderizadas: cada pestaña tiene su propia dirección.
- Política de seguridad de contenido (CSP) y cabeceras de seguridad en Vercel.
- El conversor es la primera vista nativa en Svelte; el resto se migra por fases.
- La CI ejecuta pruebas, svelte-check y build.

## [2.4.0] - 2026-11-21

### Añadido

- Conversor de moneda.
- Moneda por billetera: COP, USD o EUR.

## [2.3.0] - 2026-11-16

### Añadido

- Centro de notificaciones.
- Tema oscuro «Tinta».

### Cambiado

- Nuevo catálogo de iconos y superficies liquid glass en modales.
- Banner de tarjeta más compacto y más aire en el selector de cuenta.

## [2.2.0] - 2026-11-15

### Añadido

- Inicio de sesión con Google.
- Bloqueo de la app con Face ID o huella (WebAuthn).
- Esqueletos de carga mientras se piden los datos.
- Registro de la última actividad para limpiar cuentas inactivas.
- Pruebas automáticas de la lógica de préstamos y CI en GitHub Actions.
- Documentación del esquema de la base de datos y vista previa en el README.

### Corregido

- El último movimiento registrado aparece primero dentro del mismo día.
- El service worker prioriza la red para js y css y no mezcla versiones tras un despliegue.

### Seguridad

- Migración de refuerzo de seguridad e índices aplicada en Supabase.

## [2.1.0] - 2026-11-14

### Añadido

- La app se puede instalar (PWA) con botón de instalación.
- Pantalla de apertura animada.
- Liquid glass v2: superficies translúcidas con luz especular.

### Cambiado

- Ajustes de UX en Billeteras; el deslizador marca con borde verde cuando se completa.

## [2.0.0] - 2026-11-06

### Añadido

- Préstamos de apps de crédito, bancos y personas, con cuota y saldo.
- Cambio de tema claro/oscuro con animación circular.
- Aviso en Inicio del pago de préstamos del mes.

### Cambiado

- Rediseño completo con el material liquid glass: barra, píldora líquida en las pestañas, modales, tarjetas, botón flotante y deslizador.
- **Incompatible:** la pestaña «Tarjetas» pasa a ser «Crédito» y reúne Tarjetas y Préstamos.

### Corregido

- Cabeceras de caché de index.html y vercel.json.

### Rendimiento

- El cambio de tema es más fluido: se pausan transiciones, desenfoque y fondo animado mientras dura la animación.

## [1.2.0] - 2026-11-03

### Añadido

- Iconos y colores a elegir para cada billetera.
- Ingreso con deslizador: «desliza para ingresar».
- Navegación entre pestañas deslizando el dedo.

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

[3.4.2]: https://github.com/S3scobar/luka-finanzas/compare/v3.4.1...v3.4.2
[3.4.1]: https://github.com/S3scobar/luka-finanzas/compare/v3.4.0...v3.4.1
[3.4.0]: https://github.com/S3scobar/luka-finanzas/compare/v3.3.0...v3.4.0
[3.3.0]: https://github.com/S3scobar/luka-finanzas/compare/v3.2.0...v3.3.0
[3.2.0]: https://github.com/S3scobar/luka-finanzas/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/S3scobar/luka-finanzas/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/S3scobar/luka-finanzas/compare/v2.4.0...v3.0.0
[2.4.0]: https://github.com/S3scobar/luka-finanzas/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/S3scobar/luka-finanzas/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/S3scobar/luka-finanzas/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/S3scobar/luka-finanzas/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/S3scobar/luka-finanzas/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/S3scobar/luka-finanzas/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/S3scobar/luka-finanzas/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/S3scobar/luka-finanzas/releases/tag/v1.0.0
