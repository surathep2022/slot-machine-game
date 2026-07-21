function normalizePrizeOrder(rawOrder) {
    if (!rawOrder || typeof rawOrder !== 'object' || Array.isArray(rawOrder)) {
        return {};
    }

    const normalized = {};
    Object.entries(rawOrder).forEach(([slot, value]) => {
        const slotKey = String(slot);
        const prizeName = typeof value === 'string' ? value : value?.name || '';
        if (prizeName) {
            normalized[slotKey] = prizeName;
        }
    });

    return normalized;
}

function getPrizeNameForTurn(prizeOrder, totalSpins) {
    const normalized = normalizePrizeOrder(prizeOrder);
    const slotKey = String((totalSpins || 0) + 1);
    return normalized[slotKey] || '';
}
