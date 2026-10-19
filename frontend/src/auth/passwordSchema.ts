import { z } from 'zod'

/** BCrypt hashes at most 72 bytes: an accented letter takes 2 of them, an emoji 4. */
const BCRYPT_MAX_BYTES = 72

const utf8Length = (value: string) => new TextEncoder().encode(value).length

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres.')
  .refine(
    (value) => utf8Length(value) <= BCRYPT_MAX_BYTES,
    'A senha deve ter no máximo 72 bytes (letras acentuadas contam como 2, emojis como 4).',
  )
