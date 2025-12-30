// Documents.jsx
import { useEffect } from 'react'
import { useDataStore } from '../lib/store'
import { FileText, Download, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Documents() {
  const { documents, documentsLoading, fetchDocuments } = useDataStore()
  
  useEffect(() => { fetchDocuments() }, [])
  
  const docTypes = {
    convention: 'Convention',
    convocation: 'Convocation',
    program: 'Programme',
    attendance_sheet: 'Feuille émargement',
    certificate: 'Attestation',
    invoice: 'Facture'
  }
  
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Documents</h1><p className="text-gray-500 mt-1">{documents.length} document(s)</p></div>
      
      <div className="card p-0 overflow-hidden">
        {documentsLoading ? (
          <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div></div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun document. Les documents sont générés automatiquement depuis les sessions.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><FileText className="w-5 h-5 text-gray-600" /></div>
                  <div>
                    <p className="font-medium text-gray-900">{doc.number}</p>
                    <p className="text-sm text-gray-500">{docTypes[doc.doc_type] || doc.doc_type} • {doc.sessions?.reference || ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{doc.created_at && format(new Date(doc.created_at), 'd MMM yyyy', { locale: fr })}</span>
                  <span className="badge badge-green"><CheckCircle className="w-3 h-3 mr-1" /> Prêt</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
