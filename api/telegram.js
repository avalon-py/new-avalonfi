import { db, FieldValue } from "../lib/firebase.js";
import { parseMessage } from "../lib/parsing.js";
import { sendMessage } from "../lib/telegram.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).send("Method Not Allowed");

  const update = req.body;

  if (!update.message || !update.message.text)
    return res.status(200).end();

  const parsed = parseMessage(update.message.text);

  if (!parsed) {
    await sendMessage(
      update.message.chat.id,
      "Format invalid 😵\nExample:\n- 10k food - sushi"
    );
    return res.status(200).end();
  }

  await db
    .collection("transactions")
    .doc(String(update.update_id))
    .set({
      userId: update.message.from.id,
      username: update.message.from.username || null,
      ...parsed,
      createdAt: FieldValue.serverTimestamp(),
    });

  await sendMessage(
    update.message.chat.id,
    `Saved ✅\n${parsed.category}: ${parsed.amount.toLocaleString()}`
  );

  res.status(200).end();
}
