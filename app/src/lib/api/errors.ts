import axios from "axios";
import { isApiErrorDTO, type ApiErrorDTO } from "./contracts";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: ApiErrorDTO["code"], message: string, public readonly fieldErrors?: ApiErrorDTO["fieldErrors"]) {
    super(message);
    this.name = "ApiError";
  }
}
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
    const errObj = error as { status?: number; code: ApiErrorDTO["code"]; message: string; fieldErrors?: ApiErrorDTO["fieldErrors"] };
    return new ApiError(errObj.status ?? 0, errObj.code, errObj.message, errObj.fieldErrors);
  }
  if (axios.isAxiosError<unknown>(error)) {
    const body = error.response?.data;
    if (isApiErrorDTO(body)) return new ApiError(error.response?.status ?? 0, body.code, body.message, body.fieldErrors);
  }
  return new ApiError(0, "SERVICE_UNAVAILABLE", "No pudimos conectar con Nuari. Reintentá para comprobar el resultado.");
}
