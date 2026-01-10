import { ClipboardList } from 'lucide-react'

export default function Questionnaires() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Questionnaires</h1>
      
      <div className="card text-center py-12">
        <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">Module questionnaires</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          La gestion des questionnaires de satisfaction sera disponible dans une prochaine version.
          Vous pourrez créer des questionnaires à chaud et à froid, les envoyer automatiquement, et analyser les résultats.
        </p>
      </div>
    </div>
  )
}
