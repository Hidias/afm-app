/**
 * CALCULS FINANCIERS INTER-ENTREPRISE
 */

import { supabase } from '@/lib/supabase';

/**
 * Calcule le CA total d'une session
 */
export async function calculateSessionRevenue(sessionId: string) {
  try {
    const { data: groups, error } = await supabase
      .from('session_groups')
      .select('price_total, payment_status, status')
      .eq('session_id', sessionId);

    if (error) {
      return { success: false, error: error.message };
    }

    const revenue = {
      total: 0,          // Tous les groupes
      confirmed: 0,      // Groupes confirmés
      paid: 0,           // Paiements reçus
      pending: 0,        // Paiements en attente
      cancelled: 0       // Groupes annulés
    };

    groups?.forEach((group) => {
      const amount = group.price_total || 0;
      
      revenue.total += amount;

      if (group.status === 'cancelled') {
        revenue.cancelled += amount;
      } else if (group.status === 'confirmed') {
        revenue.confirmed += amount;
        
        if (group.payment_status === 'confirmed') {
          revenue.paid += amount;
        } else {
          revenue.pending += amount;
        }
      }
    });

    return { success: true, revenue };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Calcule le CA d'un client pour une session
 */
export async function calculateClientRevenue(
  sessionId: string,
  clientId: string
) {
  try {
    const { data: groups, error } = await supabase
      .from('session_groups')
      .select('price_total, payment_status, status')
      .eq('session_id', sessionId)
      .eq('client_id', clientId);

    if (error) {
      return { success: false, error: error.message };
    }

    const revenue = {
      total: 0,
      paid: 0,
      pending: 0
    };

    groups?.forEach((group) => {
      const amount = group.price_total || 0;
      revenue.total += amount;
      
      if (group.status === 'confirmed') {
        if (group.payment_status === 'confirmed') {
          revenue.paid += amount;
        } else {
          revenue.pending += amount;
        }
      }
    });

    return { success: true, revenue };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Calcule les statistiques financières globales
 */
export async function getFinancialStats(sessionId: string) {
  try {
    const { data: stats, error } = await supabase
      .from('sessions_inter_stats')
      .select('ca_confirmed, ca_total, nb_confirmed, nb_total')
      .eq('id', sessionId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Calculer le prix moyen par personne
    const avgPricePerPerson = stats.nb_confirmed > 0 
      ? stats.ca_confirmed / stats.nb_confirmed 
      : 0;

    // Calculer le taux de remplissage
    const { data: session } = await supabase
      .from('sessions')
      .select('max_participants')
      .eq('id', sessionId)
      .single();

    const fillRate = session?.max_participants 
      ? (stats.nb_confirmed / session.max_participants) * 100
      : 0;

    return { 
      success: true, 
      stats: {
        ...stats,
        avg_price_per_person: avgPricePerPerson,
        fill_rate: fillRate
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Vérifie si un paiement est complet pour un groupe
 */
export async function isGroupPaid(groupId: string) {
  try {
    const { data: group, error } = await supabase
      .from('session_groups')
      .select('payment_status')
      .eq('id', groupId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      is_paid: group.payment_status === 'confirmed' 
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Récupère les groupes avec paiement en attente
 */
export async function getPendingPayments(sessionId: string) {
  try {
    const { data: groups, error } = await supabase
      .from('session_groups')
      .select(`
        *,
        client:clients(name, siret),
        contact:contacts(first_name, last_name, email, phone)
      `)
      .eq('session_id', sessionId)
      .eq('status', 'confirmed')
      .neq('payment_status', 'confirmed')
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const total = groups?.reduce((sum, g) => sum + (g.price_total || 0), 0) || 0;

    return { 
      success: true, 
      groups,
      total_pending: total,
      count: groups?.length || 0
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Génère un rapport financier pour une session
 */
export async function generateFinancialReport(sessionId: string) {
  try {
    // 1. Récupérer les infos de session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        reference,
        start_date,
        course:courses(title, code)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return { success: false, error: sessionError.message };
    }

    // 2. CA global
    const revenueResult = await calculateSessionRevenue(sessionId);
    if (!revenueResult.success) {
      return { success: false, error: revenueResult.error };
    }

    // 3. Groupes par client
    const { data: groups, error: groupsError } = await supabase
      .from('session_groups')
      .select(`
        *,
        client:clients(name, siret)
      `)
      .eq('session_id', sessionId)
      .order('client_id', { ascending: true });

    if (groupsError) {
      return { success: false, error: groupsError.message };
    }

    // Agréger par client
    const clientStats: Record<string, any> = {};
    
    groups?.forEach((group) => {
      const clientId = group.client_id;
      
      if (!clientStats[clientId]) {
        clientStats[clientId] = {
          client_name: group.client?.name || 'N/A',
          nb_groups: 0,
          nb_personnes: 0,
          total: 0,
          paid: 0,
          pending: 0
        };
      }

      clientStats[clientId].nb_groups++;
      clientStats[clientId].nb_personnes += group.nb_personnes || 0;
      clientStats[clientId].total += group.price_total || 0;
      
      if (group.payment_status === 'confirmed') {
        clientStats[clientId].paid += group.price_total || 0;
      } else if (group.status === 'confirmed') {
        clientStats[clientId].pending += group.price_total || 0;
      }
    });

    return {
      success: true,
      report: {
        session: {
          reference: session.reference,
          start_date: session.start_date,
          course: session.course
        },
        revenue: revenueResult.revenue,
        clients: Object.values(clientStats),
        nb_groups: groups?.length || 0
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
