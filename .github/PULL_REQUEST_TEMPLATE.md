## Qué cambia y por qué

<!-- Una o dos frases. El «por qué» importa más que el «qué»: el diff ya muestra el qué. -->

## Tipo de cambio

- [ ] `feat` · nueva funcionalidad
- [ ] `fix` · corrección de un error
- [ ] `refactor` / `perf` / `style` · sin cambio de comportamiento
- [ ] `docs` / `test` / `ci` / `build` / `chore`

## Cómo se probó

- [ ] `npm test`
- [ ] `npm run check`
- [ ] `npm run build`
- [ ] Probado a mano en móvil y escritorio (si toca la interfaz)

## Lista de verificación

- [ ] Commits atómicos con mensajes Conventional Commits (ver `CONTRIBUTING.md`)
- [ ] Sin secretos ni archivos `.env` en el diff
- [ ] Si cambia el esquema, incluye su migración en `supabase/migrations/`
- [ ] Si es un cambio visible para quien usa la app, actualiza `CHANGELOG.md`
