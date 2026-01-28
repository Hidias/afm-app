import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function PositioningTestForm({ 
  questions, 
  onComplete, 
  traineeName 
}) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [responses, setResponses] = useState([])
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [startTime] = useState(Date.now())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentQuestion = questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === questions.length - 1
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100

  const handleAnswerSelect = (index) => {
    setSelectedAnswer(index)
  }

  const handleNext = () => {
    if (selectedAnswer === null) return

    // Enregistrer la réponse
    const isCorrect = selectedAnswer === currentQuestion.correct_index
    const newResponse = {
      question_id: currentQuestion.id,
      question_text: currentQuestion.question_text,
      selected_index: selectedAnswer,
      is_correct: isCorrect,
      is_critical: currentQuestion.critical || false,
      score_earned: isCorrect ? (currentQuestion.score || 1) : 0
    }

    const updatedResponses = [...responses, newResponse]
    setResponses(updatedResponses)

    if (isLastQuestion) {
      // Calculer le score final
      handleComplete(updatedResponses)
    } else {
      // Question suivante
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setSelectedAnswer(null)
    }
  }

  const handleComplete = async (finalResponses) => {
    setIsSubmitting(true)
    
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000)
    
    const totalQuestions = questions.length
    const correctAnswers = finalResponses.filter(r => r.is_correct).length
    const criticalQuestions = questions.filter(q => q.critical).length
    const criticalCorrect = finalResponses.filter(r => r.is_critical && r.is_correct).length
    const totalScore = finalResponses.reduce((sum, r) => sum + r.score_earned, 0)
    const maxScore = questions.reduce((sum, q) => sum + (q.score || 1), 0)
    const scorePercentage = Math.round((totalScore / maxScore) * 100)

    // Déterminer le niveau
    let level = 'debutant'
    if (scorePercentage >= 80) level = 'avance'
    else if (scorePercentage >= 60) level = 'intermediaire'

    const testResults = {
      responses: finalResponses,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      critical_questions_count: criticalQuestions,
      critical_correct_count: criticalCorrect,
      score_percentage: scorePercentage,
      level: level,
      duration_seconds: durationSeconds
    }

    await onComplete(testResults)
  }

  if (!currentQuestion) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">Aucune question disponible</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header avec progression */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">
            Question {currentQuestionIndex + 1} / {questions.length}
          </span>
          <span className="text-sm font-medium text-blue-600">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">
          {currentQuestion.question_text}
        </h3>

        {/* Options de réponse */}
        <div className="space-y-3">
          {currentQuestion.options?.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                selectedAnswer === index
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${
                  selectedAnswer === index
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300'
                }`}>
                  {selectedAnswer === index && (
                    <CheckCircle className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="text-gray-900">{option}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bouton suivant */}
      <button
        onClick={handleNext}
        disabled={selectedAnswer === null || isSubmitting}
        className={`w-full py-4 rounded-lg font-medium text-white transition-all ${
          selectedAnswer === null || isSubmitting
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Enregistrement...
          </span>
        ) : isLastQuestion ? (
          'Terminer le test'
        ) : (
          'Question suivante'
        )}
      </button>

      {/* Message d'encouragement */}
      <p className="text-center text-sm text-gray-500 mt-4">
        Prenez votre temps et répondez au mieux de vos connaissances
      </p>
    </div>
  )
}
