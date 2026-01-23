/**
 * GESTION DES STATUTS STAGIAIRES
 * Workflow: registered → confirmed → convoked → info_completed → present → certified
 */

import { supabase } from '../supabase';

export type TraineeStatus = 
  | 'registered'
  | 'confirmed'
  | 'convoked'
  | 'info_completed'
  | 'present'
  | 'certified'
  | 'cancelled';

/**
 * Met à jour le statut d'un stagiaire
 */
export async function updateTraineeStatus(
  sessionId: string,
  traineeId: string,
  newStatus: TraineeStatus
) {
  try {
    const updates: any = { trainee_status: newStatus };

    // Ajouter les timestamps appropriés
    switch (newStatus) {
      case 'convoked':
        updates.convocation_sent_at = new Date().toISOString();
        break;
      case 'info_completed':
        updates.info_completed_at = new Date().toISOString();
        break;
    }

    const { error } = await supabase
      .from('session_trainees')
      .update(updates)
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Met à jour le statut de plusieurs stagiaires
 */
export async function updateMultipleTraineesStatus(
  sessionId: string,
  traineeIds: string[],
  newStatus: TraineeStatus
) {
  try {
    const updates: any = { trainee_status: newStatus };

    switch (newStatus) {
      case 'convoked':
        updates.convocation_sent_at = new Date().toISOString();
        break;
      case 'info_completed':
        updates.info_completed_at = new Date().toISOString();
        break;
    }

    const { error } = await supabase
      .from('session_trainees')
      .update(updates)
      .eq('session_id', sessionId)
      .in('trainee_id', traineeIds);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, count: traineeIds.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Envoie les convocations (change statut à 'convoked')
 */
export async function sendConvocations(sessionId: string) {
  try {
    // Récupérer tous les stagiaires confirmés non convoqués
    const { data: trainees, error: fetchError } = await supabase
      .from('session_trainees')
      .select('trainee_id')
      .eq('session_id', sessionId)
      .eq('trainee_status', 'confirmed')
      .is('convocation_sent_at', null);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!trainees || trainees.length === 0) {
      return { success: true, count: 0 };
    }

    // Mettre à jour tous en une fois
    const { error: updateError } = await supabase
      .from('session_trainees')
      .update({
        trainee_status: 'convoked',
        convocation_sent_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .eq('trainee_status', 'confirmed')
      .is('convocation_sent_at', null);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, count: trainees.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Récupère les stagiaires par statut
 */
export async function getTraineesByStatus(
  sessionId: string,
  status: TraineeStatus
) {
  try {
    const { data, error } = await supabase
      .from('session_trainees')
      .select(`
        *,
        trainee:trainees(first_name, last_name, email, phone),
        group:session_groups(client:clients(name))
      `)
      .eq('session_id', sessionId)
      .eq('trainee_status', status)
      .order('registration_date', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, trainees: data, count: data?.length || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Compte les stagiaires par statut
 */
export async function countTraineesByStatus(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from('session_trainees')
      .select('trainee_status')
      .eq('session_id', sessionId);

    if (error) {
      return { success: false, error: error.message };
    }

    const counts: Record<string, number> = {
      registered: 0,
      confirmed: 0,
      convoked: 0,
      info_completed: 0,
      present: 0,
      certified: 0,
      cancelled: 0
    };

    data?.forEach((t) => {
      if (t.trainee_status) {
        counts[t.trainee_status] = (counts[t.trainee_status] || 0) + 1;
      }
    });

    return { success: true, counts };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Marque les stagiaires comme présents (depuis émargement)
 */
export async function markAsPresent(
  sessionId: string,
  traineeIds: string[]
) {
  try {
    const { error } = await supabase
      .from('session_trainees')
      .update({ trainee_status: 'present' })
      .eq('session_id', sessionId)
      .in('trainee_id', traineeIds);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, count: traineeIds.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Vérifie si un stagiaire peut passer à un certain statut
 */
export async function canChangeStatus(
  sessionId: string,
  traineeId: string,
  targetStatus: TraineeStatus
) {
  try {
    const { data: trainee, error } = await supabase
      .from('session_trainees')
      .select('trainee_status, group_id')
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId)
      .single();

    if (error) {
      return { success: false, can_change: false, error: error.message };
    }

    const currentStatus = trainee.trainee_status;

    // Règles de transition
    const transitions: Record<string, string[]> = {
      registered: ['confirmed', 'cancelled'],
      confirmed: ['convoked', 'cancelled'],
      convoked: ['info_completed', 'cancelled'],
      info_completed: ['present', 'cancelled'],
      present: ['certified'],
      certified: []
    };

    const allowedNext = transitions[currentStatus] || [];
    const can_change = allowedNext.includes(targetStatus);

    // Vérifier conditions spécifiques
    if (targetStatus === 'confirmed' && !trainee.group_id) {
      return {
        success: true,
        can_change: false,
        reason: 'Le stagiaire doit être dans un groupe'
      };
    }

    return {
      success: true,
      can_change,
      current_status: currentStatus,
      allowed_transitions: allowedNext
    };
  } catch (err: any) {
    return { success: false, can_change: false, error: err.message };
  }
}
