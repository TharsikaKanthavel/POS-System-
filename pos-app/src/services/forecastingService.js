import * as tf from '@tensorflow/tfjs';
import { db } from '../db';
import { aiService } from './aiService';

/**
 * ForecastingService handles AI-driven time-series predictions and demand analysis.
 * Now enhanced with Gemini for 'pre-trained' intelligence fallback.
 */
class ForecastingService {
    /**
     * Prepares historical daily revenue data for time-series modeling.
     */
    async getDailyRevenueData(days = 90) {
        const sales = await db.sales.toArray();
        const dailyTotals = {};

        sales.forEach(sale => {
            const date = sale.date instanceof Date
                ? sale.date.toISOString().split('T')[0]
                : String(sale.date).split('T')[0];

            const amount = Number(sale.total || sale.grand_total || sale.grandTotal || 0);
            dailyTotals[date] = (dailyTotals[date] || 0) + amount;
        });

        // Fill gaps with 0
        const sortedDates = Object.keys(dailyTotals).sort();
        if (sortedDates.length === 0) return [];

        const start = new Date(sortedDates[0]);
        const end = new Date();
        const data = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            data.push({
                date: dateStr,
                value: dailyTotals[dateStr] || 0
            });
        }

        return data.slice(-days);
    }

    /**
     * Predicts next day revenue using an LSTM model with Gemini fallback.
     */
    async predictNextDayRevenue(historyDays = 30) {
        try {
            const rawData = await this.getDailyRevenueData(historyDays + 7);
            if (rawData.length < 5) return 0; // Not enough data for anything

            // If we have very little data, use Gemini as the "Pre-trained" brain
            if (rawData.length < 14) {
                return await this.getGeminiForecast(rawData);
            }

            const values = rawData.map(d => d.value);

            // Simple normalization (Min-Max)
            const max = Math.max(...values, 1);
            const min = Math.min(...values);
            const normalized = values.map(v => (v - min) / (max - min || 1));

            // Prepare training data (X: past sequence, Y: next value)
            const windowSize = Math.min(7, Math.floor(normalized.length / 2));
            const X = [];
            const Y = [];

            for (let i = 0; i < normalized.length - windowSize; i++) {
                X.push(normalized.slice(i, i + windowSize));
                Y.push(normalized[i + windowSize]);
            }

            if (X.length === 0) return await this.getGeminiForecast(rawData);

            // Convert to Tensors
            const inputTensor = tf.tensor2d(X, [X.length, windowSize]).reshape([X.length, windowSize, 1]);
            const labelTensor = tf.tensor2d(Y, [Y.length, 1]);

            // Build LSTM Model
            const model = tf.sequential();
            model.add(tf.layers.lstm({ units: 32, inputShape: [windowSize, 1], returnSequences: false }));
            model.add(tf.layers.dense({ units: 1 }));

            model.compile({
                optimizer: tf.train.adam(0.01),
                loss: 'meanSquaredError'
            });

            // Train Model (Short epochs for UI responsiveness)
            await model.fit(inputTensor, labelTensor, {
                epochs: 30,
                verbose: 0
            });

            // Predict latest
            const latestWindow = normalized.slice(-windowSize);
            const input = tf.tensor3d([latestWindow.map(v => [v])], [1, windowSize, 1]);
            const prediction = model.predict(input);
            const predictedValue = (await prediction.data())[0];

            tf.dispose([inputTensor, labelTensor, input, prediction]);

            // Denormalize
            const result = predictedValue * (max - min) + min;
            return isNaN(result) ? await this.getGeminiForecast(rawData) : result;
        } catch (err) {
            console.error("Forecasting Error:", err);
            return 0;
        }
    }

    /**
     * Uses Gemini API as a pre-trained time-series model.
     */
    async getGeminiForecast(history) {
        if (!aiService.hasApiKey()) return history[history.length - 1]?.value || 0;

        const dataPoints = history.map(h => `${h.date}: ${h.value}`).join('\n');
        const prompt = `Analyze this sales history and predict the revenue for the NEXT DAY ONLY. 
        RESPOND ONLY WITH THE NUMBER.
        DATA:
        ${dataPoints}`;

        try {
            const response = await aiService.ask(prompt);
            const match = response.match(/[\d.]+/);
            return match ? parseFloat(match[0]) : (history[history.length - 1]?.value || 0);
        } catch (e) {
            return history[history.length - 1]?.value || 0;
        }
    }

    /**
     * Simplified ARIMA-like forecasting (Exponential Smoothing).
     */
    async predictWeeklyRevenue() {
        const data = await this.getDailyRevenueData(90);
        if (data.length < 7) return [];

        // Basic smoothing for the UI chart
        const values = data.map(d => d.value);
        const forecasts = [];
        let level = values.reduce((a, b) => a + b, 0) / values.length;
        let trend = (values[values.length - 1] - values[0]) / values.length;

        for (let i = 1; i <= 7; i++) {
            forecasts.push({
                day: i,
                value: Math.max(0, level + (i * trend * 1.1)) // Added 10% bias for growth
            });
        }
        return forecasts;
    }

    /**
     * Demand Analysis: Predict Slow vs Fast moving items.
     */
    async getDemandInsights() {
        const sales = await db.sales.toArray();
        const products = await db.products.toArray();

        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const productSales = {};

        // Aggregate totals from nested sales items (Primary Source)
        sales.forEach(sale => {
            const saleDate = new Date(sale.date);
            if (saleDate >= thirtyDaysAgo && sale.items) {
                sale.items.forEach(item => {
                    const pid = item.product_id || item.id;
                    if (pid) {
                        productSales[pid] = (productSales[pid] || 0) + (Number(item.quantity) || 0);
                    }
                });
            }
        });

        const insights = products.map(p => {
            const totalSold = productSales[p.id] || 0;
            const stock = Number(p.stock_quantity) || 0;

            // Velocity-based Categorization
            let status = 'Normal';
            if (totalSold >= 10) status = 'Fast Moving';
            else if (totalSold === 0 && stock > 0) status = 'Dead Stock';
            else if (totalSold < 3) status = 'Slow Moving';

            return {
                id: p.id,
                name: p.name,
                totalSold,
                status,
                color: status === 'Fast Moving' ? '#10b981' : (status === 'Dead Stock' ? '#ef4444' : '#f59e0b')
            };
        });

        return insights.sort((a, b) => b.totalSold - a.totalSold);
    }

    /**
     * Cash Flow Forecasting (Revenue vs Expenses).
     */
    async getCashFlowForecast() {
        const dailyRev = await this.getDailyRevenueData(30);
        const expenses = await db.expenses.toArray();

        const dailyExp = {};
        expenses.forEach(e => {
            const date = e.date instanceof Date
                ? e.date.toISOString().split('T')[0]
                : String(e.date).split('T')[0];
            dailyExp[date] = (dailyExp[date] || 0) + Number(e.amount || 0);
        });

        return dailyRev.map(d => ({
            date: d.date,
            revenue: d.value,
            expenses: dailyExp[d.date] || 0,
            profit: d.value - (dailyExp[d.date] || 0)
        }));
    }

    /**
     * Seasonal Demand Prediction.
     * Checks monthly trends and predicts demand for specific months.
     */
    async getSeasonalTrends() {
        const sales = await db.sales.toArray();
        const monthlyData = Array(12).fill(0).map((_, i) => ({ month: i, total: 0 }));

        sales.forEach(sale => {
            const date = new Date(sale.date);
            const month = date.getMonth();
            monthlyData[month].total += Number(sale.total || sale.grand_total || 0);
        });

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const maxVal = Math.max(...monthlyData.map(m => m.total), 1);

        return monthlyData.map((m, i) => ({
            month: months[i],
            revenue: m.total,
            isPeak: m.total > 0 && m.total === maxVal
        }));
    }

    /**
     * Customer Churn Prediction (RFM Analysis).
     * Identifies customers at risk of leaving based on recency and frequency.
     */
    async getCustomerChurnInsight() {
        const customers = await db.customers.toArray();
        const sales = await db.sales.toArray();
        const now = new Date();

        const customerSales = {};
        sales.forEach(sale => {
            if (!sale.customer_id) return;
            const cid = sale.customer_id;
            if (!customerSales[cid]) {
                customerSales[cid] = { count: 0, lastDate: new Date(0), totalAmount: 0 };
            }
            customerSales[cid].count++;
            const saleDate = new Date(sale.date);
            if (saleDate > customerSales[cid].lastDate) {
                customerSales[cid].lastDate = saleDate;
            }
            customerSales[cid].totalAmount += Number(sale.total || sale.grand_total || 0);
        });

        return customers.map(c => {
            const stats = customerSales[c.id];
            if (!stats) return { ...c, risk: 'High', daysSinceLast: 'Never', color: '#f97316' };

            const daysSinceLast = Math.floor((now - stats.lastDate) / (1000 * 60 * 60 * 24));
            let risk = 'Low';
            if (daysSinceLast > 60) risk = 'Critical';
            else if (daysSinceLast > 30) risk = 'High';
            else if (daysSinceLast > 14) risk = 'Medium';

            return {
                id: c.id,
                name: c.name,
                risk,
                daysSinceLast,
                totalSpent: stats.totalAmount,
                orderCount: stats.count,
                color: risk === 'Critical' ? '#ef4444' : risk === 'High' ? '#f97316' : risk === 'Medium' ? '#eab308' : '#10b981'
            };
        }).sort((a, b) => {
            const order = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
            return order[a.risk] - order[b.risk];
        });
    }

    /**
     * AI-based Stock Ordering Suggestions.
     */
    async getLowStockOrders() {
        const products = await db.products.toArray();
        const lowStock = products.filter(p => (Number(p.stock_quantity) || 0) <= (Number(p.alert_quantity) || 5));

        return lowStock.map(p => ({
            id: p.id,
            name: p.name,
            currentStock: p.stock_quantity || 0,
            alertQty: p.alert_quantity || 5,
            suggestedOrder: Math.max(0, (p.alert_quantity || 5) * 2 - (p.stock_quantity || 0)),
            cost: p.cost || 0
        }));
    }
}

export const forecastingService = new ForecastingService();
