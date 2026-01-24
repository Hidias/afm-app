import { supabase } from './supabase'

/**
 * Génère un code d'accès aléatoire unique
 * @param {number} length - Longueur du code (par défaut 6)
 * @returns {Promise<string>} - Code généré
 */
export async function generateUniqueAccessCode(length = 6) {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Sans I, O, 0, 1 pour éviter confusion
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    // Générer un code aléatoire
    let code = ''
    for (let i = 0; i < length; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    // Vérifier l'unicité dans session_trainees
    const { data: existing } = await supabase
      .from('session_trainees')
      .select('id')
      .eq('access_code', code)
      .single()

    // Si le code n'existe pas, on le retourne
    if (!existing) {
      return code
    }

    attempts++
  }

  // Si on n'a pas trouvé de code unique après 10 tentatives, augmenter la longueur
  return generateUniqueAccessCode(length + 1)
}

/**
 * Génère des codes d'accès pour plusieurs stagiaires
 * @param {Array<string>} traineeIds - IDs des session_trainees
 * @param {string} sessionId - ID de la session
 * @returns {Promise<Object>} - Résultat avec codes générés
 */
export async function generateAccessCodesForTrainees(traineeIds, sessionId) {
  const results = {
    success: [],
    errors: []
  }

  for (const traineeId of traineeIds) {
    try {
      // Générer un code unique
      const code = await generateUniqueAccessCode()

      // Mettre à jour le stagiaire
      const { error } = await supabase
        .from('session_trainees')
        .update({ access_code: code })
        .eq('id', traineeId)
        .eq('session_id', sessionId)

      if (error) throw error

      results.success.push({ traineeId, code })
    } catch (error) {
      console.error('Erreur génération code:', error)
      results.errors.push({ traineeId, error: error.message })
    }
  }

  return results
}

/**
 * Génère un code pour un seul stagiaire
 * @param {string} traineeId - ID du session_trainee
 * @param {string} sessionId - ID de la session
 * @returns {Promise<string>} - Code généré
 */
export async function generateAccessCodeForTrainee(traineeId, sessionId) {
  // Générer un code unique
  const code = await generateUniqueAccessCode()

  // Mettre à jour le stagiaire
  const { error } = await supabase
    .from('session_trainees')
    .update({ access_code: code })
    .eq('id', traineeId)
    .eq('session_id', sessionId)

  if (error) throw error

  return code
}
