// functions/src/features/enrollments/checkDual.ts
import {secureHandler} from "../../core";

export const enrollmentsCheckDual = secureHandler(async (req, res) => {
  const {enrollments} = (req.body || {});
  if (!Array.isArray(enrollments)) {
    res.status(400).json({ok: false, error: "invalid_enrollments"});
    return;
  }
  const activeBy = new Map<string, any[]>();
  for (const en of enrollments) {
    const cid = String(en.customerId ?? en.clientId ?? "");
    if (!cid) continue;
    if (en.status === "active") (activeBy.get(cid) || activeBy.set(cid, []).get(cid)!).push(en);
  }
  const conflicts = Array.from(activeBy.entries())
    .filter(([, list]) => list.length > 1)
    .map(([customerId, list]) => ({customerId, count: list.length, activeEnrollments: list}));
  res.status(200).json({ok: true, conflicts});
}, {auth: "user", methods: ["POST", "OPTIONS"]});
