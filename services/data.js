// Generate mock transactions for demo
export function generateMockTransactions(count = 100) {
    const categories = {
        expense: [
            'Food & Dining',
            'Shopping',
            'Transportation',
            'Bills & Utilities',
            'Entertainment',
            'Healthcare',
            'Education'
        ],
        income: [
            'Salary',
            'Freelance',
            'Investment',
            'Business'
        ]
    };

    const descriptions = {
        'Food & Dining': ['Lunch', 'Dinner', 'Coffee', 'Groceries', 'Restaurant'],
        'Shopping': ['Clothes', 'Electronics', 'Books', 'Furniture'],
        'Transportation': ['Gas', 'Uber', 'Public Transit', 'Parking'],
        'Bills & Utilities': ['Electricity', 'Water', 'Internet', 'Phone'],
        'Entertainment': ['Movies', 'Concert', 'Games', 'Streaming'],
        'Healthcare': ['Doctor', 'Medicine', 'Insurance', 'Checkup'],
        'Education': ['Course', 'Books', 'Tuition', 'Workshop'],
        'Salary': ['Monthly Salary', 'Bonus'],
        'Freelance': ['Project Payment', 'Consultation'],
        'Investment': ['Dividends', 'Stock Sale'],
        'Business': ['Revenue', 'Commission']
    };

    const transactions = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
        const type = Math.random() > 0.3 ? 'expense' : 'income';
        const categoryList = categories[type];
        const category = categoryList[Math.floor(Math.random() * categoryList.length)];
        const descList = descriptions[category] || ['Transaction'];
        const description = descList[Math.floor(Math.random() * descList.length)];

        // Generate dates within last 90 days
        const daysAgo = Math.floor(Math.random() * 90);
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);

        // Generate realistic amounts
        let amount;
        if (type === 'income') {
            amount = Math.floor(Math.random() * 5000) + 1000; // $1000-$6000
        } else {
            amount = Math.floor(Math.random() * 500) + 10; // $10-$510
        }

        transactions.push({
            id: `tx_${i}`,
            type,
            category,
            description,
            amount,
            date: date.toISOString(),
            createdAt: date
        });
    }

    // Sort by date descending
    return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Calculate daily statistics
export function calculateDailyStats(transactions) {
    const dailyMap = new Map();

    transactions.forEach(tx => {
        const dateStr = tx.date.split('T')[0]; // YYYY-MM-DD
        
        if (!dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, { income: 0, expense: 0 });
        }

        const day = dailyMap.get(dateStr);
        if (tx.type === 'income') {
            day.income += tx.amount;
        } else {
            day.expense += tx.amount;
        }
    });

    // Get last 30 days
    const result = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const data = dailyMap.get(dateStr) || { income: 0, expense: 0 };
        result.push({
            date: dateStr,
            income: data.income,
            expense: data.expense
        });
    }

    return result;
}

// Calculate monthly statistics
export function calculateMonthlyStats(transactions) {
    const monthlyMap = new Map();

    transactions.forEach(tx => {
        const date = new Date(tx.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyMap.has(monthKey)) {
            monthlyMap.set(monthKey, { income: 0, expense: 0 });
        }

        const month = monthlyMap.get(monthKey);
        if (tx.type === 'income') {
            month.income += tx.amount;
        } else {
            month.expense += tx.amount;
        }
    });

    // Get last 12 months
    const result = [];
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[date.getMonth()]} '${String(date.getFullYear()).slice(-2)}`;
        
        const data = monthlyMap.get(monthKey) || { income: 0, expense: 0 };
        result.push({
            month: monthLabel,
            income: data.income,
            expense: data.expense
        });
    }

    return result;
}

// Calculate category statistics
export function calculateCategoryStats(transactions) {
    const categoryMap = new Map();

    transactions.forEach(tx => {
        if (tx.type === 'expense') {
            const current = categoryMap.get(tx.category) || 0;
            categoryMap.set(tx.category, current + tx.amount);
        }
    });

    const result = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    return result;
}
