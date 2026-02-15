// api/duerp-ai-evaluate.js
// Route Vercel serverless pour l'évaluation IA des risques DUERP
// Deux modes : 'risk' (évaluation d'un risque) et 'unit' (analyse complète d'une unité)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante dans Vercel > Settings > Environment Variables' })
  }

  const { mode, context } = req.body

  if (!mode || !context) {
    return res.status(400).json({ error: 'Paramètres mode et context requis' })
  }

  // ═══════════════════════════════════════════════════════════
  // PROMPT SYSTÈME — Méthodologie INRS
  // ═══════════════════════════════════════════════════════════
  const systemPrompt = `Tu es un expert certifié en prévention des risques professionnels (IPRP) spécialisé dans l'évaluation DUERP selon la méthodologie INRS.

GRILLE DE COTATION OBLIGATOIRE :

FRÉQUENCE D'EXPOSITION (frequence) — entier 1 à 4 :
1 = Occasionnel : quelques fois par mois, tâche ponctuelle
2 = Fréquent : plusieurs fois par jour, tâche régulière
3 = Très fréquent : plusieurs fois par heure, tâche quasi-continue
4 = Permanent : exposition continue, toute la journée

GRAVITÉ DES DOMMAGES (gravite) — entier 1 à 4 :
1 = Minime : premiers soins, incident bénin, gêne passagère
2 = Significatif : accident sans arrêt de travail, lésion légère
3 = Grave : accident avec arrêt de travail, maladie professionnelle
4 = Très grave : incapacité permanente partielle (IPP), décès

NIVEAU DE MAÎTRISE (maitrise) — décimal :
0.5 = Bonne maîtrise : mesures de prévention 100% en place, efficaces et vérifiées
0.75 = Maîtrise partielle : mesures partiellement en place ou non systématiques
1 = Maîtrise insuffisante : pas de mesure de prévention ou mesures inefficaces

CALCUL :
- Risque brut = Fréquence × Gravité (1 à 16)
- Risque résiduel = Fréquence × Gravité × Maîtrise

NIVEAUX :
- Faible (1-4) : acceptable, surveillance
- Moyen (5-8) : à améliorer, actions programmées
- Élevé (9-12) : inacceptable, actions prioritaires
- Critique (13-16) : danger immédiat, actions immédiates

TYPES D'ACTIONS :
- prevention : éliminer ou réduire le danger à la source
- protection : protéger les personnes (EPI, barrières)
- formation : former et informer les salariés
- organisationnelle : adapter l'organisation du travail
- technique : modifier les équipements ou l'environnement

PRIORITÉS :
- critique : danger immédiat, arrêt si nécessaire
- haute : action dans le mois
- moyenne : action dans le trimestre
- basse : amélioration continue

Tu dois TOUJOURS répondre en JSON valide, sans markdown, sans backticks, sans texte avant ou après.
Sois concret, opérationnel, et adapté au secteur d'activité de l'entreprise.
Base tes cotations sur la description terrain fournie, pas sur des hypothèses.`

  try {
    let userMessage = ''

    // ═══════════════════════════════════════════════════════════
    // MODE 1 : Évaluation d'un risque individuel
    // ═══════════════════════════════════════════════════════════
    if (mode === 'risk') {
      userMessage = `Évalue ce risque professionnel et propose des actions correctives.

CONTEXTE ENTREPRISE :
- Secteur : ${context.sector || 'Non précisé'}
- Activité NAF : ${context.naf_code || ''} ${context.naf_label || ''}
- Effectif : ${context.effectif || 'Non précisé'}
- Unité de travail : ${context.unit_name || 'Non précisée'}

RISQUE À ÉVALUER :
- Danger identifié : ${context.danger || ''}
- Catégorie : ${context.category || ''}
- Situation à risque : ${context.situation || ''}
- Conséquences connues : ${context.consequences || ''}
- Prévention existante : ${context.prevention_existante || 'Aucune déclarée'}

DESCRIPTION TERRAIN DE L'ÉVALUATEUR :
"""
${context.description || 'Pas de description terrain fournie'}
"""

Réponds UNIQUEMENT avec ce JSON :
{
  "frequence": <1-4>,
  "gravite": <1-4>,
  "maitrise": <0.5 ou 0.75 ou 1>,
  "justification": {
    "frequence": "<pourquoi ce score>",
    "gravite": "<pourquoi ce score>",
    "maitrise": "<pourquoi ce score>"
  },
  "situation_completee": "<situation à risque reformulée/complétée si besoin>",
  "consequences_completees": "<conséquences reformulées/complétées>",
  "description_travail": "<description du travail réalisé dans cette situation>",
  "actions": [
    {
      "action": "<description concrète de l'action>",
      "type_action": "<prevention|protection|formation|organisationnelle|technique>",
      "priorite": "<critique|haute|moyenne|basse>",
      "cout_estime": "<estimation ou fourchette>",
      "formation_suggeree": "<nom formation si type=formation, sinon null>"
    }
  ]
}`
    }

    // ═══════════════════════════════════════════════════════════
    // MODE 2 : Analyse complète d'une unité de travail
    // ═══════════════════════════════════════════════════════════
    else if (mode === 'unit') {
      const existingRisks = (context.existing_risks || [])
        .map(r => `- ${r.danger} (${r.category || 'sans catégorie'})`)
        .join('\n')

      userMessage = `Analyse cette unité de travail et identifie TOUS les risques professionnels.

CONTEXTE ENTREPRISE :
- Entreprise : ${context.company_name || ''}
- Secteur : ${context.sector || 'Non précisé'}
- Activité NAF : ${context.naf_code || ''} ${context.naf_label || ''}
- Effectif total : ${context.effectif || 'Non précisé'}

UNITÉ DE TRAVAIL :
- Nom : ${context.unit_name || 'Non précisée'}
- Code : ${context.unit_code || ''}
- Effectif unité : ${context.unit_effectif || 'Non précisé'}
- Métiers/postes : ${context.unit_metiers || 'Non précisés'}

RISQUES DÉJÀ IDENTIFIÉS (ne pas re-créer) :
${existingRisks || '(aucun)'}

DESCRIPTION TERRAIN DE L'ÉVALUATEUR :
"""
${context.description || 'Pas de description terrain fournie'}
"""

CATÉGORIES DISPONIBLES (utilise ces codes) :
${(context.available_categories || []).map(c => `${c.code} = ${c.label}`).join('\n')}

Identifie les risques NOUVEAUX (non déjà listés) observés ou déduits de la description terrain.
Pour chaque risque, fournis la cotation et au moins 1 action corrective.

Réponds UNIQUEMENT avec ce JSON :
{
  "analyse_resume": "<résumé de l'analyse en 2-3 phrases>",
  "risques": [
    {
      "danger": "<titre court du danger>",
      "category_code": "<code catégorie parmi la liste>",
      "situation": "<situation à risque détaillée>",
      "consequences": "<conséquences possibles>",
      "description_travail": "<travail réalisé>",
      "frequence": <1-4>,
      "gravite": <1-4>,
      "maitrise": <0.5 ou 0.75 ou 1>,
      "prevention_existante": "<mesures déjà en place si mentionnées>",
      "justification": "<explication courte de la cotation>",
      "actions": [
        {
          "action": "<action concrète>",
          "type_action": "<prevention|protection|formation|organisationnelle|technique>",
          "priorite": "<critique|haute|moyenne|basse>",
          "cout_estime": "<estimation>"
        }
      ]
    }
  ]
}`
    } else {
      return res.status(400).json({ error: `Mode inconnu : ${mode}. Utilisez 'risk' ou 'unit'.` })
    }

    // ═══════════════════════════════════════════════════════════
    // APPEL ANTHROPIC API
    // ═══════════════════════════════════════════════════════════
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return res.status(500).json({ error: 'Erreur API IA : ' + response.status })
    }

    const data = await response.json()
    const text = (data.content || []).map(b => b.text || '').join('')

    // Nettoyage et parsing JSON
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    let result
    try {
      result = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw text:', text)
      return res.status(500).json({
        error: 'Erreur parsing réponse IA',
        raw: text.substring(0, 500)
      })
    }

    return res.status(200).json({ success: true, mode, result })

  } catch (err) {
    console.error('DUERP AI evaluation error:', err)
    return res.status(500).json({ error: 'Erreur serveur : ' + (err.message || '') })
  }
}
