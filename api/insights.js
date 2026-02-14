import crypto from "crypto";

function verifyWebToken(token) {
  if (!token) return null;

  const [base, sig] = token.split(".");
  if (!base || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", process.env.WEB_SHARED_SECRET)
    .update(base)
    .digest("hex");

  if (sig !== expectedSig) return null;

  return JSON.parse(Buffer.from(base, "base64").toString());
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).end();

  try {
    const { token } = req.query;
    const { summary } = req.body;

    const user = verifyWebToken(token);
    if (!user)
      return res.status(401).json({ error: "Invalid token" });

    const prompt = `You are a financial advisor. Based on this user's transaction data, provide brief, actionable insights (3-4 sentences max):

Transaction Summary:
- Total Income: Rp${summary.totalIncome.toLocaleString()}
- Total Expenses: Rp${summary.totalExpense.toLocaleString()}
- Net Balance: Rp${summary.netBalance.toLocaleString()}
- Days of Data: ${summary.days}

Top Spending Categories:
${summary.topCategories
  .map((c, i) => `${i + 1}. ${c.name}: Rp${c.value.toLocaleString()}`)
  .join("\n")}

Average Daily Spending: Rp${summary.avgDaily.toLocaleString()}

Provide:
1. One key observation
2. One actionable recommendation
3. One positive reinforcement

Keep it conversational and encouraging.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(error);
      return res.status(500).json({ error: "Gemini failed" });
    }

    const data = await response.json();
    const insight = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!insight)
      return res.status(500).json({ error: "No insight" });

    res.json({ insight });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
}
