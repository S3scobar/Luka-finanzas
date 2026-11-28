<script>
	import LegalPage from '#lib/ui/LegalPage.svelte';
	import { LEGAL } from '#lib/legal.js';

	const sections = [
		{ id: 'aceptacion', title: 'Aceptación' },
		{ id: 'servicio', title: 'Qué es LUKA' },
		{ id: 'asesoria', title: 'No es asesoría financiera' },
		{ id: 'cuenta', title: 'Tu cuenta' },
		{ id: 'uso', title: 'Uso aceptable' },
		{ id: 'propiedad', title: 'Propiedad intelectual y copyright' },
		{ id: 'disponibilidad', title: 'Disponibilidad' },
		{ id: 'responsabilidad', title: 'Responsabilidad' },
		{ id: 'terminacion', title: 'Terminación' },
		{ id: 'ley', title: 'Ley aplicable' },
		{ id: 'contacto', title: 'Cambios y contacto' }
	];
</script>

<LegalPage
	title="Términos y condiciones"
	description="Condiciones de uso de LUKA, licencia del código, derechos de autor y límites de responsabilidad."
	{sections}
>
	<h2 id="aceptacion">1. Aceptación</h2>
	<p>
		Al crear una cuenta o usar {LEGAL.app} aceptas estos términos y la <a href="/privacidad">política de privacidad</a>.
		Si no estás de acuerdo, no uses la app.
	</p>

	<h2 id="servicio">2. Qué es {LEGAL.app}</h2>
	<p>
		{LEGAL.app} es una herramienta gratuita para registrar y organizar tus finanzas personales: billeteras,
		movimientos, presupuestos, tarjetas de crédito, préstamos, suscripciones, ahorros y conversión de moneda.
		No es un banco, no mueve dinero real y no se conecta a tus cuentas financieras.
	</p>

	<h2 id="asesoria">3. No es asesoría financiera</h2>
	<p>
		Los cálculos de cuotas, intereses, rendimientos, extractos y tasas de cambio son estimaciones con base en los
		datos que tú ingresas y en fuentes públicas. Pueden diferir de lo que cobre o pague tu entidad financiera.
		Antes de tomar decisiones importantes, verifica con tu banco o con un asesor profesional.
	</p>

	<h2 id="cuenta">4. Tu cuenta</h2>
	<ul>
		<li>Debes ser mayor de 18 años o contar con autorización de tu representante legal.</li>
		<li>Eres responsable de lo que registras y de mantener seguro el acceso a tu correo, celular y dispositivo.</li>
		<li>Si sospechas que alguien entró a tu cuenta, cierra sesión en todos tus dispositivos y avisa por el canal de contacto.</li>
	</ul>

	<h2 id="uso">5. Uso aceptable</h2>
	<p>No está permitido:</p>
	<ul>
		<li>Intentar acceder a datos de otras personas o eludir las medidas de seguridad.</li>
		<li>Sobrecargar el servicio, automatizar el registro masivo de cuentas o hacer ingeniería inversa del servicio alojado con fines dañinos.</li>
		<li>Usar {LEGAL.app} para actividades ilegales, incluido el lavado de activos.</li>
	</ul>

	<h2 id="propiedad">6. Propiedad intelectual y copyright</h2>
	<p>
		© {new Date().getFullYear()} {LEGAL.owner}. Todos los derechos reservados. El código fuente de
		{LEGAL.app} es de código visible: puedes leerlo y evaluarlo, pero no está permitido copiarlo,
		modificarlo, distribuirlo ni usarlo en otro producto o servicio sin permiso por escrito. Consulta la
		<a href={LEGAL.license} rel="license noopener noreferrer" target="_blank">licencia</a>.
	</p>
	<p>
		El nombre {LEGAL.app}, el logotipo, los iconos de la app y la pantalla de apertura son de
		{LEGAL.owner} y no pueden usarse para presentar otro producto como si fuera {LEGAL.app} o
		estuviera respaldado por su autor. Los iconos Phosphor y Font Awesome se usan bajo sus propias
		licencias abiertas.
	</p>
	<p>Los datos que registras son tuyos. {LEGAL.app} solo los usa para prestarte el servicio.</p>

	<h2 id="disponibilidad">7. Disponibilidad</h2>
	<p>
		{LEGAL.app} se ofrece «tal cual» y «según disponibilidad». Puede tener interrupciones, cambios o errores, y
		funciones que se agreguen o se retiren. Se procura mantener tus datos a salvo, pero conviene que no sea tu
		único registro de información crítica.
	</p>

	<h2 id="responsabilidad">8. Responsabilidad</h2>
	<p>
		En la medida en que la ley lo permita, {LEGAL.owner} no responde por pérdidas derivadas de decisiones tomadas
		con base en los cálculos de la app, de datos mal ingresados, de la indisponibilidad del servicio o de accesos
		causados por el descuido de tus credenciales. Nada de esto limita los derechos que te otorgue la ley de
		protección al consumidor (Ley 1480 de 2011) cuando sea aplicable.
	</p>

	<h2 id="terminacion">9. Terminación</h2>
	<p>
		Puedes dejar de usar {LEGAL.app} cuando quieras y pedir que se elimine tu cuenta. Las cuentas que incumplan
		estos términos pueden suspenderse.
	</p>

	<h2 id="ley">10. Ley aplicable</h2>
	<p>Estos términos se rigen por las leyes de la República de Colombia.</p>

	<h2 id="contacto">11. Cambios y contacto</h2>
	<p>
		Estos términos pueden actualizarse; la fecha de la última versión aparece arriba y los cambios importantes
		se avisarán en la app. Para dudas o solicitudes, escribe a través de
		<a href={LEGAL.contact} rel="noopener noreferrer" target="_blank">{LEGAL.contactLabel}</a>.
	</p>
</LegalPage>
