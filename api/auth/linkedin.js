// ═══════════════════════════════════════════════════════════
// VERCEL API ROUTE — OAuth LinkedIn
// GET /api/auth/linkedin?action=connect (initie le flow OAuth)
// GET /api/auth/linkedin?code=... (callback après auth)
// ═══════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET
const APP_URL = process.env.APP_URL || 'https://app.accessformation.pro'
const REDIRECT_URI = `${APP_URL}/api/auth/linkedin`

export default async function handler(req, res) {
  try {
    const { code, action, error: oauthError, error_description } = req.query

    // ── Erreur OAuth ────────────────────────────────────
    if (oauthError) {
      console.error('LinkedIn OAuth error:', oauthError, error_description)
      return res.redirect(`${APP_URL}/#/social?linkedin=error&reason=${encodeURIComponent(oauthError)}`)
    }

    // ── Étape 1 : Initier la connexion ──────────────────
    if (action === 'connect') {
      if (!LINKEDIN_CLIENT_ID) {
        return res.status(500).json({ error: 'LINKEDIN_CLIENT_ID non configuré' })
      }

      // Scopes : openid + profile (Sign In) + w_member_social (Share)
      const scope = 'openid profile w_member_social'
      const state = Math.random().toString(36).substring(2, 15)

      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&state=${state}`

      return res.redirect(authUrl)
    }

    // ── Étape 2 : Échanger le code contre un token ──────
    if (!code) {
      return res.status(400).json({ error: 'Missing code parameter' })
    }

    console.log('[linkedin] Exchanging code for token...')

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    })

    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error('LinkedIn token error:', tokenData)
      return res.redirect(`${APP_URL}/#/social?linkedin=error&reason=token_exchange`)
    }

    const accessToken = tokenData.access_token
    const expiresIn = tokenData.expires_in || 5184000 // 60 jours par défaut

    console.log('[linkedin] Token obtained, expires in', expiresIn, 'seconds')

    // ── Étape 3 : Récupérer le profil utilisateur ───────
    let personName = 'Utilisateur LinkedIn'
    let personUrn = null

    try {
      // OpenID Connect userinfo endpoint
      const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const profileData = await profileRes.json()
      console.log('[linkedin] Profile:', JSON.stringify(profileData).slice(0, 300))

      if (profileData.sub) {
        personUrn = profileData.sub // Format: "abc123" — on construit le URN
        personName = [profileData.given_name, profileData.family_name].filter(Boolean).join(' ') || 'Utilisateur'
      }
    } catch (profileErr) {
      console.warn('[linkedin] Profile fetch error:', profileErr.message)
    }

    // Si on n'a pas eu le sub via userinfo, essayer /v2/me
    if (!personUrn) {
      try {
        const meRes = await fetch('https://api.linkedin.com/v2/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const meData = await meRes.json()
        console.log('[linkedin] /v2/me:', JSON.stringify(meData).slice(0, 300))

        if (meData.id) {
          personUrn = meData.id
          personName = [meData.localizedFirstName, meData.localizedLastName].filter(Boolean).join(' ') || personName
        }
      } catch (meErr) {
        console.warn('[linkedin] /v2/me error:', meErr.message)
      }
    }

    console.log('[linkedin] Person:', personName, 'URN/sub:', personUrn)

    // ── Étape 4 : Stocker dans Supabase ─────────────────
    await supabase.from('social_tokens').upsert({
      platform: 'linkedin',
      access_token: accessToken,
      refresh_token: null, // LinkedIn OAuth 2.0 standard n'a pas de refresh token
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      page_id: personUrn, // Stocké dans page_id pour cohérence avec les autres plateformes
      account_id: personUrn,
      metadata: {
        person_name: personName,
        person_urn: personUrn,
        scope: 'openid profile w_member_social',
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'platform' })

    // ── Succès ! ────────────────────────────────────────
    return res.redirect(`${APP_URL}/#/social?linkedin=success&name=${encodeURIComponent(personName)}`)

  } catch (err) {
    console.error('LinkedIn OAuth handler error:', err)
    return res.redirect(`${APP_URL}/#/social?linkedin=error&reason=server_error`)
  }
}
