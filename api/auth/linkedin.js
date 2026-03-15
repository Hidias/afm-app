// ═══════════════════════════════════════════════════════════
// VERCEL API ROUTE — OAuth LinkedIn
// GET /api/auth/linkedin?action=connect (initie le flow OAuth)
// GET /api/auth/linkedin?code=... (callback après auth)
// Scope : rw_organization_social (poster depuis la page entreprise)
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

      // Scope Community Management API uniquement :
      // rw_organization_social = poster + lire depuis la page entreprise
      // (Sign In with LinkedIn et w_member_social non requis pour la page entreprise)
      const scope = 'r_organization_social w_organization_social'
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

    // ── Étape 3 : Pas de profil utilisateur (Sign In with LinkedIn non activé) ─
    // On récupère directement les pages entreprise sans passer par le profil
    const personUrn = null
    const personName = null

    // ── Étape 4 : Récupérer les pages entreprise administrées ─
    let orgUrn = null
    let orgName = null

    try {
      // Récupérer les organisations où l'utilisateur est ADMINISTRATOR
      const aclRes = await fetch(
        'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=10',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202401',
          },
        }
      )
      const aclData = await aclRes.json()
      console.log('[linkedin] Org ACLs:', JSON.stringify(aclData).slice(0, 500))

      const elements = aclData.elements || []
      if (elements.length > 0) {
        // Prendre la première organisation (Access Formation)
        orgUrn = elements[0].organizationalTarget
        console.log('[linkedin] Org URN:', orgUrn)

        // Récupérer le nom de la page entreprise
        if (orgUrn) {
          const orgId = orgUrn.replace('urn:li:organization:', '')
          try {
            const orgRes = await fetch(
              `https://api.linkedin.com/v2/organizations/${orgId}?fields=localizedName,vanityName`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'X-Restli-Protocol-Version': '2.0.0',
                  'LinkedIn-Version': '202401',
                },
              }
            )
            const orgData = await orgRes.json()
            console.log('[linkedin] Org details:', JSON.stringify(orgData).slice(0, 300))
            orgName = orgData.localizedName || orgData.vanityName || 'Access Formation'
          } catch (orgErr) {
            console.warn('[linkedin] Org name fetch error:', orgErr.message)
            orgName = 'Access Formation'
          }
        }
      } else {
        console.warn('[linkedin] Aucune page entreprise trouvée pour cet utilisateur')
      }
    } catch (aclErr) {
      console.warn('[linkedin] ACL fetch error:', aclErr.message)
    }

    // Si pas de page entreprise trouvée, bloquer la connexion
    if (!orgUrn) {
      console.error('[linkedin] Aucune page entreprise admin trouvée')
      return res.redirect(`${APP_URL}/#/social?linkedin=error&reason=no_org_page`)
    }

    console.log('[linkedin] Org:', orgName, 'URN:', orgUrn)

    // ── Étape 5 : Stocker dans Supabase ─────────────────
    // page_id = URN de la page entreprise (urn:li:organization:XXXXX)
    // account_id = URN de la personne admin (urn:li:person:XXXXX)
    await supabase.from('social_tokens').upsert({
      platform: 'linkedin',
      access_token: accessToken,
      refresh_token: null, // LinkedIn OAuth 2.0 standard n'a pas de refresh token
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      page_id: orgUrn,      // URN page entreprise — utilisé comme author dans les posts
      account_id: personUrn, // URN profil admin — pour référence
      metadata: {
        org_name: orgName,
        org_urn: orgUrn,
        person_name: personName,
        person_urn: personUrn,
        scope: 'r_organization_social w_organization_social',
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'platform' })

    // ── Succès ! ────────────────────────────────────────
    return res.redirect(
      `${APP_URL}/#/social?linkedin=success&page=${encodeURIComponent(orgName || 'Access Formation')}`
    )

  } catch (err) {
    console.error('LinkedIn OAuth handler error:', err)
    return res.redirect(`${APP_URL}/#/social?linkedin=error&reason=server_error`)
  }
}
