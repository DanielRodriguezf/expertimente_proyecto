const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// Credenciales de tu archivo expertimente-v1-firebase-adminsdk-fbsvc-ce8bc15bb1.json
const serviceAccount = {
  "type": "service_account",
  "project_id": "expertimente-v1",
  "private_key_id": "ce8bc15bb186342f62f4bc740034135b20650109",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC+/qMNo7JVdHch\nO57xjgVkU54HETc+hltAw7qzRzrNPDVIfewSW60bRbu60nFBQz9ultdJNoWqIEqP\nfB08Ieg8LFQfd8TbTEe7wKJTcHc0AndhkYhe8Y742A+gBTscVtlFCl6ZQYQa6PGT\nBC4nlqcy0eQkE21ttMqhjQ9pd9S2jSQjMd/NzPfIczCBy5mvKdVF9nPXpquzO/1O\nO/nTODi/Zn3bo5H/qfBWMW3ToLSNdddRsYK8Y394vPkU/ZyGXDbRYHiAzeh9sTe5\nl3TLuCT5+5obPQKTImX+rZaYsIrtrsdWaHUEjBVckuXyA2OdgsE2QZpm/6R3j2Ul\n6usI8PJrAgMBAAECggEAALjmH/PpsDtfr0n87g1Amvev+3cxXh9USANAI6kWIVbk\nHVvl4SSPRoZLJp02HW47gVe5BQdblmBHN+dbFZz2i7Jf4mXpt39AhDFpy7v7T2s0\n+AhSBjM5Ua/rezTvMMppSZgM8d0WuqKn4IudqxD9nTUVp5yah4AtW1K1Egvdy4+X\nuVxuPswRYvnLy0s8VdZ+bdUL/6pqJ1IRaWBORwyQn7X6q9CVAcXR7cxnzQB7ReMs\nKkpaJlVtSoFyw+nb2PMs3JZwBc+4Pw37j131zzDRmNUXUxgPJzhEQ7KlUJ3q2A1U\n3+rq3dACYRf4HY/bGq30lJDWaUrIVdc8qzR4ugq6qQKBgQD8TEjH6f+hbQjqyewq\npu2pr1QczUhXtErmYsZZK3uEChq9Y8I8a4W0dePTdbmX607ssHULHZmScpx5QonD\nCMZag6Lgqwn87j5oExx3nyLxOTGfKx7op6VAogaesUKbUl4gC96VJzA5M2OXlhzj\nCXe5tznmg/006BcYJf7/1IlQSQKBgQDBzBOtxuZ0cJL3oy7WbG+KzLeEnXtD6g3F\nt+5/D+I64RcFX1gixQqLzr3rjJxIf0KUaqTbc9eR2XZ4j98BzRlpi+zSoNWXx64W\nZAGbZ4A+9Z6bMtzxLKXKq8QMzupGaACs4x0e+0VH/4G57Q9N7VT2FhkdST5jNbNX\nY6DtmdoVEwKBgF1myFLqN+7E9NYm5r1rivSUqej3vl5pqojb7F46kMFzFC8k7VV8\n4MTMGAnCvXCWdmN9d/cjgCUNNQxXK7T+XKBJt1TBPTNb59KTsKhAS6lN6SbpycmL\ntsvUr+qz6NqjhaELg91n4pxqf+YwdoU+jgo84LyMBIM/oL0Z4+tF/YexAoGAUZRa\n5FhKQtHwzBYBbXoQKlmrF0RD037/dS/MUeiZzzdZvYU5UMmpetj40eNLFqmbmWab\nJ1ZIdLkaSf4mXle8TtX8R141C8Oe4QYQNx8GuXoj3ik3IL8uu3Y6/TlNHX5CaoTg\niV409+3y6hWEz8UMctsyj0V54cGFUVA7Okn9p8kCgYAPIUhZdj/mAmAlvkx5mLce\nGSyeW/8mMCnV1Ok+EFNpKR0JwmN4A02TDMsuHk3ojfnHn1KzBAOnbgYUZAhLueqZ\nKqf7EJwRXDq6rpWO1/R8GZ4JuZZz4qrLNGZ+LEJK6MVVllw7nsLfncORoKIGSODK\n5R+3S0Cxw1GAK5NoijXefQ==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@expertimente-v1.iam.gserviceaccount.com",
  "client_id": "114510498465710497558",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40expertimente-v1.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const messaging = getMessaging();

// Mismo canal y rutas que usa tu src/app/services/notificaciones.ts
const CANAL_ID = 'expertimente_avisos';
const RUTA_OFERTA = '/mis-postulaciones';
const RUTA_TERNA = '/mis-postulaciones';

function clasificarTipo(tipo) {
  const t = String(tipo || '').toLowerCase().trim();
  if (/no[_\s-]?selecc|rechaz|descart/.test(t)) return 'rechazado';
  if (/selecc|acept|aprob/.test(t)) return 'seleccionado';
  if (/mensaj|chat|contact/.test(t)) return 'mensaje';
  return 'general';
}

function tituloDe(categoria) {
  switch (categoria) {
    case 'seleccionado': return '¡Buenas noticias!';
    case 'rechazado': return 'Actualización de tu postulación';
    case 'mensaje': return 'Tienes un nuevo mensaje';
    default: return 'Novedad en ExpertiMente';
  }
}

function mensajeRespaldo(categoria, empresa, referencia) {
  const de = empresa ? ` de ${empresa}` : '';
  const para = referencia ? ` («${referencia}»)` : '';
  switch (categoria) {
    case 'seleccionado': return `Avanzaron con tu perfil${de}${para}.`;
    case 'rechazado': return `Hay una actualización${de}${para}. Revisa tu historial.`;
    case 'mensaje': return `Un reclutador${de} te escribió${para}.`;
    default: return 'Tienes una novedad. Entra para revisarla.';
  }
}

function textoCortoTerna(categoria, empresa, cargo) {
  if (!cargo) return null;
  const detalle = empresa ? `${cargo} en ${empresa}` : cargo;

  if (categoria === 'seleccionado') {
    return { titulo: '¡Tu perfil fue aceptado!', mensaje: detalle };
  }
  if (categoria === 'rechazado') {
    return { titulo: 'Actualización de tu perfil', mensaje: detalle };
  }
  return null;
}

function construirAviso(id, data) {
  const tipo = String(data?.tipo ?? '').toLowerCase().trim();
  const categoria = clasificarTipo(tipo);

  const origen = !data?.ofertaId && (data?.cargo || data?.reclutadorId) ? 'terna' : 'oferta';
  const nombreEmpresa = String(data?.nombreEmpresa ?? '').trim();
  const referencia = String((origen === 'terna' ? data?.cargo : data?.tituloOferta) ?? '').trim();

  const mensaje = String(data?.mensaje ?? '').trim() || mensajeRespaldo(categoria, nombreEmpresa, referencia);
  const corto = origen === 'terna' ? textoCortoTerna(categoria, nombreEmpresa, referencia) : null;

  return {
    id,
    origen,
    titulo: corto?.titulo ?? tituloDe(categoria),
    mensaje: corto?.mensaje ?? mensaje,
    destino: origen === 'terna' ? RUTA_TERNA : RUTA_OFERTA
  };
}

let cargaInicial = true;

console.log('🚀 Escuchando nuevas notificaciones en Firestore (expertimente-v1)...');

db.collection('notificaciones').onSnapshot(
  (snapshot) => {
    if (cargaInicial) {
      cargaInicial = false;
      console.log(`✅ Conectado. Ignorando ${snapshot.size} notificaciones antiguas.`);
      return;
    }

    snapshot.docChanges().forEach(async (cambio) => {
      if (cambio.type !== 'added') return;

      const notifId = cambio.doc.id;
      const data = cambio.doc.data();
      const postulanteId = data?.postulanteId;

      if (!postulanteId || data?.pushEnviado === true) return;

      try {
        const postulanteRef = db.doc(`postulantes/${postulanteId}`);
        const postulanteSnap = await postulanteRef.get();

        if (!postulanteSnap.exists) return;

        const postulanteData = postulanteSnap.data();
        const tokens = Array.isArray(postulanteData?.fcmTokens)
          ? postulanteData.fcmTokens.filter(Boolean)
          : [];

        if (!tokens.length) {
          console.log(`ℹ️ El postulante ${postulanteId} no tiene tokens FCM registrados en su celular.`);
          return;
        }

        const aviso = construirAviso(notifId, data);

        const respuesta = await messaging.sendEachForMulticast({
          tokens,
          notification: {
            title: aviso.titulo,
            body: aviso.mensaje
          },
          data: {
            notifId: String(aviso.id),
            destino: String(aviso.destino),
            origen: String(aviso.origen)
          },
          android: {
            priority: 'high',
            notification: {
              channelId: CANAL_ID,
              sound: 'default',
              priority: 'max',
              defaultVibrateTimings: true
            }
          }
        });

        await cambio.doc.ref.set({ pushEnviado: true }, { merge: true });

        console.log(
          `📲 Push enviado a ${postulanteId} [${aviso.origen.toUpperCase()}]: "${aviso.titulo}" (${respuesta.successCount} enviados, ${respuesta.failureCount} fallos)`
        );

        const tokensInvalidos = [];
        respuesta.responses.forEach((res, idx) => {
          if (!res.success) {
            const codigo = res.error?.code || '';
            if (
              codigo === 'messaging/invalid-registration-token' ||
              codigo === 'messaging/registration-token-not-registered'
            ) {
              tokensInvalidos.push(tokens[idx]);
            }
          }
        });

        if (tokensInvalidos.length > 0) {
          await postulanteRef.update({
            fcmTokens: FieldValue.arrayRemove(...tokensInvalidos)
          });
          console.log(`🧹 Se eliminaron ${tokensInvalidos.length} tokens antiguos de ${postulanteId}.`);
        }
      } catch (err) {
        console.error('❌ Error enviando notificación Push:', err);
      }
    });
  },
  (error) => {
    console.error('❌ Error en el listener de Firestore:', error);
  }
);