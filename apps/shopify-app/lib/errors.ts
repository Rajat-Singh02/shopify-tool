export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
    readonly code = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function serializeError(error: unknown) {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof Error) {
    return {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      },
    };
  }

  return {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unknown error",
    },
  };
}
