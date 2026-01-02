import { create } from 'zustand'
import { supabase, isEmailAllowed } from './supabase'

// Store pour l'authentification
export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  error: null,
  
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user && isEmailAllowed(session.user.email)) {
        set({ user: session.user, loading: false })
      } else {
        if (session) await supabase.auth.signOut()
        set({ user: null, loading: false })
      }
      
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
  
  login: async (email, password) => {
    set({ loading: true, error: null })
    if (!isEmailAllowed(email)) {
      set({ loading: false, error: 'Email non autorisé' })
      return { error: 'Email non autorisé' }
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      set({ loading: false, error: error.message })
      return { error: error.message }
    }
    set({ user: data.user, loading: false })
    return { data }
  },
  
  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
}))

// Store principal pour les données
export const useDataStore = create((set, get) => ({
  // ========== CLIENTS ==========
  clients: [],
  clientsLoading: false,
  
  fetchClients: async () => {
    set({ clientsLoading: true })
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name')
    if (!error) set({ clients: data || [] })
    set({ clientsLoading: false })
    return { data, error }
  },
  
  getClient: async (id) => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()
    return { data, error }
  },
  
  createClient: async (client) => {
    // Colonnes exactes de ta table clients
    const validClient = {
      name: client.name,
      address: client.address || null,
      postal_code: client.postal_code || null,
      city: client.city || null,
      siret: client.siret || null,
      contact_name: client.contact_name || null,
      contact_function: client.contact_function || null,
      contact_email: client.contact_email || client.email || null,
      contact_phone: client.contact_phone || client.phone || null,
      notes: client.notes || null,
    }
    console.log('Creating client:', validClient)
    const { data, error } = await supabase
      .from('clients')
      .insert([validClient])
      .select()
      .single()
    if (error) console.error('Client creation error:', error)
    if (!error && data) {
      set({ clients: [...get().clients, data] })
    }
    return { data, error }
  },
  
  updateClient: async (id, updates) => {
    // Colonnes exactes de ta table clients
    const validUpdates = {}
    if (updates.name !== undefined) validUpdates.name = updates.name
    if (updates.address !== undefined) validUpdates.address = updates.address
    if (updates.postal_code !== undefined) validUpdates.postal_code = updates.postal_code
    if (updates.city !== undefined) validUpdates.city = updates.city
    if (updates.siret !== undefined) validUpdates.siret = updates.siret
    if (updates.contact_name !== undefined) validUpdates.contact_name = updates.contact_name
    if (updates.contact_function !== undefined) validUpdates.contact_function = updates.contact_function
    if (updates.contact_email !== undefined) validUpdates.contact_email = updates.contact_email
    if (updates.email !== undefined) validUpdates.contact_email = updates.email
    if (updates.contact_phone !== undefined) validUpdates.contact_phone = updates.contact_phone
    if (updates.phone !== undefined) validUpdates.contact_phone = updates.phone
    if (updates.notes !== undefined) validUpdates.notes = updates.notes
    
    console.log('Updating client:', id, validUpdates)
    const { data, error } = await supabase
      .from('clients')
      .update(validUpdates)
      .eq('id', id)
      .select()
      .single()
    if (error) console.error('Client update error:', error)
    if (!error && data) {
      set({ clients: get().clients.map(c => c.id === id ? data : c) })
    }
    return { data, error }
  },
  
  deleteClient: async (id) => {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (!error) {
      set({ clients: get().clients.filter(c => c.id !== id) })
    }
    return { error }
  },

  // ========== FORMATIONS (COURSES) ==========
  courses: [],
  coursesLoading: false,
  
  fetchCourses: async () => {
    set({ coursesLoading: true })
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('code')
    if (!error) set({ courses: data || [] })
    set({ coursesLoading: false })
    return { data, error }
  },
  
  getCourse: async (id) => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single()
    return { data, error }
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
  
  deleteCourse: async (id) => {
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (!error) {
      set({ courses: get().courses.filter(c => c.id !== id) })
    }
    return { error }
  },

  // ========== FORMATEURS (TRAINERS) ==========
  trainers: [],
  trainersLoading: false,
  
  fetchTrainers: async () => {
    set({ trainersLoading: true })
    const { data, error } = await supabase
      .from('trainers')
      .select('*')
      .order('last_name')
    if (!error) set({ trainers: data || [] })
    set({ trainersLoading: false })
    return { data, error }
  },
  
  createTrainer: async (trainer) => {
    // Colonnes exactes de ta table trainers
    const validTrainer = {
      first_name: trainer.first_name,
      last_name: trainer.last_name,
      email: trainer.email,
      phone: trainer.phone || null,
      specialties: trainer.specialties || null,
      bio: trainer.bio || null,
      certifications: trainer.certifications || null,
      hourly_rate: trainer.hourly_rate || null,
      notes: trainer.notes || null,
      qualifications: trainer.qualifications || null,
      certification_number: trainer.certification_number || null,
    }
    console.log('Creating trainer:', validTrainer)
    const { data, error } = await supabase
      .from('trainers')
      .insert([validTrainer])
      .select()
      .single()
    if (error) console.error('Trainer creation error:', error)
    if (!error && data) {
      set({ trainers: [...get().trainers, data] })
    }
    return { data, error }
  },
  
  updateTrainer: async (id, updates) => {
    // Colonnes exactes de ta table trainers
    const validUpdates = {}
    if (updates.first_name !== undefined) validUpdates.first_name = updates.first_name
    if (updates.last_name !== undefined) validUpdates.last_name = updates.last_name
    if (updates.email !== undefined) validUpdates.email = updates.email
    if (updates.phone !== undefined) validUpdates.phone = updates.phone
    if (updates.specialties !== undefined) validUpdates.specialties = updates.specialties
    if (updates.bio !== undefined) validUpdates.bio = updates.bio
    if (updates.certifications !== undefined) validUpdates.certifications = updates.certifications
    if (updates.hourly_rate !== undefined) validUpdates.hourly_rate = updates.hourly_rate
    if (updates.notes !== undefined) validUpdates.notes = updates.notes
    if (updates.qualifications !== undefined) validUpdates.qualifications = updates.qualifications
    if (updates.certification_number !== undefined) validUpdates.certification_number = updates.certification_number
    
    console.log('Updating trainer:', id, validUpdates)
    const { data, error } = await supabase
      .from('trainers')
      .update(validUpdates)
      .eq('id', id)
      .select()
      .single()
    if (error) console.error('Trainer update error:', error)
    if (!error && data) {
      set({ trainers: get().trainers.map(t => t.id === id ? data : t) })
    }
    return { data, error }
  },
  
  deleteTrainer: async (id) => {
    const { error } = await supabase.from('trainers').delete().eq('id', id)
    if (!error) {
      set({ trainers: get().trainers.filter(t => t.id !== id) })
    }
    return { error }
  },

  // ========== STAGIAIRES (TRAINEES) ==========
  trainees: [],
  traineesLoading: false,
  
  fetchTrainees: async () => {
    set({ traineesLoading: true })
    const { data, error } = await supabase
      .from('trainees')
      .select('*, clients(id, name)')
      .order('last_name')
    if (!error) set({ trainees: data || [] })
    set({ traineesLoading: false })
    return { data, error }
  },
  
  createTrainee: async (trainee) => {
    const { data, error } = await supabase
      .from('trainees')
      .insert([trainee])
      .select('*, clients(id, name)')
      .single()
    if (!error && data) {
      set({ trainees: [...get().trainees, data] })
    }
    return { data, error }
  },
  
  updateTrainee: async (id, updates) => {
    const { data, error } = await supabase
      .from('trainees')
      .update(updates)
      .eq('id', id)
      .select('*, clients(id, name)')
      .single()
    if (!error && data) {
      set({ trainees: get().trainees.map(t => t.id === id ? data : t) })
    }
    return { data, error }
  },
  
  deleteTrainee: async (id) => {
    const { error } = await supabase.from('trainees').delete().eq('id', id)
    if (!error) {
      set({ trainees: get().trainees.filter(t => t.id !== id) })
    }
    return { error }
  },

  // ========== SESSIONS ==========
  sessions: [],
  sessionsLoading: false,
  currentSession: null,
  
  fetchSessions: async () => {
    set({ sessionsLoading: true })
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('start_date', { ascending: false })
    
    if (error) {
      console.error('fetchSessions error:', error)
      set({ sessionsLoading: false })
      return { data: [], error }
    }
    
    // Charger les relations avec TOUS les champs
    const sessions = data || []
    for (let s of sessions) {
      // Charger le cours avec TOUS les champs
      if (s.course_id) {
        const { data: course } = await supabase.from('courses').select('*').eq('id', s.course_id).single()
        s.courses = course
      }
      // Charger le client avec TOUS les champs
      if (s.client_id) {
        const { data: client } = await supabase.from('clients').select('*').eq('id', s.client_id).single()
        s.clients = client
      }
      // Charger le formateur avec TOUS les champs
      if (s.trainer_id) {
        const { data: trainer } = await supabase.from('trainers').select('*').eq('id', s.trainer_id).single()
        s.trainers = trainer
      }
      // Charger les stagiaires
      const { data: sessionTrainees } = await supabase
        .from('session_trainees')
        .select('id, trainee_id, registration_date, result')
        .eq('session_id', s.id)
      s.session_trainees = sessionTrainees || []
      
      // Charger les infos des stagiaires
      for (let st of s.session_trainees) {
        const { data: trainee } = await supabase.from('trainees').select('*').eq('id', st.trainee_id).single()
        st.trainees = trainee
      }
    }
    
    set({ sessions })
    set({ sessionsLoading: false })
    return { data: sessions, error: null }
  },
  
  getSession: async (id) => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('getSession error:', error)
      return { data: null, error }
    }
    
    if (data) {
      // Charger le cours avec TOUS les champs
      if (data.course_id) {
        const { data: course } = await supabase.from('courses').select('*').eq('id', data.course_id).single()
        data.courses = course
      }
      // Charger le client avec TOUS les champs
      if (data.client_id) {
        const { data: client } = await supabase.from('clients').select('*').eq('id', data.client_id).single()
        data.clients = client
      }
      // Charger le formateur
      if (data.trainer_id) {
        const { data: trainer } = await supabase.from('trainers').select('*').eq('id', data.trainer_id).single()
        data.trainers = trainer
      }
      // Charger les stagiaires (sans status car n'existe pas)
      const { data: sessionTrainees, error: stError } = await supabase
        .from('session_trainees')
        .select('id, trainee_id, registration_date, result')
        .eq('session_id', id)
      
      if (stError) console.error('Error loading session_trainees:', stError)
      data.session_trainees = sessionTrainees || []
      
      // Charger les infos complètes des stagiaires
      for (let st of data.session_trainees) {
        const { data: trainee } = await supabase.from('trainees').select('*').eq('id', st.trainee_id).single()
        st.trainees = trainee
      }
    }
    
    set({ currentSession: data })
    return { data, error: null }
  },
  
  createSession: async (sessionData) => {
    // Générer référence unique avec timestamp
    const reference = `SES-${Date.now().toString(36).toUpperCase()}`
    
    const { trainer_ids, trainee_ids, ...rest } = sessionData
    
    console.log('createSession received:', { trainer_ids, trainee_ids, rest })
    
    // Colonnes exactes de ta table sessions
    const session = {
      course_id: rest.course_id,
      client_id: rest.client_id,
      trainer_id: trainer_ids?.length > 0 ? trainer_ids[0] : (rest.trainer_id || null),
      start_date: rest.start_date,
      end_date: rest.end_date,
      start_time: rest.start_time || '09:00',
      end_time: rest.end_time || '17:00',
      location_name: rest.location_name || rest.location || null,
      location_address: rest.location_address || null,
      location_postal_code: rest.location_postal_code || null,
      location_city: rest.location_city || null,
      is_intra: rest.is_intra || false,
      is_remote: rest.is_remote || false,
      status: rest.status || 'planned',
      notes: rest.notes || null,
      reference,
    }
    
    console.log('Creating session with trainer_id:', session.trainer_id)
    
    const { data, error } = await supabase
      .from('sessions')
      .insert([session])
      .select()
      .single()
    
    if (error) {
      console.error('Session creation error:', error)
      return { data: null, error }
    }
    
    if (data) {
      // Ajouter les stagiaires (sans status car n'existe pas)
      if (trainee_ids?.length) {
        await supabase.from('session_trainees').insert(
          trainee_ids.map(tid => ({ 
            session_id: data.id, 
            trainee_id: tid,
            registration_date: new Date().toISOString()
          }))
        ).then(res => {
          if (res.error) console.error('Error adding trainees:', res.error)
        })
      }
      await get().fetchSessions()
    }
    return { data, error: null }
  },
  
  updateSession: async (id, updates) => {
    const { trainer_ids, trainee_ids, ...rest } = updates
    
    // Colonnes exactes de ta table sessions
    const sessionUpdates = {}
    if (rest.course_id !== undefined) sessionUpdates.course_id = rest.course_id
    if (rest.client_id !== undefined) sessionUpdates.client_id = rest.client_id
    if (trainer_ids !== undefined) sessionUpdates.trainer_id = trainer_ids[0] || null
    if (rest.trainer_id !== undefined) sessionUpdates.trainer_id = rest.trainer_id
    if (rest.start_date !== undefined) sessionUpdates.start_date = rest.start_date
    if (rest.end_date !== undefined) sessionUpdates.end_date = rest.end_date
    if (rest.start_time !== undefined) sessionUpdates.start_time = rest.start_time
    if (rest.end_time !== undefined) sessionUpdates.end_time = rest.end_time
    if (rest.location_name !== undefined) sessionUpdates.location_name = rest.location_name
    if (rest.location !== undefined) sessionUpdates.location_name = rest.location
    if (rest.location_address !== undefined) sessionUpdates.location_address = rest.location_address
    if (rest.location_postal_code !== undefined) sessionUpdates.location_postal_code = rest.location_postal_code
    if (rest.location_city !== undefined) sessionUpdates.location_city = rest.location_city
    if (rest.is_intra !== undefined) sessionUpdates.is_intra = rest.is_intra
    if (rest.is_remote !== undefined) sessionUpdates.is_remote = rest.is_remote
    if (rest.status !== undefined) sessionUpdates.status = rest.status
    if (rest.notes !== undefined) sessionUpdates.notes = rest.notes
    
    console.log('Updating session:', id, sessionUpdates)
    
    const { data, error } = await supabase
      .from('sessions')
      .update(sessionUpdates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('updateSession error:', error)
      return { data: null, error }
    }
    
    if (data) {
      // Mettre à jour les stagiaires si fournis
      if (trainee_ids !== undefined) {
        await supabase.from('session_trainees').delete().eq('session_id', id)
        if (trainee_ids.length) {
          await supabase.from('session_trainees').insert(
            trainee_ids.map(tid => ({ 
              session_id: id, 
              trainee_id: tid,
              registration_date: new Date().toISOString()
            }))
          )
        }
      }
      await get().fetchSessions()
    }
    return { data, error }
  },
  
  deleteSession: async (id) => {
    // Supprimer d'abord les relations
    await supabase.from('session_trainees').delete().eq('session_id', id)
    
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (!error) {
      set({ sessions: get().sessions.filter(s => s.id !== id) })
    }
    return { error }
  },
  
  addTraineeToSession: async (sessionId, traineeId) => {
    console.log('Adding trainee to session:', sessionId, traineeId)
    const { data, error } = await supabase
      .from('session_trainees')
      .insert([{ 
        session_id: sessionId, 
        trainee_id: traineeId, 
        registration_date: new Date().toISOString()
      }])
      .select()
    if (error) console.error('addTraineeToSession error:', error)
    if (!error) await get().fetchSessions()
    return { data, error }
  },
  
  removeTraineeFromSession: async (sessionId, traineeId) => {
    const { error } = await supabase
      .from('session_trainees')
      .delete()
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId)
    if (!error) await get().fetchSessions()
    return { error }
  },
  
  updateTraineeStatus: async (sessionId, traineeId, status) => {
    const { error } = await supabase
      .from('session_trainees')
      .update({ status })
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId)
    if (!error) await get().fetchSessions()
    return { error }
  },

  // ========== ÉMARGEMENTS (ATTENDANCES) ==========
  attendances: [],
  
  fetchAttendances: async (sessionId) => {
    const { data, error } = await supabase
      .from('attendances')
      .select('*')
      .eq('session_id', sessionId)
      .order('date')
      .order('period')
    if (error) console.error('fetchAttendances error:', error)
    if (!error) set({ attendances: data || [] })
    return { data: data || [], error }
  },
  
  createAttendance: async (attendance) => {
    const { data, error } = await supabase
      .from('attendances')
      .insert([attendance])
      .select()
      .single()
    if (!error && data) {
      set({ attendances: [...get().attendances, data] })
    }
    return { data, error }
  },
  
  getSessionByToken: async (token) => {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        courses(title, duration_hours),
        clients(name),
        session_trainees(trainee_id, status, trainees(id, first_name, last_name, email))
      `)
      .eq('attendance_token', token)
      .single()
    return { data, error }
  },
  
  getAttendancesBySessionAndDate: async (sessionId, date) => {
    const { data, error } = await supabase
      .from('attendances')
      .select('*')
      .eq('session_id', sessionId)
      .eq('date', date)
    return { data: data || [], error }
  },

  // ========== DOCUMENTS ==========
  documents: [],
  documentsLoading: false,
  
  fetchDocuments: async (sessionId = null) => {
    set({ documentsLoading: true })
    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (sessionId) query = query.eq('session_id', sessionId)
    
    const { data, error } = await query
    if (error) console.error('fetchDocuments error:', error)
    if (!error) set({ documents: data || [] })
    set({ documentsLoading: false })
    return { data, error }
  },
  
  createDocument: async (document) => {
    const now = new Date()
    const prefix = {
      convention: 'CONV',
      convocation: 'CVOC',
      attestation: 'ATT',
      certificat: 'CERT',
      emargement: 'EMAR',
      programme: 'PROG',
      evaluation: 'EVAL'
    }[document.doc_type] || 'DOC'
    
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
  
  deleteDocument: async (id) => {
    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (!error) {
      set({ documents: get().documents.filter(d => d.id !== id) })
    }
    return { error }
  },

  // ========== PARAMÈTRES ORGANISME ==========
  orgSettings: null,
  
  fetchOrgSettings: async () => {
    const { data, error } = await supabase
      .from('org_settings')
      .select('*')
      .single()
    if (!error && data) set({ orgSettings: data })
    return { data, error }
  },
  
  updateOrgSettings: async (settings) => {
    const { data: existing } = await supabase.from('org_settings').select('id').single()
    
    let result
    if (existing) {
      result = await supabase.from('org_settings').update(settings).eq('id', existing.id).select().single()
    } else {
      result = await supabase.from('org_settings').insert([settings]).select().single()
    }
    
    if (!result.error && result.data) set({ orgSettings: result.data })
    return result
  },
  
  // ========== FICHIERS UPLOADÉS ==========
  uploadedFiles: [],
  uploadedFilesLoading: false,
  
  fetchUploadedFiles: async () => {
    set({ uploadedFilesLoading: true })
    const { data, error } = await supabase
      .from('uploaded_documents')
      .select('*, sessions(reference), courses(title), clients(name)')
      .order('created_at', { ascending: false })
    if (!error) set({ uploadedFiles: data || [] })
    set({ uploadedFilesLoading: false })
    return { data, error }
  },
  
  uploadFile: async (file, metadata = {}) => {
    // 1. Upload vers Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `uploads/${fileName}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)
    
    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { error: uploadError }
    }
    
    // 2. Obtenir l'URL publique
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)
    
    // 3. Enregistrer dans la base de données
    const docRecord = {
      name: metadata.name || file.name,
      filename: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      mime_type: file.type,
      category: metadata.category || 'other',
      session_id: metadata.session_id || null,
      course_id: metadata.course_id || null,
      client_id: metadata.client_id || null,
      notes: metadata.notes || null,
    }
    
    const { data, error } = await supabase
      .from('uploaded_documents')
      .insert([docRecord])
      .select('*, sessions(reference), courses(title), clients(name)')
      .single()
    
    if (!error && data) {
      set({ uploadedFiles: [data, ...get().uploadedFiles] })
    }
    
    return { data, error }
  },
  
  deleteUploadedFile: async (id, fileUrl) => {
    // 1. Supprimer de la base de données
    const { error } = await supabase
      .from('uploaded_documents')
      .delete()
      .eq('id', id)
    
    if (error) return { error }
    
    // 2. Supprimer du storage (optionnel, extraire le path)
    try {
      const urlParts = fileUrl.split('/uploads/')
      if (urlParts[1]) {
        await supabase.storage.from('documents').remove([`uploads/${urlParts[1]}`])
      }
    } catch (e) {
      console.warn('Storage delete error:', e)
    }
    
    set({ uploadedFiles: get().uploadedFiles.filter(f => f.id !== id) })
    return { error: null }
  },
  
  // ========== TEMPLATES DE DOCUMENTS (RI, Livret) ==========
  documentTemplates: [],
  
  fetchDocumentTemplates: async () => {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .order('code')
    if (!error) set({ documentTemplates: data || [] })
    return { data, error }
  },
  
  getDocumentTemplate: async (code) => {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('code', code)
      .single()
    return { data, error }
  },
  
  updateDocumentTemplate: async (code, updates) => {
    const { data: existing } = await supabase
      .from('document_templates')
      .select('id')
      .eq('code', code)
      .single()
    
    let result
    if (existing) {
      result = await supabase
        .from('document_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('code', code)
        .select()
        .single()
    } else {
      result = await supabase
        .from('document_templates')
        .insert([{ code, ...updates }])
        .select()
        .single()
    }
    
    if (!result.error && result.data) {
      const templates = get().documentTemplates
      const idx = templates.findIndex(t => t.code === code)
      if (idx >= 0) {
        templates[idx] = result.data
        set({ documentTemplates: [...templates] })
      } else {
        set({ documentTemplates: [...templates, result.data] })
      }
    }
    return result
  },

  // ========== CERTIFICATS FORMATEURS ==========
  trainerCertificates: [],
  
  fetchTrainerCertificates: async (trainerId) => {
    const { data, error } = await supabase
      .from('trainer_certificates')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('expiry_date', { ascending: true })
    return { data: data || [], error }
  },
  
  createTrainerCertificate: async (certificate) => {
    console.log('Creating certificate:', certificate)
    const { data, error } = await supabase
      .from('trainer_certificates')
      .insert([certificate])
      .select()
      .single()
    if (error) console.error('Certificate creation error:', error)
    return { data, error }
  },
  
  updateTrainerCertificate: async (id, updates) => {
    const { data, error } = await supabase
      .from('trainer_certificates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },
  
  deleteTrainerCertificate: async (id) => {
    const { error } = await supabase
      .from('trainer_certificates')
      .delete()
      .eq('id', id)
    return { error }
  },

  // ========== DOCUMENTS SESSION (uploadés) ==========
  sessionDocuments: [],
  sessionDocumentsLoading: false,
  
  fetchSessionDocuments: async (sessionId) => {
    set({ sessionDocumentsLoading: true })
    const { data, error } = await supabase
      .from('session_documents')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
    if (error) console.error('fetchSessionDocuments error:', error)
    set({ sessionDocuments: data || [], sessionDocumentsLoading: false })
    return { data: data || [], error }
  },
  
  uploadSessionDocument: async (sessionId, file, category, notes = '') => {
    // Upload file to storage
    const fileName = `${Date.now()}_${file.name}`
    const filePath = `sessions/${sessionId}/${fileName}`
    
    console.log('Uploading to:', filePath)
    
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return { error: uploadError }
    }
    
    // Create record in database
    const { data, error } = await supabase
      .from('session_documents')
      .insert([{
        session_id: sessionId,
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        category,
        file_path: filePath,
        file_name: fileName,
        file_size: file.size,
        notes
      }])
      .select()
      .single()
    
    if (error) {
      console.error('Database insert error:', error)
      return { data: null, error }
    }
    
    if (data) {
      set({ sessionDocuments: [data, ...get().sessionDocuments] })
    }
    return { data, error: null }
  },
  
  deleteSessionDocument: async (id, filePath) => {
    // Delete from storage
    await supabase.storage.from('documents').remove([filePath])
    
    // Delete from database
    const { error } = await supabase
      .from('session_documents')
      .delete()
      .eq('id', id)
    
    if (!error) {
      set({ sessionDocuments: get().sessionDocuments.filter(d => d.id !== id) })
    }
    return { error }
  },
  
  getSessionDocumentUrl: async (filePath) => {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600) // 1 hour
    return data?.signedUrl
  },

  // ========== DOCUMENTS STAGIAIRES ==========
  traineeDocuments: [],
  
  fetchTraineeDocuments: async (traineeId) => {
    const { data, error } = await supabase
      .from('trainee_documents')
      .select('*')
      .eq('trainee_id', traineeId)
      .order('created_at', { ascending: false })
    return { data: data || [], error }
  },
  
  uploadTraineeDocument: async (traineeId, file, category = 'autre', notes = '') => {
    const fileName = `${Date.now()}_${file.name}`
    const filePath = `trainees/${traineeId}/${fileName}`
    
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)
    
    if (uploadError) return { error: uploadError }
    
    const { data, error } = await supabase
      .from('trainee_documents')
      .insert([{
        trainee_id: traineeId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        category,
        file_path: filePath,
        file_name: fileName,
        file_size: file.size,
        notes
      }])
      .select()
      .single()
    
    return { data, error }
  },
  
  deleteTraineeDocument: async (id, filePath) => {
    await supabase.storage.from('documents').remove([filePath])
    const { error } = await supabase
      .from('trainee_documents')
      .delete()
      .eq('id', id)
    return { error }
  },

  // ========== PRÉSENCE PAR JOURNÉE ==========
  fetchAttendance: async (sessionId) => {
    const { data, error } = await supabase
      .from('attendances')
      .select('*')
      .eq('session_id', sessionId)
    return { data: data || [], error }
  },
  
  upsertAttendance: async (sessionId, traineeId, date, present) => {
    console.log('upsertAttendance:', { sessionId, traineeId, date, present })
    
    // Vérifier si l'enregistrement existe
    const { data: existing } = await supabase
      .from('attendances')
      .select('id')
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId)
      .eq('date', date)
      .maybeSingle()
    
    let result
    if (existing) {
      // Update
      result = await supabase
        .from('attendances')
        .update({ present })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      // Insert
      result = await supabase
        .from('attendances')
        .insert({
          session_id: sessionId,
          trainee_id: traineeId,
          date,
          period: 'full', // journée complète par défaut
          present
        })
        .select()
        .single()
    }
    
    if (result.error) console.error('upsertAttendance error:', result.error)
    return result
  },

  // ========== ÉVALUATIONS STAGIAIRES ==========
  fetchTraineeEvaluations: async (sessionId) => {
    const { data, error } = await supabase
      .from('trainee_evaluations')
      .select('*')
      .eq('session_id', sessionId)
    if (error) console.error('fetchTraineeEvaluations error:', error)
    return { data: data || [], error }
  },
  
  upsertTraineeEvaluation: async (sessionId, traineeId, updates) => {
    console.log('upsertTraineeEvaluation:', { sessionId, traineeId, updates })
    
    // Vérifier si l'enregistrement existe
    const { data: existing } = await supabase
      .from('trainee_evaluations')
      .select('id')
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId)
      .maybeSingle()
    
    let result
    if (existing) {
      // Update
      result = await supabase
        .from('trainee_evaluations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      // Insert
      result = await supabase
        .from('trainee_evaluations')
        .insert({
          session_id: sessionId,
          trainee_id: traineeId,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
    }
    
    if (result.error) console.error('upsertTraineeEvaluation error:', result.error)
    return result
  },

  // ========== ÉVALUATION FORMATEUR ==========
  fetchTrainerEvaluation: async (sessionId) => {
    const { data, error } = await supabase
      .from('trainer_evaluations')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle()
    if (error) console.error('fetchTrainerEvaluation error:', error)
    return { data, error }
  },
  
  upsertTrainerEvaluation: async (sessionId, trainerId, updates) => {
    console.log('upsertTrainerEvaluation:', { sessionId, trainerId, updates })
    
    // Vérifier si l'enregistrement existe
    const { data: existing } = await supabase
      .from('trainer_evaluations')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle()
    
    let result
    if (existing) {
      // Update
      result = await supabase
        .from('trainer_evaluations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      // Insert
      result = await supabase
        .from('trainer_evaluations')
        .insert({
          session_id: sessionId,
          trainer_id: trainerId,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
    }
    
    if (result.error) console.error('upsertTrainerEvaluation error:', result.error)
    return result
  },

  // ========== ÉVALUATIONS À FROID (90 jours) ==========
  fetchColdEvaluations: async (sessionId) => {
    const { data, error } = await supabase
      .from('evaluations_cold')
      .select('*')
      .eq('session_id', sessionId)
    if (error) console.error('fetchColdEvaluations error:', error)
    return { data: data || [], error }
  },
  
  upsertColdEvaluation: async (sessionId, traineeId, updates) => {
    console.log('upsertColdEvaluation:', { sessionId, traineeId, updates })
    
    // Vérifier si l'enregistrement existe
    const { data: existing } = await supabase
      .from('evaluations_cold')
      .select('id')
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId)
      .maybeSingle()
    
    let result
    if (existing) {
      result = await supabase
        .from('evaluations_cold')
        .update({ ...updates })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('evaluations_cold')
        .insert({
          session_id: sessionId,
          trainee_id: traineeId,
          ...updates
        })
        .select()
        .single()
    }
    
    if (result.error) console.error('upsertColdEvaluation error:', result.error)
    return result
  },

  // ========== EXPORT COMPLET ==========
  fetchAllEvaluations: async () => {
    try {
      const [hotEvals, trainerEvals, coldEvals, attendances] = await Promise.all([
        supabase.from('trainee_evaluations').select('*'),
        supabase.from('trainer_evaluations').select('*'),
        supabase.from('evaluations_cold').select('*'),
        supabase.from('attendances').select('*'),
      ])
      
      return {
        trainee_evaluations: hotEvals.data || [],
        trainer_evaluations: trainerEvals.data || [],
        evaluations_cold: coldEvals.data || [],
        attendances: attendances.data || [],
      }
    } catch (error) {
      console.error('fetchAllEvaluations error:', error)
      return {
        trainee_evaluations: [],
        trainer_evaluations: [],
        evaluations_cold: [],
        attendances: [],
      }
    }
  },

  // ========== QUALIOPI SESSION ==========
  fetchSessionQualiopi: async (sessionId) => {
    const { data, error } = await supabase
      .from('session_qualiopi')
      .select('*')
      .eq('session_id', sessionId)
      .single()
    return { data, error }
  },
  
  upsertSessionQualiopi: async (sessionId, updates) => {
    const { data, error } = await supabase
      .from('session_qualiopi')
      .upsert({
        session_id: sessionId,
        ...updates,
        updated_at: new Date().toISOString()
      }, { onConflict: 'session_id' })
      .select()
      .single()
    return { data, error }
  },

  // ========== STATISTIQUES GLOBALES ==========
  fetchGlobalStats: async () => {
    // D'abord récupérer les IDs des sessions terminées
    const { data: completedSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('status', 'completed')
    
    const completedIds = completedSessions?.map(s => s.id) || []
    
    if (completedIds.length === 0) {
      return { tauxSatisfaction: 0, tauxRecommandation: 0, tauxPresence: 0, tauxReponse: 0 }
    }
    
    // Taux de satisfaction (sessions terminées uniquement)
    const { data: evalData } = await supabase
      .from('trainee_evaluations')
      .select('satisfaction_score, session_id')
      .in('session_id', completedIds)
      .not('satisfaction_score', 'is', null)
    
    const scores = evalData?.filter(e => e.satisfaction_score) || []
    const avgSatisfaction = scores.length > 0
      ? (scores.reduce((acc, e) => acc + parseFloat(e.satisfaction_score), 0) / scores.length) / 5 * 100
      : 0
    
    // Taux de recommandation (sessions terminées uniquement)
    const { data: recoData } = await supabase
      .from('trainee_evaluations')
      .select('would_recommend, session_id')
      .in('session_id', completedIds)
      .not('would_recommend', 'is', null)
    
    const recoResponses = recoData?.filter(e => e.would_recommend !== null) || []
    const recoYes = recoResponses.filter(e => e.would_recommend).length
    const tauxRecommandation = recoResponses.length > 0 ? (recoYes / recoResponses.length) * 100 : 0
    
    // Taux de présence (sessions terminées uniquement)
    const { data: presenceData } = await supabase
      .from('attendances')
      .select('present, session_id')
      .in('session_id', completedIds)
    
    const totalPresence = presenceData?.length || 0
    const presentCount = presenceData?.filter(p => p.present).length || 0
    const tauxPresence = totalPresence > 0 ? (presentCount / totalPresence) * 100 : 0
    
    // Taux de réponse questionnaires (sessions terminées uniquement)
    const { data: questionnaireData } = await supabase
      .from('trainee_evaluations')
      .select('questionnaire_submitted, session_id')
      .in('session_id', completedIds)
    
    const totalQ = questionnaireData?.length || 0
    const submittedQ = questionnaireData?.filter(q => q.questionnaire_submitted).length || 0
    const tauxReponse = totalQ > 0 ? (submittedQ / totalQ) * 100 : 0
    
    return {
      tauxSatisfaction: Math.round(avgSatisfaction * 10) / 10,
      tauxRecommandation: Math.round(tauxRecommandation * 10) / 10,
      tauxPresence: Math.round(tauxPresence * 10) / 10,
      tauxReponse: Math.round(tauxReponse * 10) / 10,
    }
  },

  // ========== COMPLÉTUDE ==========
  fetchCompletudeReport: async () => {
    const missing = []
    
    const { data: clients } = await supabase.from('clients').select('*')
    clients?.forEach(c => {
      const m = []
      if (!c.name) m.push('Nom')
      if (!c.siret) m.push('SIRET')
      if (!c.address) m.push('Adresse')
      if (!c.contact_email) m.push('Email contact')
      if (!c.contact_name) m.push('Contact')
      if (m.length > 0) missing.push({ type: 'Client', name: c.name || 'Sans nom', fields: m })
    })
    
    const { data: trainees } = await supabase.from('trainees').select('*')
    trainees?.forEach(t => {
      const m = []
      if (!t.first_name) m.push('Prénom')
      if (!t.last_name) m.push('Nom')
      if (!t.email) m.push('Email')
      if (m.length > 0) missing.push({ type: 'Stagiaire', name: `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Sans nom', fields: m })
    })
    
    const { data: trainers } = await supabase.from('trainers').select('*')
    trainers?.forEach(t => {
      const m = []
      if (!t.first_name) m.push('Prénom')
      if (!t.last_name) m.push('Nom')
      if (!t.email) m.push('Email')
      if (!t.specialties) m.push('Spécialités')
      if (m.length > 0) missing.push({ type: 'Formateur', name: `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Sans nom', fields: m })
    })
    
    const { data: sessions } = await supabase.from('sessions').select('*')
    sessions?.forEach(s => {
      const m = []
      if (!s.course_id) m.push('Formation')
      if (!s.client_id) m.push('Client')
      if (!s.trainer_id) m.push('Formateur')
      // Le lieu n'est requis que si ce n'est pas intra (chez le client)
      if (!s.is_intra && !s.location_name && !s.location_address) m.push('Lieu')
      if (m.length > 0) missing.push({ type: 'Session', name: s.reference || 'Sans réf', fields: m })
    })
    
    const total = (clients?.length || 0) + (trainees?.length || 0) + (trainers?.length || 0) + (sessions?.length || 0)
    const completude = total > 0 ? Math.round(((total - missing.length) / total) * 100) : 0
    
    return { completude, missing }
  },

  // ========== RAPPORT QUALIOPI ==========
  fetchQualiopiReport: async () => {
    const issues = []
    
    // Charger les sessions avec leurs relations
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
    
    // Vérifier chaque session
    sessions?.forEach(s => {
      // Indicateur 1 - Info précontractuelle
      if (!s.course_id) {
        issues.push({ indicateur: 1, session: s.reference, probleme: 'Formation non définie' })
      }
      
      // Indicateur 5 - Objectifs et contenus
      // (vérifié via courses.objectives)
      
      // Indicateur 11 - Attestations
      if (s.status === 'completed') {
        // Session terminée devrait avoir des attestations
      }
      
      // Indicateur 17 - Formateur qualifié
      if (!s.trainer_id) {
        issues.push({ indicateur: 17, session: s.reference, probleme: 'Aucun formateur assigné' })
      }
    })
    
    // Charger les formateurs
    const { data: trainers } = await supabase.from('trainers').select('*')
    
    trainers?.forEach(t => {
      if (!t.qualifications && !t.certifications) {
        issues.push({ indicateur: 21, session: `Formateur ${t.first_name} ${t.last_name}`, probleme: 'Qualifications non renseignées' })
      }
    })
    
    // Calculer le score
    const totalChecks = (sessions?.length || 0) * 3 + (trainers?.length || 0)
    const score = totalChecks > 0 ? Math.round(((totalChecks - issues.length) / totalChecks) * 100) : 100
    
    return { score: Math.max(0, Math.min(100, score)), issues }
  },
  
  // ============================================================
  // QUESTIONS DE POSITIONNEMENT
  // ============================================================
  courseQuestions: [],
  
  fetchCourseQuestions: async (courseId) => {
    // D'abord, récupérer le cours pour avoir son theme_id
    const { data: course } = await supabase
      .from('courses')
      .select('theme_id')
      .eq('id', courseId)
      .single()
    
    // Si le cours a un theme_id, charger les questions du thème
    if (course?.theme_id) {
      const { data, error } = await supabase
        .from('theme_questions')
        .select('*')
        .eq('theme_id', course.theme_id)
        .order('position', { ascending: true })
      if (!error) set({ courseQuestions: data || [] })
      return { data: data || [], error }
    }
    
    // Sinon essayer course_questions (ancienne méthode)
    const { data, error } = await supabase
      .from('course_questions')
      .select('*')
      .eq('course_id', courseId)
      .order('position', { ascending: true })
    if (!error) set({ courseQuestions: data || [] })
    return { data: data || [], error }
  },
  
  createCourseQuestion: async (courseId, question) => {
    const { data, error } = await supabase
      .from('course_questions')
      .insert([{ ...question, course_id: courseId }])
      .select()
      .single()
    if (error) {
      console.error('Erreur création question:', error)
    }
    if (!error && data) {
      set(state => ({ courseQuestions: [...state.courseQuestions, data] }))
    }
    return { data, error }
  },
  
  updateCourseQuestion: async (id, updates) => {
    const { data, error } = await supabase
      .from('course_questions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error) {
      set(state => ({
        courseQuestions: state.courseQuestions.map(q => q.id === id ? data : q)
      }))
    }
    return { data, error }
  },
  
  deleteCourseQuestion: async (id) => {
    const { error } = await supabase
      .from('course_questions')
      .delete()
      .eq('id', id)
    if (!error) {
      set(state => ({
        courseQuestions: state.courseQuestions.filter(q => q.id !== id)
      }))
    }
    return { error }
  },
  
  reorderCourseQuestions: async (courseId, questionIds) => {
    // Met à jour les positions
    const updates = questionIds.map((id, index) => 
      supabase.from('course_questions').update({ position: index }).eq('id', id)
    )
    await Promise.all(updates)
    // Recharge
    const { data } = await supabase
      .from('course_questions')
      .select('*')
      .eq('course_id', courseId)
      .order('position', { ascending: true })
    set({ courseQuestions: data || [] })
  },

  // ========== THÈMES DE FORMATION ==========
  themes: [],
  
  fetchThemes: async () => {
    const { data, error } = await supabase
      .from('training_themes')
      .select('*')
      .order('position')
    if (!error) set({ themes: data || [] })
    return { data, error }
  },

  // ========== TESTS PAR THÈME ==========
  themeQuestions: [],
  
  fetchThemeQuestions: async (themeId) => {
    const { data, error } = await supabase
      .from('theme_questions')
      .select('*')
      .eq('theme_id', themeId)
      .order('position')
    if (!error) set({ themeQuestions: data || [] })
    return { data, error }
  },
  
  createThemeQuestion: async (themeId, question) => {
    const { data, error } = await supabase
      .from('theme_questions')
      .insert([{ ...question, theme_id: themeId }])
      .select()
      .single()
    if (!error && data) {
      set(state => ({ themeQuestions: [...state.themeQuestions, data] }))
    }
    return { data, error }
  },
  
  updateThemeQuestion: async (id, updates) => {
    const { data, error } = await supabase
      .from('theme_questions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      set(state => ({
        themeQuestions: state.themeQuestions.map(q => q.id === id ? data : q)
      }))
    }
    return { data, error }
  },
  
  deleteThemeQuestion: async (id) => {
    const { error } = await supabase
      .from('theme_questions')
      .delete()
      .eq('id', id)
    if (!error) {
      set(state => ({
        themeQuestions: state.themeQuestions.filter(q => q.id !== id)
      }))
    }
    return { error }
  },

  // ========== ORGANISATION SETTINGS ==========
  organization: null,
  
  fetchOrganization: async () => {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('*')
      .single()
    if (!error && data) set({ organization: data })
    return { data, error }
  },
  
  updateOrganization: async (updates) => {
    const org = get().organization
    
    // Ne garder que les champs de base qui existent certainement
    const basicFields = {
      name: updates.name,
      address: updates.address,
      postal_code: updates.postal_code,
      city: updates.city,
      phone: updates.phone,
      email: updates.email,
      siret: updates.siret,
      nda: updates.nda,
    }
    
    // Essayer d'ajouter les champs optionnels
    const optionalFields = {}
    if (updates.logo_base64 !== undefined) optionalFields.logo_base64 = updates.logo_base64
    if (updates.stamp_base64 !== undefined) optionalFields.stamp_base64 = updates.stamp_base64
    if (updates.reglement_interieur !== undefined) optionalFields.reglement_interieur = updates.reglement_interieur
    if (updates.reglement_version !== undefined) optionalFields.reglement_version = updates.reglement_version
    if (updates.livret_accueil !== undefined) optionalFields.livret_accueil = updates.livret_accueil
    if (updates.livret_version !== undefined) optionalFields.livret_version = updates.livret_version
    
    const allUpdates = { ...basicFields, ...optionalFields, updated_at: new Date().toISOString() }
    
    console.log('Updating organization:', allUpdates)
    
    if (!org) {
      // Créer si n'existe pas
      const { data, error } = await supabase
        .from('organization_settings')
        .insert([allUpdates])
        .select()
        .single()
      if (error) console.error('Organization insert error:', error)
      if (!error && data) set({ organization: data })
      return { data, error }
    }
    
    const { data, error } = await supabase
      .from('organization_settings')
      .update(allUpdates)
      .eq('id', org.id)
      .select()
      .single()
    if (error) console.error('Organization update error:', error)
    if (!error && data) set({ organization: data })
    return { data, error }
  },

  // ========== NON-CONFORMITÉS ==========
  nonConformities: [],
  
  fetchNonConformities: async () => {
    const { data, error } = await supabase
      .from('non_conformites')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('fetchNonConformities error:', error)
    if (!error) set({ nonConformities: data || [] })
    return { data, error }
  },
  
  createNonConformity: async (nc) => {
    const ref = `NC-${Date.now().toString(36).toUpperCase()}`
    console.log('Creating NC:', { ...nc, reference: ref })
    const { data, error } = await supabase
      .from('non_conformites')
      .insert([{ ...nc, reference: ref }])
      .select()
      .single()
    if (error) console.error('NC creation error:', error)
    if (!error && data) {
      set(state => ({ nonConformities: [data, ...state.nonConformities] }))
    }
    return { data, error }
  },
  
  updateNonConformity: async (id, updates) => {
    console.log('Updating NC:', id, updates)
    const { data, error } = await supabase
      .from('non_conformites')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) console.error('NC update error:', error)
    if (!error && data) {
      set(state => ({
        nonConformities: state.nonConformities.map(nc => nc.id === id ? data : nc)
      }))
    }
    return { data, error }
  },
  
  deleteNonConformity: async (id) => {
    const { error } = await supabase
      .from('non_conformites')
      .delete()
      .eq('id', id)
    if (!error) {
      set(state => ({
        nonConformities: state.nonConformities.filter(nc => nc.id !== id)
      }))
    }
    return { error }
  },

  // ========== APP VERSIONS (Changelog) ==========
  appVersions: [],
  
  fetchAppVersions: async () => {
    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .order('release_date', { ascending: false })
    if (!error) set({ appVersions: data || [] })
    return { data, error }
  },

  // ========== DUPLICATION ==========
  duplicateCourse: async (courseId) => {
    const course = get().courses.find(c => c.id === courseId)
    if (!course) return { error: 'Formation non trouvée' }
    
    const newCourse = {
      title: `${course.title} (copie)`,
      code: `${course.code || 'F'}-${Date.now().toString(36).toUpperCase()}`,
      description: course.description || null,
      objectives: course.objectives || null,
      prerequisites: course.prerequisites || null,
      target_audience: course.target_audience || null,
      duration_hours: course.duration_hours || null,
      duration: course.duration || null,
      price_ht: course.price_ht || null,
      price_per_day: course.price_per_day || null,
      theme_id: course.theme_id || null,
      content: course.content || null,
      program: course.program || null,
      methods: course.methods || null,
      material: course.material || null,
    }
    
    const { data, error } = await supabase
      .from('courses')
      .insert([newCourse])
      .select()
      .single()
    
    if (error) {
      console.error('Erreur duplication:', error)
    }
    if (!error && data) {
      set(state => ({ courses: [...state.courses, data] }))
    }
    return { data, error }
  },
  
  duplicateSession: async (sessionId) => {
    const session = get().sessions.find(s => s.id === sessionId)
    if (!session) return { error: 'Session non trouvée' }
    
    const ref = `SES-DUP-${Date.now().toString(36).toUpperCase()}`
    const newSession = {
      course_id: session.course_id,
      client_id: session.client_id,
      trainer_id: session.trainer_id,
      reference: ref,
      start_date: null,
      end_date: null,
    }
    
    const { data, error } = await supabase
      .from('sessions')
      .insert([newSession])
      .select()
      .single()
    
    if (error) {
      console.error('Duplicate session error:', error)
      return { data: null, error }
    }
    
    if (data) {
      await get().fetchSessions()
    }
    return { data, error: null }
  },
}))
