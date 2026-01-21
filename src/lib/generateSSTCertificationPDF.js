import { PDFDocument } from 'pdf-lib'
import { format } from 'date-fns'
import { getCompetencesConfig } from './sstCompetencesConfig'

/**
 * Génère le PDF de certification SST en remplissant les vrais PDF INRS
 * avec toutes les cases d'indicateurs cochées selon l'évaluation du formateur
 */
export async function generateSSTCertificationPDF(certification, trainee, session, trainer) {
  const isFI = certification.formation_type === 'FI'
  
  // Charger le template PDF approprié
  const templatePath = isFI 
    ? '/templates/sst/FI.pdf'
    : '/templates/sst/MAC.pdf'
  
  try {
    console.log('📥 Chargement du template:', templatePath)
    
    const response = await fetch(templatePath)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Impossible de charger ${templatePath}`)
    }
    
    const existingPdfBytes = await response.arrayBuffer()
    console.log('📦 PDF chargé:', existingPdfBytes.byteLength, 'bytes')
    
    // Charger le PDF template
    const pdfDoc = await PDFDocument.load(existingPdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
      throwOnInvalidObject: false
    })
    
    console.log('✅ PDF document chargé avec succès')
    
    // Récupérer le formulaire
    const form = pdfDoc.getForm()
    
    const fields = form.getFields()
    console.log(`📋 Formulaire trouvé avec ${fields.length} champs`)
    
    if (fields.length === 0) {
      throw new Error('Le PDF ne contient aucun champ de formulaire')
    }
    
    // === INFORMATIONS CANDIDAT ET SESSION ===
    
    form.getTextField('Nom').setText(trainee.last_name || '')
    form.getTextField('Prénom').setText(trainee.first_name || '')
    
    if (trainee.birth_date) {
      form.getTextField('Date de naissance').setText(
        format(new Date(trainee.birth_date), 'dd/MM/yyyy')
      )
    }
    
    form.getTextField('Date début').setText(
      format(new Date(session.start_date), 'dd/MM/yyyy')
    )
    form.getTextField('Date fin').setText(
      format(new Date(session.end_date), 'dd/MM/yyyy')
    )
    
    // === INDICATEURS DÉTAILLÉS ===
    
    const config = getCompetencesConfig(certification.formation_type)
    
    // Cocher les cases d'indicateurs selon l'évaluation
    Object.values(config).forEach(comp => {
      comp.indicateurs.forEach(ind => {
        const value = certification[ind.id] // true, false ou null
        
        try {
          if (value === true) {
            // Cocher "Acquis"
            form.getCheckBox(ind.pdfAcquis).check()
          } else if (value === false) {
            // Cocher "Non acquis"
            form.getCheckBox(ind.pdfNonAcquis).check()
          }
          // Si null, ne rien cocher (non évalué)
        } catch (error) {
          console.warn(`Case "${ind.pdfAcquis}" ou "${ind.pdfNonAcquis}" introuvable`, error)
        }
      })
    })
    
    // === RÉSUMÉ DES COMPÉTENCES (page 2) ===
    
    // Cocher les cases "Acquise" / "Non acquise" pour chaque compétence
    const competencesMapping = isFI 
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
          { db: 'c2_acquis', acquis: 'Acquise', nonAcquis: 'Non acquise' },
          { db: 'c3_acquis', acquis: 'Acquise_2', nonAcquis: 'Non acquise_2' },
          { db: 'c4_acquis', acquis: 'Acquise_3', nonAcquis: 'Non acquise_3' },
          { db: 'c5_acquis', acquis: 'Acquise_4', nonAcquis: 'Non acquise_4' },
          { db: 'c6_acquis', acquis: 'Acquise_5', nonAcquis: 'Non acquise_5' },
          { db: 'c7_acquis', acquis: 'Acquise_6', nonAcquis: 'Non acquise_6' },
          { db: 'c8_acquis', acquis: 'Acquise_7', nonAcquis: 'Non acquise_7' },
        ]
    
    competencesMapping.forEach(comp => {
      const value = certification[comp.db]
      
      try {
        if (value === true) {
          form.getCheckBox(comp.acquis).check()
        } else if (value === false) {
          form.getCheckBox(comp.nonAcquis).check()
        }
      } catch (error) {
        console.warn(`Case compétence "${comp.acquis}" introuvable`, error)
      }
    })
    
    // === FORMATEUR ===
    
    form.getTextField('Nom Formateur').setText(trainer?.last_name || '')
    form.getTextField('Prénom Formateur').setText(trainer?.first_name || '')
    form.getTextField('Date Certification').setText(
      format(new Date(certification.date_certification), 'dd/MM/yyyy')
    )
    
    // === SIGNATURE DU FORMATEUR ===
    if (certification.formateur_signature_url) {
      try {
        console.log('📝 Ajout de la signature du formateur')
        
        // Charger l'image de signature
        const signatureResponse = await fetch(certification.formateur_signature_url)
        const signatureBytes = await signatureResponse.arrayBuffer()
        
        // Déterminer le type d'image
        const isPng = certification.formateur_signature_url.toLowerCase().includes('.png')
        const signatureImage = isPng 
          ? await pdfDoc.embedPng(signatureBytes)
          : await pdfDoc.embedJpg(signatureBytes)
        
        // Récupérer la page 2 (index 1)
        const pages = pdfDoc.getPages()
        const page2 = pages[1]
        
        // Dimensions de la signature (ajuster selon besoin)
        const signatureWidth = 100
        const signatureHeight = 40
        
        // Position de la signature dans le tableau formateur
        // Dans l'espace entre "Signature :" et "Date de certification :"
        // Coordonnées PDF : origine en bas à gauche
        const x = 260  // Position horizontale (à droite de "Signature :")
        const y = 118  // Position verticale depuis le bas (centré dans l'espace jaune)
        
        // Dessiner la signature sur la page
        page2.drawImage(signatureImage, {
          x: x,
          y: y,
          width: signatureWidth,
          height: signatureHeight,
        })
        
        console.log('✅ Signature ajoutée au PDF')
      } catch (error) {
        console.warn('⚠️ Erreur lors de l\'ajout de la signature:', error)
        // On continue même si la signature échoue
      }
    }
    
    // === RÉSULTAT FINAL ===
    
    if (certification.candidat_certifie) {
      form.getCheckBox('OUI').check()
    } else {
      form.getCheckBox('NON').check()
    }
    
    // Aplatir le formulaire
    form.flatten()
    
    // Sauvegarder le PDF
    const pdfBytes = await pdfDoc.save()
    
    // Télécharger
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
    throw new Error(`Impossible de charger le template ${templatePath}`)
  }
}
