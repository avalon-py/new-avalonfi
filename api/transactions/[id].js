import admin from "firebase-admin";
import { db } from "../../lib/firebase.js";
import { verifyWebToken } from "../../lib/auth.js";
import { normalizeCategory } from "../../lib/parsing.js";

export default async function handler(req, res) {

  const { token } = req.query;
  const { id } = req.query;

  const user = verifyWebToken(token);
  if (!user)
    return res.status(401).json({ error: "Invalid token" });

  const docRef = db.collection("transactions").doc(id);
  const doc = await docRef.get();

  if (!doc.exists)
    return res.status(404).json({ error: "Not found" });

  if (doc.data().userId !== user.id)
    return res.status(403).json({ error: "Forbidden" });

  if (req.method === "PUT") {

    const { amount, category, description } = req.body;

    await docRef.update({
      amount,
      category: normalizeCategory(category),
      description: description || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ success: true });
  }

  if (req.method === "DELETE") {
    await docRef.delete();
    return res.json({ success: true });
  }

  res.status(405).end();
}
