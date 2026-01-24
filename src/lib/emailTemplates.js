/**
 * Génère le HTML de l'email de convocation avec code d'accès
 * @param {Object} params - Paramètres de l'email
 * @returns {string} - HTML de l'email
 */
export function generateConvocationEmail({
  trainee,
  session,
  course,
  accessCode,
  groupName,
  companyName,
  isViaCompanyContact = false // NOUVEAU : pour savoir si c'est envoyé au contact
}) {
  const startDate = new Date(session.start_date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  const endDate = new Date(session.end_date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const portalUrl = `${window.location.origin}/portail/${accessCode}`

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convocation à la formation</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Container principal -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header avec logo et couleur -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                🎓 Convocation à la formation
              </h1>
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <!-- Salutation -->
              <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">
                Bonjour${isViaCompanyContact ? '' : ` <strong>${trainee.first_name} ${trainee.last_name}</strong>`},
              </p>

              ${isViaCompanyContact ? `
              <p style="font-size: 16px; color: #555555; line-height: 1.6; margin: 0 0 20px 0;">
                Nous vous adressons la convocation pour votre collaborateur :
              </p>
              
              <div style="background-color: #f0f7ff; border: 2px solid #2196F3; border-radius: 8px; padding: 15px 20px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 18px; color: #0d47a1;">
                  👤 <strong>${trainee.first_name} ${trainee.last_name}</strong>
                </p>
              </div>

              <p style="font-size: 16px; color: #555555; line-height: 1.6; margin: 0 0 30px 0;">
                Ce collaborateur n'ayant pas d'adresse email personnelle, 
                <strong>merci de lui transmettre ses identifiants d'accès</strong> à la formation :
              </p>
              ` : `
              <p style="font-size: 16px; color: #555555; line-height: 1.6; margin: 0 0 30px 0;">
                Nous avons le plaisir de vous confirmer votre inscription à la formation suivante :
              </p>
              `}

              <!-- Carte formation -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; border: 2px solid #e9ecef; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="color: #667eea; margin: 0 0 15px 0; font-size: 22px;">
                      ${course.title}
                    </h2>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666; font-size: 14px;">📅 Dates :</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: #333; font-size: 14px;">Du ${startDate}</strong><br/>
                          <strong style="color: #333; font-size: 14px;">Au ${endDate}</strong>
                        </td>
                      </tr>
                      ${session.location_city ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666; font-size: 14px;">📍 Lieu :</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: #333; font-size: 14px;">${session.location_address || ''}</strong><br/>
                          <strong style="color: #333; font-size: 14px;">${session.location_postal_code || ''} ${session.location_city}</strong>
                        </td>
                      </tr>
                      ` : ''}
                      ${course.duration_hours ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666; font-size: 14px;">⏱️ Durée :</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: #333; font-size: 14px;">${course.duration_hours} heures</strong>
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666; font-size: 14px;">🏢 Entreprise :</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: #333; font-size: 14px;">${companyName}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666; font-size: 14px;">📋 Référence :</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: #333; font-size: 14px;">${session.reference}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Code d'accès en évidence -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 30px; text-align: center;">
                    <p style="color: #ffffff; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                      Votre code d'accès personnel
                    </p>
                    <div style="background-color: #ffffff; display: inline-block; padding: 15px 40px; border-radius: 6px; margin-bottom: 15px;">
                      <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px; font-family: 'Courier New', monospace;">
                        ${accessCode}
                      </span>
                    </div>
                    <p style="color: #ffffff; margin: 0; font-size: 13px;">
                      Conservez ce code précieusement
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Bouton CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}" style="display: inline-block; background-color: #667eea; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      📝 Compléter ma fiche de renseignement
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Alerte email indésirable -->
              <div style="background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px 20px; margin-bottom: 20px; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #0d47a1;">
                  <strong>📬 Vérifiez vos courriers indésirables</strong>
                </p>
                <p style="margin: 0; font-size: 13px; color: #0d47a1; line-height: 1.5;">
                  Cet email peut arriver dans votre dossier "Spam" ou "Courrier indésirable". 
                  Pour ne rien manquer : ajoutez <strong>noreply@accessformation.pro</strong> à vos contacts.
                </p>
              </div>

              <!-- Instructions -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px; margin-bottom: 30px; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #856404;">
                  <strong>⚠️ Action requise avant la formation :</strong>
                </p>
                <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.5;">
                  Vous devez obligatoirement compléter votre fiche de renseignement en ligne avant le début de la formation. 
                  Cliquez sur le bouton ci-dessus ou utilisez le lien ci-dessous avec votre code d'accès.
                </p>
              </div>

              <!-- Lien portail -->
              <p style="font-size: 14px; color: #666666; margin: 0 0 10px 0;">
                <strong>Lien vers votre espace stagiaire :</strong>
              </p>
              <p style="font-size: 14px; margin: 0 0 30px 0;">
                <a href="${portalUrl}" style="color: #667eea; word-break: break-all;">
                  ${portalUrl}
                </a>
              </p>

              <!-- Documents à prévoir -->
              <div style="background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px 20px; margin-bottom: 30px; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #0d47a1;">
                  <strong>📋 Documents à apporter le jour J :</strong>
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #0d47a1; line-height: 1.8;">
                  <li>Pièce d'identité en cours de validité</li>
                  <li>Attestation de sécurité sociale</li>
                  <li>Tenue adaptée à la formation</li>
                </ul>
              </div>

              <!-- Contact -->
              <p style="font-size: 14px; color: #666666; line-height: 1.6; margin: 0;">
                Pour toute question, n'hésitez pas à nous contacter.
              </p>

              <p style="font-size: 14px; color: #666666; margin: 20px 0 0 0;">
                À très bientôt,<br/>
                <strong>L'équipe Access Formation</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #667eea; font-weight: bold;">
                Access Formation
              </p>
              <p style="margin: 0 0 5px 0; font-size: 13px; color: #666666;">
                Organisme de formation professionnelle
              </p>
              <p style="margin: 0 0 15px 0; font-size: 13px; color: #666666;">
                📧 contact@accessformation.pro | 📞 02 98 XX XX XX
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                Cet email a été envoyé à ${trainee.email}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * Génère le sujet de l'email
 */
export function generateEmailSubject(courseTitle, sessionReference) {
  return `🎓 Convocation - ${courseTitle} (${sessionReference})`
}

/**
 * Prépare les données pour l'envoi d'email
 */
export function prepareEmailData(trainee, session, group) {
  if (!trainee.access_code) {
    throw new Error('Le stagiaire n\'a pas de code d\'accès')
  }

  // Déterminer le destinataire
  const traineeEmail = trainee.trainees?.email
  const companyEmail = group.clients?.contact_email
  
  let recipientEmail = null
  let isViaCompanyContact = false
  
  if (traineeEmail) {
    // Le stagiaire a un email -> envoi direct
    recipientEmail = traineeEmail
    isViaCompanyContact = false
  } else if (companyEmail) {
    // Pas d'email stagiaire mais l'entreprise a un contact -> envoi au contact
    recipientEmail = companyEmail
    isViaCompanyContact = true
  } else {
    // Ni stagiaire ni entreprise n'ont d'email
    throw new Error('Aucun email disponible pour le stagiaire ni pour l\'entreprise')
  }

  const subject = isViaCompanyContact
    ? `🎓 Convocation Formation - Pour ${trainee.trainees.first_name} ${trainee.trainees.last_name} (${session.courses?.title || 'Formation'})`
    : generateEmailSubject(session.courses?.title || 'Formation', session.reference)

  return {
    to: recipientEmail,
    subject: subject,
    html: generateConvocationEmail({
      trainee: trainee.trainees,
      session: session,
      course: session.courses || {},
      accessCode: trainee.access_code,
      groupName: group.group_name,
      companyName: group.clients?.name || 'Entreprise',
      isViaCompanyContact: isViaCompanyContact
    }),
    isViaCompanyContact: isViaCompanyContact, // Pour l'affichage dans l'interface
    recipientType: isViaCompanyContact ? 'company' : 'trainee'
  }
}
