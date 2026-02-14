export async function generateFinancialInsights(transactions, token) {
    const summary = analyzeTransactions(transactions);

    try {
        const response = await fetch(
            `/api/insights?token=${token}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ summary })
            }
        );

        if (!response.ok) {
            throw new Error("Insights API failed");
        }

        const data = await response.json();
        return data.insight;

    } catch (error) {
        console.error("Insight error:", error);
        return generateFallbackInsights(summary);
    }
}

function analyzeTransactions(transactions) {
    const income = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');
    
    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
    
    // Category breakdown
    const categoryMap = new Map();
    expenses.forEach(tx => {
        const current = categoryMap.get(tx.category) || 0;
        categoryMap.set(tx.category, current + tx.amount);
    });
    
    const topCategories = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    
    // Calculate date range
    const dates = transactions.map(t => new Date(t.date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const days = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) || 1;
    
    return {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
        topCategories,
        avgDaily: totalExpense / days,
        days
    };
}

function generateFallbackInsights(summary) {
    const savingsRate = summary.totalIncome > 0 
        ? ((summary.netBalance / summary.totalIncome) * 100).toFixed(1)
        : 0;
    
    const topCategory = summary.topCategories[0]?.name || 'various categories';
    const topCategoryAmount = summary.topCategories[0]?.value || 0;
    const topCategoryPercent = summary.totalExpense > 0
        ? ((topCategoryAmount / summary.totalExpense) * 100).toFixed(1)
        : 0;
    
    let insight = '';
    
    if (summary.netBalance > 0) {
        insight = `Great job! You're saving ${savingsRate}% of your income. `;
    } else {
        insight = `You're currently spending more than you earn. `;
    }
    
    insight += `Your biggest expense is ${topCategory}, accounting for ${topCategoryPercent}% of total spending. `;
    
    if (summary.avgDaily > 100) {
        insight += `Consider tracking small daily expenses - they add up to $${Math.round(summary.avgDaily)} per day. `;
    }
    
    insight += `Keep monitoring your finances to stay on track!`;
    
    return insight;

}
