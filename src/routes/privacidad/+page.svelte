<script>
	import LegalPage from '#lib/ui/LegalPage.svelte';
	import { LEGAL } from '#lib/legal.js';

	const sections = [
		{ id: 'responsable', title: 'Responsable' },
		{ id: 'datos', title: 'Qué datos se tratan' },
		{ id: 'finalidad', title: 'Para qué se usan' },
		{ id: 'dispositivo', title: 'Datos en tu dispositivo' },
		{ id: 'terceros', title: 'Proveedores' },
		{ id: 'seguridad', title: 'Seguridad' },
		{ id: 'conservacion', title: 'Conservación y eliminación' },
		{ id: 'derechos', title: 'Tus derechos' },
		{ id: 'menores', title: 'Menores de edad' },
		{ id: 'cambios', title: 'Cambios a esta política' }
	];
</script>

<LegalPage
	title="Política de privacidad"
	description="Cómo LUKA trata tus datos personales y financieros, dónde se guardan y cómo ejercer tus derechos."
	{sections}
>
	<p>
		{LEGAL.app} es una app de finanzas personales. Esta política explica qué datos trata, para qué y cómo
		puedes controlarlos. Se aplica la ley colombiana de protección de datos personales (Ley 1581 de 2012 y
		Decreto 1377 de 2013, compilado en el Decreto 1074 de 2015).
	</p>

	<h2 id="responsable">1. Responsable</h2>
	<p>
		El responsable del tratamiento es {LEGAL.owner}, autor de {LEGAL.app}. Para cualquier consulta o solicitud
		sobre tus datos, escribe a través de <a href={LEGAL.contact} rel="noopener noreferrer" target="_blank">{LEGAL.contactLabel}</a>.
	</p>

	<h2 id="datos">2. Qué datos se tratan</h2>
	<ul>
		<li><strong>Cuenta:</strong> correo electrónico o número de celular, nombre (si entras con Google) y un identificador interno.</li>
		<li><strong>Información financiera que tú registras:</strong> billeteras y saldos, movimientos, categorías, presupuestos, tarjetas de crédito y sus compras, préstamos y pagos, suscripciones, metas de ahorro y tu moneda base.</li>
		<li><strong>Actividad mínima:</strong> la fecha de tu último ingreso, para mantener la cuenta y avisarte de pagos.</li>
	</ul>
	<p>
		{LEGAL.app} no pide ni guarda contraseñas bancarias, números completos de tarjetas ni datos de pago, y no se
		conecta a tus cuentas bancarias. Lo que ves es lo que tú escribes.
	</p>

	<h2 id="finalidad">3. Para qué se usan</h2>
	<p>
		Solo para darte el servicio: mostrar tus saldos, calcular presupuestos, cuotas e intereses, avisarte de pagos
		y mantener tu sesión segura. No se venden ni se ceden tus datos, no se usan para publicidad y la app no
		incluye rastreadores, analítica de terceros ni anuncios.
	</p>

	<h2 id="dispositivo">4. Datos en tu dispositivo</h2>
	<p>
		{LEGAL.app} usa el almacenamiento local del navegador (no cookies de seguimiento) para: tu sesión, el tema
		claro u oscuro, las tasas de cambio (máximo 6 horas), tus preferencias de notificaciones y si ya viste el
		tutorial. Si activas el desbloqueo con Face ID o huella, la verificación la hace tu dispositivo: {LEGAL.app}
		solo guarda un identificador de la credencial y nunca recibe tu huella ni tu rostro. Puedes borrar estos datos
		desde la configuración de tu navegador.
	</p>

	<h2 id="terceros">5. Proveedores</h2>
	<p>Para funcionar, {LEGAL.app} se apoya en estos servicios, que actúan como encargados del tratamiento:</p>
	<ul>
		<li><strong>Supabase:</strong> base de datos y autenticación, donde se guarda tu cuenta y tu información financiera.</li>
		<li><strong>Vercel:</strong> aloja la app y procesa los datos técnicos de cada visita (dirección IP, navegador).</li>
		<li><strong>Google:</strong> solo si eliges entrar con tu cuenta de Google.</li>
		<li><strong>open.er-api.com:</strong> entrega las tasas de cambio. No recibe datos tuyos más allá de la petición técnica.</li>
	</ul>
	<p>
		Algunos de estos proveedores pueden almacenar datos fuera de Colombia. Al usar {LEGAL.app} autorizas esa
		transferencia, que se limita a lo necesario para prestar el servicio.
	</p>

	<h2 id="seguridad">6. Seguridad</h2>
	<p>
		Toda la comunicación va cifrada (HTTPS). En la base de datos cada fila pertenece a un usuario y las políticas
		de seguridad a nivel de fila impiden que otra cuenta la lea o la modifique. La app aplica una política de
		seguridad de contenido estricta y no carga código de terceros. Ningún sistema es infalible: si detectas un
		problema de seguridad, avísalo por el canal de contacto.
	</p>

	<h2 id="conservacion">7. Conservación y eliminación</h2>
	<p>
		Tus datos se conservan mientras tengas la cuenta. Si pides eliminarla, se borra la cuenta y, con ella, toda
		tu información financiera asociada, salvo lo que la ley obligue a conservar.
	</p>

	<h2 id="derechos">8. Tus derechos</h2>
	<p>Como titular puedes, en cualquier momento y sin costo:</p>
	<ul>
		<li>Conocer, actualizar y rectificar tus datos (casi todo se puede editar desde la propia app).</li>
		<li>Pedir prueba de la autorización que diste y saber cómo se usan tus datos.</li>
		<li>Revocar la autorización o pedir que se eliminen tus datos.</li>
		<li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) después de haber hecho tu consulta o reclamo.</li>
	</ul>
	<p>
		Las consultas se responden en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles, como indica la
		Ley 1581 de 2012.
	</p>

	<h2 id="menores">9. Menores de edad</h2>
	<p>{LEGAL.app} está pensada para mayores de 18 años. Un menor solo debería usarla con autorización de su representante legal.</p>

	<h2 id="cambios">10. Cambios a esta política</h2>
	<p>
		Si esta política cambia de forma importante, se avisará dentro de la app. La fecha de la última versión
		aparece arriba. Consulta también los <a href="/terminos">términos y condiciones</a>.
	</p>
</LegalPage>
