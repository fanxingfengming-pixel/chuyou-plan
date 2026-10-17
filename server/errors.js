export class AppError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function publicError(error) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message } },
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "服务暂时无法完成请求，请稍后重试。",
      },
    },
  };
}
