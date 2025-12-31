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
  
  updateTrainer: async (id, updates) => {
    const { data, error } = await supabase
      .from('trainers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
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
      .select(`
        *,
        courses(id, code, title, duration_hours, objectives, program, price_ht, price_ttc, prerequisites, target_audience, pedagogical_methods, evaluation_methods, delivered_documents),
        clients(id, name, address, postal_code, city, siret, email, phone, contact_name, contact_function, contact_email, contact_phone),
        session_trainers(trainer_id, trainers(id, first_name, last_name, email)),
        session_trainees(id, trainee_id, status, trainees(id, first_name, last_name, email))
      `)
      .order('start_date', { ascending: false })
    if (!error) set({ sessions: data || [] })
    set({ sessionsLoading: false })
    return { data, error }
  },
  
  getSession: async (id) => {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        courses(id, code, title, duration_hours, objectives, program, prerequisites, target_audience),
        clients(id, name, address, postal_code, city, siret, email, phone),
        session_trainers(trainer_id, trainers(id, first_name, last_name, email, phone)),
        session_trainees(id, trainee_id, status, trainees(id, first_name, last_name, email, client_id))
      `)
      .eq('id', id)
      .single()
    if (!error) set({ currentSession: data })
    return { data, error }
  },
  
  createSession: async (sessionData) => {
    // Générer référence
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)
    
    const reference = `SES-${year}-${String((count || 0) + 1).padStart(4, '0')}`
    const attendance_token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, 32)
    
    const { trainer_ids, trainee_ids, ...session } = sessionData
    
    const { data, error } = await supabase
      .from('sessions')
      .insert([{ ...session, reference, attendance_token }])
      .select()
      .single()
    
    if (!error && data) {
      // Ajouter les formateurs
      if (trainer_ids?.length) {
        await supabase.from('session_trainers').insert(
          trainer_ids.map(tid => ({ session_id: data.id, trainer_id: tid }))
        )
      }
      // Ajouter les stagiaires
      if (trainee_ids?.length) {
        await supabase.from('session_trainees').insert(
          trainee_ids.map(tid => ({ session_id: data.id, trainee_id: tid, status: 'enrolled' }))
        )
      }
      await get().fetchSessions()
    }
    return { data, error }
  },
  
  updateSession: async (id, updates) => {
    const { trainer_ids, trainee_ids, ...sessionUpdates } = updates
    
    const { data, error } = await supabase
      .from('sessions')
      .update(sessionUpdates)
      .eq('id', id)
      .select()
      .single()
    
    if (!error && data) {
      // Mettre à jour les formateurs si fournis
      if (trainer_ids !== undefined) {
        await supabase.from('session_trainers').delete().eq('session_id', id)
        if (trainer_ids.length) {
          await supabase.from('session_trainers').insert(
            trainer_ids.map(tid => ({ session_id: id, trainer_id: tid }))
          )
        }
      }
      // Mettre à jour les stagiaires si fournis
      if (trainee_ids !== undefined) {
        await supabase.from('session_trainees').delete().eq('session_id', id)
        if (trainee_ids.length) {
          await supabase.from('session_trainees').insert(
            trainee_ids.map(tid => ({ session_id: id, trainee_id: tid, status: 'enrolled' }))
          )
        }
      }
      await get().fetchSessions()
    }
    return { data, error }
  },
  
  deleteSession: async (id) => {
    // Supprimer d'abord les relations
    await supabase.from('session_trainers').delete().eq('session_id', id)
    await supabase.from('session_trainees').delete().eq('session_id', id)
    await supabase.from('attendances').delete().eq('session_id', id)
    
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (!error) {
      set({ sessions: get().sessions.filter(s => s.id !== id) })
    }
    return { error }
  },
  
  addTraineeToSession: async (sessionId, traineeId) => {
    const { data, error } = await supabase
      .from('session_trainees')
      .insert([{ session_id: sessionId, trainee_id: traineeId, status: 'enrolled' }])
      .select()
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
      .select('*, trainees(first_name, last_name)')
      .eq('session_id', sessionId)
      .order('date')
      .order('period')
    if (!error) set({ attendances: data || [] })
    return { data, error }
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
      .select('*, sessions(reference, courses(title))')
      .order('created_at', { ascending: false })
    
    if (sessionId) query = query.eq('session_id', sessionId)
    
    const { data, error } = await query
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
    const { data, error } = await supabase
      .from('trainer_certificates')
      .insert([certificate])
      .select()
      .single()
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
    set({ sessionDocuments: data || [], sessionDocumentsLoading: false })
    return { data: data || [], error }
  },
  
  uploadSessionDocument: async (sessionId, file, category, notes = '') => {
    // Upload file to storage
    const fileName = `${Date.now()}_${file.name}`
    const filePath = `sessions/${sessionId}/${fileName}`
    
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)
    
    if (uploadError) return { error: uploadError }
    
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
    
    if (!error && data) {
      set({ sessionDocuments: [data, ...get().sessionDocuments] })
    }
    return { data, error }
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
}))
