import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import QRCode from 'qrcode'

const ADMIN_CODE = 'access2026'

const LABELS = {
  q1_priority: {
    title: '🎯 Priorité #1',
    options: {
      sst_mac: '🩺 Secourisme (SST/MAC)',
      incendie: '🔥 Incendie',
      les_deux: '✅ Les deux',
      a_cadrer: '🤔 À cadrer',
    }
  },
  q2_trigger: {
    title: '⚡ Déclencheur',
    options: {
      conformite: '📋 Mise en conformité',
      turnover: '👥 Nouveaux entrants',
      audit: '🔍 Audit / assurance',
      accident: '⚠️ Accident',
      renouvellement: '🔄 Renouvellement',
    }
  },
  q3_constraint: {
    title: '🧩 Contrainte',
    options: {
      planning: '📅 Planning / équipes',
      multi_sites: '🏢 Multi-sites',
      terrain: '🔧 Besoin terrain',
      niveaux: '🌍 Niveaux hétérogènes',
      budget: '💶 Budget / financement',
    }
  },
}

const BAR_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6']

export default function BniAdmin() {
  const [authed, setAuthed] = useState(false)
  const [code, setCode] = useState('')
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const qrCanvasRef = useRef(null)

  // Generate QR code
  useEffect(() => {
    if (showQR && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, 'https://app.accessformation.pro/#/bni', {
        width: 300, margin: 2, color: { dark: '#0F2034', light: '#FFFFFF' },
        errorCorrectionLevel: 'H'
      })
    }
  }, [showQR])

  const loadResponses = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('bni_responses')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setResponses(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authed) return
    loadResponses()
    const interval = setInterval(loadResponses, 3000) // Refresh every 3s
    return () => clearInterval(interval)
  }, [authed, loadResponses])

  // Also subscribe to real-time
  useEffect(() => {
    if (!authed) return
    const channel = supabase
      .channel('bni_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bni_responses' }, (payload) => {
        setResponses(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [authed])

  function getStats(field) {
    const counts = {}
    responses.forEach(r => {
      const val = r[field]
      if (val) counts[val] = (counts[val] || 0) + 1
    })
    const total = responses.length || 1
    return Object.entries(LABELS[field].options).map(([key, label], i) => ({
      key, label, count: counts[key] || 0, pct: Math.round(((counts[key] || 0) / total) * 100),
      color: BAR_COLORS[i % BAR_COLORS.length]
    }))
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #0A1628, #132B3E)' }}>
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-white mb-6">🔐 BNI Admin</h1>
          <form onSubmit={e => { e.preventDefault(); if (code === ADMIN_CODE) setAuthed(true) }}>
            <input
              type="password"
              placeholder="Code admin"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-center text-lg focus:outline-none focus:border-amber-400 mb-4"
              autoFocus
            />
            <button type="submit" className="w-full py-4 bg-amber-500 text-white rounded-xl font-bold text-lg">
              Accéder
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: 'linear-gradient(135deg, #0A1628, #132B3E)', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">📊 BNI Live Dashboard</h1>
            <p className="text-white/50 text-sm">Mise à jour automatique</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-amber-400">{responses.length}</div>
            <div className="text-white/50 text-xs">participant{responses.length > 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* QR Code toggle */}
        <div className="mb-6 flex gap-3">
          <button onClick={() => setShowQR(!showQR)} className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-xl text-sm hover:bg-white/15 transition-colors">
            {showQR ? '✕ Fermer' : '📱 QR Code pour Canva'}
          </button>
          <a href="#/bni" target="_blank" className="px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-sm hover:bg-amber-500/30 transition-colors">
            🔗 Ouvrir le quiz
          </a>
        </div>

        {showQR && (
          <div className="mb-6 bg-white rounded-2xl p-6 text-center inline-block">
            <canvas ref={qrCanvasRef} />
            <p className="text-gray-600 text-sm mt-2 font-medium">app.accessformation.pro/#/bni</p>
            <p className="text-gray-400 text-xs mt-1">Capture d'écran → coller dans Canva</p>
          </div>
        )}

        {loading ? (
          <div className="text-center text-white/50 py-20">Chargement...</div>
        ) : responses.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-white/60 text-xl">En attente des premières réponses...</p>
            <p className="text-white/30 mt-2">Les données apparaîtront ici en temps réel</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {['q1_priority', 'q2_trigger', 'q3_constraint'].map(field => {
                const stats = getStats(field)
                const maxCount = Math.max(...stats.map(s => s.count), 1)
                return (
                  <div key={field} className="bg-white/5 rounded-2xl p-5 border border-white/10">
                    <h3 className="text-white font-bold text-lg mb-4">{LABELS[field].title}</h3>
                    <div className="space-y-3">
                      {stats.map(s => (
                        <div key={s.key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-white/80 truncate">{s.label}</span>
                            <span className="text-white font-bold ml-2">{s.count} <span className="text-white/40 font-normal">({s.pct}%)</span></span>
                          </div>
                          <div className="w-full h-6 bg-white/5 rounded-lg overflow-hidden">
                            <div
                              className="h-full rounded-lg transition-all duration-1000 ease-out flex items-center pl-2"
                              style={{
                                width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 8 : 0)}%`,
                                backgroundColor: s.color + '90',
                                boxShadow: s.count > 0 ? `0 0 12px ${s.color}40` : 'none'
                              }}
                            >
                              {s.count > 0 && <span className="text-white text-xs font-bold">{s.count}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Latest participants */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <h3 className="text-white font-bold text-lg mb-4">👥 Participants ({responses.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/50 border-b border-white/10">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Nom</th>
                      <th className="text-left py-2 px-2">Priorité</th>
                      <th className="text-left py-2 px-2">Déclencheur</th>
                      <th className="text-left py-2 px-2">Contrainte</th>
                      <th className="text-left py-2 px-2">Heure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map((r, i) => (
                      <tr key={r.id} className={`border-b border-white/5 ${i === 0 ? 'bg-amber-500/10' : ''}`}>
                        <td className="py-2 px-2 text-white/40">{responses.length - i}</td>
                        <td className="py-2 px-2 text-white font-medium">{r.first_name} {r.last_name}</td>
                        <td className="py-2 px-2 text-white/70">{LABELS.q1_priority.options[r.q1_priority] || '-'}</td>
                        <td className="py-2 px-2 text-white/70">{LABELS.q2_trigger.options[r.q2_trigger] || '-'}</td>
                        <td className="py-2 px-2 text-white/70">{LABELS.q3_constraint.options[r.q3_constraint] || '-'}</td>
                        <td className="py-2 px-2 text-white/40">{new Date(r.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick insight */}
            <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
              <h3 className="text-amber-400 font-bold mb-2">💡 Insight rapide</h3>
              <p className="text-white/80 text-sm">
                {(() => {
                  const q1Stats = getStats('q1_priority')
                  const topQ1 = q1Stats.reduce((a, b) => a.count > b.count ? a : b)
                  const q2Stats = getStats('q2_trigger')
                  const topQ2 = q2Stats.reduce((a, b) => a.count > b.count ? a : b)
                  return `${topQ1.pct}% priorité ${topQ1.label.split(' ').slice(1).join(' ')}, déclencheur principal : ${topQ2.label.split(' ').slice(1).join(' ')} (${topQ2.pct}%)`
                })()}
              </p>
            </div>

            {/* Danger button */}
            <div className="mt-8 text-center">
              <button
                onClick={async () => {
                  if (confirm('⚠️ Supprimer TOUTES les réponses BNI ? Cette action est irréversible.')) {
                    await supabase.from('bni_responses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                    setResponses([])
                  }
                }}
                className="px-6 py-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm hover:bg-red-500/30 transition-colors"
              >
                🗑️ Réinitialiser les réponses
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
