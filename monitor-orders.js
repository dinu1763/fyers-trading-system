require('dotenv').config();
const OrderService = require('./src/services/orderService');

async function monitorAndCancelOrders() {
  const orderService = new OrderService();
  
  console.log('👁️ Order Monitor Service Started');
  console.log('Monitoring for TP/SL execution and auto-cancelling...');
  
  setInterval(async () => {
    try {
      const orders = await orderService.getOrders();
      
      if (!orders.data?.orderBook) return;
      
      // Group orders by symbol
      const ordersBySymbol = {};
      orders.data.orderBook.forEach(order => {
        if (order.productType === 'INTRADAY' && order.side === -1) { // Sell orders only
          if (!ordersBySymbol[order.symbol]) {
            ordersBySymbol[order.symbol] = [];
          }
          ordersBySymbol[order.symbol].push(order);
        }
      });
      
      // Check each symbol for TP/SL pairs
      for (const symbol in ordersBySymbol) {
        const symbolOrders = ordersBySymbol[symbol];
        
        if (symbolOrders.length >= 2) {
          const limitOrders = symbolOrders.filter(o => o.type === 1); // Limit orders (TP)
          const stopOrders = symbolOrders.filter(o => o.type === 4);  // Stop orders (SL)
          
          // Check for executed orders
          for (const order of symbolOrders) {
            if (order.status === 'COMPLETE' || order.status === 'FILLED') {
              console.log(`🎯 Order executed: ${symbol} - ${order.id}`);
              
              // Cancel all other pending orders for this symbol
              const otherOrders = symbolOrders.filter(o => 
                o.id !== order.id && 
                (o.status === 'PENDING' || o.status === 'OPEN')
              );
              
              for (const otherOrder of otherOrders) {
                try {
                  await orderService.cancelOrder(otherOrder.id);
                  console.log(`✅ Auto-cancelled: ${otherOrder.id}`);
                } catch (cancelError) {
                  console.log(`❌ Cancel failed: ${otherOrder.id}`);
                }
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.log(`❌ Monitor error: ${error.message}`);
    }
  }, 30000); // Check every 30 seconds
}

if (require.main === module) {
  monitorAndCancelOrders();
}