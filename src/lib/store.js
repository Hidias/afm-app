import { create } from 'zustand'
import { supabase, isEmailAllowed } from './supabase'

// Store pour l'authentification
export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  error: null,
  
  // Initialiser l'auth
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        if (isEmailAllowed(session.user.email)) {
          set({ user: session.user, loading: false })
        } else {
          await supabase.auth.signOut()
          set({ user: null, loading: false, error: 'Email non autorisé' })
        }
      } else {
        set({ user: null, loading: false })
      }
      
      // Écouter les changements d'auth
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user && isEmailAllowed(session.user.email)) {
          set({ user: session.user })
        } else {
          set({ user: null })
        }
      })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },
  
  // Connexion
  login: async (email, password) => {
    set({ loading: true, error: null })
    
    if (!isEmailAllowed(email)) {
      set({ loading: false, error: 'Email non autorisé' })
      return { error: 'Email non autorisé' }
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      set({ loading: false, error: error.message })
      return { error: error.message }
    }
    
    set({ user: data.user, loading: false })
    return { data }
  },
  
  // Déconnexion
  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
}))

// Store pour les données
export const useDataStore = create((set, get) => ({
  // Clients
  clients: [],
  clientsLoading: false,
  
  fetchClients: async () => {
    set({ clientsLoading: true })
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name')
    
    if (!error) {
      set({ clients: data || [] })
    }
    set({ clientsLoading: false })
  },
  
  createClient: async (client) => {
    const { data, error } = await supabase
      .from('clients')
      .insert([client])
      .select()
      .single()
    
    if (!error && data) {
      set({ clients: [...get().clients, data] })
    }
    return { data, error }
  },
  
  updateClient: async (id, updates) => {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (!error && data) {
      set({ clients: get().clients.map(c => c.id === id ? data : c) })
    }
    return { data, error }
  },
  
  deleteClient: async (id) => {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
    
    if (!error) {
      set({ clients: get().clients.filter(c => c.id !== id) })
    }
    return { error }
  },
  
  // Formations (courses)
  courses: [],
  coursesLoading: false,
  
  fetchCourses: async () => {
    set({ coursesLoading: true })
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('code')
    
    if (!error) {
      set({ courses: data || [] })
    }
    set({ coursesLoading: false })
  },
  
  createCourse: async (course) => {
    const { data, error } = await supabase
      .from('courses')
      .insert([course])
      .select()
      .single()
    
    if (!error && data) {
      set({ courses: [...get().courses, data] })
    }
    return { data, error }
  },
  
  updateCourse: async (id, updates) => {
    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (!error && data) {
      set({ courses: get().courses.map(c => c.id === id ? data : c) })
    }
    return { data, error }
  },
  
  // Formateurs
  trainers: [],
  trainersLoading: false,
  
  fetchTrainers: async () => {
    set({ trainersLoading: true })
    const { data, error } = await supabase
      .from('trainers')
      .select('*')
      .order('last_name')
    
    if (!error) {
      set({ trainers: data || [] })
    }
    set({ trainersLoading: false })
  },
  
  createTrainer: async (trainer) => {
    const { data, error } = await supabase
      .from('trainers')
      .insert([trainer])
      .select()
      .single()
    
    if (!error && data) {
      set({ trainers: [...get().trainers, data] })
    }
    return { data, error }
  },
  
  // Stagiaires
  trainees: [],
  traineesLoading: false,
  
  fetchTrainees: async () => {
    set({ traineesLoading: true })
    const { data, error } = await supabase
      .from('trainees')
      .select('*, clients(name)')
      .order('last_name')
    
    if (!error) {
      set({ trainees: data || [] })
    }
    set({ traineesLoading: false })
  },
  
  createTrainee: async (trainee) => {
    const { data, error } = await supabase
      .from('trainees')
      .insert([trainee])
      .select('*, clients(name)')
      .single()
    
    if (!error && data) {
      set({ trainees: [...get().trainees, data] })
    }
    return { data, error }
  },
  
  // Sessions
  sessions: [],
  sessionsLoading: false,
  
  fetchSessions: async () => {
    set({ sessionsLoading: true })
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        courses(code, title, duration_hours),
        clients(name),
        session_trainers(trainer_id, trainers(first_name, last_name)),
        session_trainees(trainee_id, status, trainees(first_name, last_name, email))
      `)
      .order('start_date', { ascending: false })
    
    if (!error) {
      set({ sessions: data || [] })
    }
    set({ sessionsLoading: false })
  },
  
  createSession: async (session) => {
    // Générer une référence
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)
    
    const reference = `SESS-${year}-${String((count || 0) + 1).padStart(4, '0')}`
    
    // Générer un token d'émargement
    const attendanceToken = crypto.randomUUID().replace(/-/g, '')
    
    const { data, error } = await supabase
      .from('sessions')
      .insert([{ ...session, reference, attendance_token: attendanceToken }])
      .select(`
        *,
        courses(code, title, duration_hours),
        clients(name)
      `)
      .single()
    
    if (!error && data) {
      set({ sessions: [data, ...get().sessions] })
    }
    return { data, error }
  },
  
  updateSession: async (id, updates) => {
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        courses(code, title, duration_hours),
        clients(name),
        session_trainers(trainer_id, trainers(first_name, last_name)),
        session_trainees(trainee_id, status, trainees(first_name, last_name, email))
      `)
      .single()
    
    if (!error && data) {
      set({ sessions: get().sessions.map(s => s.id === id ? data : s) })
    }
    return { data, error }
  },
  
  // Ajouter un stagiaire à une session
  addTraineeToSession: async (sessionId, traineeId) => {
    const { data, error } = await supabase
      .from('session_trainees')
      .insert([{ session_id: sessionId, trainee_id: traineeId, status: 'enrolled' }])
      .select()
    
    if (!error) {
      await get().fetchSessions()
    }
    return { data, error }
  },
  
  // Émargements
  attendances: [],
  
  fetchAttendances: async (sessionId) => {
    const { data, error } = await supabase
      .from('attendances')
      .select('*, trainees(first_name, last_name)')
      .eq('session_id', sessionId)
      .order('date')
    
    if (!error) {
      set({ attendances: data || [] })
    }
    return { data, error }
  },
  
  createAttendance: async (attendance) => {
    const { data, error } = await supabase
      .from('attendances')
      .insert([attendance])
      .select()
      .single()
    
    return { data, error }
  },
  
  // Documents
  documents: [],
  documentsLoading: false,
  
  fetchDocuments: async (sessionId = null) => {
    set({ documentsLoading: true })
    let query = supabase
      .from('documents')
      .select('*, sessions(reference)')
      .order('created_at', { ascending: false })
    
    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }
    
    const { data, error } = await query
    
    if (!error) {
      set({ documents: data || [] })
    }
    set({ documentsLoading: false })
  },
  
  createDocument: async (document) => {
    // Générer un numéro
    const now = new Date()
    const prefix = document.doc_type.substring(0, 4).toUpperCase()
    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('doc_type', document.doc_type)
    
    const number = `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String((count || 0) + 1).padStart(5, '0')}`
    
    const { data, error } = await supabase
      .from('documents')
      .insert([{ ...document, number, status: 'ready' }])
      .select()
      .single()
    
    if (!error && data) {
      set({ documents: [data, ...get().documents] })
    }
    return { data, error }
  },
  
  // Questionnaires
  questionnaires: [],
  
  fetchQuestionnaires: async () => {
    const { data, error } = await supabase
      .from('questionnaires')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error) {
      set({ questionnaires: data || [] })
    }
  },
  
  // Réponses questionnaires
  questionnaireResponses: [],
  
  fetchQuestionnaireResponses: async (sessionId = null) => {
    let query = supabase
      .from('questionnaire_responses')
      .select('*, questionnaires(title, q_type), trainees(first_name, last_name), sessions(reference)')
      .order('created_at', { ascending: false })
    
    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }
    
    const { data, error } = await query
    
    if (!error) {
      set({ questionnaireResponses: data || [] })
    }
  },
}))
