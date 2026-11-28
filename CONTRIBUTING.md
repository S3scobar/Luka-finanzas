# Flujo de trabajo

LUKA es un proyecto personal de código visible (ver [LICENSE](LICENSE)): no recibe contribuciones externas, pero este documento describe cómo se trabaja en él, para que cualquiera que lo revise pueda seguir el historial.

## Ramas (Git Flow)

| Rama | Origen | Destino | Para qué |
|---|---|---|---|
| `main` | — | — | Solo versiones publicadas. Cada merge lleva una etiqueta `vX.Y.Z`. |
| `develop` | `main` | — | Integración del trabajo terminado. |
| `feature/<nombre>` | `develop` | `develop` | Funcionalidad nueva o mejora. |
| `bugfix/<nombre>` | `develop` | `develop` | Error encontrado durante el desarrollo, no urgente. |
| `release/X.Y.Z` | `develop` | `main` y `develop` | Preparar una versión: changelog y número de versión. |
| `hotfix/X.Y.Z` | `main` | `main` y `develop` | Error crítico en producción. |

Reglas:

- Nunca se hace commit directo en `main` ni en `develop`.
- Los nombres van en minúsculas y con guiones: `feature/panel-escritorio`.
- Las ramas viven pocos días y se borran al fusionarse.
- Los merges usan `--no-ff` para conservar la forma de cada rama en el historial.

## Commits (Conventional Commits)

```text
<tipo>(<alcance>): <resumen en imperativo, máximo 72 caracteres>

<cuerpo opcional: qué cambia y, sobre todo, por qué>
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Alcances habituales: `auth`, `wallets`, `budgets`, `credit`, `loans`, `subscriptions`, `savings`, `analytics`, `home`, `theme`, `pwa`, `db`, `ui`, `nav`.

Un commit hace una sola cosa: no se mezclan refactorizaciones con funcionalidades ni cambios de formato con cambios de comportamiento. Antes de cada commit se revisa `git diff --staged`, que no haya secretos y que pasen `npm test`, `npm run check` y `npm run build`.

## Versiones (SemVer)

- **MAJOR**: cambio incompatible o rediseño que obliga a quien usa la app a adaptarse (por ejemplo, la migración a SvelteKit).
- **MINOR**: funcionalidad nueva compatible.
- **PATCH**: corrección compatible.

Cada versión tiene su etiqueta anotada en `main` y su entrada en [CHANGELOG.md](CHANGELOG.md), escrita en la misma rama de `release` o `hotfix` y pensada para quien usa la app, no para quien lee el código. El número de `package.json` sale de la etiqueta.

## Base de datos

Todo cambio de esquema es una migración con fecha en `supabase/migrations/` y se refleja en `supabase/schema.sql`. Los valores reales de Supabase nunca se versionan: se configuran como variables de entorno (ver `.env.example`).

## Pull requests

Desde la 3.4.2 el trabajo entra a `develop` mediante pull request, con la plantilla de `.github/`. La CI ejecuta pruebas, `svelte-check` y el build en cada push a `main` y `develop` y en cada PR.

El historial anterior se reconstruyó a partir del desarrollo real; ver [docs/HISTORIAL.md](docs/HISTORIAL.md).
