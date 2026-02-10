import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import QRCode from 'qrcode'

const ADMIN_CODE = 'access2026'

const LABELS = {
  q1_priority: {
    title: '🎯 Priorité #1',
    options: {
      sst_mac: '🩺 Secourisme',
      incendie: '🔥 Incendie',
      les_deux: '✅ Les deux',
      a_cadrer: '🤔 À cadrer',
    }
  },
  q2_trigger: {
    title: '⚡ Déclencheur',
    options: {
      conformite: '📋 Conformité',
      turnover: '👥 Turnover',
      audit: '🔍 Audit',
      accident: '⚠️ Accident',
      renouvellement: '🔄 Renouvellement',
    }
  },
  q3_constraint: {
    title: '🧩 Contrainte',
    options: {
      planning: '📅 Planning',
      multi_sites: '🏢 Multi-sites',
      terrain: '🔧 Terrain',
      niveaux: '🌍 Niveaux/langue',
      budget: '💶 Budget',
    }
  },
}

const BAR_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6']

export default function BniAdmin() {
  const [authed, setAuthed] = useState(false)
  const [code, setCode] = useState('')
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const qrCanvasRef = useRef(null)
  const [newParticipant, setNewParticipant] = useState(null)

  useEffect(() => {
    if (authed && qrCanvasRef.current) {
      setTimeout(() => {
        QRCode.toCanvas(qrCanvasRef.current, 'https://app.accessformation.pro/#/bni', {
          width: 220, margin: 2, color: { dark: '#0F2034', light: '#FFFFFF' },
          errorCorrectionLevel: 'H'
        })
      }, 100)
    }
  }, [authed, loading])

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
    const interval = setInterval(loadResponses, 2000)
    return () => clearInterval(interval)
  }, [authed, loadResponses])

  useEffect(() => {
    if (!authed) return
    const channel = supabase
      .channel('bni_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bni_responses' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setResponses(prev => [payload.new, ...prev.filter(r => r.id !== payload.new.id)])
          setNewParticipant(payload.new.first_name)
          setTimeout(() => setNewParticipant(null), 3000)
        } else if (payload.eventType === 'UPDATE') {
          setResponses(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
        }
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
    const total = responses.filter(r => r[field]).length || 1
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
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0A1628, #132B3E)', fontFamily: "'Inter', sans-serif" }}>
      
      {newParticipant && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-xl animate-slideDown font-medium">
          🙋 {newParticipant} vient de rejoindre !
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-screen">
        
        {/* LEFT PANEL — QR Code + Participant count */}
        <div className="lg:w-80 lg:min-h-screen bg-white/5 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col items-center justify-center p-6 lg:p-8 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <img src={import.meta.env.BASE_URL + 'assets/bni/logo-af.png'} alt="AF" className="h-10 w-10 rounded-lg object-cover" />
            <span className="text-white font-bold text-lg">Access Formation</span>
          </div>

          <div className="bg-white rounded-2xl p-4 mb-4 shadow-xl">
            <canvas ref={qrCanvasRef} />
          </div>

          <p className="text-white/50 text-sm mb-6">Scannez pour participer</p>

          <div className="text-center">
            <div className="text-6xl font-bold text-amber-400 leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {responses.length}
            </div>
            <div className="text-white/50 text-sm mt-1">participant{responses.length > 1 ? 's' : ''}</div>
          </div>

          {responses.length > 0 && (
            <div className="mt-6 w-full max-w-xs">
              <div className="text-white/40 text-xs mb-2 text-center">Derniers arrivés</div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {responses.slice(0, 8).map((r, i) => (
                  <div key={r.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${i === 0 ? 'bg-amber-500/20 text-amber-300' : 'text-white/60'}`}>
                    <span className="text-base">{i === 0 ? '🆕' : '👤'}</span>
                    <span className="font-medium">{r.first_name} {r.last_name?.charAt(0)}.</span>
                    <span className="ml-auto text-xs text-white/30">
                      {new Date(r.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL — Live Stats */}
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            
            <h1 className="text-xl font-bold text-white mb-4">📊 Résultats en direct</h1>

            {loading ? (
              <div className="text-center text-white/50 py-20">Chargement...</div>
            ) : responses.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">⏳</div>
                <p className="text-white/60 text-xl">En attente des premières réponses...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {['q1_priority', 'q2_trigger', 'q3_constraint'].map(field => {
                    const stats = getStats(field)
                    const maxCount = Math.max(...stats.map(s => s.count), 1)
                    const answered = responses.filter(r => r[field]).length
                    return (
                      <div key={field} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-white font-bold text-base">{LABELS[field].title}</h3>
                          <span className="text-white/30 text-xs">{answered} rép.</span>
                        </div>
                        <div className="space-y-2.5">
                          {stats.map(s => (
                            <div key={s.key}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-white/70">{s.label}</span>
                                <span className="text-white font-bold">{s.count > 0 ? `${s.pct}%` : ''}</span>
                              </div>
                              <div className="w-full h-5 bg-white/5 rounded-lg overflow-hidden">
                                <div
                                  className="h-full rounded-lg transition-all duration-700 ease-out"
                                  style={{
                                    width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 5 : 0)}%`,
                                    backgroundColor: s.color + '90',
                                    boxShadow: s.count > 0 ? `0 0 10px ${s.color}30` : 'none'
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <h3 className="text-white font-bold mb-3">👥 Détail participants</h3>
                  <div className="overflow-x-auto -mx-4 px-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/40 border-b border-white/10 text-xs">
                          <th className="text-left py-2 pr-2">Nom</th>
                          <th className="text-left py-2 px-2">Priorité</th>
                          <th className="text-left py-2 px-2">Déclencheur</th>
                          <th className="text-left py-2 px-2">Contrainte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {responses.map((r, i) => (
                          <tr key={r.id} className={`border-b border-white/5 ${i === 0 ? 'bg-amber-500/10' : ''}`}>
                            <td className="py-2 pr-2 text-white font-medium whitespace-nowrap">
                              {r.first_name} {r.last_name}
                            </td>
                            <td className="py-2 px-2 text-white/60 text-xs">
                              {r.q1_priority ? LABELS.q1_priority.options[r.q1_priority] : <span className="text-white/20">...</span>}
                            </td>
                            <td className="py-2 px-2 text-white/60 text-xs">
                              {r.q2_trigger ? LABELS.q2_trigger.options[r.q2_trigger] : <span className="text-white/20">...</span>}
                            </td>
                            <td className="py-2 px-2 text-white/60 text-xs">
                              {r.q3_constraint ? LABELS.q3_constraint.options[r.q3_constraint] : <span className="text-white/20">...</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {responses.filter(r => r.q1_priority).length >= 3 && (
                  <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                    <h3 className="text-amber-400 font-bold text-sm mb-1">💡 Insight</h3>
                    <p className="text-white/80 text-sm">
                      {(() => {
                        const q1Stats = getStats('q1_priority')
                        const topQ1 = q1Stats.reduce((a, b) => a.count > b.count ? a : b)
                        return `${topQ1.pct}% ont choisi « ${topQ1.label} » comme priorité`
                      })()}
                    </p>
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={async () => {
                      if (confirm('Supprimer TOUTES les réponses BNI ?')) {
                        await supabase.from('bni_responses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                        setResponses([])
                      }
                    }}
                    className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs hover:bg-red-500/30 transition-colors"
                  >
                    🗑️ Réinitialiser
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slideDown { animation: slideDown 0.4s ease-out; }
      `}</style>
    </div>
  )
}
