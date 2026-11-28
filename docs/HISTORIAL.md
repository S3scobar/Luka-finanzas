# Sobre el historial de este repositorio

El desarrollo de LUKA empezó el 31 de octubre de 2026 en un repositorio anterior. Ese historial reflejaba un trabajo rápido y en solitario: un primer commit de 8.600 líneas, más de 50 merges de pull requests diminutos, ramas largas reutilizadas para temas distintos y mensajes sin convención.

El 27 de noviembre de 2026 el proyecto se trasladó a este repositorio y el historial se reconstruyó con un flujo de trabajo ordenado. Esta nota explica qué se conservó y qué se hizo de otra manera, para que quien lo revise sepa qué está mirando.

## Qué se conservó

- **El orden y las fechas reales del desarrollo.** Cada commit conserva la fecha y la hora del commit original del que sale. Nada se adelantó ni se atrasó para parecer otro ritmo de trabajo.
- **El estado del código en cada momento.** Cada release corresponde al estado real del proyecto al final de esa iteración. Las 13 iteraciones entre el 31 de octubre y el 27 de noviembre son las del desarrollo real.
- **El contenido final.** El código de `v3.4.1` es idéntico al del repositorio anterior, salvo lo que se detalla abajo.

## Qué se hizo distinto

- **Commits atómicos.** Los commits grandes del original (el primero, la migración a SvelteKit, el centro de notificaciones…) se dividieron en commits pequeños de un solo propósito, con mensajes Conventional Commits. Los commits que salen de un mismo commit original comparten su marca de tiempo.
- **Git Flow.** Las ramas `feature/*`, `bugfix/*`, `release/*` y `hotfix/*` se fusionaron con `--no-ff`. Como esas fusiones se hicieron en local, GitHub no muestra pull requests para este tramo; los PR se usan desde la 3.4.2.
- **Versiones retroactivas.** Antes de la migración a SvelteKit el proyecto no tenía número de versión. Las versiones 1.0.0 a 2.4.0 se asignaron después, agrupando el trabajo real por iteración. La 3.0.0 es la que ya traía el `package.json`.
- **Versiones y changelog escritos al cerrar cada iteración**, con `CHANGELOG.md` actualizado en la rama de release.
- **Sin credenciales.** El archivo `js/config.js` de las primeras versiones tenía la URL y la clave pública (`anon`) del proyecto de Supabase; aquí aparecen con valores de ejemplo.
- **Scripts SQL.** Los scripts SQL que existieron un par de días al inicio y se retiraron enseguida, y un intento de mover la configuración a variables de entorno que se revirtió el mismo día, no se reconstruyeron. El esquema de la base se documenta desde la 2.2.0.
- **Licencia.** El repositorio anterior usaba MIT. LUKA no es de código abierto: la licencia de este repositorio es de código visible (ver [LICENSE](../LICENSE)) y se aplica desde la 3.4.2. El pie de página y los términos de la app se actualizaron en ese mismo cambio.
- **Autoría.** Todos los commits se atribuyen a la cuenta del titular del proyecto.

## Cómo comprobarlo

```bash
git log --graph --oneline --decorate --date=short --format='%h %ad %d %s'
git tag -n1                      # versiones y su resumen
git log v2.4.0..v3.0.0 --oneline # lo que entró en la migración a SvelteKit
```
