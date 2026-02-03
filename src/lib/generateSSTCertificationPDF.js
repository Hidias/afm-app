import { PDFDocument, PDFName } from 'pdf-lib'
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
    
    // === DEBUG ===
    console.log('🔍 === DEBUG INDICATEURS ===')
    console.log('🔍 formation_type:', certification.formation_type)
    console.log('🔍 config keys:', Object.keys(config))
    console.log('🔍 certification sample:', {
      c2_ind1: certification.c2_ind1,
      c2_ind2: certification.c2_ind2,
      c3_ind1: certification.c3_ind1
    })
    
    // Cocher les cases d'indicateurs selon l'évaluation
    Object.values(config).forEach(comp => {
      console.log(`🔍 Compétence ${comp.code}: ${comp.indicateurs.length} indicateurs`)
      
      comp.indicateurs.forEach(ind => {
        const value = certification[ind.id]
        console.log(`  🔍 ${ind.id} = ${value}`)
        console.log(`     → Acquis: "${ind.pdfAcquis}" / Non acquis: "${ind.pdfNonAcquis}"`)
        
        try {
          if (value === true) {
            console.log(`     ✅ Coche "${ind.pdfAcquis}"...`)
            const checkbox = form.getCheckBox(ind.pdfAcquis)
            checkbox.acroField.setValue(PDFName.of('Oui'))
            console.log(`     ✅ COCHÉE avec valeur "Oui" !`)
          } else if (value === false) {
            console.log(`     ❌ Coche "${ind.pdfNonAcquis}"...`)
            const checkbox = form.getCheckBox(ind.pdfNonAcquis)
            checkbox.acroField.setValue(PDFName.of('Oui'))
            console.log(`     ❌ COCHÉE avec valeur "Oui" !`)
          } else {
            console.log(`     ⚪ Null - non évalué`)
          }
        } catch (error) {
          console.error(`     💥 ERREUR:`, error.message)
          console.warn(`Case "${ind.pdfAcquis}" ou "${ind.pdfNonAcquis}" introuvable`, error)
        }
      })
    })
    console.log('=== FIN DEBUG INDICATEURS ===')
    
    // === RÉSUMÉ DES COMPÉTENCES (page 2) ===
    
    console.log('🔍 === DEBUG RÉSUMÉ ===')
    console.log('🔍 isFI:', isFI)
    
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
      console.log(`🔍 ${comp.db} = ${value} → "${comp.acquis}"`)
      
      try {
        if (value === true) {
          console.log(`  ✅ Coche "${comp.acquis}"...`)
          const checkbox = form.getCheckBox(comp.acquis)
          checkbox.acroField.setValue(PDFName.of('On'))
          console.log(`  ✅ COCHÉE avec valeur "On" !`)
        } else if (value === false) {
          console.log(`  ❌ Coche "${comp.nonAcquis}"...`)
          const checkbox = form.getCheckBox(comp.nonAcquis)
          checkbox.acroField.setValue(PDFName.of('On'))
          console.log(`  ❌ COCHÉE avec valeur "On" !`)
        }
      } catch (error) {
        console.error(`  💥 ERREUR:`, error.message)
        console.warn(`Case compétence "${comp.acquis}" introuvable`, error)
      }
    })
    console.log('=== FIN DEBUG RÉSUMÉ ===')
    
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
        const x = 130
        const y = 320
        
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
      }
    }
    
    // === RÉSULTAT FINAL ===
    
    console.log('🔍 === DEBUG RÉSULTAT FINAL ===')
    console.log('🔍 candidat_certifie:', certification.candidat_certifie)
    
    try {
      if (certification.candidat_certifie) {
        console.log('✅ Coche "OUI"...')
        const checkbox = form.getCheckBox('OUI')
        checkbox.acroField.setValue(PDFName.of('On'))
        console.log('✅ COCHÉE avec valeur "On" !')
      } else {
        console.log('❌ Coche "NON"...')
        const checkbox = form.getCheckBox('NON')
        checkbox.acroField.setValue(PDFName.of('On'))
        console.log('❌ COCHÉE avec valeur "On" !')
      }
    } catch (error) {
      console.error('💥 ERREUR résultat:', error.message)
    }
    
    // Aplatir le formulaire
    try {
      form.flatten()
      console.log('✅ Formulaire aplati avec succès')
    } catch (flattenError) {
      console.warn('⚠️ Impossible d\'aplatir le formulaire, le PDF restera éditable:', flattenError.message)
    }
    
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
