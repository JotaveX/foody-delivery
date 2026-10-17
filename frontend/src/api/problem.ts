import axios from 'axios'

/** RFC 9457 body returned by the API for every error. */
export interface ProblemDetail {
  status?: number
  title?: string
  detail?: string
  errors?: Record<string, string>
}

export interface ApiError {
  message: string
  fieldErrors: Record<string, string>
}

export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError<ProblemDetail>(error)) {
    if (!error.response) {
      return { message: 'Não foi possível conectar ao servidor. Tente novamente.', fieldErrors: {} }
    }
    const problem = error.response.data
    return {
      message: problem?.detail ?? 'Algo deu errado. Tente novamente.',
      fieldErrors: problem?.errors ?? {},
    }
  }
  return { message: 'Algo deu errado. Tente novamente.', fieldErrors: {} }
}
