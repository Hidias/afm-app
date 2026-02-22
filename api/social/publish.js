// ═══════════════════════════════════════════════════════════
// VERCEL API ROUTE — Publication sur les réseaux sociaux
// POST /api/social/publish
// Body: { post_id } ou { platforms, content_facebook, content_instagram, content_gmb, media_urls }
// ═══════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

// ── Rafraîchir le token Google si expiré ────────────────
async function refreshGoogleToken(token) {
  if (!token.refresh_token) return token.access_token

  const expiresAt = new Date(token.token_expires_at)
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return token.access_token // Encore valide (marge 5 min)
  }

  // Rafraîchir
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()

  if (data.access_token) {
    // Mettre à jour en base
    await supabase.from('social_tokens').update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('platform', 'gmb')

    return data.access_token
  }

  return token.access_token
}

// ── Publier sur Facebook ────────────────────────────────
async function publishFacebook(content, mediaUrl, token) {
  const pageId = token.page_id
  const accessToken = token.access_token

  let endpoint, body
  if (mediaUrl) {
    // Post avec photo
    endpoint = `https://graph.facebook.com/v21.0/${pageId}/photos`
    body = { url: mediaUrl, message: content, access_token: accessToken }
  } else {
    // Post texte seul
    endpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`
    body = { message: content, access_token: accessToken }
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()

  if (data.error) throw new Error(`Facebook: ${data.error.message}`)
  return data.id || data.post_id
}

// ── Publier sur Instagram ───────────────────────────────
async function publishInstagram(content, mediaUrl, token) {
  if (!mediaUrl) throw new Error('Instagram nécessite une image')

  const igAccountId = token.page_id
  const accessToken = token.access_token

  // Étape 1 : Créer le conteneur média
  const createRes = await fetch(`https://graph.facebook.com/v21.0/${igAccountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: mediaUrl,
      caption: content,
      access_token: accessToken,
    }),
  })
  const createData = await createRes.json()

  if (createData.error) throw new Error(`Instagram create: ${createData.error.message}`)
  const containerId = createData.id

  // Attendre que le conteneur soit prêt (polling)
  let ready = false
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const statusRes = await fetch(`https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`)
    const statusData = await statusRes.json()
    if (statusData.status_code === 'FINISHED') {
      ready = true
      break
    }
    if (statusData.status_code === 'ERROR') {
      throw new Error(`Instagram media error: ${JSON.stringify(statusData)}`)
    }
  }

  if (!ready) throw new Error('Instagram: timeout waiting for media processing')

  // Étape 2 : Publier
  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igAccountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  })
  const publishData = await publishRes.json()

  if (publishData.error) throw new Error(`Instagram publish: ${publishData.error.message}`)
  return publishData.id
}

// ── Publier sur Google My Business ──────────────────────
async function publishGMB(content, mediaUrl, token) {
  const accessToken = await refreshGoogleToken(token)
  const locationId = token.page_id

  if (!locationId) throw new Error('GMB: aucune fiche connectée')

  const postBody = {
    languageCode: 'fr',
    summary: content,
    topicType: 'STANDARD',
  }

  // Ajouter la photo si disponible
  if (mediaUrl) {
    postBody.media = [{
      mediaFormat: 'PHOTO',
      sourceUrl: mediaUrl,
    }]
  }

  // Ajouter le CTA
  postBody.callToAction = {
    actionType: 'LEARN_MORE',
    url: 'https://www.accessformation.pro',
  }

  const res = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}/localPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postBody),
  })
  const data = await res.json()

  if (data.error) throw new Error(`GMB: ${data.error.message}`)
  return data.name
}

// ── Handler principal ───────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { post_id } = req.body
    let post

    if (post_id) {
      // Charger le post depuis Supabase
      const { data, error } = await supabase.from('social_posts').select('*').eq('id', post_id).single()
      if (error || !data) return res.status(404).json({ error: 'Post not found' })
      post = data
    } else {
      post = req.body
    }

    const platforms = post.platforms || []
    const mediaUrl = post.media_urls?.[0] || null
    const results = {}

    // Charger tous les tokens nécessaires
    const { data: tokens } = await supabase.from('social_tokens').select('*')
    const tokenMap = {}
    ;(tokens || []).forEach(t => { tokenMap[t.platform] = t })

    // ── Publier sur chaque plateforme ─────────────────
    for (const platform of platforms) {
      // Skip LinkedIn (pas encore implémenté)
      if (platform === 'linkedin') {
        results.linkedin = { status: 'skipped', reason: 'LinkedIn pas encore connecté' }
        continue
      }

      const token = tokenMap[platform === 'gmb' ? 'gmb' : platform]
      if (!token) {
        results[platform] = { status: 'error', reason: `${platform} non connecté` }
        continue
      }

      const content = post[`content_${platform}`]
      if (!content) {
        results[platform] = { status: 'skipped', reason: 'Pas de contenu' }
        continue
      }

      try {
        let externalId

        switch (platform) {
          case 'facebook':
            externalId = await publishFacebook(content, mediaUrl, token)
            break
          case 'instagram':
            externalId = await publishInstagram(content, mediaUrl, token)
            break
          case 'gmb':
            externalId = await publishGMB(content, mediaUrl, token)
            break
        }

        results[platform] = { status: 'published', external_id: externalId }

        // Mettre à jour le post en base si on a un post_id
        if (post_id) {
          const updates = {}
          updates[`published_${platform}_at`] = new Date().toISOString()
          updates[`external_id_${platform}`] = externalId
          await supabase.from('social_posts').update(updates).eq('id', post_id)
        }
      } catch (pubErr) {
        console.error(`Error publishing to ${platform}:`, pubErr.message)
        results[platform] = { status: 'error', reason: pubErr.message }
      }

      // Pause 2s entre chaque publication (rate limiting)
      await new Promise(r => setTimeout(r, 2000))
    }

    // Mettre à jour le statut global du post
    if (post_id) {
      const allPublished = Object.values(results).every(r => r.status === 'published' || r.status === 'skipped')
      const anyPublished = Object.values(results).some(r => r.status === 'published')

      await supabase.from('social_posts').update({
        status: anyPublished ? 'published' : 'failed',
        updated_at: new Date().toISOString(),
      }).eq('id', post_id)
    }

    return res.status(200).json({ success: true, results })

  } catch (err) {
    console.error('Publish handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}
