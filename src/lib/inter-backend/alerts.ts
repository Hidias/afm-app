/**
 * GESTION DES ALERTES SESSION
 */

import { supabase } from '../supabase';
import { checkMinParticipants } from './validation';

export type AlertType = 
  | 'min_not_reached'
  | 'max_reached'
  | 'pending_payments'
  | 'missing_infos'
  | 'convocation_due'
  | 'session_soon';

/**
 * Crée une nouvelle alerte
 */
export async function createAlert(
  sessionId: string,
  alertType: AlertType,
  message: string
) {
  try {
    const { error } = await supabase
      .from('session_alerts')
      .insert({
        session_id: sessionId,
        alert_type: alertType,
        message: message,
        status: 'pending'
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Résout une alerte
 */
export async function resolveAlert(alertId: string) {
  try {
    const { error } = await supabase
      .from('session_alerts')
      .update({ 
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Supprime une alerte
 */
export async function dismissAlert(alertId: string) {
  try {
    const { error } = await supabase
      .from('session_alerts')
      .delete()
      .eq('id', alertId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Récupère toutes les alertes actives pour une session
 */
export async function getActiveAlerts(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from('session_alerts')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, alerts: data, count: data?.length || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Vérifie toutes les conditions et crée les alertes nécessaires
 */
export async function checkAndCreateAlerts(sessionId: string) {
  try {
    const alerts: string[] = [];

    // 1. Vérifier le minimum de participants
    const minCheck = await checkMinParticipants(sessionId);
    if (minCheck.success && !minCheck.is_valid) {
      // Vérifier si l'alerte existe déjà
      const { data: existing } = await supabase
        .from('session_alerts')
        .select('id')
        .eq('session_id', sessionId)
        .eq('alert_type', 'min_not_reached')
        .eq('status', 'pending')
        .maybeSingle();

      if (!existing) {
        await createAlert(
          sessionId,
          'min_not_reached',
          `Seuil minimum non atteint: ${minCheck.current}/${minCheck.min_required} participants`
        );
        alerts.push('min_not_reached');
      }
    }

    // 2. Vérifier les paiements en attente
    const { data: unpaidGroups } = await supabase
      .from('session_groups')
      .select('id, client_id, price_total')
      .eq('session_id', sessionId)
      .eq('status', 'confirmed')
      .neq('payment_status', 'confirmed');

    if (unpaidGroups && unpaidGroups.length > 0) {
      const { data: existing } = await supabase
        .from('session_alerts')
        .select('id')
        .eq('session_id', sessionId)
        .eq('alert_type', 'pending_payments')
        .eq('status', 'pending')
        .maybeSingle();

      if (!existing) {
        const totalPending = unpaidGroups.reduce(
          (sum, g) => sum + (g.price_total || 0), 
          0
        );
        await createAlert(
          sessionId,
          'pending_payments',
          `${unpaidGroups.length} groupe(s) avec paiement en attente (${totalPending}€)`
        );
        alerts.push('pending_payments');
      }
    }

    // 3. Vérifier les infos manquantes
    const { data: incompleteTrainees } = await supabase
      .from('session_trainees')
      .select('trainee_id')
      .eq('session_id', sessionId)
      .in('trainee_status', ['confirmed', 'convoked'])
      .is('info_completed_at', null);

    if (incompleteTrainees && incompleteTrainees.length > 0) {
      const { data: existing } = await supabase
        .from('session_alerts')
        .select('id')
        .eq('session_id', sessionId)
        .eq('alert_type', 'missing_infos')
        .eq('status', 'pending')
        .maybeSingle();

      if (!existing) {
        await createAlert(
          sessionId,
          'missing_infos',
          `${incompleteTrainees.length} stagiaire(s) n'ont pas complété leurs informations`
        );
        alerts.push('missing_infos');
      }
    }

    // 4. Vérifier si session proche (7 jours)
    const { data: session } = await supabase
      .from('sessions')
      .select('start_date')
      .eq('id', sessionId)
      .single();

    if (session) {
      const startDate = new Date(session.start_date);
      const now = new Date();
      const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil <= 7 && daysUntil > 0) {
        const { data: existing } = await supabase
          .from('session_alerts')
          .select('id')
          .eq('session_id', sessionId)
          .eq('alert_type', 'session_soon')
          .eq('status', 'pending')
          .maybeSingle();

        if (!existing) {
          await createAlert(
            sessionId,
            'session_soon',
            `Session dans ${daysUntil} jour(s)`
          );
          alerts.push('session_soon');
        }
      }
    }

    return { success: true, alerts };
  } catch (err: any) {
    return { success: false, alerts: [], error: err.message };
  }
}

/**
 * Nettoie les alertes obsolètes
 */
export async function cleanupAlerts(sessionId: string) {
  try {
    let cleaned = 0;

    // 1. Supprimer les alertes "min_not_reached" si le minimum est atteint
    const minCheck = await checkMinParticipants(sessionId);
    if (minCheck.success && minCheck.is_valid) {
      const { error } = await supabase
        .from('session_alerts')
        .delete()
        .eq('session_id', sessionId)
        .eq('alert_type', 'min_not_reached')
        .eq('status', 'pending');

      if (!error) cleaned++;
    }

    // 2. Supprimer les alertes "pending_payments" si tous les paiements sont confirmés
    const { count } = await supabase
      .from('session_groups')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('status', 'confirmed')
      .neq('payment_status', 'confirmed');

    if (count === 0) {
      const { error } = await supabase
        .from('session_alerts')
        .delete()
        .eq('session_id', sessionId)
        .eq('alert_type', 'pending_payments')
        .eq('status', 'pending');

      if (!error) cleaned++;
    }

    // 3. Supprimer les alertes "missing_infos" si toutes les infos sont complètes
    const { count: missingCount } = await supabase
      .from('session_trainees')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .in('trainee_status', ['confirmed', 'convoked'])
      .is('info_completed_at', null);

    if (missingCount === 0) {
      const { error } = await supabase
        .from('session_alerts')
        .delete()
        .eq('session_id', sessionId)
        .eq('alert_type', 'missing_infos')
        .eq('status', 'pending');

      if (!error) cleaned++;
    }

    return { success: true, cleaned };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Récupère un résumé des alertes par type
 */
export async function getAlertsSummary(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from('session_alerts')
      .select('alert_type, status')
      .eq('session_id', sessionId);

    if (error) {
      return { success: false, error: error.message };
    }

    const summary: Record<string, { pending: number; resolved: number }> = {};

    data?.forEach((alert) => {
      if (!summary[alert.alert_type]) {
        summary[alert.alert_type] = { pending: 0, resolved: 0 };
      }

      if (alert.status === 'pending') {
        summary[alert.alert_type].pending++;
      } else if (alert.status === 'resolved') {
        summary[alert.alert_type].resolved++;
      }
    });

    return { success: true, summary };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
