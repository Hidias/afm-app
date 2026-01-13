-- Schema V2.5.25 - CSP, Poste, Départ anticipé, Indicateurs, Alertes
-- Access Formation - Access Campus
-- Date: 10/01/2026
-- Version "production-grade" avec transaction

BEGIN;

-- =====================================================
-- 0. EXTENSION PGCRYPTO
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. FIX ATTENDANCE_TOKEN
-- =====================================================
-- Backfill les sessions existantes
UPDATE public.sessions
SET attendance_token = encode(gen_random_bytes(32), 'hex')
WHERE attendance_token IS NULL;

-- Default DB (prévention si l'app oublie)
ALTER TABLE public.sessions
  ALTER COLUMN attendance_token
  SET DEFAULT encode(gen_random_bytes(32), 'hex');

-- Solidifier token (empêche les NULL futurs)
ALTER TABLE public.sessions
  ALTER COLUMN attendance_token SET NOT NULL;

-- =====================================================
-- 2. AJOUT CSP ET JOB_TITLE (trainees)
-- =====================================================
ALTER TABLE public.trainees ADD COLUMN IF NOT EXISTS csp TEXT;
ALTER TABLE public.trainees ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Colonnes trainee_info_sheets (si existe) - robuste avec to_regclass
DO $$
BEGIN
  IF to_regclass('public.trainee_info_sheets') IS NOT NULL THEN
    ALTER TABLE public.trainee_info_sheets ADD COLUMN IF NOT EXISTS csp TEXT;
    ALTER TABLE public.trainee_info_sheets ADD COLUMN IF NOT EXISTS job_title TEXT;
  END IF;
END $$;

-- =====================================================
-- 3. DÉPART ANTICIPÉ ET SITUATION (session_trainees)
-- =====================================================
ALTER TABLE public.session_trainees ADD COLUMN IF NOT EXISTS early_departure BOOLEAN DEFAULT FALSE;
ALTER TABLE public.session_trainees ADD COLUMN IF NOT EXISTS departure_date DATE;
ALTER TABLE public.session_trainees ADD COLUMN IF NOT EXISTS departure_reason TEXT;
ALTER TABLE public.session_trainees ADD COLUMN IF NOT EXISTS situation TEXT;
ALTER TABLE public.session_trainees ADD COLUMN IF NOT EXISTS funding_type TEXT;

-- Sécuriser si colonne déjà là avec NULL
UPDATE public.session_trainees
SET early_departure = FALSE
WHERE early_departure IS NULL;

-- Solidifier early_departure
ALTER TABLE public.session_trainees
  ALTER COLUMN early_departure SET NOT NULL;

-- Index optimisé pour "abandons par session"
CREATE INDEX IF NOT EXISTS idx_st_session_earlydep_true
ON public.session_trainees(session_id)
WHERE early_departure = TRUE;

-- =====================================================
-- 4. FIX QUALITY_ALERTS STATUS
-- =====================================================
-- S'assurer que status a un default et pas de NULL (si table existe)
DO $$
BEGIN
  IF to_regclass('public.quality_alerts') IS NOT NULL THEN
    -- Default
    ALTER TABLE public.quality_alerts
      ALTER COLUMN status SET DEFAULT 'pending';
    -- Backfill NULL
    UPDATE public.quality_alerts
    SET status = 'pending'
    WHERE status IS NULL;
    -- NOT NULL
    ALTER TABLE public.quality_alerts
      ALTER COLUMN status SET NOT NULL;
  END IF;
END $$;

COMMIT;

-- =====================================================
-- VÉRIFICATIONS (à exécuter après le COMMIT)
-- =====================================================
-- Sessions sans token (doit retourner 0)
SELECT count(*) AS sessions_sans_token
FROM public.sessions
WHERE attendance_token IS NULL;

-- Doublons de token (doit retourner 0 lignes)
SELECT attendance_token, count(*) AS n
FROM public.sessions
GROUP BY 1
HAVING count(*) > 1;

-- ============================================
-- AJOUT COLONNE day_type pour sessions demi-journée
-- ============================================

-- Ajouter la colonne day_type si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sessions' 
    AND column_name = 'day_type'
  ) THEN
    ALTER TABLE public.sessions 
    ADD COLUMN day_type TEXT DEFAULT 'full' CHECK (day_type IN ('full', 'half'));
    
    COMMENT ON COLUMN public.sessions.day_type IS 'Type de journée: full = journée complète (matin+après-midi), half = demi-journée (matin seulement)';
  END IF;
END $$;
