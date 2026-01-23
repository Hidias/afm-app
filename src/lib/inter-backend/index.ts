/**
 * INTER-ENTREPRISE - BACKEND CORE
 * Point d'entrée central pour toutes les fonctions backend
 */

// Codes d'accès
export {
  generateAccessCode,
  verifyAccessCode,
  recordFailedAttempt,
  generateAllAccessCodes
} from './accessCodes';

// Gestion des groupes
export {
  createGroup,
  addTraineeToGroup,
  removeTraineeFromGroup,
  updateGroupSize,
  updateGroupPrice,
  confirmGroup,
  cancelGroup,
  getSessionGroups,
  getGroupTrainees,
  type CreateGroupData
} from './groups';

// Calculs financiers
export {
  calculateSessionRevenue,
  calculateClientRevenue,
  getFinancialStats,
  isGroupPaid,
  getPendingPayments,
  generateFinancialReport
} from './finance';

// Validation des seuils
export {
  checkMinParticipants,
  checkMaxParticipants,
  canAddParticipants,
  updateSessionThresholds,
  checkAllThresholds
} from './validation';

// Gestion des statuts
export {
  updateTraineeStatus,
  updateMultipleTraineesStatus,
  sendConvocations,
  getTraineesByStatus,
  countTraineesByStatus,
  markAsPresent,
  canChangeStatus,
  type TraineeStatus
} from './status';

// Gestion des alertes
export {
  createAlert,
  resolveAlert,
  dismissAlert,
  getActiveAlerts,
  checkAndCreateAlerts,
  cleanupAlerts,
  getAlertsSummary,
  type AlertType
} from './alerts';
