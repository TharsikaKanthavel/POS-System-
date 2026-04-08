import { db } from '../db';

/**
 * AI Service to handle natural language queries about the business.
 */
class AIService {
    constructor() {
        this._updateApiKey();
    }

    _updateApiKey() {
        const storedKey = localStorage.getItem('GEMINI_API_KEY');
        this.apiKey = (storedKey && storedKey.trim() !== '')
            ? storedKey.trim()
            : 'AIzaSyB3D74D6wSgG2rt4syScqWMkYYUe-vJcIc';
    }

    setApiKey(key) {
        if (key) {
            localStorage.setItem('GEMINI_API_KEY', key.trim());
        } else {
            localStorage.removeItem('GEMINI_API_KEY');
        }
        this._updateApiKey();
    }

    clearApiKey() {
        localStorage.removeItem('GEMINI_API_KEY');
        this._updateApiKey();
    }

    hasApiKey() {
        return !!this.apiKey && this.apiKey.startsWith('AIza');
    }

    async getSystemContext() {
        // Fetch all base data for precise calculation
        const allProducts = await db.products.toArray();
        const allSales = await db.sales.toArray();
        const allExpenses = await db.expenses.toArray();
        const allStock = await db.stock.toArray();

        // 1. FINANCIAL PERFORMANCE (ACTUAL)
        let totalRevenue = 0;
        let totalCogs = 0; // Cost of Goods Sold
        let totalSalesCount = allSales.length;

        allSales.forEach(sale => {
            // Revenue is the final amount paid (using fields from POS snapshot)
            totalRevenue += (Number(sale.grandTotal || sale.total || sale.grand_total || 0));

            // Calculate COGS from snapshot items in the sale
            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    const qty = Number(item.quantity) || 0;
                    const cost = Number(item.cost || 0);
                    totalCogs += (cost * qty);
                });
            }
        });

        const totalExpenses = allExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        // Gross Profit = Revenue - COGS
        const grossProfit = totalRevenue - totalCogs;
        // Net Profit = Gross Profit - Expenses
        const netProfit = grossProfit - totalExpenses;

        // 2. INVENTORY VALUATION (CURRENT)
        let invCostValue = 0;
        let invRetailValue = 0;
        let totalStockQty = 0;

        allProducts.forEach(p => {
            // Get total stock across all warehouses for this product
            const pStock = allStock
                .filter(s => s.product_id === p.id)
                .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

            const cost = Number(p.cost || 0);
            const price = Number(p.price || 0);

            totalStockQty += pStock;
            invCostValue += (cost * pStock);
            invRetailValue += (price * pStock);
        });

        // 3. TODAY'S PERFORMANCE
        const today = new Date().toISOString().split('T')[0];
        const todaySales = allSales.filter(s => {
            const sDate = s.date instanceof Date ? s.date.toISOString() : String(s.date);
            return sDate.startsWith(today);
        });
        const todayRevenue = todaySales.reduce((sum, s) => sum + (Number(s.grandTotal || s.total || s.grand_total || 0)), 0);

        return `
            You are the SAAI POS Data Master. Your data is verified and 100% accurate.
            Current Time: ${new Date().toLocaleString()}

            FINANCIAL PERFORMANCE:
            - TOTAL REVENUE: ${totalRevenue.toFixed(2)}
            - COST OF GOODS SOLD (COGS): ${totalCogs.toFixed(2)}
            - TOTAL EXPENSES: ${totalExpenses.toFixed(2)}
            - GROSS PROFIT: ${grossProfit.toFixed(2)}
            - ACTUAL NET PROFIT: ${netProfit.toFixed(2)}
            - TOTAL SALES COUNT: ${totalSalesCount}

            INVENTORY SNAPSHOT (LIVE):
            - TOTAL STOCK QUANTITY: ${totalStockQty}
            - INVENTORY VALUE (AT COST): ${invCostValue.toFixed(2)}
            - INVENTORY VALUE (AT RETAIL/PRICE): ${invRetailValue.toFixed(2)}
            - POTENTIAL PROFIT FROM STOCK: ${(invRetailValue - invCostValue).toFixed(2)}

            TODAY'S SUMMARY:
            - TODAY REVENUE: ${todayRevenue.toFixed(2)}
            - TODAY SALES COUNT: ${todaySales.length}

            MISSION:
            1. Use these EXACT figures for money and wealth questions.
            2. Be short, data-driven, and professional.
            3. If asked about "profit", always cite both Gross and Net Profit.
            4. If asked about "value" or "wealth", use the Inventory Value (Retail).
        `;
    }

    async ask(userMessage, chatHistory = []) {
        const systemPrompt = await this.getSystemContext();

        // Prepare contents with simple history support
        const contents = [];

        // Add history (limit to last 4 messages for stability)
        const history = chatHistory.slice(-4);
        history.forEach(msg => {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            });
        });

        // Add current prompt
        contents.push({
            role: 'user',
            parts: [{ text: `CONTEXT: ${systemPrompt}\n\nUSER: ${userMessage}` }]
        });

        const callApi = async (key) => {
            if (!key) throw new Error('API Key is missing.');

            // Using gemini-3-flash-preview: The absolute latest model as of Jan 2026
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048,
                        topP: 0.95,
                        topK: 40
                    }
                })
            });
            return response;
        };

        try {
            // Priority: Local Storage Key -> Hardcoded Key
            const currentKey = this.apiKey || 'AIzaSyB3D74D6wSgG2rt4syScqWMkYYUe-vJcIc';
            let response = await callApi(currentKey);

            // Automatic fallback to last known working key
            if (!response.ok && currentKey !== 'AIzaSyB3D74D6wSgG2rt4syScqWMkYYUe-vJcIc') {
                console.warn("Retrying with backup key...");
                response = await callApi('AIzaSyB3D74D6wSgG2rt4syScqWMkYYUe-vJcIc');
            }

            if (!response.ok) {
                const error = await response.json();
                const msg = error.error?.message || `Error ${response.status}`;

                if (response.status === 403) {
                    throw new Error("Access Denied: Please check if Gemini 3 is enabled for your API key.");
                }
                throw new Error("AI Service Issue (Gemini 3): " + msg);
            }

            const data = await response.json();
            if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
                throw new Error('AI returned an empty response.');
            }

            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('AI Service Error:', error);
            throw error;
        }
    }

    /**
     * Specialized method to parse natural language into a Purchase Order JSON.
     */
    async executeNLPOrder(userCommand) {
        const products = await db.products.toArray();
        const suppliers = await db.suppliers.toArray();
        const warehouses = await db.warehouses.toArray();

        const dataContext = `
            AVAILABLE PRODUCTS: ${products.map(p => `${p.name} (ID: ${p.id}, Cost: ${p.cost})`).join(', ')}
            AVAILABLE SUPPLIERS: ${suppliers.map(s => `${s.name} (ID: ${s.id})`).join(', ')}
            AVAILABLE WAREHOUSES: ${warehouses.map(w => `${w.name} (ID: ${w.id})`).join(', ')}
        `;

        const prompt = `
            You are an Inventory Assistant. Convert the following user command into a structured Purchase JSON object.
            USER COMMAND: "${userCommand}"
            
            CONTEXT:
            ${dataContext}

            OUTPUT FORMAT (JSON ONLY):
            {
                "supplier_id": number,
                "warehouse_id": number,
                "items": [
                    {"product_id": number, "quantity": number, "cost": number}
                ],
                "notes": "string"
            }

            Rules:
            1. If product/supplier/warehouse isn't found in context, pick the most likely or leave as null.
            2. If quantity isn't specified, default to 10.
            3. respond ONLY with the JSON block.
        `;

        const contents = [{
            role: 'user',
            parts: [{ text: prompt }]
        }];

        const currentKey = this.apiKey || 'AIzaSyB3D74D6wSgG2rt4syScqWMkYYUe-vJcIc';

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${currentKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        if (!response.ok) throw new Error('AI Parse Failed');
        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        // Extract JSON from markdown if present
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    }
}

export const aiService = new AIService();
