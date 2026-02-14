import crypto from "crypto";
import { db, FieldValue, Timestamp } from "../lib/firebase.js";
import { parseMessage } from "../lib/parsing.js";
import { sendMessage, editMessage } from "../lib/telegram.js";


/* ────────────────────────────────
   Date Helpers
──────────────────────────────── */

function startOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
}

function startOfTomorrowUTC() {
  const d = startOfTodayUTC();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function startOfMonthUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfNextMonthUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/* ────────────────────────────────
   Firestore Query
──────────────────────────────── */

async function getUserTransactions(userId, start, end) {
  let query = db.collection("transactions")
    .where("userId", "==", userId);

  if (start) {
    query = query.where(
      "createdAt",
      ">=",
      Timestamp.fromDate(start)
    );
  }

  if (end) {
    query = query.where(
      "createdAt",
      "<",
      Timestamp.fromDate(end)
    );
  }

  const snap = await query.get();
  return snap.docs.map(doc => doc.data());
}

/* ────────────────────────────────
   Command Logic
──────────────────────────────── */

async function handleDay(userId, chatId) {
  const txs = await getUserTransactions(
    userId,
    startOfTodayUTC(),
    startOfTomorrowUTC()
  );

  if (txs.length === 0) {
    return sendMessage(chatId, "📅 Today\nNo transactions today 💤");
  }

  let income = 0;
  let expense = 0;

  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }

  return sendMessage(
    chatId,
`📅 *Today*
• Income: Rp${income.toLocaleString()}
• Expense: Rp${expense.toLocaleString()}
• Net: Rp${(income - expense).toLocaleString()}`,
    { parse_mode: "Markdown" }
  );
}

async function handleMonth(userId, chatId) {
  const txs = await getUserTransactions(
    userId,
    startOfMonthUTC(),
    startOfNextMonthUTC()
  );

  if (txs.length === 0)
    return sendMessage(chatId, "📆 This Month\nNo transactions yet 💤");

  let income = 0;
  let expense = 0;

  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }

  return sendMessage(
    chatId,
`📆 *This Month*
• Income: Rp${income.toLocaleString()}
• Expense: Rp${expense.toLocaleString()}
• Net: Rp${(income - expense).toLocaleString()}`,
    { parse_mode: "Markdown" }
  );
}

async function handleHist(userId, chatId) {
  const txs = await getUserTransactions(userId);

  if (txs.length === 0)
    return sendMessage(chatId, "📊 History\nNo transactions yet 💤");

  let income = 0;
  let expense = 0;

  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }

  return sendMessage(
    chatId,
`📊 *All Time*
• Income: Rp${income.toLocaleString()}
• Expense: Rp${expense.toLocaleString()}
• Net: Rp${(income - expense).toLocaleString()}`,
    { parse_mode: "Markdown" }
  );
}

function generateWebToken(user) {
  const payload = {
    id: user.id,
    username: user.username || "",
    ts: Date.now(),
  };

  const base = Buffer.from(JSON.stringify(payload)).toString("base64");

  const sig = crypto
    .createHmac("sha256", process.env.WEB_SHARED_SECRET)
    .update(base)
    .digest("hex");

  return `${base}.${sig}`;
}

/* ────────────────────────────────
   Main Handler (Vercel)
──────────────────────────────── */

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).end();

  const update = req.body;

  try {

    /* ────────────────────────────────
       ✅ HANDLE CALLBACK BUTTONS
    ──────────────────────────────── */
    if (update.callback_query) {
      const callback = update.callback_query;
      const data = callback.data;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const userId = callback.from.id;

      if (data.startsWith("confirm_delete_")) {
        const txId = data.replace("confirm_delete_", "");

        await editMessage(
          chatId,
          messageId,
          "Are you sure you want to delete this transaction?",
          {
            inline_keyboard: [[
              { text: "✅ Yes, delete", callback_data: `delete_${txId}` },
              { text: "❌ Cancel", callback_data: `cancel_${txId}` }
            ]]
          }
        );
      }

      if (data.startsWith("delete_")) {
        const txId = data.replace("delete_", "");

        const docRef = db.collection("transactions").doc(txId);
        const doc = await docRef.get();

        if (doc.exists && doc.data().userId === userId) {
          await docRef.delete();
        }

        await editMessage(chatId, messageId, "Transaction deleted ❌");
      }

      if (data.startsWith("cancel_")) {
        const txId = data.replace("cancel_", "");

        const docRef = db.collection("transactions").doc(txId);
        const doc = await docRef.get();

        if (doc.exists) {
          const tx = doc.data();

          await editMessage(
            chatId,
            messageId,
            `Saved ✅\n${tx.category}: ${tx.amount.toLocaleString()}`,
            {
              inline_keyboard: [[
                {
                  text: "🗑 Delete",
                  callback_data: `confirm_delete_${txId}`
                }
              ]]
            }
          );
        }
      }

      // stop spinner
      await fetch(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerCallbackQuery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callback.id
          })
        }
      );

      return res.status(200).end();
    }

    /* ────────────────────────────────
       ✅ HANDLE NORMAL MESSAGES
    ──────────────────────────────── */

    if (!update.message || !update.message.text)
      return res.status(200).end();

    const text = update.message.text.trim();
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;

    // COMMANDS
    if (text.startsWith("/")) {
      const command = text.split(" ")[0];

      switch (command) {
        case "/day":
          await handleDay(userId, chatId);
          break;
        case "/month":
          await handleMonth(userId, chatId);
          break;
        case "/hist":
          await handleHist(userId, chatId);
          break;
        default:
          await sendMessage(chatId, "Unknown command 🤔");
      }

      return res.status(200).end();
    }

    // TRANSACTIONS
    const parsed = parseMessage(text);

    if (!parsed) {
      await sendMessage(
        chatId,
        "Format invalid 😵\nExample:\n- 10k food - sushi"
      );
      return res.status(200).end();
    }

    // ✅ SAVE ONLY ONCE (FIXED)
    const docRef = await db.collection("transactions").add({
      userId,
      username: update.message.from.username || null,
      ...parsed,
      createdAt: FieldValue.serverTimestamp(),
    });

    await sendMessage(
      chatId,
      `Saved ✅\n${parsed.category}: ${parsed.amount.toLocaleString()}`,
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: "🗑 Delete",
              callback_data: `confirm_delete_${docRef.id}`
            }
          ]]
        }
      }
    );

    return res.status(200).end();

  } catch (err) {
    console.error("Telegram error:", err);
    return res.status(500).end();
  }
}
