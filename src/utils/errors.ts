export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class InsufficientFundsError extends ApiError {
  constructor(message = "Insufficient funds across chains") {
    super(400, message);
    this.name = "InsufficientFundsError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, message);
    this.name = "ValidationError";
  }
} 
