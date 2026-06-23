// functions/api/submit.js
// Cloudflare Pages Function — route automatique : /api/submit
//
// Rôle : recevoir le POST du formulaire (même origine = aucun CORS dans le
// navigateur), puis relayer la charge utile vers Power Automate CÔTÉ SERVEUR.
// Le déclencheur HTTP Power Automate ne renvoie pas d'en-têtes CORS, mais ce
// n'est pas un problème ici : l'appel serveur-à-serveur ne passe pas par la
// politique CORS du navigateur.
//
// L'URL Power Automate (signée SAS) n'est JAMAIS exposée au client : elle est
// stockée dans la variable d'environnement POWER_AUTOMATE_URL (voir étapes de
// déploiement). On ne la met pas dans le code ni dans le dépôt Git.

export async function onRequestPost(context) {
  const { request, env } = context;

  // Garde-fou : la variable d'environnement doit exister.
  if (!env.POWER_AUTOMATE_URL) {
    return json({ ok: false, error: 'POWER_AUTOMATE_URL non configurée' }, 500);
  }

  // Lire le corps JSON envoyé par le formulaire.
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'Corps JSON invalide' }, 400);
  }

  // Relayer vers Power Automate (serveur-à-serveur, pas de CORS ici).
  try {
    const upstream = await fetch(env.POWER_AUTOMATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // On renvoie au navigateur un statut clair. Le formulaire ne vérifie que
    // response.ok, donc on reflète simplement le succès/échec en amont.
    if (!upstream.ok) {
      return json(
        { ok: false, error: 'Échec Power Automate', status: upstream.status },
        502
      );
    }

    return json({ ok: true, reference: payload.reference ?? null }, 200);
  } catch (err) {
    return json({ ok: false, error: 'Erreur réseau vers Power Automate' }, 502);
  }
}

// Refuser proprement les autres méthodes (GET, etc.).
export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ ok: false, error: 'Méthode non autorisée' }, 405);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
