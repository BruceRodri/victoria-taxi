# Victoria-Taxi

## Central compartida

La entrada principal usa React, Capacitor y una API Node 24 con SQLite. Para desarrollo ejecuta `npm run dev`. Los perfiles de Sofía, Diego y Valeria están disponibles en localhost. Abre una ventana normal para Sofía y una privada para Diego. En el perfil de Diego, **Probar GPS en Newark Penn** permite simular una recogida sin desplazarte. Los datos de la demo anterior siguen en su navegador de origen.

Para servir la aplicación compilada, ejecuta `npm run build` y `npm start` detrás de un proxy HTTPS. La central escucha en 127.0.0.1:5192 por defecto. Configura `PORT`, `HOST` y `VT_DATA_DIR` si corresponde. Se requiere un directorio persistente, privado y con copias de seguridad para SQLite y los documentos. Configura `VT_ADMIN_EMAIL` y `VT_ADMIN_PASSWORD` para iniciar la cuenta de administración. Usa una contraseña de al menos diez caracteres. El servidor de producción deshabilita el acceso rápido a los perfiles de prueba. En el móvil introduce la dirección HTTPS de la central al abrir la app o define `VITE_VICTORIA_API` al compilar.

Las ofertas se muestran a conductores aprobados con ubicación reciente a diez millas de la recogida. La finalización por el conductor requiere un viaje iniciado y GPS reciente a cien metros del último destino. El historial distingue el trazado GPS registrado de la ruta estimada. Las tarifas y las paradas representan estimaciones en efectivo.

Las llamadas usan WebRTC. Para redes que requieren retransmisión configura un servidor TURN con `VT_TURN_URL` y `VT_TURN_SECRET` (secreto compartido de coturn). La API emite credenciales temporales. Los participantes necesitan permiso de micrófono y la pantalla del viaje abierta para hablar.

La web registra una suscripción Web Push desde **Avisos**. Configura `VT_PUSH_CONTACT` para el servicio. En Android se necesitan el archivo Firebase `android/app/google-services.json` de la app y las credenciales de servicio del servidor en `GOOGLE_APPLICATION_CREDENTIALS`. En iOS se necesitan firma y perfil con Push Notifications, y las variables de servidor `VT_APNS_KEY` (ruta a la clave .p8), `VT_APNS_KEY_ID` y `VT_APNS_TEAM`. Para dispositivos con firma de desarrollo configura `VT_APNS_SANDBOX=1`. Guarda las credenciales fuera del repositorio. Compila y sincroniza con `npm run build` y `npx cap sync` después de configurar el proyecto nativo.

Ejecuta `node --test server/dispatch.test.mjs` para verificar permisos, aceptación, paradas, finalización, reseñas, historial y revisión de documentos en una base temporal.

## Demostraciones locales anteriores


## Prueba entre la PC y un Android en la misma Wi-Fi

Desde PowerShell ejecuta `./server/start-wifi.ps1` después de compilar la web y el APK debug. Abre `http://127.0.0.1:5191/pc` en la PC como Sofía. Escanea el QR con Android. Instala el APK de esa página y vuelve a ella para pulsar **Conectar como Diego**. Concede ubicación y notificaciones e inicia el turno. Cuando la PC indique **Diego disponible**, bloquea el móvil y solicita el viaje desde la PC. La notificación abre la app para aceptar. El chat y la finalización se comparten con Sofía. La alternativa de navegador permite la prueba en primer plano.

El servidor escucha solo en la dirección Wi-Fi indicada y en loopback. Guarda la sesión de prueba en `.wifi-test`. Usa datos ficticios en una red de confianza. El servidor debe seguir abierto durante la prueba. La comunicación HTTP con la PC se habilita en el APK debug. El cliente Android consulta las ofertas durante el turno en un hilo nativo; su entrega depende de la Wi-Fi y de que Android mantenga el proceso activo. Esta prueba local funciona sin FCM. La demo individual sigue disponible con `npm run dev`.

