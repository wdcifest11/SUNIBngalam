import crypto from "node:crypto";

type HashRecord = {
  algorithm: "scrypt";
  params: { N: number; r: number; p: number; keyLen: number };
  salt: string; // base64
  hash: string; // base64
};

const DEFAULT_PARAMS = { N: 16384, r: 8, p: 1, keyLen: 32 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, DEFAULT_PARAMS.keyLen, {
    N: DEFAULT_PARAMS.N,
    r: DEFAULT_PARAMS.r,
    p: DEFAULT_PARAMS.p,
  });

  const record: HashRecord = {
    algorithm: "scrypt",
    params: DEFAULT_PARAMS,
    salt: salt.toString("base64"),
    hash: Buffer.from(key).toString("base64"),
  };

  return JSON.stringify(record);
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const rec = JSON.parse(stored) as HashRecord;
    if (rec.algorithm !== "scrypt") return false;
    const salt = Buffer.from(rec.salt, "base64");
    const expected = Buffer.from(rec.hash, "base64");
    const key = crypto.scryptSync(password, salt, rec.params.keyLen, {
      N: rec.params.N,
      r: rec.params.r,
      p: rec.params.p,
    });
    return crypto.timingSafeEqual(Buffer.from(key), expected);
  } catch {
    return false;
  }
}

