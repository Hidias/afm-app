-- ============================================
-- V2.5.22 - Notifications & Réclamations
-- ============================================

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL, -- 'reclamation', 'veille', 'materiel', 'audit', 'revue_direction', 'j90'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(255), -- Lien vers la page concernée
    read_at TIMESTAMPTZ, -- NULL si non lu
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Index pour les notifications non lues
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_notifications" ON notifications;
CREATE POLICY "auth_notifications" ON notifications FOR ALL USING (auth.role() = 'authenticated');

-- Table pour les tokens publics (réclamations)
CREATE TABLE IF NOT EXISTS public_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(255) UNIQUE NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'complaint', -- 'complaint'
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_ip VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_public_tokens_token ON public_tokens(token);
CREATE INDEX IF NOT EXISTS idx_public_tokens_expires ON public_tokens(expires_at);

-- RLS - permettre insertion anonyme pour les tokens
ALTER TABLE public_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_create_token" ON public_tokens;
CREATE POLICY "anon_create_token" ON public_tokens FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "anon_read_token" ON public_tokens;
CREATE POLICY "anon_read_token" ON public_tokens FOR SELECT USING (true);
DROP POLICY IF EXISTS "anon_update_token" ON public_tokens;
CREATE POLICY "anon_update_token" ON public_tokens FOR UPDATE USING (true);

-- Permettre aux anonymes de vérifier les sessions (lecture seule, champs limités)
-- Note: On crée une vue pour limiter les champs exposés
CREATE OR REPLACE VIEW public_sessions_view AS
SELECT 
    s.id,
    s.reference,
    s.start_date,
    s.end_date,
    c.title as course_title
FROM sessions s
LEFT JOIN courses c ON s.course_id = c.id;

-- Grant pour la vue
GRANT SELECT ON public_sessions_view TO anon;

-- Permettre aux anonymes de créer des NC (réclamations)
-- On ajoute une policy spéciale pour les réclamations (source = 'reclamation')
DROP POLICY IF EXISTS "anon_create_reclamation" ON non_conformites;
CREATE POLICY "anon_create_reclamation" ON non_conformites 
FOR INSERT WITH CHECK (source = 'reclamation');

-- Nettoyage automatique des tokens expirés (fonction)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public_tokens WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier les sessions à J+90
CREATE OR REPLACE FUNCTION get_sessions_j90()
RETURNS TABLE(session_id UUID, reference VARCHAR, course_title VARCHAR, end_date DATE) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.reference, c.title, s.end_date::DATE
    FROM sessions s
    LEFT JOIN courses c ON s.course_id = c.id
    WHERE s.end_date = CURRENT_DATE - INTERVAL '90 days'
    AND s.status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
