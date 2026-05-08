/**
 * js/reports.js
 * Geração de relatórios financeiros mensais.
 */

const Reports = {
    openMonthlyReport() {
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const currentMonthName = monthNames[App.currentMonth];
        
        // Dados do mês atual
        const monthlyTransactions = Store.transactions.filter(t => {
            if (t.status !== 'paid') return false;
            // Ignora gastos de cartão no fluxo direto (contabiliza na fatura paga)
            if (t.card && t.card !== 'none' && !t.invoicePaid) return false;
            
            const dateStr = t.paymentDate || t.date;
            const date = new Date(dateStr + 'T12:00:00Z');
            return date.getMonth() === App.currentMonth && date.getFullYear() === App.currentYear;
        });

        const totalIncome = monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const savings = totalIncome - totalExpense;
        const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

        // Top Categorias
        const categoryTotals = {};
        monthlyTransactions.filter(t => t.type === 'expense').forEach(t => {
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
        });
        const topCategories = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        // Preencher Modal
        document.getElementById('report-title').innerText = `Relatório de ${currentMonthName} / ${App.currentYear}`;
        document.getElementById('report-income').innerText = Utils.formatCurrency(totalIncome);
        document.getElementById('report-expense').innerText = Utils.formatCurrency(totalExpense);
        document.getElementById('report-savings').innerText = Utils.formatCurrency(savings);
        document.getElementById('report-savings-rate').innerText = `${savingsRate.toFixed(1)}%`;
        
        const topList = document.getElementById('report-top-categories');
        topList.innerHTML = '';
        topCategories.forEach(([name, val]) => {
            const perc = totalExpense > 0 ? (val / totalExpense) * 100 : 0;
            topList.innerHTML += `
                <div class="report-row">
                    <span>${name}</span>
                    <span>${Utils.formatCurrency(val)} (${perc.toFixed(0)}%)</span>
                </div>
            `;
        });

        // Insights
        const insightEl = document.getElementById('report-insight');
        if (savings > 0) {
            insightEl.innerHTML = `<p style="color: var(--success)">Parabéns! Você fechou o mês no azul. Esse valor de ${Utils.formatCurrency(savings)} pode ser investido!</p>`;
        } else if (savings < 0) {
            insightEl.innerHTML = `<p style="color: var(--danger)">Atenção: Suas despesas superaram suas receitas este mês em ${Utils.formatCurrency(Math.abs(savings))}. Reveja seus custos fixos.</p>`;
        } else {
            insightEl.innerHTML = `<p>Equilíbrio total. Suas contas ficaram zeradas este mês.</p>`;
        }

        document.getElementById('report-modal').classList.add('active');
        UI.initIcons();
    },

    closeReport() {
        document.getElementById('report-modal').classList.remove('active');
    }
};

window.Reports = Reports;
