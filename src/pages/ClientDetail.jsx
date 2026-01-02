import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function ClientDetail() {
  return (
    <div>
      <Link to="/clients" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Retour aux clients
      </Link>
      <div className="card text-center py-12">
        <p className="text-gray-500">Détail du client - fonctionnalité à venir</p>
      </div>
    </div>
  )
}
