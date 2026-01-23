/**
 * VALIDATION DES SEUILS PARTICIPANTS
 */

import { supabase } from '@/lib/supabase';

/**
 * Vérifie si une session atteint le minimum de participants
 */
export async function checkMinParticipants(sessionId: string) {
  try {
    // Récupérer le seuil minimum
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('min_participants')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return { success: false, error: sessionError.message };
    }

    const minRequired = session.min_participants || 4;

    // Compter les participants confirmés
    const { count, error: countError } = await supabase
      .from('session_trainees')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('trainee_status', 'confirmed');

    if (countError) {
      return { success: false, error: countError.message };
    }

    const current = count || 0;
    const isValid = current >= minRequired;
    const missing = Math.max(0, minRequired - current);

    return {
      success: true,
      is_valid: isValid,
      current,
      min_required: minRequired,
      missing
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Vérifie si une session peut accepter plus de participants
 */
export async function checkMaxParticipants(sessionId: string) {
  try {
    // Récupérer le seuil maximum
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('max_participants')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return { success: false, error: sessionError.message };
    }

    const maxAllowed = session.max_participants || 10;

    // Compter tous les participants (sauf annulés)
    const { count, error: countError } = await supabase
      .from('session_trainees')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .neq('trainee_status', 'cancelled');

    if (countError) {
      return { success: false, error: countError.message };
    }

    const current = count || 0;
    const can_add = current < maxAllowed;
    const remaining = Math.max(0, maxAllowed - current);

    return {
      success: true,
      can_add,
      current,
      max_allowed: maxAllowed,
      remaining
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Vérifie si on peut ajouter N participants
 */
export async function canAddParticipants(
  sessionId: string,
  nbToAdd: number
) {
  try {
    const maxCheck = await checkMaxParticipants(sessionId);
    
    if (!maxCheck.success) {
      return { success: false, error: maxCheck.error };
    }

    const can_add = maxCheck.remaining >= nbToAdd;

    return {
      success: true,
      can_add,
      remaining: maxCheck.remaining,
      would_exceed: !can_add
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Met à jour les seuils d'une session
 */
export async function updateSessionThresholds(
  sessionId: string,
  minParticipants?: number,
  maxParticipants?: number
) {
  try {
    const updates: any = {};
    
    if (minParticipants !== undefined) {
      updates.min_participants = minParticipants;
    }
    
    if (maxParticipants !== undefined) {
      // Vérifier qu'on n'a pas déjà plus de participants
      const { count } = await supabase
        .from('session_trainees')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .neq('trainee_status', 'cancelled');

      if ((count || 0) > maxParticipants) {
        return {
          success: false,
          error: `Impossible: ${count} participant(s) déjà inscrit(s)`
        };
      }
      
      updates.max_participants = maxParticipants;
    }

    const { error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Vérifie tous les seuils et retourne un rapport
 */
export async function checkAllThresholds(sessionId: string) {
  try {
    const minCheck = await checkMinParticipants(sessionId);
    const maxCheck = await checkMaxParticipants(sessionId);

    if (!minCheck.success || !maxCheck.success) {
      return {
        success: false,
        error: minCheck.error || maxCheck.error
      };
    }

    const warnings: string[] = [];
    const alerts: string[] = [];

    // Vérifier le minimum
    if (!minCheck.is_valid) {
      alerts.push(
        `Seuil minimum non atteint: ${minCheck.current}/${minCheck.min_required} participants`
      );
    }

    // Vérifier si proche du max
    const fillRate = (maxCheck.current / maxCheck.max_allowed) * 100;
    
    if (fillRate >= 100) {
      alerts.push('Session complète');
    } else if (fillRate >= 90) {
      warnings.push(`Session bientôt complète (${maxCheck.remaining} places restantes)`);
    }

    return {
      success: true,
      min: minCheck,
      max: maxCheck,
      fill_rate: fillRate,
      warnings,
      alerts,
      is_valid: minCheck.is_valid && maxCheck.can_add
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
