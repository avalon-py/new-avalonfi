export async function sendMessage(chatId, text, extra = {}) {
  const res = await fetch(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...extra,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram send failed:", err);
    throw new Error("Telegram API failed");
  }

  return await res.json();
}

export async function editMessage(chatId, messageId, text, replyMarkup = null) {
  await fetch(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/editMessageText`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        ...(replyMarkup && { reply_markup: replyMarkup })
      })
    }
  );
}
