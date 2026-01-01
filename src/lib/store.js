import { create } from 'zustand'
import { supabase } from './supabase'

export const useStore = create((set, get) => ({
  // État utilisateur
  user: null,
  loading: true,
  
  // Paramètres organisation
  organization: null,
  
  // Données
  clients: [],
  courses: [],
  trainers: [],
  trainees: [],
  sessions: [],
  qualiopiIndicators: [],
  nonConformities: [],
  
  // Stats dashboard
  stats: {
    completionDossiers: 0,
    completionQualiopi: 0,
    satisfactionRate: 0,
    recommendationRate: 0,
    presenceRate: 0,
    questionnaireRate: 0,
  },
  
  // Actions utilisateur
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  
  // Charger paramètres organisation
  loadOrganization: async () => {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('*')
      .single()
    
    if (!error && data) {
      set({ organization: data })
    }
    return data
  },
  
  // Sauvegarder paramètres organisation
  saveOrganization: async (updates) => {
    const org = get().organization
    const { data, error } = await supabase
      .from('organization_settings')
      .update(updates)
      .eq('id', org.id)
      .select()
      .single()
    
    if (!error && data) {
      set({ organization: data })
    }
    return { data, error }
  },
  
  // Charger indicateurs Qualiopi
  loadQualiopiIndicators: async () => {
    const { data, error } = await supabase
      .from('qualiopi_indicators')
      .select('*')
      .order('number')
    
    if (!error) {
      set({ qualiopiIndicators: data || [] })
    }
    return data
  },
  
  // Charger clients
  loadClients: async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name')
    
    if (!error) {
      set({ clients: data || [] })
    }
    return data
  },
  
  // Charger formations
  loadCourses: async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('title')
    
    if (!error) {
      set({ courses: data || [] })
    }
    return data
  },
  
  // Charger formateurs
  loadTrainers: async () => {
    const { data, error } = await supabase
      .from('trainers')
      .select(`
        *,
        trainer_certificates(*)
      `)
      .order('last_name')
    
    if (!error) {
      set({ trainers: data || [] })
    }
    return data
  },
  
  // Charger stagiaires
  loadTrainees: async () => {
    const { data, error } = await supabase
      .from('trainees')
      .select(`
        *,
        client:clients(id, name),
        trainee_documents(*)
      `)
      .order('last_name')
    
    if (!error) {
      set({ trainees: data || [] })
    }
    return data
  },
  
  // Charger sessions avec toutes les relations
  loadSessions: async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        course:courses(*),
        client:clients(*),
        trainer:trainers(*),
        session_trainees(
          *,
          trainee:trainees(*)
        ),
        daily_attendances(*),
        evaluations_hot(*),
        evaluations_cold(*),
        evaluations_trainer(*),
        session_documents(*),
        session_qualiopi_indicators(*)
      `)
      .order('start_date', { ascending: false })
    
    if (!error) {
      set({ sessions: data || [] })
    }
    return data
  },
  
  // Charger non-conformités
  loadNonConformities: async () => {
    const { data, error } = await supabase
      .from('non_conformities')
      .select(`
        *,
        session:sessions(id, reference)
      `)
      .order('created_at', { ascending: false })
    
    if (!error) {
      set({ nonConformities: data || [] })
    }
    return data
  },
  
  // Calculer les statistiques du dashboard
  calculateStats: () => {
    const sessions = get().sessions
    const clients = get().clients
    const trainees = get().trainees
    
    // Complétude Dossiers
    let totalFields = 0
    let filledFields = 0
    
    // Vérifier sessions
    sessions.forEach(s => {
      totalFields += 10
      if (s.course_id) filledFields++
      if (s.client_id) filledFields++
      if (s.trainer_id) filledFields++
      if (s.start_date) filledFields++
      if (s.end_date) filledFields++
      if (s.location_name || s.is_intra) filledFields++
      if (s.location_address || s.is_intra) filledFields++
      if (s.location_city || s.is_intra) filledFields++
      if (s.session_trainees?.length > 0) filledFields++
      if (s.trainer) filledFields++
    })
    
    // Vérifier clients
    clients.forEach(c => {
      totalFields += 5
      if (c.name) filledFields++
      if (c.address) filledFields++
      if (c.siret) filledFields++
      if (c.contact_name) filledFields++
      if (c.contact_email) filledFields++
    })
    
    // Vérifier stagiaires
    trainees.forEach(t => {
      totalFields += 5
      if (t.first_name) filledFields++
      if (t.last_name) filledFields++
      if (t.email) filledFields++
      if (t.birth_date) filledFields++
      if (t.social_security_number) filledFields++
    })
    
    const completionDossiers = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0
    
    // Complétude Qualiopi
    let totalIndicators = 0
    let validatedIndicators = 0
    
    sessions.forEach(s => {
      if (s.session_qualiopi_indicators) {
        s.session_qualiopi_indicators.forEach(ind => {
          totalIndicators++
          if (ind.is_validated) validatedIndicators++
        })
      }
    })
    
    const completionQualiopi = totalIndicators > 0 ? Math.round((validatedIndicators / totalIndicators) * 100) : 0
    
    // Taux de satisfaction (moyenne des évaluations à chaud)
    let totalSatisfaction = 0
    let countSatisfaction = 0
    
    sessions.forEach(s => {
      if (s.evaluations_hot) {
        s.evaluations_hot.forEach(e => {
          const avg = (
            (e.q1_objectives || 0) +
            (e.q2_content || 0) +
            (e.q3_pedagogy || 0) +
            (e.q4_trainer || 0) +
            (e.q5_organization || 0) +
            (e.q6_materials || 0)
          ) / 6
          if (avg > 0) {
            totalSatisfaction += avg
            countSatisfaction++
          }
        })
      }
    })
    
    const satisfactionRate = countSatisfaction > 0 ? Math.round((totalSatisfaction / countSatisfaction / 5) * 100) : 0
    
    // Taux de recommandation
    let recommendYes = 0
    let recommendTotal = 0
    
    sessions.forEach(s => {
      if (s.evaluations_hot) {
        s.evaluations_hot.forEach(e => {
          if (e.would_recommend !== null) {
            recommendTotal++
            if (e.would_recommend) recommendYes++
          }
        })
      }
    })
    
    const recommendationRate = recommendTotal > 0 ? Math.round((recommendYes / recommendTotal) * 100) : 0
    
    // Taux de présence
    let totalPresence = 0
    let countPresence = 0
    
    sessions.forEach(s => {
      if (s.daily_attendances) {
        s.daily_attendances.forEach(a => {
          countPresence += 2 // matin + après-midi
          if (a.morning_present) totalPresence++
          if (a.afternoon_present) totalPresence++
        })
      }
    })
    
    const presenceRate = countPresence > 0 ? Math.round((totalPresence / countPresence) * 100) : 0
    
    // Taux questionnaires remplis
    let totalQuestionnaires = 0
    let filledQuestionnaires = 0
    
    sessions.forEach(s => {
      const traineeCount = s.session_trainees?.length || 0
      totalQuestionnaires += traineeCount // Chaque stagiaire doit remplir une éval
      filledQuestionnaires += s.evaluations_hot?.length || 0
    })
    
    const questionnaireRate = totalQuestionnaires > 0 ? Math.round((filledQuestionnaires / totalQuestionnaires) * 100) : 0
    
    set({
      stats: {
        completionDossiers,
        completionQualiopi,
        satisfactionRate,
        recommendationRate,
        presenceRate,
        questionnaireRate,
      }
    })
  },
  
  // Charger toutes les données
  loadAllData: async () => {
    await Promise.all([
      get().loadOrganization(),
      get().loadQualiopiIndicators(),
      get().loadClients(),
      get().loadCourses(),
      get().loadTrainers(),
      get().loadTrainees(),
      get().loadSessions(),
      get().loadNonConformities(),
    ])
    get().calculateStats()
  },
}))
