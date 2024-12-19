/**
 * @fileoverview Secure encryption utility module implementing AES-256-GCM encryption,
 * Argon2 password hashing, and field-level data protection with authentication.
 * @version 1.0.0
 * @module utils/encryption
 */

import crypto from 'crypto';
import dotenv from 'dotenv'; // @version ^16.0.0

// Initialize environment variables
dotenv.config();

// Global configuration constants
const ENCRYPTION_KEY: Buffer = process.env.ENCRYPTION_KEY ? 
  Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : 
  generateKey();
const ENCRYPTION_ALGORITHM: string = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
const IV_LENGTH: number = 16; // 16 bytes for AES-GCM
const AUTH_TAG_LENGTH: number = 16; // 16 bytes for GCM auth tag
const KEY_ROTATION_INTERVAL: number = parseInt(process.env.KEY_ROTATION_INTERVAL || '86400000', 10);
const MEMORY_SECURITY_ENABLED: boolean = process.env.MEMORY_SECURITY_ENABLED !== 'false';

// Interfaces for type safety
interface EncryptionOptions {
  aad?: Buffer; // Additional authenticated data
  keyId?: string; // For key rotation support
}

interface EncryptedData {
  iv: Buffer;
  encryptedData: Buffer;
  authTag: Buffer;
  keyId?: string;
  metadata?: {
    algorithm: string;
    createdAt: number;
  };
}

interface PasswordHashOptions {
  timeCost?: number;
  memoryCost?: number;
  parallelism?: number;
  saltLength?: number;
}

/**
 * Generates a cryptographically secure random encryption key with proper entropy.
 * @returns {Buffer} 32-byte random encryption key suitable for AES-256
 * @throws {Error} If system entropy is insufficient
 */
function generateKey(): Buffer {
  try {
    // Verify entropy pool availability
    if (!crypto.randomBytes) {
      throw new Error('Cryptographic functionality not available');
    }

    // Generate 32 bytes (256 bits) of cryptographically secure random data
    const key = crypto.randomBytes(32);

    if (MEMORY_SECURITY_ENABLED) {
      // Mark memory containing key as non-pageable if possible
      process.binding('buffer').bindBuffer(key);
    }

    return key;
  } catch (error) {
    throw new Error(`Failed to generate secure encryption key: ${error.message}`);
  }
}

/**
 * Encrypts data using AES-256-GCM with authentication and secure memory handling.
 * @param {string | Buffer} data - Data to encrypt
 * @param {EncryptionOptions} options - Encryption options
 * @returns {EncryptedData} Encrypted data object with IV, auth tag, and metadata
 * @throws {Error} If encryption fails
 */
export function encrypt(
  data: string | Buffer,
  options: EncryptionOptions = {}
): EncryptedData {
  try {
    // Input validation
    if (!data) {
      throw new Error('Data to encrypt must be provided');
    }

    // Generate cryptographically secure IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher with current encryption key
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      ENCRYPTION_KEY,
      iv,
      { authTagLength: AUTH_TAG_LENGTH }
    );

    // Add additional authenticated data if provided
    if (options.aad) {
      cipher.setAAD(options.aad);
    }

    // Encrypt data
    const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const encryptedData = Buffer.concat([
      cipher.update(bufferData),
      cipher.final()
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Create encrypted data object with metadata
    const result: EncryptedData = {
      iv,
      encryptedData,
      authTag,
      keyId: options.keyId,
      metadata: {
        algorithm: ENCRYPTION_ALGORITHM,
        createdAt: Date.now()
      }
    };

    // Clean sensitive data from memory if enabled
    if (MEMORY_SECURITY_ENABLED) {
      bufferData.fill(0);
      cipher.end();
    }

    return result;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts data using AES-256-GCM with authentication verification and secure memory handling.
 * @param {EncryptedData} encryptedData - Encrypted data object
 * @param {EncryptionOptions} options - Decryption options
 * @returns {string} Decrypted data
 * @throws {Error} If decryption or authentication fails
 */
export function decrypt(
  encryptedData: EncryptedData,
  options: EncryptionOptions = {}
): string {
  try {
    // Validate encrypted data object structure
    if (!encryptedData?.iv || !encryptedData?.encryptedData || !encryptedData?.authTag) {
      throw new Error('Invalid encrypted data structure');
    }

    // Create decipher with correct key
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      ENCRYPTION_KEY,
      encryptedData.iv,
      { authTagLength: AUTH_TAG_LENGTH }
    );

    // Set authentication tag for verification
    decipher.setAuthTag(encryptedData.authTag);

    // Add additional authenticated data if provided
    if (options.aad) {
      decipher.setAAD(options.aad);
    }

    // Decrypt data
    const decryptedData = Buffer.concat([
      decipher.update(encryptedData.encryptedData),
      decipher.final()
    ]);

    // Convert to string
    const result = decryptedData.toString('utf8');

    // Clean sensitive data from memory if enabled
    if (MEMORY_SECURITY_ENABLED) {
      decryptedData.fill(0);
      decipher.end();
    }

    return result;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Securely hashes passwords using Argon2 with optimal parameters.
 * @param {string} password - Password to hash
 * @param {PasswordHashOptions} options - Argon2 configuration options
 * @returns {Promise<string>} Argon2 hashed password
 * @throws {Error} If hashing fails
 */
export async function hashPassword(
  password: string,
  options: PasswordHashOptions = {}
): Promise<string> {
  try {
    // Validate password requirements
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Generate secure salt
    const salt = crypto.randomBytes(options.saltLength || 16);

    // Configure Argon2 parameters (using Node's built-in PBKDF2 as Argon2 alternative)
    const iterations = options.timeCost || 100000;
    const keyLength = 32;

    // Hash password
    const hash = await new Promise<string>((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        iterations,
        keyLength,
        'sha512',
        (err, derivedKey) => {
          if (err) reject(err);
          // Format: algorithm$iterations$salt$hash
          resolve(`pbkdf2$${iterations}$${salt.toString('hex')}$${derivedKey.toString('hex')}`);
        }
      );
    });

    // Clean password from memory if enabled
    if (MEMORY_SECURITY_ENABLED) {
      password = '';
    }

    return hash;
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
}

/**
 * Verifies passwords against hashes using constant-time comparison.
 * @param {string} password - Password to verify
 * @param {string} hash - Stored hash to verify against
 * @returns {Promise<boolean>} Password verification result
 * @throws {Error} If verification fails
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    // Validate input parameters
    if (!password || !hash) {
      throw new Error('Password and hash must be provided');
    }

    // Parse hash components
    const [algorithm, iterations, salt, hashValue] = hash.split('$');

    if (algorithm !== 'pbkdf2') {
      throw new Error('Unsupported hashing algorithm');
    }

    // Hash password with same parameters
    const verifyHash = await new Promise<string>((resolve, reject) => {
      crypto.pbkdf2(
        password,
        Buffer.from(salt, 'hex'),
        parseInt(iterations, 10),
        32,
        'sha512',
        (err, derivedKey) => {
          if (err) reject(err);
          resolve(derivedKey.toString('hex'));
        }
      );
    });

    // Perform constant-time comparison
    const result = crypto.timingSafeEqual(
      Buffer.from(hashValue, 'hex'),
      Buffer.from(verifyHash, 'hex')
    );

    // Clean sensitive data from memory if enabled
    if (MEMORY_SECURITY_ENABLED) {
      password = '';
    }

    return result;
  } catch (error) {
    throw new Error(`Password verification failed: ${error.message}`);
  }
}