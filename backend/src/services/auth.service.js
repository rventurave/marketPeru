// Lógica de negocio de autenticación y gestión de usuarios.

import { createUsersRepository } from '../repositories/users.repository.js';
import { createSessionsRepository } from '../repositories/sessions.repository.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateSessionToken, generateCsrfToken, generateSessionId, hashSessionToken } from '../utils/token.js';
import { SESSION_TTL_SECONDS } from '../utils/cookies.js';
import { conflict, unauthorized } from '../utils/errors.js';

function toUserDto(user, sellerProfile, csrfToken) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    created_at: user.created_at,
    csrf_token: csrfToken,
    seller_profile: sellerProfile
      ? {
          display_name: sellerProfile.display_name,
          bio: sellerProfile.bio,
          location: sellerProfile.location,
          average_rating: sellerProfile.average_rating,
          rating_count: sellerProfile.rating_count,
        }
      : null,
  };
}

export function createAuthService(env) {
  const users = createUsersRepository(env.DB);
  const sessions = createSessionsRepository(env.DB);

  async function createSession(userId) {
    const token = generateSessionToken();
    const tokenHash = await hashSessionToken(token);
    const csrfToken = generateCsrfToken();
    const id = generateSessionId();
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + SESSION_TTL_SECONDS * 1000).toISOString();

    await sessions.create({ id, userId, tokenHash, csrfToken, expiresAt, createdAt });
    return { token, csrfToken };
  }

  return {
    async register({ name, email, password }) {
      const existing = await users.findByEmail(email);
      if (existing) {
        throw conflict('EMAIL_ALREADY_EXISTS', 'El correo ya está registrado');
      }

      const passwordHash = await hashPassword(password);
      const user = await users.create({ email, passwordHash, name });
      const { token, csrfToken } = await createSession(user.id);

      return { dto: toUserDto(user, null, csrfToken), token };
    },

    async login({ email, password }) {
      const invalid = () => unauthorized('INVALID_CREDENTIALS', 'Credenciales inválidas');

      const user = await users.findByEmail(email);
      if (!user) throw invalid();

      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) throw invalid();

      // Estado de cuenta: no revela el motivo exacto (evita enumeración).
      if (user.status !== 'active') throw invalid();

      await sessions.deleteExpired(user.id, new Date().toISOString());
      const { token, csrfToken } = await createSession(user.id);
      const sellerProfile = await users.findSellerProfile(user.id);

      return { dto: toUserDto(user, sellerProfile, csrfToken), token };
    },

    async logout(tokenHash) {
      if (tokenHash) {
        await sessions.deleteByTokenHash(tokenHash);
      }
    },

    async me(userId, csrfToken) {
      const user = await users.findById(userId);
      if (!user) throw unauthorized();
      const sellerProfile = await users.findSellerProfile(userId);
      return toUserDto(user, sellerProfile, csrfToken);
    },

    async updateProfile(userId, csrfToken, fields) {
      if (fields.name !== undefined) {
        await users.updateName(userId, fields.name);
      }
      if (fields.bio !== undefined || fields.location !== undefined) {
        const profile = await users.findSellerProfile(userId);
        if (profile) {
          await users.updateSellerProfileFields(userId, {
            bio: fields.bio,
            location: fields.location,
          });
        }
        // Sin perfil de vendedor, bio/location se ignoran (gestionar perfil de
        // vendedor es una acción separada en una etapa posterior).
      }
      return this.me(userId, csrfToken);
    },
  };
}
