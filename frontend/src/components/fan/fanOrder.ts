export const sendToBack = (order: number[]): number[] => [...order.slice(1), order[0]]
export const bringToFront = (order: number[]): number[] => [order[order.length - 1], ...order.slice(0, -1)]
