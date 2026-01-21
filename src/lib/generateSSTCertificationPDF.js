import { PDFDocument } from 'pdf-lib'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * Génère le PDF de certification SST en remplissant les vrais PDF INRS
 * Utilise les templates officiels avec champs de formulaire
 */
export async function generateSSTCertificationPDF(certification, trainee, session, trainer) {
  const isFI = certification.formation_type === 'FI'
  
  // Charger le template PDF approprié
  const templatePath = isFI 
    ? '/templates/sst/FI.pdf'  // Formation Initiale
    : '/templates/sst/MAC.pdf' // MAC
  
  try {
    // Charger le PDF template
    const existingPdfBytes = await fetch(templatePath).then(res => res.arrayBuffer())
    const pdfDoc = await PDFDocument.load(existingPdfBytes)
    
    // Récupérer le formulaire
    const form = pdfDoc.getForm()
    
    // === PAGE 1 : Informations candidat et session ===
    
    // Candidat
    const nomField = form.getTextField('Nom')
    nomField.setText(trainee.last_name || '')
    
    const prenomField = form.getTextField('Prénom')
    prenomField.setText(trainee.first_name || '')
    
    const dateNaissanceField = form.getTextField('Date de naissance')
    if (trainee.birth_date) {
      dateNaissanceField.setText(format(new Date(trainee.birth_date), 'dd/MM/yyyy'))
    }
    
    // Session
    const dateDebutField = form.getTextField('Date début')
    dateDebutField.setText(format(new Date(session.start_date), 'dd/MM/yyyy'))
    
    const dateFinField = form.getTextField('Date fin')
    dateFinField.setText(format(new Date(session.end_date), 'dd/MM/yyyy'))
    
    // === COMPÉTENCES (cases à cocher) ===
    
    // Mapping des compétences
    const competences = isFI 
      ? [
          { db: 'c1_acquis', acquis: 'Acquise', nonAcquis: 'Non acquise' },
          { db: 'c2_acquis', acquis: 'Acquise_2', nonAcquis: 'Non acquise_2' },
          { db: 'c3_acquis', acquis: 'Acquise_3', nonAcquis: 'Non acquise_3' },
          { db: 'c4_acquis', acquis: 'Acquise_4', nonAcquis: 'Non acquise_4' },
          { db: 'c5_acquis', acquis: 'Acquise_5', nonAcquis: 'Non acquise_5' },
          { db: 'c6_acquis', acquis: 'Acquise_6', nonAcquis: 'Non acquise_6' },
          { db: 'c7_acquis', acquis: 'Acquise_7', nonAcquis: 'Non acquise_7' },
          { db: 'c8_acquis', acquis: 'Acquise_8', nonAcquis: 'Non acquise_8' },
        ]
      : [
          // MAC : C2 à C8 (pas de C1)
          { db: 'c2_acquis', acquis: 'Acquise', nonAcquis: 'Non acquise' },
          { db: 'c3_acquis', acquis: 'Acquise_2', nonAcquis: 'Non acquise_2' },
          { db: 'c4_acquis', acquis: 'Acquise_3', nonAcquis: 'Non acquise_3' },
          { db: 'c5_acquis', acquis: 'Acquise_4', nonAcquis: 'Non acquise_4' },
          { db: 'c6_acquis', acquis: 'Acquise_5', nonAcquis: 'Non acquise_5' },
          { db: 'c7_acquis', acquis: 'Acquise_6', nonAcquis: 'Non acquise_6' },
          { db: 'c8_acquis', acquis: 'Acquise_7', nonAcquis: 'Non acquise_7' },
        ]
    
    // Cocher les cases de compétences
    competences.forEach(comp => {
      const value = certification[comp.db]
      
      if (value === true) {
        // Compétence acquise
        const acquisField = form.getCheckBox(comp.acquis)
        acquisField.check()
      } else if (value === false) {
        // Compétence non acquise
        const nonAcquisField = form.getCheckBox(comp.nonAcquis)
        nonAcquisField.check()
      }
      // Si null/undefined, on ne coche rien
    })
    
    // === PAGE 2 : Formateur et résultat ===
    
    // Formateur
    const nomFormateurField = form.getTextField('Nom Formateur')
    nomFormateurField.setText(trainer?.last_name || '')
    
    const prenomFormateurField = form.getTextField('Prénom Formateur')
    prenomFormateurField.setText(trainer?.first_name || '')
    
    // Date de certification
    const dateCertifField = form.getTextField('Date Certification')
    dateCertifField.setText(format(new Date(certification.date_certification), 'dd/MM/yyyy'))
    
    // Résultat final (OUI/NON)
    if (certification.candidat_certifie) {
      const ouiField = form.getCheckBox('OUI')
      ouiField.check()
    } else {
      const nonField = form.getCheckBox('NON')
      nonField.check()
    }
    
    // Aplatir le formulaire (rendre les champs non modifiables)
    form.flatten()
    
    // Sauvegarder le PDF modifié
    const pdfBytes = await pdfDoc.save()
    
    // Télécharger le PDF
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Grille_SST_${isFI ? 'FI' : 'MAC'}_${trainee.last_name}_${trainee.first_name}.pdf`
    link.click()
    URL.revokeObjectURL(url)
    
    return link.download
    
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error)
    throw new Error(`Impossible de charger le template ${templatePath}. Vérifiez que le fichier existe dans public/templates/sst/`)
  }
}
