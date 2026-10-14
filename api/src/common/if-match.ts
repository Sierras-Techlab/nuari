import { ApiError } from './errors.js';

export function parseIfMatch(value: string | undefined): number {
  if (value === undefined) {
    throw new ApiError(428, 'PRECONDITION_REQUIRED', 'Se requiere If-Match para modificar este recurso.');
  }

  const match = /^"([1-9]\d*)"$/.exec(value);
  if (!match) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'El encabezado If-Match no es válido.', {
      'If-Match': ['Usá una versión entera positiva entre comillas.'],
    });
  }

  const version = Number(match[1]);
  if (!Number.isSafeInteger(version)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'El encabezado If-Match no es válido.', {
      'If-Match': ['Usá una versión entera positiva válida.'],
    });
  }

  return version;
}
