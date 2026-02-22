import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════
// MODULE SOCIAL MEDIA — Access Campus
// Phase 1 : Générateur IA + Calendrier + Médiathèque
// ═══════════════════════════════════════════════════════════

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', icon: '💼', color: 'blue', maxChars: 3000 },
  { id: 'facebook', label: 'Facebook', icon: '📘', color: 'indigo', maxChars: 5000 },
  { id: 'instagram', label: 'Instagram', icon: '📸', color: 'pink', maxChars: 2200 },
  { id: 'gmb', label: 'Google', icon: '📍', color: 'green', maxChars: 1500 },
]

const POST_TYPES = [
  { id: 'expertise', label: '🎓 Expertise terrain', desc: 'Partager un savoir-faire, une anecdote formation' },
  { id: 'stat', label: '📊 Statistique / Résultat', desc: 'Taux de réussite, satisfaction, certifications' },
  { id: 'storytelling', label: '📖 Storytelling', desc: 'Histoire vécue en formation, retour terrain' },
  { id: 'promo', label: '📢 Promotion', desc: 'Nouvelle formation, offre, événement' },
  { id: 'educatif', label: '📚 Éducatif', desc: 'Conseil prévention, réglementation, bonnes pratiques' },
  { id: 'qualiopi', label: '✅ Qualiopi / Qualité', desc: 'Démarche qualité, certification, processus' },
  { id: 'campus', label: '💻 Access Campus', desc: 'Fonctionnalités de la plateforme, innovation' },
]

// Hashtags gérés dynamiquement par l'IA dans le prompt

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────
export default function SocialMedia() {
  const [activeTab, setActiveTab] = useState('generator')
  const [posts, setPosts] = useState([])
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [editingDraft, setEditingDraft] = useState(null)

  // Charger les données au montage
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: postsData } = await supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(50)
      if (postsData) setPosts(postsData)
    } catch (err) {
      console.warn('Erreur chargement posts:', err)
    }
    try {
      const { data: mediaData } = await supabase.from('social_media_library').select('*').order('created_at', { ascending: false }).limit(100)
      if (mediaData) setMedia(mediaData)
    } catch (err) {
      console.warn('Erreur chargement media:', err)
    }
    await loadStats()
    setLoading(false)
  }

  // Stats depuis les sessions pour alimenter l'IA
  const loadStats = async () => {
    try {
      // Sessions avec jointures correctes
      const { data: sessions, error: sessErr } = await supabase
        .from('sessions')
        .select('id, start_date, end_date, location_city, location_name, status, course:courses(title), client:clients(name)')
        .order('start_date', { ascending: false })
        .limit(20)

      if (sessErr) console.warn('Stats sessions:', sessErr.message)

      // Évaluations à chaud pour la note moyenne (moyenne des 6 questions)
      const { data: evals, error: evalErr } = await supabase
        .from('evaluations_hot')
        .select('q1_objectives, q2_content, q3_pedagogy, q4_trainer, q5_organization, q6_materials, submitted_at')
        .not('q1_objectives', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(100)

      if (evalErr) console.warn('Stats évaluations:', evalErr.message)

      const completedSessions = (sessions || []).filter(s => s.status === 'completed' || s.status === 'terminée' || s.status === 'Terminée')
      
      // Calculer la note moyenne sur 5 (moyenne des 6 critères par éval, puis moyenne générale)
      const validEvals = (evals || []).filter(e => e.q1_objectives)
      let avgRating = '4.96'
      if (validEvals.length > 0) {
        const totalAvg = validEvals.reduce((sum, e) => {
          const avg = (e.q1_objectives + e.q2_content + e.q3_pedagogy + e.q4_trainer + e.q5_organization + e.q6_materials) / 6
          return sum + avg
        }, 0) / validEvals.length
        avgRating = totalAvg.toFixed(2)
      }

      const s = {
        recentSessions: (sessions || []).slice(0, 5),
        completedCount: completedSessions.length,
        avgRating,
        totalTrainees: completedSessions.length * 8,
        successRate: '100',
      }
      setStats(s)
      return s
    } catch (err) {
      console.warn('Erreur stats (non bloquant):', err)
      const fallback = { recentSessions: [], completedCount: 0, avgRating: '4.96', totalTrainees: 0, successRate: '100' }
      setStats(fallback)
      return fallback
    }
  }

  const tabs = [
    { id: 'generator', label: '✨ Générateur', count: null },
    { id: 'calendar', label: '📅 Calendrier', count: posts.filter(p => p.status === 'scheduled').length },
    { id: 'library', label: '🖼️ Médiathèque', count: media.length },
    { id: 'drafts', label: '📝 Brouillons', count: posts.filter(p => p.status === 'draft').length },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D35]">📱 Social & Communication</h1>
          <p className="text-sm text-gray-500 mt-1">Générez et planifiez vos publications sur tous vos réseaux</p>
        </div>
        <div className="flex items-center gap-2">
          {PLATFORMS.map(p => (
            <span key={p.id} className="text-lg" title={p.label}>{p.icon}</span>
          ))}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-white text-[#0F2D35] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 bg-[#E9B44C] text-[#0F2D35] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {activeTab === 'generator' && <GeneratorTab stats={stats} onSave={loadData} media={media} editingDraft={editingDraft} onClearDraft={() => setEditingDraft(null)} />}
      {activeTab === 'calendar' && <CalendarTab posts={posts} onUpdate={loadData} />}
      {activeTab === 'library' && <LibraryTab media={media} onUpdate={loadData} />}
      {activeTab === 'drafts' && <DraftsTab posts={posts.filter(p => p.status === 'draft')} onUpdate={loadData} onEdit={(draft) => { setEditingDraft(draft); setActiveTab('generator') }} />}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════
// ONGLET GÉNÉRATEUR IA
// ═══════════════════════════════════════════════════════════
function GeneratorTab({ stats, onSave, media, editingDraft, onClearDraft }) {
  const [postType, setPostType] = useState('expertise')
  const [selectedPlatforms, setSelectedPlatforms] = useState(['linkedin', 'facebook', 'instagram', 'gmb'])
  const [freeInput, setFreeInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedPosts, setGeneratedPosts] = useState(null) // { linkedin: '...', facebook: '...', ... }
  const [editedPosts, setEditedPosts] = useState({})
  const [previewPlatform, setPreviewPlatform] = useState('linkedin')
  const [selectedMedia, setSelectedMedia] = useState([])
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [editingId, setEditingId] = useState(null) // ID du brouillon en cours d'édition

  // ── Charger un brouillon pour édition ────────────────
  useEffect(() => {
    if (editingDraft) {
      const posts = {}
      const platforms = editingDraft.platforms || []
      if (editingDraft.content_linkedin) posts.linkedin = editingDraft.content_linkedin
      if (editingDraft.content_facebook) posts.facebook = editingDraft.content_facebook
      if (editingDraft.content_instagram) posts.instagram = editingDraft.content_instagram
      if (editingDraft.content_gmb) posts.gmb = editingDraft.content_gmb

      setGeneratedPosts(posts)
      setEditedPosts(posts)
      setSelectedPlatforms(platforms)
      setTitle(editingDraft.title || '')
      setPostType(editingDraft.post_type || 'expertise')
      setFreeInput(editingDraft.ai_prompt || '')
      setScheduledAt(editingDraft.scheduled_at ? editingDraft.scheduled_at.slice(0, 16) : '')
      setPreviewPlatform(platforms[0] || 'linkedin')
      setEditingId(editingDraft.id)
      setSelectedMedia((editingDraft.media_urls || []).map(url => ({ file_url: url })))
      onClearDraft?.()
    }
  }, [editingDraft])

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  // ── Génération IA ────────────────────────────────────
  const generateContent = async () => {
    if (selectedPlatforms.length === 0) {
      toast.error('Sélectionnez au moins une plateforme')
      return
    }
    setGenerating(true)
    try {
      const typeInfo = POST_TYPES.find(t => t.id === postType)

      // Contexte enrichi depuis les données Campus
      const contextParts = []
      if (stats) {
        contextParts.push(`Statistiques Access Formation :`)
        contextParts.push(`- Note satisfaction moyenne : ${stats.avgRating}/5`)
        contextParts.push(`- Taux de réussite : ${stats.successRate}%`)
        contextParts.push(`- Sessions terminées récemment : ${stats.completedCount}`)
        if (stats.recentSessions?.length > 0) {
          const recent = stats.recentSessions.slice(0, 3)
          recent.forEach(s => {
            const courseName = s.course?.title || 'Formation'
            const location = s.location_city || s.location_name || 'Bretagne'
            contextParts.push(`- Session "${courseName}" à ${location} (client confidentiel)`)
          })
        }
      }
      contextParts.push(`Certification Qualiopi obtenue en février 2026`)
      contextParts.push(`Habilitation INRS : H37007/2025/SST-1/O/13`)
      contextParts.push(`Zone : Bretagne (22,29,35,56) et Pays de la Loire (44,49,53,72,85)`)
      contextParts.push(`Spécialités : SST, incendie, habilitation électrique, PRAP, gestes & postures, DUERP`)
      contextParts.push(`Approche : ludopédagogie, formations en entreprise, matériel fourni`)

      const systemPrompt = `Tu es un community manager expert pour Access Formation, organisme de formation à la prévention des risques basé à Concarneau en Bretagne. Tu rédiges des posts qui performent sur chaque algorithme.

═══ VOIX DE MARQUE ═══
- TOUJOURS parler en "nous" / "notre" / "nos" — JAMAIS "je" / "mon" / "on"
- Access Formation parle en tant qu'équipe : "Nous intervenons", "Notre approche", "Nos formateurs"
- JAMAIS de signature ("L'équipe AF", "Hicham"...)
- JAMAIS de guillemets fictifs ou de citations inventées
- Inciter à nous contacter : contact@accessformation.pro (naturellement, pas en formule creuse)
- Pas de "N'hésitez pas", "Ne ratez pas", "Ne manquez pas" — formuler positivement

═══ TONALITÉ ═══
- Sémantiquement POSITIF : tourner les phrases de façon affirmative
  ❌ "Ne laissez pas un accident arriver" → ✅ "Chaque geste compte pour protéger vos équipes"
  ❌ "Vos salariés ne savent pas réagir" → ✅ "Vos salariés méritent d'avoir les bons réflexes"
- EXCEPTION : quand on parle d'accident/urgence, être IMPACTANT et direct
  ✅ "Un arrêt cardiaque. 4 minutes pour agir. Vos équipes sont-elles prêtes ?"
- Professionnel mais humain, ancré dans le terrain
- Emojis avec parcimonie (2-3 max par post, jamais en rafale)

═══ LINKEDIN — ALGO 2025 ═══
Objectif : dwell time (temps de lecture) + commentaires
- HOOK en 1ère ligne (visible avant "voir plus") : question percutante OU stat marquante OU affirmation forte
- 1 phrase = 1 ligne (sauts de ligne fréquents pour aérer)
- Texte : 800-1500 caractères
- JAMAIS de lien dans le corps du post (reach divisé par 10)
- Terminer par "🔗 Lien en commentaire" si besoin
- Finir par une QUESTION OUVERTE pour générer des commentaires (l'algo booste les posts qui génèrent des conversations)
- Hashtags : 3-5 MAX, les mettre dans un PREMIER COMMENTAIRE (pas dans le post)
- Donc le post LinkedIn ne contient AUCUN hashtag dans le corps
- Ton : expert terrain qui partage du vécu, pas du corporate
- 📍 Mentionner "Bretagne" ou "Pays de la Loire" pour le reach local

═══ FACEBOOK — ALGO 2025 ═══
Objectif : réactions (❤️ 😮 comptent plus que 👍) + partages
- Texte court : 300-600 caractères
- Ton accessible et local, tutoiement OK
- JAMAIS de lien externe dans le corps (reach divisé par 5)
- Photo native mentionnée > lien avec preview
- Emoji en début de paragraphe pour structurer
- Finir par une QUESTION pour les commentaires
- 3-4 hashtags en fin de post
- 📍 Ancrage local : "en Bretagne", "dans le Finistère", "à Concarneau"

═══ INSTAGRAM — ALGO 2025 ═══
Objectif : saves (enregistrements) + partages en DM
- 1ère phrase = hook visible dans le feed (avant le "...plus")
- Texte : 200-500 caractères (hors hashtags)
- CTA "Enregistre ce post" ou "Envoie-le à un collègue concerné" (le save booste x3)
- Ligne de séparation avec des points avant les hashtags :
  .
  .
  .
- Hashtags : 5-10 pertinents et spécifiques (pas 30 génériques)
  Mix : 3 gros volume (#formation #sécurité) + 3 niche (#SSTFormation #PréventionBretagne) + 2 marque (#AccessFormation)
- Pas de lien (non cliquable) — dire "Lien en bio"
- Ton inspirant et visuel

═══ GOOGLE MY BUSINESS — SEO LOCAL ═══
Objectif : référencement local + conversions
- Très court : 100-250 caractères
- Mots-clés locaux obligatoires : "formation sécurité Bretagne", "SST Concarneau", "prévention risques Finistère"
- CTA direct avec email : "📧 contact@accessformation.pro"
- Pas de hashtags
- Mentionner la certification Qualiopi (facteur de confiance)
- Catégorie : Nouveauté ou Événement

═══ RÈGLES ABSOLUES ═══
- JAMAIS mentionner de noms de clients ou d'entreprises clientes
- JAMAIS inventer de citations entre guillemets
- JAMAIS utiliser "ne pas" / "ne plus" / "ne jamais" sauf contexte accident/urgence
- TOUJOURS "nous" jamais "je" jamais "on" (sauf Facebook où "on" est toléré)
- Contact : contact@accessformation.pro uniquement (PAS de numéro de téléphone)

${contextParts.join('\n')}

Localisation : 📍 Concarneau, Bretagne — Interventions en Bretagne (22,29,35,56) et Pays de la Loire (44,49,53,72,85)
Contact : contact@accessformation.pro | www.accessformation.pro`

      const userPrompt = `Génère un post de type "${typeInfo.label}" pour les plateformes : ${selectedPlatforms.join(', ')}.

${freeInput ? `Idée/contexte spécifique : ${freeInput}` : `Choisis un angle pertinent et original basé sur les données ci-dessus.`}

RAPPEL IMPORTANT :
- LinkedIn : PAS de hashtags dans le post (ils vont en commentaire séparé)
- Toujours parler en "nous", jamais "je"
- Formulations positives, sauf contexte accident où il faut être impactant
- Chaque plateforme a son propre style et sa propre longueur

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de backticks) avec cette structure :
{
  "title": "titre interne court (3-5 mots)",
  ${selectedPlatforms.map(p => `"${p}": "texte du post pour ${p}"`).join(',\n  ')}${selectedPlatforms.includes('linkedin') ? ',\n  "linkedin_hashtags": "3-5 hashtags pour le commentaire LinkedIn"' : ''}
}`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`API ${response.status}: ${err}`)
      }

      const data = await response.json()
      
      // Vérifier si la réponse a été tronquée
      if (data.stop_reason === 'max_tokens') {
        throw new Error('Réponse tronquée — réessayez avec moins de plateformes')
      }
      
      const text = data.content?.[0]?.text || ''

      // Parser le JSON (enlever les backticks si présents)
      const cleanJson = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      let parsed
      try {
        parsed = JSON.parse(cleanJson)
      } catch (jsonErr) {
        console.error('JSON brut reçu:', text)
        throw new Error('L\'IA a renvoyé un JSON invalide — réessayez')
      }

      setGeneratedPosts(parsed)
      setEditedPosts(parsed)
      setTitle(parsed.title || '')

      // Mettre le preview sur la première plateforme sélectionnée
      if (selectedPlatforms.length > 0) {
        setPreviewPlatform(selectedPlatforms[0])
      }

      toast.success('Posts générés !')
    } catch (err) {
      console.error('Erreur génération:', err)
      toast.error('Erreur de génération : ' + err.message)
    }
    setGenerating(false)
  }

  // ── Régénérer une plateforme ─────────────────────────
  const regeneratePlatform = async (platform) => {
    // TODO: appel IA pour régénérer uniquement cette plateforme
    toast('Régénération à venir', { icon: '🔄' })
  }

  // ── Sauvegarder le post ──────────────────────────────
  const savePost = async (status = 'draft') => {
    if (!editedPosts || selectedPlatforms.length === 0) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const postData = {
        title: title || 'Sans titre',
        content_linkedin: editedPosts.linkedin || null,
        content_facebook: editedPosts.facebook || null,
        content_instagram: editedPosts.instagram || null,
        content_gmb: editedPosts.gmb || null,
        media_urls: selectedMedia.map(m => m.file_url),
        platforms: selectedPlatforms,
        status,
        scheduled_at: scheduledAt || null,
        post_type: postType,
        source_type: 'ai',
        ai_prompt: freeInput || null,
        created_by: user?.id,
        updated_at: new Date().toISOString(),
      }

      // Update si on édite un brouillon existant, sinon insert
      if (editingId) {
        const { error } = await supabase.from('social_posts').update(postData).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('social_posts').insert(postData)
        if (error) throw error
      }

      toast.success(
        editingId 
          ? (status === 'draft' ? 'Brouillon mis à jour' : 'Publication planifiée !') 
          : (status === 'draft' ? 'Brouillon enregistré' : 'Publication planifiée !')
      )

      // Reset
      setGeneratedPosts(null)
      setEditedPosts({})
      setFreeInput('')
      setTitle('')
      setScheduledAt('')
      setSelectedMedia([])
      setEditingId(null)

      onSave?.()
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      toast.error('Erreur : ' + err.message)
    }
    setSaving(false)
  }

  // ── Copier le texte dans le presse-papier ────────────
  const copyToClipboard = (platform) => {
    const text = editedPosts[platform]
    if (!text) return
    navigator.clipboard.writeText(text)
    toast.success(`Copié pour ${PLATFORMS.find(p => p.id === platform)?.label} !`)
  }

  return (
    <div className="space-y-4">
      {/* Bandeau si on édite un brouillon */}
      {editingId && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-amber-800">✏️ Édition du brouillon : <strong>{title}</strong></span>
          <button
            onClick={() => {
              setEditingId(null); setGeneratedPosts(null); setEditedPosts({}); setTitle(''); setFreeInput(''); setScheduledAt(''); setSelectedMedia([])
            }}
            className="text-xs bg-white border border-amber-300 text-amber-700 px-3 py-1 rounded-lg hover:bg-amber-100"
          >
            ✕ Annuler l'édition
          </button>
        </div>
      )}

      {/* Étape 1 : Type de post + Plateformes */}
      <div className="bg-white rounded-xl border p-4 space-y-4">
        <h2 className="font-bold text-[#0F2D35]">1️⃣ Quel type de contenu ?</h2>

        {/* Types de post */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {POST_TYPES.map(type => (
            <button
              key={type.id}
              onClick={() => setPostType(type.id)}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                postType === type.id
                  ? 'border-[#E9B44C] bg-amber-50 ring-2 ring-[#E9B44C]/30'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-sm font-medium">{type.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{type.desc}</div>
            </button>
          ))}
        </div>

        {/* Plateformes */}
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Publier sur :</h3>
          <div className="flex gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  selectedPlatforms.includes(p.id)
                    ? `border-${p.color}-400 bg-${p.color}-50 text-${p.color}-700 ring-1 ring-${p.color}-200`
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                <span>{p.icon}</span>
                {p.label}
                {selectedPlatforms.includes(p.id) && <span className="text-green-500">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Input libre */}
        <div>
          <label className="text-sm font-medium text-gray-600">Idée ou contexte (optionnel) :</label>
          <textarea
            value={freeInput}
            onChange={e => setFreeInput(e.target.value)}
            placeholder="Ex: Session SST très dynamique hier à Lorient, les stagiaires ont adoré la mise en situation accident..."
            className="w-full mt-1 border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-[#E9B44C] focus:border-transparent"
            rows={3}
          />
        </div>

        {/* Stats Campus détectées */}
        {stats && (
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            <span className="font-medium text-gray-700">📊 Données Campus disponibles :</span>
            <span className="ml-2">
              {stats.avgRating}/5 satisfaction • {stats.successRate}% réussite • {stats.completedCount} sessions récentes
            </span>
          </div>
        )}

        {/* Bouton Générer */}
        <button
          onClick={generateContent}
          disabled={generating || selectedPlatforms.length === 0}
          className="w-full py-3 bg-gradient-to-r from-[#0F2D35] to-[#1a4a56] text-white rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Génération en cours...
            </>
          ) : (
            <>✨ Générer les posts</>
          )}
        </button>
      </div>

      {/* Étape 2 : Aperçu et édition */}
      {generatedPosts && (
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[#0F2D35]">2️⃣ Aperçu et édition</h2>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titre interne..."
              className="text-sm border rounded-lg px-3 py-1.5 w-64 focus:ring-2 focus:ring-[#E9B44C]"
            />
          </div>

          {/* Sélecteur de plateforme pour preview */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {selectedPlatforms.map(pId => {
              const p = PLATFORMS.find(x => x.id === pId)
              return (
                <button
                  key={pId}
                  onClick={() => setPreviewPlatform(pId)}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                    previewPlatform === pId
                      ? 'bg-white shadow-sm text-[#0F2D35]'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p?.icon} {p?.label}
                  {editedPosts[pId] && (
                    <span className="text-[10px] text-gray-400">({editedPosts[pId].length})</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Zone d'édition */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Éditeur */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  {PLATFORMS.find(p => p.id === previewPlatform)?.icon}{' '}
                  {PLATFORMS.find(p => p.id === previewPlatform)?.label}
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => copyToClipboard(previewPlatform)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md transition-colors"
                    title="Copier"
                  >
                    📋 Copier
                  </button>
                  <button
                    onClick={() => regeneratePlatform(previewPlatform)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md transition-colors"
                    title="Régénérer"
                  >
                    🔄
                  </button>
                </div>
              </div>
              <textarea
                value={editedPosts[previewPlatform] || ''}
                onChange={e => setEditedPosts(prev => ({ ...prev, [previewPlatform]: e.target.value }))}
                className="w-full border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-[#E9B44C] focus:border-transparent font-mono"
                rows={12}
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>
                  {(editedPosts[previewPlatform] || '').length} / {PLATFORMS.find(p => p.id === previewPlatform)?.maxChars} caractères
                </span>
              </div>
              {/* Hashtags LinkedIn à poster en commentaire */}
              {previewPlatform === 'linkedin' && editedPosts.linkedin_hashtags && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center justify-between">
                  <div className="text-xs text-blue-700">
                    <span className="font-medium">💬 Commentaire LinkedIn :</span> {editedPosts.linkedin_hashtags}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(editedPosts.linkedin_hashtags); toast.success('Hashtags copiés !') }}
                    className="text-[10px] bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded-md text-blue-700 ml-2 shrink-0"
                  >
                    📋 Copier
                  </button>
                </div>
              )}
            </div>

            {/* Preview visuel */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">👁️ Aperçu</label>
              <PostPreview
                platform={previewPlatform}
                content={editedPosts[previewPlatform] || ''}
                media={selectedMedia}
              />
            </div>
          </div>

          {/* Médias */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">📷 Photos / Médias</h3>
            <div className="flex gap-2 flex-wrap">
              {selectedMedia.map((m, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                  <img src={m.file_url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setSelectedMedia(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-bl-md"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <MediaPicker
                media={media}
                selected={selectedMedia}
                onSelect={(m) => setSelectedMedia(prev => [...prev, m])}
              />
            </div>
          </div>

          {/* Planification + Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t">
            <div className="flex-1">
              <label className="text-xs text-gray-500">📅 Planifier pour :</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#E9B44C]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => savePost('draft')}
                disabled={saving}
                className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-300 disabled:opacity-50 transition-colors"
              >
                📝 Brouillon
              </button>
              <button
                onClick={() => savePost(scheduledAt ? 'scheduled' : 'draft')}
                disabled={saving || !scheduledAt}
                className="px-5 py-2.5 bg-[#E9B44C] text-[#0F2D35] rounded-xl text-sm font-bold hover:bg-[#d4a43e] disabled:opacity-50 transition-colors"
              >
                {saving ? '⏳...' : '📅 Planifier'}
              </button>
              {/* Bouton copier tout */}
              <button
                onClick={() => {
                  const allTexts = selectedPlatforms
                    .map(pId => {
                      let text = `=== ${PLATFORMS.find(p => p.id === pId)?.label?.toUpperCase()} ===\n${editedPosts[pId] || ''}`
                      if (pId === 'linkedin' && editedPosts.linkedin_hashtags) {
                        text += `\n\n--- COMMENTAIRE LINKEDIN ---\n${editedPosts.linkedin_hashtags}`
                      }
                      return text
                    })
                    .join('\n\n')
                  navigator.clipboard.writeText(allTexts)
                  toast.success('Tous les posts copiés !')
                }}
                className="px-5 py-2.5 bg-[#0F2D35] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-colors"
              >
                📋 Tout copier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════
// PREVIEW DE POST
// ═══════════════════════════════════════════════════════════
function PostPreview({ platform, content, media }) {
  if (!content) return <div className="text-sm text-gray-400 italic p-4">Aucun contenu</div>

  const platformStyles = {
    linkedin: { bg: 'bg-white', border: 'border-gray-200', accent: '#0a66c2', name: 'Access Formation', subtitle: 'Organisme de formation • Concarneau' },
    facebook: { bg: 'bg-white', border: 'border-gray-200', accent: '#1877f2', name: 'Access Formation', subtitle: 'Organisme de formation' },
    instagram: { bg: 'bg-white', border: 'border-gray-200', accent: '#e4405f', name: 'accessformation', subtitle: '' },
    gmb: { bg: 'bg-white', border: 'border-gray-200', accent: '#4285f4', name: 'Access Formation', subtitle: 'Concarneau, Bretagne' },
  }

  const style = platformStyles[platform] || platformStyles.linkedin

  return (
    <div className={`${style.bg} border ${style.border} rounded-xl overflow-hidden shadow-sm`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-100">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: style.accent }}>
          AF
        </div>
        <div>
          <div className="font-semibold text-sm">{style.name}</div>
          <div className="text-[10px] text-gray-500">{style.subtitle}</div>
        </div>
      </div>

      {/* Image si présente */}
      {media?.length > 0 && (
        <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
          <img src={media[0].file_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Contenu */}
      <div className="p-3">
        <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ maxHeight: '200px', overflow: 'auto' }}>
          {content}
        </p>
      </div>

      {/* Footer mock */}
      <div className="px-3 pb-3 flex items-center gap-4 text-[10px] text-gray-400">
        {platform === 'linkedin' && <><span>👍 J'aime</span><span>💬 Commenter</span><span>🔄 Partager</span></>}
        {platform === 'facebook' && <><span>👍 J'aime</span><span>💬 Commenter</span><span>↗️ Partager</span></>}
        {platform === 'instagram' && <><span>❤️</span><span>💬</span><span>📤</span><span>🔖</span></>}
        {platform === 'gmb' && <><span>📞 Appeler</span><span>🗺️ Itinéraire</span><span>🌐 Site web</span></>}
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════
// SÉLECTEUR DE MÉDIAS
// ═══════════════════════════════════════════════════════════
function MediaPicker({ media, selected, onSelect }) {
  const [showPicker, setShowPicker] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploading(true)
    for (const file of files) {
      try {
        const fileName = `social/${Date.now()}_${file.name}`
        const { data, error } = await supabase.storage.from('media').upload(fileName, file)
        if (error) throw error

        const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName)
        const fileUrl = urlData.publicUrl

        // Sauvegarder dans la médiathèque
        const { data: mediaData, error: mediaError } = await supabase.from('social_media_library').insert({
          file_url: fileUrl,
          file_name: file.name,
          file_type: file.type.startsWith('video') ? 'video' : 'image',
          file_size: file.size,
        }).select().single()

        if (mediaError) throw mediaError
        onSelect(mediaData)
        toast.success(`${file.name} uploadé !`)
      } catch (err) {
        console.error('Erreur upload:', err)
        toast.error(`Erreur upload ${file.name}`)
      }
    }
    setUploading(false)
  }

  return (
    <div className="relative">
      <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#E9B44C] hover:bg-amber-50 transition-all">
        {uploading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
        ) : (
          <>
            <span className="text-lg">➕</span>
            <span className="text-[8px] text-gray-400">Photo</span>
          </>
        )}
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
      </label>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════
// ONGLET CALENDRIER
// ═══════════════════════════════════════════════════════════
function CalendarTab({ posts, onUpdate }) {
  const scheduledPosts = posts.filter(p => p.status === 'scheduled' || p.status === 'published')

  // Grouper par semaine
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + 1) // Lundi
  weekStart.setHours(0, 0, 0, 0)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  const getPostsForDay = (day) => {
    return scheduledPosts.filter(p => {
      if (!p.scheduled_at) return false
      const postDate = new Date(p.scheduled_at)
      return postDate.toDateString() === day.toDateString()
    })
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-[#0F2D35]">📅 Semaine du {weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</h2>
        <div className="flex gap-1">
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ Publié</span>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">📅 Planifié</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const dayPosts = getPostsForDay(day)
          const isToday = day.toDateString() === now.toDateString()
          return (
            <div key={i} className={`border rounded-lg p-2 min-h-[120px] ${isToday ? 'border-[#E9B44C] bg-amber-50/50' : 'border-gray-200'}`}>
              <div className={`text-xs font-medium mb-1 ${isToday ? 'text-[#E9B44C]' : 'text-gray-500'}`}>
                {dayNames[i]} {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayPosts.map(p => (
                  <div
                    key={p.id}
                    className={`text-[10px] p-1.5 rounded-md cursor-pointer hover:opacity-80 ${
                      p.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}
                    title={p.title}
                  >
                    <div className="font-medium truncate">{p.title || 'Sans titre'}</div>
                    <div className="flex gap-0.5 mt-0.5">
                      {p.platforms?.map(pl => (
                        <span key={pl}>{PLATFORMS.find(x => x.id === pl)?.icon}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {dayPosts.length === 0 && (
                  <div className="text-[10px] text-gray-300 italic">—</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {scheduledPosts.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm">Aucune publication planifiée</p>
          <p className="text-xs">Utilisez le générateur pour créer vos premiers posts !</p>
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════
// ONGLET MÉDIATHÈQUE
// ═══════════════════════════════════════════════════════════
function LibraryTab({ media, onUpdate }) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploading(true)
    let count = 0
    for (const file of files) {
      try {
        const fileName = `social/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('media').upload(fileName, file)
        if (upErr) throw upErr

        const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName)

        await supabase.from('social_media_library').insert({
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type.startsWith('video') ? 'video' : 'image',
          file_size: file.size,
        })
        count++
      } catch (err) {
        console.error('Erreur upload:', err)
      }
    }
    toast.success(`${count} fichier(s) uploadé(s)`)
    setUploading(false)
    onUpdate?.()
  }

  const deleteMedia = async (id, fileUrl) => {
    if (!confirm('Supprimer cette image ?')) return
    try {
      await supabase.from('social_media_library').delete().eq('id', id)
      toast.success('Supprimé')
      onUpdate?.()
    } catch (err) {
      toast.error('Erreur suppression')
    }
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-[#0F2D35]">🖼️ Médiathèque</h2>
        <label className="bg-[#0F2D35] text-white text-sm px-4 py-2 rounded-lg cursor-pointer hover:opacity-90 transition-colors">
          {uploading ? '⏳ Upload...' : '➕ Ajouter des photos'}
          <input type="file" accept="image/*,video/*" multiple onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {media.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">📷</div>
          <p className="text-sm font-medium">Pas encore de médias</p>
          <p className="text-xs mt-1">Uploadez vos photos de formations, logos, visuels pour les réutiliser dans vos posts</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {media.map(m => (
            <div key={m.id} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer">
              <img src={m.file_url} alt={m.file_name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                <button
                  onClick={() => deleteMedia(m.id, m.file_url)}
                  className="opacity-0 group-hover:opacity-100 bg-red-500 text-white text-xs px-2 py-1 rounded-md transition-all"
                >
                  🗑️
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] p-1 truncate opacity-0 group-hover:opacity-100 transition-all">
                {m.file_name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════
// ONGLET BROUILLONS
// ═══════════════════════════════════════════════════════════
function DraftsTab({ posts, onUpdate, onEdit }) {
  const deleteDraft = async (id) => {
    if (!confirm('Supprimer ce brouillon ?')) return
    await supabase.from('social_posts').delete().eq('id', id)
    toast.success('Brouillon supprimé')
    onUpdate?.()
  }

  const copyPost = (post, platform) => {
    const content = post[`content_${platform}`]
    if (!content) return
    navigator.clipboard.writeText(content)
    toast.success(`Copié pour ${PLATFORMS.find(p => p.id === platform)?.label} !`)
  }

  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
        <div className="text-3xl mb-2">📝</div>
        <p className="text-sm">Aucun brouillon</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {posts.map(post => (
        <div key={post.id} className="bg-white rounded-xl border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-sm">{post.title || 'Sans titre'}</span>
              <span className="text-[10px] text-gray-400 ml-2">
                {new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {post.platforms?.map(pl => (
                <span key={pl}>{PLATFORMS.find(x => x.id === pl)?.icon}</span>
              ))}
              <button onClick={() => deleteDraft(post.id)} className="ml-2 text-red-400 hover:text-red-600 text-sm">🗑️</button>
            </div>
          </div>

          {/* Preview du contenu */}
          <div className="text-xs text-gray-600 line-clamp-3">
            {post.content_linkedin || post.content_facebook || post.content_instagram || post.content_gmb || 'Aucun contenu'}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 pt-1">
            <button
              onClick={() => onEdit?.(post)}
              className="text-[10px] bg-[#E9B44C] text-[#0F2D35] font-bold px-3 py-1.5 rounded-md hover:bg-[#d4a43e] transition-colors"
            >
              ✏️ Reprendre
            </button>
            {post.platforms?.map(pl => (
              <button
                key={pl}
                onClick={() => copyPost(post, pl)}
                className="text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md transition-colors"
              >
                📋 {PLATFORMS.find(x => x.id === pl)?.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
