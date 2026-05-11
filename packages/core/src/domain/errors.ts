export class AichestraError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AichestraError";
    this.code = code;
  }
}

export class NotFoundError extends AichestraError {
  constructor(resource: string, id: string) {
    super("not_found", `${resource} not found: ${id}`);
  }
}

export class ValidationError extends AichestraError {
  details: string[];

  constructor(details: string[]) {
    super("validation_error", details.join("; "));
    this.details = details;
  }
}

export class ConflictError extends AichestraError {
  constructor(message: string) {
    super("conflict", message);
  }
}
