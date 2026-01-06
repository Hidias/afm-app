-- V2.5.21c - Correction des doublons responsables
-- À exécuter une seule fois

-- Supprimer les doublons de responsables (garder le premier)
DELETE FROM process_responsibles a USING process_responsibles b
WHERE a.id > b.id AND a.name = b.name;

-- Vérifier qu'il n'y a plus de doublons
SELECT name, COUNT(*) FROM process_responsibles GROUP BY name HAVING COUNT(*) > 1;
