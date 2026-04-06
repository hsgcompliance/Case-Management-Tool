// functions/src/features/auth/createSession.ts
import {secureHandler} from "../../core";
import {createSessionCookie} from "../../core/session";

export const createSession = secureHandler(async (req, res) => {
  const {idToken} = (req.body || {}) as { idToken?: string };
  if (!idToken) {
    res.status(400).json({ok: false, error: "missing_id_token"});
    return;
  }
  const cookie = await createSessionCookie(idToken, 5);
  res.json({ok: true, cookie, maxAge: 5 * 24 * 60 * 60});
}, {auth: "public", methods: ["POST"]});
