-- V2.5.21b - Données complètes des 3 process
-- À exécuter APRÈS schema-v2.5.21-process.sql

-- ═══════════════════════════════════════════════════════════════════
-- RÉCUPÉRATION DES IDs
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- Process IDs
  v_pr001_id UUID;
  v_pr002_id UUID;
  v_pr003_id UUID;
  
  -- Category IDs
  v_cat_commercial UUID;
  v_cat_preparation UUID;
  v_cat_formation UUID;
  v_cat_post UUID;
  v_cat_qualite UUID;
  
  -- Responsible IDs
  v_resp_hicham UUID;
  v_resp_maxime UUID;
  v_resp_formateur UUID;
  v_resp_stagiaire UUID;
  v_resp_client UUID;
  
  -- Step IDs pour PR-001
  v_s01 UUID; v_s02 UUID; v_s03 UUID; v_s04 UUID; v_s05 UUID;
  v_s06 UUID; v_s07 UUID; v_s08 UUID; v_s09 UUID; v_s10 UUID;
  v_s11 UUID; v_s12 UUID; v_s13 UUID; v_s14 UUID; v_s15 UUID;
  v_s16 UUID; v_s17 UUID; v_s18 UUID; v_s19 UUID; v_s20 UUID;
  v_s21 UUID; v_s22 UUID; v_s23 UUID; v_s24 UUID; v_s25 UUID;
  v_s26 UUID; v_s27 UUID; v_s28 UUID; v_s29 UUID; v_s30 UUID;
  v_s31 UUID; v_s32 UUID; v_s33 UUID; v_s34 UUID; v_s35 UUID;
  
  -- Step IDs pour PR-002
  v_nc01 UUID; v_nc02 UUID; v_nc03 UUID; v_nc04 UUID; v_nc05 UUID;
  v_nc06 UUID; v_nc07 UUID; v_nc08 UUID; v_nc09 UUID; v_nc10 UUID;
  v_nc11 UUID; v_nc12 UUID;
  
  -- Step IDs pour PR-003
  v_rc01 UUID; v_rc02 UUID; v_rc03 UUID; v_rc04 UUID; v_rc05 UUID;
  v_rc06 UUID; v_rc07 UUID; v_rc08 UUID; v_rc09 UUID; v_rc10 UUID;
  v_rc11 UUID; v_rc12 UUID;

BEGIN
  -- Récupérer les IDs des process
  SELECT id INTO v_pr001_id FROM processes WHERE code = 'PR-001';
  SELECT id INTO v_pr002_id FROM processes WHERE code = 'PR-002';
  SELECT id INTO v_pr003_id FROM processes WHERE code = 'PR-003';
  
  -- Récupérer les IDs des catégories
  SELECT id INTO v_cat_commercial FROM process_categories WHERE name = 'Commercial';
  SELECT id INTO v_cat_preparation FROM process_categories WHERE name = 'Préparation';
  SELECT id INTO v_cat_formation FROM process_categories WHERE name = 'Formation';
  SELECT id INTO v_cat_post FROM process_categories WHERE name = 'Post-formation';
  SELECT id INTO v_cat_qualite FROM process_categories WHERE name = 'Qualité';
  
  -- Récupérer les IDs des responsables
  SELECT id INTO v_resp_hicham FROM process_responsibles WHERE name = 'Hicham';
  SELECT id INTO v_resp_maxime FROM process_responsibles WHERE name = 'Maxime';
  SELECT id INTO v_resp_formateur FROM process_responsibles WHERE name = 'Formateur';
  SELECT id INTO v_resp_stagiaire FROM process_responsibles WHERE name = 'Stagiaire';
  SELECT id INTO v_resp_client FROM process_responsibles WHERE name = 'Client';

  -- ═══════════════════════════════════════════════════════════════════
  -- PR-001: PROCESS FORMATION STANDARD
  -- ═══════════════════════════════════════════════════════════════════
  
  -- Supprimer les anciennes étapes si elles existent
  DELETE FROM process_connections WHERE process_id = v_pr001_id;
  DELETE FROM process_steps WHERE process_id = v_pr001_id;
  
  -- ÉTAPES
  -- Ligne 1 : Début
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'start', 'Demande client', 'Réception d''une demande de formation (prospection, site web, bouche à oreille, partenaire)', v_cat_commercial, 400, 50, '', '')
  RETURNING id INTO v_s01;
  
  -- Ligne 2 : Premier contact
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Premier contact', 'RDV physique ou téléphonique pour comprendre les besoins du client', v_resp_hicham, v_cat_commercial, 400, 130, 'J+1', 'Téléphone')
  RETURNING id INTO v_s02;
  
  -- Ligne 3 : Analyse besoins
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Analyse des besoins', 'Identifier les besoins, prérequis, contraintes et objectifs de formation', v_resp_hicham, v_cat_commercial, 400, 210, '', '')
  RETURNING id INTO v_s03;
  
  -- Ligne 4 : Envoi devis
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'document', 'Envoi Devis + CGV + Programme', 'Envoi du devis, des conditions générales de vente et du programme de formation', v_resp_hicham, v_cat_commercial, 400, 290, 'J+2', 'Sellsy')
  RETURNING id INTO v_s04;
  
  -- Ligne 5 : Décision acceptation
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'decision', 'Client accepte ?', 'Le client renvoie le devis signé ou un bon pour accord', v_cat_commercial, 400, 370, '', '')
  RETURNING id INTO v_s05;
  
  -- Branche NON : Relance
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Relance client', 'Relancer le client pour connaître sa décision', v_resp_hicham, v_cat_commercial, 200, 370, 'J+7', 'Email')
  RETURNING id INTO v_s06;
  
  -- Fin si refus définitif
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'end', 'Fin (refus)', 'Le client ne donne pas suite', v_cat_commercial, 50, 370, '', '')
  RETURNING id INTO v_s07;
  
  -- Ligne 6 : Décision OPCO
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'decision', 'Financement OPCO ?', 'Le client demande-t-il un financement OPCO ?', v_cat_commercial, 400, 450, '', '')
  RETURNING id INTO v_s08;
  
  -- Branche OUI : Attente OPCO
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Attente validation OPCO', 'Attendre la validation de prise en charge par l''OPCO', v_resp_client, v_cat_commercial, 600, 450, 'Variable', '')
  RETURNING id INTO v_s09;
  
  -- Ligne 7 : Convention
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'document', 'Envoi Convention + CGV', 'Convention de formation avec prérequis et matériel requis', v_resp_hicham, v_cat_preparation, 400, 530, 'J+1', 'Campus')
  RETURNING id INTO v_s10;
  
  -- Ligne 8 : Planification
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Planification session', 'Définir dates, lieu, formateur selon disponibilités', v_resp_hicham, v_cat_preparation, 400, 610, '', 'Campus')
  RETURNING id INTO v_s11;
  
  -- Ligne 9 : Inscription stagiaires
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Inscription stagiaires', 'Saisie des stagiaires à partir de la liste fournie par le client', v_resp_hicham, v_cat_preparation, 400, 690, '', 'Campus')
  RETURNING id INTO v_s12;
  
  -- Ligne 10 : Convocations
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'document', 'Envoi convocations', 'Convocations avec prérequis, matériel requis et lieu de formation', v_resp_hicham, v_cat_preparation, 400, 770, 'J-7', 'Campus')
  RETURNING id INTO v_s13;
  
  -- Ligne 11 : Livret accueil
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'document', 'Livret d''accueil', 'Envoi du livret d''accueil aux stagiaires', v_resp_hicham, v_cat_preparation, 400, 850, 'J-7', 'Campus')
  RETURNING id INTO v_s14;
  
  -- Ligne 12 : Jour J - Accueil
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'JOUR J - Accueil', 'Accueil des stagiaires dans la salle de formation', v_resp_formateur, v_cat_formation, 400, 930, 'Jour J', '')
  RETURNING id INTO v_s15;
  
  -- Ligne 13 : Fiche renseignement
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'document', 'Fiche de renseignement', 'Le stagiaire remplit sa fiche via QR code', v_resp_stagiaire, v_cat_formation, 400, 1010, 'Immédiat', 'Campus (QR)')
  RETURNING id INTO v_s16;
  
  -- Ligne 14 : Décision QR fonctionne
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'decision', 'QR code OK ?', 'Le QR code fonctionne-t-il correctement ?', v_cat_formation, 400, 1090, '', '')
  RETURNING id INTO v_s17;
  
  -- Branche NON : Papier
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'document', 'Fiche papier', 'Utiliser les fiches papier en backup', v_resp_stagiaire, v_cat_formation, 200, 1090, '', 'Papier')
  RETURNING id INTO v_s18;
  
  -- Ligne 15 : Test positionnement
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Test de positionnement', 'Évaluation initiale des connaissances des stagiaires', v_resp_formateur, v_cat_formation, 400, 1170, 'Jour J', 'Campus')
  RETURNING id INTO v_s19;
  
  -- Ligne 16 : Formation
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Déroulement formation', 'Animation de la formation selon le programme', v_resp_formateur, v_cat_formation, 400, 1250, '', '')
  RETURNING id INTO v_s20;
  
  -- Ligne 17 : Émargement
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Émargement', 'Signature des présences par demi-journée via QR code', v_resp_stagiaire, v_cat_formation, 400, 1330, 'Chaque 1/2j', 'Campus (QR)')
  RETURNING id INTO v_s21;
  
  -- Ligne 18 : Décision émargement OK
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'decision', 'Émargement OK ?', 'L''émargement numérique fonctionne ?', v_cat_formation, 400, 1410, '', '')
  RETURNING id INTO v_s22;
  
  -- Branche NON : Émargement papier
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'document', 'Émargement papier', 'Utiliser la feuille d''émargement papier', v_resp_stagiaire, v_cat_formation, 200, 1410, '', 'Papier')
  RETURNING id INTO v_s23;
  
  -- Ligne 19 : Évaluations formatives
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Évaluations formatives', 'Évaluations pendant la formation pour mesurer la progression', v_resp_formateur, v_cat_formation, 400, 1490, '', '')
  RETURNING id INTO v_s24;
  
  -- Ligne 20 : Fin journée
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Fin de journée', 'Rangement salle, nettoyage matériel, préparation J+1 ou clôture', v_resp_formateur, v_cat_formation, 400, 1570, 'Fin de journée', '')
  RETURNING id INTO v_s25;
  
  -- Ligne 21 : Décision dernier jour
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'decision', 'Dernier jour ?', 'Est-ce le dernier jour de formation ?', v_cat_formation, 400, 1650, '', '')
  RETURNING id INTO v_s26;
  
  -- Ligne 22 : Évaluation à chaud
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Évaluation à chaud', 'Les stagiaires évaluent la formation via le portail', v_resp_stagiaire, v_cat_post, 400, 1730, 'Dernier jour', 'Campus (QR)')
  RETURNING id INTO v_s27;
  
  -- Ligne 23 : Attestation
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'document', 'Attestation de formation', 'Génération et remise des attestations de fin de formation', v_resp_formateur, v_cat_post, 400, 1810, 'Dernier jour', 'Campus')
  RETURNING id INTO v_s28;
  
  -- Ligne 24 : Certificat réalisation
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'document', 'Certificat de réalisation', 'Document attestant la réalisation de la formation', v_resp_hicham, v_cat_post, 400, 1890, 'J+1', 'Campus')
  RETURNING id INTO v_s29;
  
  -- Ligne 25 : Retour donneur d'ordre
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Retour donneur d''ordre', 'Compte-rendu au client (RH, dirigeant, QSE)', v_resp_formateur, v_cat_post, 400, 1970, 'J+1', 'Email')
  RETURNING id INTO v_s30;
  
  -- Ligne 26 : Facturation
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'document', 'Facturation', 'Émission et envoi de la facture', v_resp_hicham, v_cat_post, 400, 2050, 'J+3', 'Sellsy')
  RETURNING id INTO v_s31;
  
  -- Ligne 27 : Éval à froid
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'action', 'Suivi évaluation à froid', 'Relances pour récupérer les évaluations à froid (envoyées avec convention)', v_resp_hicham, v_cat_post, 400, 2130, 'J+30 à J+180', 'Email')
  RETURNING id INTO v_s32;
  
  -- Ligne 28 : Vérification qualité
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'decision', 'Alertes qualité ?', 'Y a-t-il des notes ≤ 3 ou des réclamations ?', v_cat_qualite, 400, 2210, '', 'Campus')
  RETURNING id INTO v_s33;
  
  -- Branche OUI : Sous-process NC
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, linked_process_id, delay, tool)
  VALUES (v_pr001_id, 'subprocess', 'Traitement NC', 'Voir process PR-002', v_cat_qualite, 600, 2210, v_pr002_id, '', 'Campus')
  RETURNING id INTO v_s34;
  
  -- Ligne 29 : Fin
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr001_id, 'end', 'Clôture formation', 'Formation terminée et documentée', v_cat_post, 400, 2290, '', '')
  RETURNING id INTO v_s35;
  
  -- CONNEXIONS PR-001
  INSERT INTO process_connections (process_id, from_step_id, to_step_id, label) VALUES
    (v_pr001_id, v_s01, v_s02, NULL),
    (v_pr001_id, v_s02, v_s03, NULL),
    (v_pr001_id, v_s03, v_s04, NULL),
    (v_pr001_id, v_s04, v_s05, NULL),
    (v_pr001_id, v_s05, v_s06, 'Non'),
    (v_pr001_id, v_s06, v_s07, 'Refus'),
    (v_pr001_id, v_s06, v_s05, 'Relance'),
    (v_pr001_id, v_s05, v_s08, 'Oui'),
    (v_pr001_id, v_s08, v_s09, 'Oui'),
    (v_pr001_id, v_s09, v_s10, NULL),
    (v_pr001_id, v_s08, v_s10, 'Non'),
    (v_pr001_id, v_s10, v_s11, NULL),
    (v_pr001_id, v_s11, v_s12, NULL),
    (v_pr001_id, v_s12, v_s13, NULL),
    (v_pr001_id, v_s13, v_s14, NULL),
    (v_pr001_id, v_s14, v_s15, NULL),
    (v_pr001_id, v_s15, v_s16, NULL),
    (v_pr001_id, v_s16, v_s17, NULL),
    (v_pr001_id, v_s17, v_s18, 'Non'),
    (v_pr001_id, v_s18, v_s19, NULL),
    (v_pr001_id, v_s17, v_s19, 'Oui'),
    (v_pr001_id, v_s19, v_s20, NULL),
    (v_pr001_id, v_s20, v_s21, NULL),
    (v_pr001_id, v_s21, v_s22, NULL),
    (v_pr001_id, v_s22, v_s23, 'Non'),
    (v_pr001_id, v_s23, v_s24, NULL),
    (v_pr001_id, v_s22, v_s24, 'Oui'),
    (v_pr001_id, v_s24, v_s25, NULL),
    (v_pr001_id, v_s25, v_s26, NULL),
    (v_pr001_id, v_s26, v_s20, 'Non'),
    (v_pr001_id, v_s26, v_s27, 'Oui'),
    (v_pr001_id, v_s27, v_s28, NULL),
    (v_pr001_id, v_s28, v_s29, NULL),
    (v_pr001_id, v_s29, v_s30, NULL),
    (v_pr001_id, v_s30, v_s31, NULL),
    (v_pr001_id, v_s31, v_s32, NULL),
    (v_pr001_id, v_s32, v_s33, NULL),
    (v_pr001_id, v_s33, v_s34, 'Oui'),
    (v_pr001_id, v_s34, v_s35, NULL),
    (v_pr001_id, v_s33, v_s35, 'Non');

  -- ═══════════════════════════════════════════════════════════════════
  -- PR-002: TRAITEMENT DES NON-CONFORMITÉS
  -- ═══════════════════════════════════════════════════════════════════
  
  DELETE FROM process_connections WHERE process_id = v_pr002_id;
  DELETE FROM process_steps WHERE process_id = v_pr002_id;
  
  -- Étapes
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'start', 'Alerte détectée', 'Une note ≤ 3 est détectée dans les évaluations', v_cat_qualite, 300, 50, '', 'Campus')
  RETURNING id INTO v_nc01;
  
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'action', 'Notification Dashboard', 'L''alerte apparaît dans le tableau de bord', v_cat_qualite, 300, 130, 'Automatique', 'Campus')
  RETURNING id INTO v_nc02;
  
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'action', 'Revue hebdomadaire', 'Analyse des alertes lors de la revue qualité hebdomadaire', v_resp_hicham, v_cat_qualite, 300, 210, 'Hebdo', '')
  RETURNING id INTO v_nc03;
  
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'decision', 'Créer une NC ?', 'L''alerte nécessite-t-elle une non-conformité formelle ?', v_cat_qualite, 300, 290, '', '')
  RETURNING id INTO v_nc04;
  
  -- Branche NON : Traitement direct
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'action', 'Traitement direct', 'Traiter l''alerte sans créer de NC (cas mineur)', v_resp_hicham, v_cat_qualite, 100, 290, 'Immédiat', 'Campus')
  RETURNING id INTO v_nc05;
  
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'end', 'Alerte traitée', 'Alerte marquée comme traitée', v_cat_qualite, 100, 370, '', '')
  RETURNING id INTO v_nc06;
  
  -- Suite : Création NC
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'action', 'Création NC', 'Créer la fiche de non-conformité', v_resp_hicham, v_cat_qualite, 300, 370, 'Immédiat', 'Campus')
  RETURNING id INTO v_nc07;
  
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'action', 'Analyse des causes', 'Identifier les causes racines de la non-conformité', v_resp_hicham, v_cat_qualite, 300, 450, '48h', '')
  RETURNING id INTO v_nc08;
  
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'action', 'Action corrective', 'Définir et planifier les actions correctives', v_resp_hicham, v_cat_qualite, 300, 530, '48h', 'Campus')
  RETURNING id INTO v_nc09;
  
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'action', 'Mise en œuvre', 'Réaliser les actions correctives définies', v_resp_hicham, v_cat_qualite, 300, 610, 'Variable', '')
  RETURNING id INTO v_nc10;
  
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'decision', 'Efficace ?', 'L''action corrective est-elle efficace ?', v_cat_qualite, 300, 690, '', '')
  RETURNING id INTO v_nc11;
  
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr002_id, 'end', 'Clôture NC', 'Non-conformité résolue et clôturée', v_cat_qualite, 300, 770, '', 'Campus')
  RETURNING id INTO v_nc12;
  
  -- Connexions PR-002
  INSERT INTO process_connections (process_id, from_step_id, to_step_id, label) VALUES
    (v_pr002_id, v_nc01, v_nc02, NULL),
    (v_pr002_id, v_nc02, v_nc03, NULL),
    (v_pr002_id, v_nc03, v_nc04, NULL),
    (v_pr002_id, v_nc04, v_nc05, 'Non'),
    (v_pr002_id, v_nc05, v_nc06, NULL),
    (v_pr002_id, v_nc04, v_nc07, 'Oui'),
    (v_pr002_id, v_nc07, v_nc08, NULL),
    (v_pr002_id, v_nc08, v_nc09, NULL),
    (v_pr002_id, v_nc09, v_nc10, NULL),
    (v_pr002_id, v_nc10, v_nc11, NULL),
    (v_pr002_id, v_nc11, v_nc08, 'Non'),
    (v_pr002_id, v_nc11, v_nc12, 'Oui');

  -- ═══════════════════════════════════════════════════════════════════
  -- PR-003: GESTION DES RÉCLAMATIONS
  -- ═══════════════════════════════════════════════════════════════════
  
  DELETE FROM process_connections WHERE process_id = v_pr003_id;
  DELETE FROM process_steps WHERE process_id = v_pr003_id;
  
  -- Étapes
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr003_id, 'start', 'Réclamation reçue', 'Réception d''une réclamation (email, téléphone, courrier, direct)', v_cat_qualite, 300, 50, '', '')
  RETURNING id INTO v_rc01;
  
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr003_id, 'action', 'Enregistrement', 'Enregistrer la réclamation dans le système', v_resp_hicham, v_cat_qualite, 300, 130, 'Immédiat', 'Campus')
  RETURNING id INTO v_rc02;
  
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr003_id, 'action', 'Accusé de réception', 'Envoyer un accusé de réception au client', v_resp_hicham, v_cat_qualite, 300, 210, '48h', 'Email')
  RETURNING id INTO v_rc03;
  
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr003_id, 'action', 'Analyse réclamation', 'Analyser la réclamation et investiguer', v_resp_hicham, v_cat_qualite, 300, 290, '48h', '')
  RETURNING id INTO v_rc04;
  
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr003_id, 'decision', 'Justifiée ?', 'La réclamation est-elle justifiée ?', v_cat_qualite, 300, 370, '', '')
  RETURNING id INTO v_rc05;
  
  -- Branche NON : Réponse explicative
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr003_id, 'action', 'Réponse explicative', 'Expliquer au client pourquoi la réclamation n''est pas retenue', v_resp_hicham, v_cat_qualite, 100, 370, '48h', 'Email')
  RETURNING id INTO v_rc06;
  
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr003_id, 'end', 'Clôture (non justifiée)', 'Réclamation clôturée sans suite', v_cat_qualite, 100, 450, '', '')
  RETURNING id INTO v_rc07;
  
  -- Suite : Réclamation justifiée
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, linked_process_id, delay, tool)
  VALUES (v_pr003_id, 'subprocess', 'Création NC', 'Créer une non-conformité si nécessaire (PR-002)', v_cat_qualite, 300, 450, v_pr002_id, '', 'Campus')
  RETURNING id INTO v_rc08;
  
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr003_id, 'action', 'Action corrective', 'Définir et mettre en œuvre une action corrective', v_resp_hicham, v_cat_qualite, 300, 530, 'Variable', '')
  RETURNING id INTO v_rc09;
  
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr003_id, 'action', 'Réponse au client', 'Informer le client des actions prises', v_resp_hicham, v_cat_qualite, 300, 610, '48h', 'Email')
  RETURNING id INTO v_rc10;
  
  INSERT INTO process_steps (process_id, type, title, description, responsible_id, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr003_id, 'action', 'Suivi satisfaction', 'S''assurer que le client est satisfait de la résolution', v_resp_hicham, v_cat_qualite, 300, 690, 'J+7', 'Téléphone')
  RETURNING id INTO v_rc11;
  
  INSERT INTO process_steps (process_id, type, title, description, category_id, position_x, position_y, delay, tool)
  VALUES (v_pr003_id, 'end', 'Clôture réclamation', 'Réclamation traitée et clôturée', v_cat_qualite, 300, 770, '', 'Campus')
  RETURNING id INTO v_rc12;
  
  -- Connexions PR-003
  INSERT INTO process_connections (process_id, from_step_id, to_step_id, label) VALUES
    (v_pr003_id, v_rc01, v_rc02, NULL),
    (v_pr003_id, v_rc02, v_rc03, NULL),
    (v_pr003_id, v_rc03, v_rc04, NULL),
    (v_pr003_id, v_rc04, v_rc05, NULL),
    (v_pr003_id, v_rc05, v_rc06, 'Non'),
    (v_pr003_id, v_rc06, v_rc07, NULL),
    (v_pr003_id, v_rc05, v_rc08, 'Oui'),
    (v_pr003_id, v_rc08, v_rc09, NULL),
    (v_pr003_id, v_rc09, v_rc10, NULL),
    (v_pr003_id, v_rc10, v_rc11, NULL),
    (v_pr003_id, v_rc11, v_rc12, NULL);

  RAISE NOTICE 'Process PR-001, PR-002 et PR-003 créés avec succès !';
  
END $$;
