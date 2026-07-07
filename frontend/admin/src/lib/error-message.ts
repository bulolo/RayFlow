type ErrorWithMessage = {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
};

export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object') {
    const value = error as ErrorWithMessage;
    if (value.response?.data?.message) {
      return value.response.data.message;
    }
    if (value.message) {
      return value.message;
    }
  }

  return fallback;
}
