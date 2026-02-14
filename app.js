import { generateMockTransactions, calculateDailyStats, calculateCategoryStats, calculateMonthlyStats } from './services/data.js';
import { generateFinancialInsights } from './services/gemini.js';

// State
let appState = {
    isAuthenticated: false,
    loading: true,
    transactions: [],
    username: 'Guest',
    timeRange: 'daily', // 'daily' or 'monthly'
    charts: {
        main: null,
        category: null
    },
    token: null
};

// Constants
const COLORS = {
    income: '#10b981',
    expense: '#ef4444',
    charts: ['#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
};

// DOM Elements
const els = {
    loadingView: document.getElementById('loading-view'),
    errorView: document.getElementById('error-view'),
    dashboardView: document.getElementById('dashboard-view'),
    errorMessage: document.getElementById('error-message'),
    authBadge: document.getElementById('auth-badge'),
    usernameDisplay: document.getElementById('username-display'),
    totalBalance: document.getElementById('total-balance'),
    totalIncome: document.getElementById('total-income'),
    totalExpense: document.getElementById('total-expense'),
    transactionList: document.getElementById('transaction-list'),
    categoryLegend: document.getElementById('category-legend'),
    aiBtn: document.getElementById('ai-btn'),
    aiContainer: document.getElementById('ai-container'),
    aiContent: document.getElementById('ai-content'),
    timeRangeSelector: document.getElementById('time-range-selector')
};

els.editModal = document.getElementById("edit-modal");
els.editForm = document.getElementById("edit-form");
els.editAmount = document.getElementById("edit-amount");
els.editCategory = document.getElementById("edit-category");
els.editDescription = document.getElementById("edit-description");
els.cancelEdit = document.getElementById("cancel-edit");
let editingId = null;

// Initialization
async function init() {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');
    appState.token = token;

    // Simulate verification delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (token) {
        try {
            const verifyRes = await fetch(
                `/api/verify?token=${token}`
            );
    
            if (!verifyRes.ok) throw new Error();
    
            const user = await verifyRes.json();
            appState.username = user.username || "Telegram User";
    
            const txRes = await fetch(
                `/api/transactions?token=${token}`
            );
    
            if (!txRes.ok) throw new Error();
    
            const data = await txRes.json();
            appState.transactions = data.transactions;
    
            showDashboard();
    
        } catch (err) {
            els.loadingView.classList.add('hidden');
            els.errorView.classList.remove('hidden');
            els.errorMessage.textContent = "Invalid or expired session.";
        }
    
    } else {
        // Demo flow (triggered if no token provided)
        appState.isAuthenticated = true; // Allow for demo
        appState.username = 'Demo User';
        appState.transactions = generateMockTransactions(100);
        
        // Update UI to show Demo Mode
        els.authBadge.className = 'flex items-center px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full';
        els.authBadge.innerHTML = '<i class="ph ph-flask mr-1"></i> Demo Mode';
        
        showDashboard();
    }
}

function showDashboard() {
    els.loadingView.classList.add('hidden');
    els.dashboardView.classList.remove('hidden');
    els.usernameDisplay.textContent = appState.username;

    renderStats();
    renderCharts();
    renderTransactions();
}

function renderStats() {
    const income = appState.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = appState.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = income - expense;

    els.totalBalance.textContent = `$${balance.toLocaleString()}`;
    els.totalIncome.textContent = `$${income.toLocaleString()}`;
    els.totalExpense.textContent = `$${expense.toLocaleString()}`;
}

function renderCharts() {
    // 1. Main Cash Flow Chart
    const ctxMain = document.getElementById('mainChart').getContext('2d');
    
    let statsData;
    let labels;
    
    if (appState.timeRange === 'monthly') {
        const monthlyData = calculateMonthlyStats(appState.transactions);
        statsData = monthlyData;
        labels = monthlyData.map(d => d.month);
    } else {
        const dailyData = calculateDailyStats(appState.transactions);
        statsData = dailyData;
        labels = dailyData.map(d => {
            const date = new Date(d.date);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });
    }

    if (appState.charts.main) appState.charts.main.destroy();

    appState.charts.main = new Chart(ctxMain, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: statsData.map(d => d.income),
                    backgroundColor: COLORS.income,
                    borderRadius: 4,
                },
                {
                    label: 'Expense',
                    data: statsData.map(d => d.expense),
                    backgroundColor: COLORS.expense,
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', align: 'end', labels: { usePointStyle: true } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#fff',
                    titleColor: '#1e293b',
                    bodyColor: '#475569',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: $${context.raw.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9', drawBorder: false },
                    ticks: { callback: (val) => '$' + val }
                },
                x: {
                    grid: { display: false, drawBorder: false }
                }
            }
        }
    });

    // 2. Category Pie Chart
    const catStats = calculateCategoryStats(appState.transactions);
    const ctxCat = document.getElementById('categoryChart').getContext('2d');

    if (appState.charts.category) appState.charts.category.destroy();

    appState.charts.category = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: catStats.map(c => c.name),
            datasets: [{
                data: catStats.map(c => c.value),
                backgroundColor: catStats.map((_, i) => COLORS.charts[i % COLORS.charts.length]),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#fff',
                    bodyColor: '#1e293b',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return ` $${context.raw.toLocaleString()}`;
                        }
                    }
                }
            }
        }
    });

    // Custom Legend
    els.categoryLegend.innerHTML = '';
    catStats.slice(0, 4).forEach((cat, index) => {
        const color = COLORS.charts[index % COLORS.charts.length];
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between text-sm';
        item.innerHTML = `
            <div class="flex items-center">
                <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${color}"></div>
                <span class="text-slate-600 font-medium">${cat.name}</span>
            </div>
            <span class="font-bold text-slate-800">$${cat.value.toLocaleString()}</span>
        `;
        els.categoryLegend.appendChild(item);
    });
}

function renderTransactions() {
    els.transactionList.innerHTML = '';
    
    appState.transactions.slice(0, 10).forEach(tx => {
        const isIncome = tx.type === 'income';
        const date = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        let iconClass = 'ph-currency-dollar';
        switch(tx.category.toLowerCase()) {
            case 'food & dining': iconClass = 'ph-coffee'; break;
            case 'shopping': iconClass = 'ph-shopping-bag'; break;
            case 'transportation': iconClass = 'ph-car'; break;
            case 'bills & utilities': iconClass = 'ph-lightning'; break;
            case 'salary': iconClass = 'ph-briefcase'; break;
            case 'entertainment': iconClass = 'ph-film-strip'; break;
        }

        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-4 hover:bg-slate-50 transition-colors';
        div.dataset.id = tx.id;
        div.innerHTML = `
            <div class="flex items-center space-x-4">
                <div class="p-2.5 rounded-full ${isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}">
                    <i class="ph ${iconClass} text-lg"></i>
                </div>
                <div>
                    <p class="text-sm font-bold text-slate-800">${tx.category}</p>
                    <p class="text-xs text-slate-500 font-medium">${date} • ${tx.description}</p>
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <div class="text-sm font-bold ${isIncome ? 'text-emerald-600' : 'text-slate-800'}">
                    ${isIncome ? '+' : '-'}$${tx.amount.toLocaleString()}
                </div>
                <button class="edit-btn text-xs text-indigo-500 hover:text-indigo-700">
                    <i class="ph ph-pencil"></i>
                </button>
                <button class="delete-btn text-xs text-rose-500 hover:text-rose-700">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
        `;
        els.transactionList.appendChild(div);
    });
}

// Event Listeners
els.aiBtn.addEventListener('click', async () => {
    const btn = els.aiBtn;
    const originalContent = btn.innerHTML;
    
    // Set loading state
    btn.disabled = true;
    btn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i><span>Analyzing...</span>`;
    
    try {
        const insights = await generateFinancialInsights(
            appState.transactions,
            appState.token
        );

        
        els.aiContainer.classList.remove('hidden');
        els.aiContent.innerHTML = insights.replace(/\n/g, '<br/>'); // Simple formatting
        
        // Scroll to insights
        els.aiContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        console.error(err);
        alert('Failed to generate insights.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
});

els.timeRangeSelector.addEventListener('change', (e) => {
    appState.timeRange = e.target.value;
    renderCharts();
});

els.transactionList.addEventListener("click", async (e) => {
    const deleteBtn = e.target.closest(".delete-btn");
    const editBtn = e.target.closest(".edit-btn");
    const container = e.target.closest("[data-id]");

    if (!container) return;

    const id = container.dataset.id;
    const tx = appState.transactions.find(t => t.id === id);

    // 🗑 DELETE
    if (deleteBtn) {
        if (!confirm("Delete this transaction?")) return;

        const res = await fetch(
            `/api/transactions/${id}?token=${appState.token}`,
            { method: "DELETE" }
        );
        
        if (!res.ok) {
            alert("Failed to delete.");
            return;
        }

        appState.transactions = appState.transactions.filter(t => t.id !== id);

        renderStats();
        renderCharts();
        renderTransactions();
    }

    // ✏ EDIT
    if (editBtn) {
        editingId = id;
    
        els.editAmount.value = tx.amount;
        els.editCategory.value = tx.category;
        els.editDescription.value = tx.description || "";
    
        els.editModal.classList.remove("hidden");
        els.editModal.classList.add("flex");
    }
});

els.editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editingId) return;

    const newAmount = Number(els.editAmount.value);
    const newCategory = els.editCategory.value.trim();
    const newDescription = els.editDescription.value.trim();

    const res = await fetch(
        `/api/transactions/${editingId}?token=${appState.token}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount: newAmount,
                category: newCategory,
                description: newDescription
            })
        }
    );

    if (!res.ok) {
        alert("Failed to update.");
        return;
    }

    const tx = appState.transactions.find(t => t.id === editingId);
    if (!tx) return;
    tx.amount = newAmount;
    tx.category = newCategory;
    tx.description = newDescription;

    els.editModal.classList.add("hidden");
    els.editModal.classList.remove("flex");

    renderStats();
    renderCharts();
    renderTransactions();
});

els.cancelEdit.addEventListener("click", () => {
    els.editModal.classList.add("hidden");
    els.editModal.classList.remove("flex");
});

els.editModal.addEventListener("click", (e) => {
    if (e.target === els.editModal) {
        els.editModal.classList.add("hidden");
        els.editModal.classList.remove("flex");
    }
});

// Run
init();
