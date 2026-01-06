-- V2.5.20 - Ajout du champ day_type pour gérer les sessions demi-journée
-- Exécuter ce script dans Supabase SQL Editor

-- Ajouter la colonne day_type à la table sessions
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS day_type TEXT DEFAULT 'full' CHECK (day_type IN ('full', 'half'));

-- Commenter la colonne
COMMENT ON COLUMN sessions.day_type IS 'Type de journée: full = journée complète (2 émargements), half = demi-journée (1 émargement)';

-- Mettre à jour les sessions existantes (toutes en journée complète par défaut)
UPDATE sessions SET day_type = 'full' WHERE day_type IS NULL;
