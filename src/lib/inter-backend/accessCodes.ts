/**
 * GESTION DES CODES D'ACCÈS STAGIAIRES
 * Pour le portail inter-entreprise
 */

import { supabase } from '../supabase';

/**
 * Génère un code d'accès unique à 6 chiffres
 */
export async function generateAccessCode(
  sessionId: string,
  traineeId: string
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 10;

    // Générer un code unique
    while (!isUnique && attempts < MAX_ATTEMPTS) {
      code = Math.floor(100000 + Math.random() * 900000).toString();

      // Vérifier l'unicité pour cette session
      const { data: existing } = await supabase
        .from('session_trainees')
        .select('id')
        .eq('session_id', sessionId)
        .eq('access_code', code)
        .maybeSingle();

      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return { success: false, error: 'Impossible de générer un code unique' };
    }

    // Mettre à jour le stagiaire
    const { error } = await supabase
      .from('session_trainees')
      .update({
        access_code: code!,
        code_generated_at: new Date().toISOString(),
        failed_attempts: 0,
        locked_until: null
      })
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, code: code! };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Vérifie un code d'accès
 */
export async function verifyAccessCode(
  sessionId: string,
  code: string
): Promise<{ 
  success: boolean; 
  traineeId?: string; 
  locked?: boolean;
  error?: string;
}> {
  try {
    // Récupérer le stagiaire
    const { data: sessionTrainee, error: fetchError } = await supabase
      .from('session_trainees')
      .select('trainee_id, failed_attempts, locked_until')
      .eq('session_id', sessionId)
      .eq('access_code', code)
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!sessionTrainee) {
      return { success: false, error: 'Code invalide' };
    }

    // Vérifier si le compte est verrouillé
    if (sessionTrainee.locked_until) {
      const lockedUntil = new Date(sessionTrainee.locked_until);
      if (lockedUntil > new Date()) {
        return { 
          success: false, 
          locked: true,
          error: `Compte verrouillé jusqu'à ${lockedUntil.toLocaleString('fr-FR')}`
        };
      }
    }

    // Réinitialiser les tentatives échouées
    await supabase
      .from('session_trainees')
      .update({
        failed_attempts: 0,
        locked_until: null
      })
      .eq('session_id', sessionId)
      .eq('trainee_id', sessionTrainee.trainee_id);

    return { success: true, traineeId: sessionTrainee.trainee_id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Enregistre une tentative échouée
 */
export async function recordFailedAttempt(
  sessionId: string,
  code: string
): Promise<{ locked: boolean }> {
  try {
    const { data: sessionTrainee } = await supabase
      .from('session_trainees')
      .select('trainee_id, failed_attempts')
      .eq('session_id', sessionId)
      .eq('access_code', code)
      .maybeSingle();

    if (!sessionTrainee) {
      return { locked: false };
    }

    const newFailedAttempts = (sessionTrainee.failed_attempts || 0) + 1;
    const MAX_ATTEMPTS = 3;

    // Verrouiller après 3 tentatives
    if (newFailedAttempts >= MAX_ATTEMPTS) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + 30); // Verrouillé 30 min

      await supabase
        .from('session_trainees')
        .update({
          failed_attempts: newFailedAttempts,
          locked_until: lockedUntil.toISOString()
        })
        .eq('session_id', sessionId)
        .eq('trainee_id', sessionTrainee.trainee_id);

      return { locked: true };
    }

    // Incrémenter les tentatives
    await supabase
      .from('session_trainees')
      .update({ failed_attempts: newFailedAttempts })
      .eq('session_id', sessionId)
      .eq('trainee_id', sessionTrainee.trainee_id);

    return { locked: false };
  } catch (err) {
    return { locked: false };
  }
}

/**
 * Génère les codes pour tous les stagiaires d'une session
 */
export async function generateAllAccessCodes(
  sessionId: string
): Promise<{ success: boolean; generated: number; errors: string[] }> {
  try {
    // Récupérer tous les stagiaires sans code
    const { data: trainees, error: fetchError } = await supabase
      .from('session_trainees')
      .select('trainee_id')
      .eq('session_id', sessionId)
      .is('access_code', null);

    if (fetchError) {
      return { success: false, generated: 0, errors: [fetchError.message] };
    }

    if (!trainees || trainees.length === 0) {
      return { success: true, generated: 0, errors: [] };
    }

    const errors: string[] = [];
    let generated = 0;

    // Générer un code pour chaque stagiaire
    for (const trainee of trainees) {
      const result = await generateAccessCode(sessionId, trainee.trainee_id);
      if (result.success) {
        generated++;
      } else {
        errors.push(`Stagiaire ${trainee.trainee_id}: ${result.error}`);
      }
    }

    return { 
      success: errors.length === 0, 
      generated, 
      errors 
    };
  } catch (err: any) {
    return { success: false, generated: 0, errors: [err.message] };
  }
}
