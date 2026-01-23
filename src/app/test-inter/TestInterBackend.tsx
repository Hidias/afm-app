'use client';

import { useState } from 'react';
import {
  generateAccessCode,
  generateAllAccessCodes,
  createGroup,
  calculateSessionRevenue,
  checkMinParticipants,
  checkMaxParticipants,
  updateTraineeStatus,
  getActiveAlerts,
  checkAndCreateAlerts
} from '@/lib/inter-backend';

/**
 * COMPOSANT DE TEST INTER-ENTREPRISE
 * 
 * Pour tester ce composant :
 * 1. Ajoute-le dans une page : src/app/test-inter/page.tsx
 * 2. Navigue vers /test-inter
 * 3. Entre un vrai sessionId de ta base
 * 4. Teste les différentes fonctions
 */

export default function TestInterBackend() {
  const [sessionId, setSessionId] = useState('');
  const [traineeId, setTraineeId] = useState('');
  const [clientId, setClientId] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Ajouter un résultat au log
  const addResult = (title: string, data: any, success: boolean = true) => {
    setResults(prev => [{
      title,
      data,
      success,
      timestamp: new Date().toLocaleTimeString()
    }, ...prev]);
  };

  // Test 1 : Générer un code d'accès
  const testGenerateCode = async () => {
    if (!sessionId || !traineeId) {
      alert('Entre sessionId et traineeId');
      return;
    }

    setLoading(true);
    const result = await generateAccessCode(sessionId, traineeId);
    setLoading(false);

    addResult('Generate Access Code', result, result.success);
    
    if (result.success) {
      alert(`✅ Code généré : ${result.code}`);
    } else {
      alert(`❌ Erreur : ${result.error}`);
    }
  };

  // Test 2 : Générer tous les codes d'une session
  const testGenerateAllCodes = async () => {
    if (!sessionId) {
      alert('Entre sessionId');
      return;
    }

    setLoading(true);
    const result = await generateAllAccessCodes(sessionId);
    setLoading(false);

    addResult('Generate All Codes', result, result.success);
    
    if (result.success) {
      alert(`✅ ${result.generated} code(s) générés`);
    } else {
      alert(`❌ Erreur : ${result.error}`);
    }
  };

  // Test 3 : Créer un groupe
  const testCreateGroup = async () => {
    if (!sessionId || !clientId) {
      alert('Entre sessionId et clientId');
      return;
    }

    setLoading(true);
    const result = await createGroup({
      session_id: sessionId,
      client_id: clientId,
      nb_personnes: 5,
      price_per_person: 300,
      notes: 'Groupe de test'
    });
    setLoading(false);

    addResult('Create Group', result, result.success);
    
    if (result.success) {
      alert(`✅ Groupe créé : ${result.group?.id}`);
    } else {
      alert(`❌ Erreur : ${result.error}`);
    }
  };

  // Test 4 : Calculer le CA
  const testCalculateRevenue = async () => {
    if (!sessionId) {
      alert('Entre sessionId');
      return;
    }

    setLoading(true);
    const result = await calculateSessionRevenue(sessionId);
    setLoading(false);

    addResult('Calculate Revenue', result, result.success);
    
    if (result.success) {
      alert(`✅ CA Total : ${result.revenue?.total}€\nCA Confirmé : ${result.revenue?.confirmed}€\nCA Payé : ${result.revenue?.paid}€`);
    } else {
      alert(`❌ Erreur : ${result.error}`);
    }
  };

  // Test 5 : Vérifier le minimum
  const testCheckMin = async () => {
    if (!sessionId) {
      alert('Entre sessionId');
      return;
    }

    setLoading(true);
    const result = await checkMinParticipants(sessionId);
    setLoading(false);

    addResult('Check Min Participants', result, result.success);
    
    if (result.success) {
      const status = result.is_valid ? '✅ Valide' : '❌ Minimum non atteint';
      alert(`${status}\nActuel : ${result.current}/${result.min_required}\nManque : ${result.missing}`);
    } else {
      alert(`❌ Erreur : ${result.error}`);
    }
  };

  // Test 6 : Vérifier le maximum
  const testCheckMax = async () => {
    if (!sessionId) {
      alert('Entre sessionId');
      return;
    }

    setLoading(true);
    const result = await checkMaxParticipants(sessionId);
    setLoading(false);

    addResult('Check Max Participants', result, result.success);
    
    if (result.success) {
      const status = result.can_add ? '✅ Places disponibles' : '❌ Session complète';
      alert(`${status}\nActuel : ${result.current}/${result.max_allowed}\nRestantes : ${result.remaining}`);
    } else {
      alert(`❌ Erreur : ${result.error}`);
    }
  };

  // Test 7 : Changer le statut d'un stagiaire
  const testUpdateStatus = async () => {
    if (!sessionId || !traineeId) {
      alert('Entre sessionId et traineeId');
      return;
    }

    setLoading(true);
    const result = await updateTraineeStatus(sessionId, traineeId, 'confirmed');
    setLoading(false);

    addResult('Update Trainee Status', result, result.success);
    
    if (result.success) {
      alert('✅ Statut mis à jour : confirmed');
    } else {
      alert(`❌ Erreur : ${result.error}`);
    }
  };

  // Test 8 : Récupérer les alertes
  const testGetAlerts = async () => {
    if (!sessionId) {
      alert('Entre sessionId');
      return;
    }

    setLoading(true);
    const result = await getActiveAlerts(sessionId);
    setLoading(false);

    addResult('Get Active Alerts', result, result.success);
    
    if (result.success) {
      alert(`✅ ${result.count} alerte(s) active(s)`);
    } else {
      alert(`❌ Erreur : ${result.error}`);
    }
  };

  // Test 9 : Créer les alertes automatiques
  const testCreateAlerts = async () => {
    if (!sessionId) {
      alert('Entre sessionId');
      return;
    }

    setLoading(true);
    const result = await checkAndCreateAlerts(sessionId);
    setLoading(false);

    addResult('Check And Create Alerts', result, result.success);
    
    if (result.success) {
      alert(`✅ Alertes créées : ${result.alerts.join(', ') || 'Aucune'}`);
    } else {
      alert(`❌ Erreur : ${result.error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Test Inter-Entreprise Backend
          </h1>
          <p className="text-gray-600">
            Teste toutes les fonctions du backend inter-entreprise
          </p>
        </div>

        {/* Inputs */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📝 Paramètres</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session ID
              </label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="UUID de la session"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trainee ID
              </label>
              <input
                type="text"
                value={traineeId}
                onChange={(e) => setTraineeId(e.target.value)}
                placeholder="UUID du stagiaire"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="UUID du client"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Tests */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Codes d'accès */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-blue-600">
              🔑 Codes d'accès
            </h3>
            <div className="space-y-2">
              <button
                onClick={testGenerateCode}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                Générer un code
              </button>
              <button
                onClick={testGenerateAllCodes}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                Générer tous les codes
              </button>
            </div>
          </div>

          {/* Groupes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-green-600">
              👥 Groupes
            </h3>
            <div className="space-y-2">
              <button
                onClick={testCreateGroup}
                disabled={loading}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                Créer un groupe
              </button>
            </div>
          </div>

          {/* Finance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-purple-600">
              💰 Finance
            </h3>
            <div className="space-y-2">
              <button
                onClick={testCalculateRevenue}
                disabled={loading}
                className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                Calculer le CA
              </button>
            </div>
          </div>

          {/* Validation */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-orange-600">
              ✅ Validation
            </h3>
            <div className="space-y-2">
              <button
                onClick={testCheckMin}
                disabled={loading}
                className="w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                Vérifier minimum
              </button>
              <button
                onClick={testCheckMax}
                disabled={loading}
                className="w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                Vérifier maximum
              </button>
            </div>
          </div>

          {/* Statuts */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-indigo-600">
              🔄 Statuts
            </h3>
            <div className="space-y-2">
              <button
                onClick={testUpdateStatus}
                disabled={loading}
                className="w-full px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                Changer statut
              </button>
            </div>
          </div>

          {/* Alertes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-600">
              🚨 Alertes
            </h3>
            <div className="space-y-2">
              <button
                onClick={testGetAlerts}
                disabled={loading}
                className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                Voir alertes
              </button>
              <button
                onClick={testCreateAlerts}
                disabled={loading}
                className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                Créer alertes
              </button>
            </div>
          </div>
        </div>

        {/* Results Log */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">📊 Résultats</h2>
            <button
              onClick={() => setResults([])}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
            >
              Effacer
            </button>
          </div>

          {results.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Aucun test exécuté. Clique sur un bouton pour commencer !
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${
                    result.success
                      ? 'bg-green-50 border-green-500'
                      : 'bg-red-50 border-red-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-gray-900">
                      {result.title}
                    </span>
                    <span className="text-xs text-gray-500">
                      {result.timestamp}
                    </span>
                  </div>
                  <pre className="text-sm text-gray-700 overflow-x-auto bg-white p-2 rounded">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
