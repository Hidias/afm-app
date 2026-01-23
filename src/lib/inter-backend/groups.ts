/**
 * GESTION DES GROUPES INTER-ENTREPRISE
 */

import { supabase } from '@/lib/supabase';

export interface CreateGroupData {
  session_id: string;
  client_id: string;
  contact_id?: string;
  nb_personnes: number;
  price_per_person: number;
  notes?: string;
}

/**
 * Crée un nouveau groupe
 */
export async function createGroup(data: CreateGroupData) {
  try {
    const price_total = data.nb_personnes * data.price_per_person;

    const { data: group, error } = await supabase
      .from('session_groups')
      .insert({
        session_id: data.session_id,
        client_id: data.client_id,
        contact_id: data.contact_id,
        nb_personnes: data.nb_personnes,
        price_per_person: data.price_per_person,
        price_total: price_total,
        payment_status: 'pending',
        status: 'pending',
        notes: data.notes
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, group };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Ajoute un stagiaire à un groupe
 */
export async function addTraineeToGroup(
  groupId: string,
  traineeId: string,
  sessionId: string
) {
  try {
    // Vérifier que le groupe a de la place
    const { data: group, error: groupError } = await supabase
      .from('session_groups')
      .select('nb_personnes')
      .eq('id', groupId)
      .single();

    if (groupError) {
      return { success: false, error: groupError.message };
    }

    // Compter les stagiaires dans le groupe
    const { count } = await supabase
      .from('session_trainees')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    if ((count || 0) >= group.nb_personnes) {
      return { success: false, error: 'Le groupe est complet' };
    }

    // Ajouter le stagiaire
    const { error: updateError } = await supabase
      .from('session_trainees')
      .update({ 
        group_id: groupId,
        trainee_status: 'registered'
      })
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Retire un stagiaire d'un groupe
 */
export async function removeTraineeFromGroup(
  traineeId: string,
  sessionId: string
) {
  try {
    const { error } = await supabase
      .from('session_trainees')
      .update({ 
        group_id: null,
        trainee_status: 'registered'
      })
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
 * Met à jour le nombre de personnes d'un groupe
 */
export async function updateGroupSize(
  groupId: string,
  newSize: number
) {
  try {
    // Vérifier qu'il n'y a pas plus de stagiaires que la nouvelle taille
    const { count } = await supabase
      .from('session_trainees')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    if ((count || 0) > newSize) {
      return { 
        success: false, 
        error: `Impossible: ${count} stagiaire(s) déjà dans le groupe` 
      };
    }

    // Récupérer le prix unitaire
    const { data: group, error: fetchError } = await supabase
      .from('session_groups')
      .select('price_per_person')
      .eq('id', groupId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const newTotal = newSize * group.price_per_person;

    // Mettre à jour
    const { error: updateError } = await supabase
      .from('session_groups')
      .update({
        nb_personnes: newSize,
        price_total: newTotal
      })
      .eq('id', groupId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, new_total: newTotal };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Met à jour le prix unitaire d'un groupe
 */
export async function updateGroupPrice(
  groupId: string,
  newPricePerPerson: number
) {
  try {
    const { data: group, error: fetchError } = await supabase
      .from('session_groups')
      .select('nb_personnes')
      .eq('id', groupId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const newTotal = group.nb_personnes * newPricePerPerson;

    const { error: updateError } = await supabase
      .from('session_groups')
      .update({
        price_per_person: newPricePerPerson,
        price_total: newTotal
      })
      .eq('id', groupId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, new_total: newTotal };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Confirme un groupe (paiement reçu)
 */
export async function confirmGroup(groupId: string) {
  try {
    const { error } = await supabase
      .from('session_groups')
      .update({
        status: 'confirmed',
        payment_status: 'confirmed'
      })
      .eq('id', groupId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Confirmer tous les stagiaires du groupe
    const { error: traineeError } = await supabase
      .from('session_trainees')
      .update({ trainee_status: 'confirmed' })
      .eq('group_id', groupId)
      .eq('trainee_status', 'registered');

    if (traineeError) {
      return { success: false, error: traineeError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Annule un groupe
 */
export async function cancelGroup(groupId: string, reason?: string) {
  try {
    const { error } = await supabase
      .from('session_groups')
      .update({
        status: 'cancelled',
        notes: reason
      })
      .eq('id', groupId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Annuler tous les stagiaires du groupe
    const { error: traineeError } = await supabase
      .from('session_trainees')
      .update({ 
        trainee_status: 'cancelled',
        group_id: null
      })
      .eq('group_id', groupId);

    if (traineeError) {
      return { success: false, error: traineeError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Récupère tous les groupes d'une session
 */
export async function getSessionGroups(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from('session_groups')
      .select(`
        *,
        client:clients(name, siret),
        contact:contacts(first_name, last_name, email)
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, groups: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Récupère les stagiaires d'un groupe
 */
export async function getGroupTrainees(groupId: string) {
  try {
    const { data, error } = await supabase
      .from('session_trainees')
      .select(`
        *,
        trainee:trainees(first_name, last_name, email)
      `)
      .eq('group_id', groupId)
      .order('registration_date', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, trainees: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
