import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const UNLOCK_CODE = '291089'

const QUESTIONS = [
  {
    id: 'q1_priority',
    title: "Votre priorité #1 aujourd'hui ?",
    emoji: '🎯',
    options: [
      { value: 'sst_mac', label: 'Secourisme (SST/MAC)', icon: '🩺' },
      { value: 'incendie', label: 'Incendie (évacuation/extincteurs)', icon: '🔥' },
      { value: 'les_deux', label: 'Les deux', icon: '✅' },
      { value: 'a_cadrer', label: 'Je ne sais pas / à cadrer', icon: '🤔' },
    ]
  },
  {
    id: 'q2_trigger',
    title: 'Votre déclencheur ?',
    emoji: '⚡',
    options: [
      { value: 'conformite', label: 'Mise en conformité', icon: '📋' },
      { value: 'turnover', label: 'Nouveaux entrants / turnover', icon: '👥' },
      { value: 'audit', label: 'Audit client / assurance', icon: '🔍' },
      { value: 'accident', label: 'Accident / presque accident', icon: '⚠️' },
      { value: 'renouvellement', label: 'Renouvellement / recyclage', icon: '🔄' },
    ]
  },
  {
    id: 'q3_constraint',
    title: 'Votre contrainte principale ?',
    emoji: '🧩',
    options: [
      { value: 'planning', label: 'Planning / équipes', icon: '📅' },
      { value: 'multi_sites', label: 'Multi-sites', icon: '🏢' },
      { value: 'terrain', label: 'Besoin terrain (sur poste)', icon: '🔧' },
      { value: 'niveaux', label: 'Niveaux hétérogènes / langue', icon: '🌍' },
      { value: 'budget', label: 'Budget / financement', icon: '💶' },
    ]
  },
]

function Confetti({ active }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const particles = []
    const colors = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#FFFFFF']
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * canvas.height,
        w: Math.random() * 10 + 4,
        h: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 4 + 2,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 10,
        opacity: 1,
      })
    }
    let frame
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      particles.forEach(p => {
        if (p.opacity <= 0) return
        alive = true
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        p.rot += p.vr
        if (p.y > canvas.height) p.opacity -= 0.02
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rot * Math.PI) / 180)
        ctx.globalAlpha = Math.max(0, p.opacity)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      })
      if (alive) frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [active])
  if (!active) return null
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }} />
}

function ProgressBar({ step, total }) {
  const pct = ((step) / total) * 100
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #F59E0B, #F97316)',
        }}
      />
    </div>
  )
}

export default function BniQuiz() {
  const [step, setStep] = useState(0) // 0=landing, 1-3=questions, 4=locked, 5=docs, 6=thanks
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [answers, setAnswers] = useState({})
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [funPage, setFunPage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [participantCount, setParticipantCount] = useState(0)
  const [slideDir, setSlideDir] = useState('right')
  const [animKey, setAnimKey] = useState(0)
  const [responseId, setResponseId] = useState(null)

  // Load participant count
  useEffect(() => {
    loadCount()
    const interval = setInterval(loadCount, 5000)
    return () => clearInterval(interval)
  }, [])

  async function loadCount() {
    try {
      const { count } = await supabase.from('bni_responses').select('*', { count: 'exact', head: true })
      if (count !== null) setParticipantCount(count)
    } catch (e) { /* silent */ }
  }

  function goNext() {
    setSlideDir('right')
    setAnimKey(k => k + 1)
    setStep(s => s + 1)
  }

  async function handleAnswer(questionId, value) {
    const newAnswers = { ...answers, [questionId]: value }
    setAnswers(newAnswers)
    
    // Send immediately to Supabase
    try {
      if (!responseId) {
        // First question — INSERT new row
        const { data } = await supabase.from('bni_responses').insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          [questionId]: value,
        }).select('id').single()
        if (data) setResponseId(data.id)
      } else {
        // Q2 or Q3 — UPDATE existing row
        await supabase.from('bni_responses').update({
          [questionId]: value,
        }).eq('id', responseId)
      }
    } catch (e) {
      console.error('Save error:', e)
    }

    // Also save locally as backup
    try {
      const existing = JSON.parse(localStorage.getItem('bni_responses') || '[]')
      const entry = { firstName, lastName, ...newAnswers, ts: new Date().toISOString() }
      const idx = existing.findIndex(x => x.firstName === firstName && x.lastName === lastName)
      if (idx >= 0) existing[idx] = entry; else existing.push(entry)
      localStorage.setItem('bni_responses', JSON.stringify(existing))
    } catch (e) { /* silent */ }

    // Small delay for visual feedback then advance
    setTimeout(() => goNext(), 300)
  }

  function handleCodeSubmit(e) {
    e.preventDefault()
    if (code === UNLOCK_CODE) {
      setUnlocked(true)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 4000)
    } else {
      setCodeError('Code incorrect 😬')
      setTimeout(() => setCodeError(''), 2000)
    }
  }

  function downloadVCard() {
    const vcard = `BEGIN:VCARD
VERSION:3.0
N:SAIDI;Hicham;;;
FN:Hicham SAIDI - Access Formation
ORG:Access Formation
TITLE:Co-directeur & Formateur
TEL;TYPE=CELL:+33635200428
TEL;TYPE=WORK:+33246565754
EMAIL:contact@accessformation.pro
URL:https://www.accessformation.pro
ADR;TYPE=WORK:;;24 Rue Kerbleiz;Concarneau;;29900;France
NOTE:Formations SST, Incendie, CACES, Habilitation Électrique - Certifié Qualiopi
END:VCARD`
    const blob = new Blob([vcard], { type: 'text/vcard' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Hicham_SAIDI_Access_Formation.vcf'
    a.click()
    URL.revokeObjectURL(url)
  }

  const containerStyle = {
    minHeight: '100dvh',
    background: 'linear-gradient(135deg, #0A1628 0%, #0F2034 40%, #132B3E 100%)',
    fontFamily: "'Inter', -apple-system, sans-serif",
  }

  // STEP 0: Landing
  if (step === 0) {
    const canStart = firstName.trim().length > 0 && lastName.trim().length > 0
    return (
      <div style={containerStyle} className="flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md mx-auto text-center animate-fadeIn">
          {/* Logos */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <img src={import.meta.env.BASE_URL + 'assets/bni/logo-af.png'} alt="Access Formation" className="h-20 w-20 rounded-2xl object-cover shadow-xl" />
            <div className="text-white/30 text-2xl font-light">×</div>
            <img src={import.meta.env.BASE_URL + 'assets/bni/logo-bni.png'} alt="BNI" className="h-20 rounded-xl object-cover shadow-xl" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "'Georgia', serif" }}>
            Sécurité au travail
          </h1>
          <p className="text-amber-400 font-semibold text-lg mb-1">3 questions, 30 secondes</p>
          <p className="text-white/50 text-sm mb-8">Réponses anonymes • Résultats en direct</p>

          {/* Name inputs */}
          <div className="space-y-3 mb-6">
            <input
              type="text"
              placeholder="Prénom"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white text-lg placeholder-white/40 focus:outline-none focus:border-amber-400 focus:bg-white/15 transition-all text-center"
              autoFocus
              autoComplete="given-name"
            />
            <input
              type="text"
              placeholder="Nom"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white text-lg placeholder-white/40 focus:outline-none focus:border-amber-400 focus:bg-white/15 transition-all text-center"
              autoComplete="family-name"
            />
          </div>

          {/* Start button */}
          <button
            onClick={() => canStart && goNext()}
            disabled={!canStart}
            className={`w-full py-5 rounded-2xl text-xl font-bold transition-all duration-300 shadow-lg ${
              canStart
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-amber-500/30 hover:shadow-xl active:scale-[0.98] cursor-pointer'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            🚀 Lancer le test
          </button>

          {participantCount > 0 && (
            <p className="text-white/40 text-sm mt-4 animate-pulse">
              {participantCount} participant{participantCount > 1 ? 's' : ''} déjà
            </p>
          )}
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fadeIn { animation: fadeIn 0.6s ease-out; }
        `}</style>
      </div>
    )
  }

  // STEP 1-3: Questions
  if (step >= 1 && step <= 3) {
    const q = QUESTIONS[step - 1]
    const selected = answers[q.id]
    return (
      <div style={containerStyle} className="flex flex-col min-h-screen p-6" key={`q-${animKey}`}>
        <div className="w-full max-w-md mx-auto">
          {/* Progress */}
          <div className="mb-2">
            <div className="flex justify-between text-white/50 text-xs mb-2">
              <span>Question {step}/3</span>
              <span>{firstName}</span>
            </div>
            <ProgressBar step={step} total={4} />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md mx-auto animate-slideIn">
            {/* Question */}
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">{q.emoji}</div>
              <h2 className="text-2xl font-bold text-white leading-tight">{q.title}</h2>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {q.options.map((opt, i) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(q.id, opt.value)}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all duration-300 border ${
                    selected === opt.value
                      ? 'bg-amber-500/20 border-amber-400 text-white scale-[1.02]'
                      : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10 hover:border-white/20 active:scale-[0.98]'
                  }`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="text-lg font-medium">{opt.label}</span>
                </button>
              ))}
            </div>

            {saving && (
              <div className="text-center mt-6">
                <div className="inline-flex items-center gap-2 text-amber-400">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                  Envoi en cours...
                </div>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes slideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
          .animate-slideIn { animation: slideIn 0.4s ease-out; }
        `}</style>
      </div>
    )
  }

  // STEP 4: Locked page
  if (step === 4) {
    return (
      <div style={containerStyle} className="flex flex-col min-h-screen p-6">
        <Confetti active={showConfetti} />
        <div className="w-full max-w-md mx-auto mb-4">
          <ProgressBar step={4} total={4} />
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md mx-auto text-center animate-fadeIn">
            {!funPage && !unlocked && (
              <>
                {/* Locked state */}
                <div className="text-5xl mb-4">🤝</div>
                <h2 className="text-2xl font-bold text-white mb-4">Merci {firstName} !</h2>
                <p className="text-amber-400 font-semibold text-lg mb-3 italic">
                  « Qui donne reçoit »
                </p>
                <p className="text-white/60 text-base mb-8 leading-relaxed">
                  Tu vas recevoir un code à la fin de la conférence d'un des membres de la plus belle des sphères, qui te donnera accès au Saint Graal ! 🏆
                </p>
                <button
                  onClick={() => setFunPage(true)}
                  className="w-full py-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl text-xl font-bold shadow-lg hover:shadow-amber-500/30 hover:shadow-xl active:scale-[0.98] transition-all"
                >
                  🔓 Accès documents
                </button>
                <p className="text-white/40 text-sm mt-4">Ne ferme pas cette page 📱</p>
                <p className="text-white/30 text-xs mt-1">Patience et verrouille ton téléphone 😉</p>
              </>
            )}

            {funPage && !unlocked && (
              <>
                {/* Fun page with logos + code input */}
                <div className="flex items-center justify-center gap-5 mb-6">
                  <img src={import.meta.env.BASE_URL + 'assets/bni/logo-af.png'} alt="Access Formation" className="h-16 w-16 rounded-xl object-cover shadow-xl" />
                  <div className="text-white/30 text-xl font-light">×</div>
                  <img src={import.meta.env.BASE_URL + 'assets/bni/logo-bni.png'} alt="BNI" className="h-16 rounded-xl object-cover shadow-xl" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">🏆 Le Saint Graal</h2>
                <p className="text-white/50 mb-6">Entre le code pour débloquer tes documents</p>
                <form onSubmit={handleCodeSubmit} className="space-y-4">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="••••••"
                    value={code}
                    onChange={e => {
                      setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      setCodeError('')
                    }}
                    className="w-full px-6 py-5 bg-white/10 border-2 border-white/20 rounded-2xl text-white text-3xl text-center tracking-[0.5em] placeholder-white/20 focus:outline-none focus:border-amber-400 transition-all"
                    autoFocus
                    maxLength={6}
                  />
                  {codeError && (
                    <p className="text-red-400 font-medium animate-shake">{codeError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={code.length < 6}
                    className={`w-full py-4 rounded-2xl text-lg font-bold transition-all ${
                      code.length === 6
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white active:scale-[0.98]'
                        : 'bg-white/10 text-white/30 cursor-not-allowed'
                    }`}
                  >
                    Déverrouiller 🔑
                  </button>
                </form>
              </>
            )}

            {unlocked && (
              <>
                {/* Unlocked — show docs */}
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-white mb-2">Débloqué !</h2>
                <p className="text-white/60 mb-8">Vos documents sont prêts</p>
                <div className="space-y-3">
                  <a
                    href={import.meta.env.BASE_URL + 'assets/bni/certificat-qualiopi.pdf'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-3 py-4 bg-white/10 border border-white/20 rounded-2xl text-white font-semibold hover:bg-white/15 active:scale-[0.98] transition-all"
                  >
                    📜 Certificat Qualiopi
                  </a>
                  <a
                    href={import.meta.env.BASE_URL + 'assets/bni/programme-access-formation.pdf'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-3 py-4 bg-white/10 border border-white/20 rounded-2xl text-white font-semibold hover:bg-white/15 active:scale-[0.98] transition-all"
                  >
                    📚 Programme de formation
                  </a>
                  <button
                    onClick={downloadVCard}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl text-white font-bold shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition-all"
                  >
                    📇 Ajouter le contact
                  </button>
                </div>
                <button
                  onClick={goNext}
                  className="mt-6 text-white/50 hover:text-white underline transition-colors"
                >
                  Continuer →
                </button>
              </>
            )}
          </div>
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
          @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
          .animate-shake { animation: shake 0.4s ease-in-out; }
        `}</style>
      </div>
    )
  }

  // STEP 5: Thank you
  return (
    <div style={containerStyle} className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-md mx-auto text-center animate-fadeIn">
        {/* Logos */}
        <div className="flex items-center justify-center gap-6 mb-8">
          <img src={import.meta.env.BASE_URL + 'assets/bni/logo-af.png'} alt="Access Formation" className="h-16 w-16 rounded-xl object-cover shadow-xl" />
          <div className="text-white/30 text-xl">×</div>
          <img src={import.meta.env.BASE_URL + 'assets/bni/logo-bni.png'} alt="BNI" className="h-16 rounded-xl object-cover shadow-xl" />
        </div>

        <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Georgia', serif" }}>
          Merci {firstName} 🙏
        </h2>
        <p className="text-white/60 text-lg mb-8">On échange ?</p>

        {/* Contact actions */}
        <div className="space-y-3 mb-8">
          <a
            href="tel:+33635200428"
            className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl text-white font-bold text-lg shadow-lg active:scale-[0.98] transition-all"
          >
            📞 Appeler Hicham
          </a>
          <a
            href="mailto:contact@accessformation.pro?subject=BNI%20-%20Demande%20d'information"
            className="w-full flex items-center justify-center gap-3 py-4 bg-white/10 border border-white/20 rounded-2xl text-white font-semibold hover:bg-white/15 active:scale-[0.98] transition-all"
          >
            ✉️ Envoyer un email
          </a>
          <button
            onClick={downloadVCard}
            className="w-full flex items-center justify-center gap-3 py-4 bg-white/10 border border-white/20 rounded-2xl text-white font-semibold hover:bg-white/15 active:scale-[0.98] transition-all"
          >
            📇 Ajouter au répertoire
          </button>
        </div>

        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <p className="text-white font-semibold text-lg">Hicham SAIDI</p>
          <p className="text-amber-400 text-sm font-medium">Co-directeur & Formateur</p>
          <p className="text-white/50 text-sm mt-2">Access Formation • Concarneau</p>
          <p className="text-white/50 text-sm">06 35 20 04 28</p>
          <p className="text-white/50 text-sm">contact@accessformation.pro</p>
        </div>

        <p className="text-white/30 text-xs mt-6">
          Certifié Qualiopi • SST • Incendie • CACES • Habilitation électrique
        </p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.6s ease-out; }
      `}</style>
    </div>
  )
}
