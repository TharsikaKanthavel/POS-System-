import { db } from '../db';

const hasWindow = typeof window !== 'undefined';

// Ensure electronAPI exists if we are in Electron with nodeIntegration
if (hasWindow && !window.electronAPI) {
    try {
        // eslint-disable-next-line global-require
        const { ipcRenderer } = require('electron');
        window.electronAPI = {
            ...(window.electronAPI || {}),
            pricingSuggest: (payload) => ipcRenderer.invoke('pricing:suggest', payload),
        };
    } catch (e) {
        // Not running in Electron – pricing suggestions will be unavailable
    }
}

const isElectron =
    hasWindow &&
    typeof window.electronAPI !== 'undefined' &&
    typeof window.electronAPI.pricingSuggest === 'function';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function computeSalesVelocity(productId) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_PER_DAY);

    const sales = await db.sales.toArray();

    let units7 = 0;
    let units30 = 0;

    for (const sale of sales) {
        if (!sale.date) continue;
        const date = new Date(sale.date);
        const items = Array.isArray(sale.items) ? sale.items : [];
        const totalForProduct = items
            .filter((i) => i.id === productId)
            .reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);

        if (totalForProduct <= 0) continue;

        if (date >= sevenDaysAgo) {
            units7 += totalForProduct;
        }
        if (date >= thirtyDaysAgo) {
            units30 += totalForProduct;
        }
    }

    return { units7, units30 };
}

async function getEarliestExpiry(productId, productFallbackExpiry) {
    const batches = await db.batches.where('product_id').equals(productId).toArray();
    const dates = [];

    for (const b of batches) {
        if (b.expiry_date) {
            const d = new Date(b.expiry_date);
            if (!Number.isNaN(d.getTime())) {
                dates.push(d);
            }
        }
    }

    if (dates.length > 0) {
        return new Date(Math.min(...dates.map((d) => d.getTime())));
    }

    if (productFallbackExpiry) {
        const d = new Date(productFallbackExpiry);
        if (!Number.isNaN(d.getTime())) {
            return d;
        }
    }

    return null;
}

async function buildPricingPayload(productId) {
    const product = await db.products.get(productId);
    if (!product) {
        throw new Error('Product not found');
    }

    const [velocity, expiryDate] = await Promise.all([
        computeSalesVelocity(productId),
        getEarliestExpiry(productId, product.expiry_date),
    ]);

    const stockUnits = parseInt(product.stock_quantity || 0, 10) || 0;

    // Try to resolve category name; fall back to "General"
    let categoryName = 'General';
    if (product.category_id) {
        const cat = await db.categories.get(product.category_id);
        if (cat?.name) {
            categoryName = cat.name;
        }
    }

    const productPayload = {
        product_id: product.id,
        name: product.name,
        cost_price: parseFloat(product.cost || 0),
        current_price: parseFloat(product.price || 0),
        category: categoryName,
        stock_units: stockUnits,
        expiry_date: expiryDate ? expiryDate.toISOString() : null,
        recent_units_sold_7d: velocity.units7,
        recent_units_sold_30d: velocity.units30,
        current_discount_pct: 0,
    };

    const marketPayload = {
        now: new Date().toISOString(),
        competitor_price: null,
    };

    return { productPayload, marketPayload };
}

export const pricingService = {
    isAvailable() {
        return isElectron;
    },

    async getSuggestionForProduct(productId) {
        if (!isElectron) {
            throw new Error('AI pricing is only available in the Electron desktop app.');
        }

        const { productPayload, marketPayload } = await buildPricingPayload(productId);
        const response = await window.electronAPI.pricingSuggest({
            product: productPayload,
            market: marketPayload,
        });

        if (!response || response.status !== 'success') {
            throw new Error(response?.message || 'Failed to get pricing suggestion');
        }

        return response.decision;
    },
};