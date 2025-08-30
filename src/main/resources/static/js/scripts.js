const DEBUG = false; // flip to false for prod

const maxOrdersBeforeScrolling = 22;

let websocket = null;

document.addEventListener("DOMContentLoaded", () => {
    const tickerTabs = document.querySelectorAll(".tab");
    const tickerPanels = document.querySelectorAll(".tab-panel");
    const mainViewTabs = document.querySelectorAll(".orderbook-tab");
    const mainViewPanels = document.querySelectorAll(".orderbook-panel");
    const chartTabs = document.querySelectorAll(".chart-tab");
    const chartPanels = document.querySelectorAll(".chart-panel");
    const ohlcTabs = document.querySelectorAll(".ohlc-tab");
    const ohlcPanels = document.querySelectorAll(".ohlc-panel");
    const newsTabs = document.querySelectorAll(".news-tab");
    const newsPanels = document.querySelectorAll(".news-panel");

    const activateTicker = (id) => {
        tickerTabs.forEach(b => b.classList.toggle("tab-active", b.dataset.tab === id));
        tickerPanels.forEach(p => p.classList.toggle("active", p.id === `panel-${id}`));
        
        // When switching to LSE:RR, also reactivate the orderbook tab
        if (id === "LSE:RR" && mainViewTabs.length > 0) {
            activateMainView("all-orders");
        }
    };

    const activateMainView = (id) => {
        mainViewTabs.forEach(b => b.classList.toggle("orderbook-tab-active", b.dataset.orderbookTab === id));
        mainViewPanels.forEach(p => p.classList.toggle("orderbook-panel-active", p.id === `orderbook-panel-${id}`));
    };

    const activateChart = (id) => {
        chartTabs.forEach(b => b.classList.toggle("chart-tab-active", b.dataset.chartTab === id));
        chartPanels.forEach(p => p.classList.toggle("chart-panel-active", p.id === `chart-panel-${id}`));
    };

    const activateOhlc = (id) => {
        ohlcTabs.forEach(b => b.classList.toggle("ohlc-tab-active", b.dataset.ohlcTab === id));
        ohlcPanels.forEach(p => p.classList.toggle("ohlc-panel-active", p.id === `ohlc-panel-${id}`));
    };

    const activateNews = (id) => {
        newsTabs.forEach(b => b.classList.toggle("news-tab-active", b.dataset.newsTab === id));
        newsPanels.forEach(p => p.classList.toggle("news-panel-active", p.id === `news-panel-${id}`));
    };

    // default: first tab
    if (tickerTabs.length) activateTicker(tickerTabs[0].dataset.tab);
    if (mainViewTabs.length) activateMainView(mainViewTabs[0].dataset.orderbookTab);
    if (chartTabs.length) activateChart("chart"); // Select Chart tab by default
    if (ohlcTabs.length) activateOhlc("quotes-info"); // Select Quotes Info tab by default
    if (newsTabs.length) activateNews("rr-news"); // Select RR News tab by default

    // interactions
    tickerTabs.forEach(b => b.addEventListener("click", () => activateTicker(b.dataset.tab)));
    mainViewTabs.forEach(b => b.addEventListener("click", () => activateMainView(b.dataset.orderbookTab)));
    chartTabs.forEach(b => b.addEventListener("click", () => activateChart(b.dataset.chartTab)));
    ohlcTabs.forEach(b => b.addEventListener("click", () => activateOhlc(b.dataset.ohlcTab)));
    newsTabs.forEach(b => b.addEventListener("click", () => activateNews(b.dataset.newsTab)));

    // Initialize WebSocket connection
    initializeWebSocket();
    
    // Add click listener for the blue bar to switch between buy/sell modes
    const orderBookHeader = document.querySelector('.orderbook-header');
    if (orderBookHeader) {
        orderBookHeader.addEventListener('click', () => {
            // Toggle between 'buy' and 'sell' mode
            const currentMode = window.orderBookDisplayMode || 'buy';
            window.orderBookDisplayMode = (currentMode === 'buy') ? 'sell' : 'buy';
            
            // Update display if we have current data
            if (window.currentOrderbookData && window.currentOrderbookData.headerInfo) {
                updateOrderbookHeader(window.currentOrderbookData.headerInfo);
            }
            
            if (DEBUG) console.log("Switched to %s mode", window.orderBookDisplayMode);
        });
        
        // Add cursor pointer to indicate it's clickable
        orderBookHeader.style.cursor = 'pointer';
    }
    
    // Initialize display mode to 'buy'
    window.orderBookDisplayMode = 'buy';
    
    // Add event listeners for order filtering dropdowns
    const buyOrdersFilter = document.getElementById('buy-orders-filter');
    const sellOrdersFilter = document.getElementById('sell-orders-filter');
    
    if (buyOrdersFilter) {
        buyOrdersFilter.addEventListener('change', () => {
            // Trigger orderbook refresh when filter changes
            if (window.currentOrderbookData) {
                updateOrderbook(window.currentOrderbookData);
            }
        });
    }
    
    if (sellOrdersFilter) {
        sellOrdersFilter.addEventListener('change', () => {
            // Trigger orderbook refresh when filter changes  
            if (window.currentOrderbookData) {
                updateOrderbook(window.currentOrderbookData);
            }
        });
    }
})

// submit Search
const searchForm = document.querySelector(".search-group");
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = new FormData(searchForm).get("q");
  console.log("Search:", q);
});

// OK button click
document.querySelector(".btn-ghost").addEventListener("click", () => {
  console.log("OK clicked");
});

// toggle state
document.getElementById("live-toggle").addEventListener("change", (e) => {
  console.log("Live mode:", e.target.checked);
});

function initializeWebSocket() {
    // Dynamically determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/websocket`;
    
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = function(event) {
        console.log('WebSocket connection established');
    };
    
    websocket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    websocket.onclose = function(event) {
        console.log('WebSocket connection closed');
        // Attempt to reconnect after 3 seconds
        setTimeout(initializeWebSocket, 3000);
    };
    
    websocket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'orderbook':
            updateOrderbook(data.content);
            break;
        case 'trades':
            updateTrades(data.content);
            break;
        case 'ohlc':
            updateOHLC(data.content);
            break;
        case 'timeseries':
            updateTimeseries(data.content);
            break;
        case 'news':
            updateNews(data.content);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function updateOrderbook(orderbookData) {
    if (DEBUG) console.log('Received from WebSocket:', orderbookData);

    // Store current orderbook data globally for filtering
    window.currentOrderbookData = orderbookData;
    
    const bestBid = (orderbookData.bids || []).reduce((max, o) => Math.max(max, o.price), -Infinity);
    const bestAsk = (orderbookData.asks || []).reduce((min, o) => Math.min(min, o.price), Infinity);

    // Fallback if one side is missing
    const midpoint = (isFinite(bestBid) && isFinite(bestAsk))
        ? (bestBid + bestAsk) / 2
        : 632.30;

    populateOrders('bid-orders', orderbookData.bids, 'bid', midpoint);
    populateOrders('ask-orders', orderbookData.asks, 'ask', midpoint);
    
    const maxOrderNumber = Math.max(getOrderCount('bid-orders'), getOrderCount('ask-orders'));
    
    // Update orderbook scrollbar state
    updateScrollbarState(maxOrderNumber);
    
    // Update orderbook header with side-specific information
    if (orderbookData.headerInfo) {
        updateOrderbookHeader(orderbookData.headerInfo);
    }
    
    // Update yellow bar if data is available
    if (orderbookData.yellowBar) {
        updateYellowBar(orderbookData.yellowBar);
    }
    
    // Update price level bar with filtered data
    updatePriceLevelBarFromOrderbook(orderbookData.bids, orderbookData.asks);
}

function populateOrders(containerId, orders, side, midpoint) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    // Apply filtering based on dropdown selection
    const filteredOrders = applyOrderFiltering(orders, side);
    
    // Add actual order rows
    filteredOrders.forEach(order => {
        const orderRow = document.createElement('div');

        orderRow.className = `order-row ${getOrderColor(order.price, midpoint)}`;
        
        if (side === 'bid') {
            orderRow.innerHTML = `
                <span class="order-cell">${order.time}</span>
                <span class="order-cell">${order.exchange}</span>
                <span class="order-cell">${order.size.toLocaleString()}</span>
                <span class="order-cell">${order.price.toFixed(2)}</span>
            `;
        } else {
            orderRow.innerHTML = `
                <span class="order-cell">${order.price.toFixed(2)}</span>
                <span class="order-cell">${order.size.toLocaleString()}</span>
                <span class="order-cell">${order.exchange}</span>
                <span class="order-cell">${order.time}</span>
            `;
        }
        
        container.appendChild(orderRow);
    });
    if (DEBUG) console.log("%d orders in table on %s side from filtered input", container.childElementCount, side);
}

function getOrderCount(containerId) {
    const container = document.getElementById(containerId);
    return container.childElementCount;
}

function getOrderColor(price, spreadMid) {
    // Determine color based on price level proximity to spread
    // Colors change every 0.05 distance with doubled number of color nuances
    const distance = Math.round(Math.abs(price - spreadMid) * 100) / 100;

    if (distance <= 0.05) return 'order-darkest-blue';
    else if (distance <= 0.10) return 'order-dark-blue';
    else if (distance <= 0.15) return 'order-blue';
    else if (distance <= 0.20) return 'order-light-blue';
    else if (distance <= 0.25) return 'order-lightest-blue';
    else if (distance <= 0.30) return 'order-cyan';
    else if (distance <= 0.35) return 'order-light-cyan';
    else if (distance <= 0.40) return 'order-lightest-pink';
    else if (distance <= 0.45) return 'order-light-pink';
    else if (distance <= 0.50) return 'order-pink';
    else if (distance <= 0.55) return 'order-dark-pink';
    else if (distance <= 0.60) return 'order-darker-pink';
    else if (distance <= 0.65) return 'order-red-pink';
    else if (distance <= 0.70) return 'order-light-brown';
    else if (distance <= 0.75) return 'order-brown';
    else if (distance <= 0.80) return 'order-dark-brown';
    else if (distance <= 0.85) return 'order-darker-brown';
    else if (distance <= 0.90) return 'order-darkest-brown';
    else if (distance <= 0.95) return 'order-maroon';
    else return 'order-deep-maroon';
}

let timeseriesChart = null;

function updateTimeseries(timeseriesData) {
    if (!timeseriesChart) {
        initializeTimeseriesChart(timeseriesData);
    } else {
        updateTimeseriesChart(timeseriesData);
    }
}

function initializeTimeseriesChart(timeseriesData) {
    const ctx = document.getElementById('timeseries-chart').getContext('2d');

    // Register annotation plugin
    const annotationPlugin = window['chartjs-plugin-annotation'];
    if (annotationPlugin) Chart.register(annotationPlugin);

    // Create synthetic x-axis starting at 08:00 with even intervals
    const syntheticData = [];
    
    // Map actual data to synthetic x positions starting from 08:00 (x=0)
    timeseriesData.prices.forEach(point => {
      if (point.price !== null) {
        let xPosition;
        const time = point.time;
        
        // Map times to evenly spaced x positions starting at 08:00
        if (time >= '09:00' && time < '11:00') {
          // Scale within 0.5-1.5 range (09:00 is at x=0.5, 11:00 is at x=1.5)
          const minutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
          const start = 9 * 60; // 09:00 in minutes
          const end = 11 * 60;  // 11:00 in minutes
          xPosition = 0.5 + (minutes - start) / (end - start);
        } else if (time >= '11:00' && time < '13:00') {
          // Scale within 1.5-2.5 range
          const minutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
          const start = 11 * 60;
          const end = 13 * 60;
          xPosition = 1.5 + (minutes - start) / (end - start);
        } else if (time >= '13:00' && time < '15:00') {
          // Scale within 2.5-3.5 range
          const minutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
          const start = 13 * 60;
          const end = 15 * 60;
          xPosition = 2.5 + (minutes - start) / (end - start);
        } else if (time >= '15:00') {
          // Scale within 3.5-4.5 range
          const minutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
          const start = 15 * 60;
          const end = 16 * 60 + 30; // 16:30
          xPosition = 3.5 + (minutes - start) / (end - start);
        }
        
        if (xPosition !== undefined) {
          syntheticData.push({ x: xPosition, y: point.price });
        }
      }
    });

    timeseriesChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: timeseriesData.symbol,
          data: syntheticData,
          borderColor: '#4a90e2',
          backgroundColor: 'transparent',
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 3,
          fill: false,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          annotation: {
            annotations: {
              line1: {
                type: 'line',
                yMin: 625, 
                yMax: 625,
                borderColor: '#ff0000',
                borderWidth: 1,
                borderDash: [3, 3]
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            min: 0,
            max: 4.5,
            grid: {
              color: '#e0e0e0'
            },
            ticks: {
              font: { size: 9 },
              maxRotation: 0,
              stepSize: 0.5,
              callback: function(value) {
                // Show labels only at positions 0.5, 1.5, 2.5, 3.5 (09:00, 11:00, 13:00, 15:00)
                if (value === 0.5) return '09:00';
                if (value === 1.5) return '11:00';  
                if (value === 2.5) return '13:00';
                if (value === 3.5) return '15:00';
                return '';
              }
            }
          },
          y: {
            position: 'right',
            min: 624,
            max: 634,
            grid: {
              color: '#e0e0e0'
            },
            ticks: {
              font: { size: 9 },
              stepSize: 2
            }
          }
        }
      }
    });
}

function updateTimeseriesChart(timeseriesData) {
    // Create synthetic data like in initialization
    const syntheticData = [];
    
    timeseriesData.prices.forEach(point => {
        if (point.price !== null) {
            let xPosition;
            const time = point.time;
            
            if (time >= '09:00' && time < '11:00') {
                const minutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
                const start = 9 * 60;
                const end = 11 * 60;
                xPosition = 0.5 + (minutes - start) / (end - start);
            } else if (time >= '11:00' && time < '13:00') {
                const minutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
                const start = 11 * 60;
                const end = 13 * 60;
                xPosition = 1.5 + (minutes - start) / (end - start);
            } else if (time >= '13:00' && time < '15:00') {
                const minutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
                const start = 13 * 60;
                const end = 15 * 60;
                xPosition = 2.5 + (minutes - start) / (end - start);
            } else if (time >= '15:00') {
                const minutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
                const start = 15 * 60;
                const end = 16 * 60 + 30;
                xPosition = 3.5 + (minutes - start) / (end - start);
            }
            
            if (xPosition !== undefined) {
                syntheticData.push({ x: xPosition, y: point.price });
            }
        }
    });
    
    timeseriesChart.data.datasets[0].data = syntheticData;
    timeseriesChart.update();
}

function updateOHLC(ohlcData) {
    populateOhlcData(ohlcData.data);
}

function populateOhlcData(data) {
    const container = document.getElementById('ohlc-data');
    
    // Create table
    const table = document.createElement('table');
    table.className = 'ohlc-table';
    
    // Split data into two columns
    const leftColumn = data.slice(0, Math.ceil(data.length / 2));
    const rightColumn = data.slice(Math.ceil(data.length / 2));
    
    // Create rows
    const maxRows = Math.max(leftColumn.length, rightColumn.length);
    
    for (let i = 0; i < maxRows; i++) {
        const row = document.createElement('tr');
        row.className = 'ohlc-row';
        
        // Left column data
        if (leftColumn[i]) {
            const leftLabelCell = document.createElement('td');
            leftLabelCell.textContent = leftColumn[i].label;
            leftLabelCell.style.fontWeight = '600';
            
            const leftValueCell = document.createElement('td');
            leftValueCell.textContent = leftColumn[i].value;
            leftValueCell.style.textAlign = 'right';
            
            row.appendChild(leftLabelCell);
            row.appendChild(leftValueCell);
        } else {
            row.appendChild(document.createElement('td'));
            row.appendChild(document.createElement('td'));
        }
        
        // Right column data
        if (rightColumn[i]) {
            const rightLabelCell = document.createElement('td');
            rightLabelCell.textContent = rightColumn[i].label;
            rightLabelCell.style.fontWeight = '600';
            rightLabelCell.style.paddingLeft = '16px';
            
            const rightValueCell = document.createElement('td');
            rightValueCell.textContent = rightColumn[i].value;
            rightValueCell.style.textAlign = 'right';
            
            row.appendChild(rightLabelCell);
            row.appendChild(rightValueCell);
        } else {
            row.appendChild(document.createElement('td'));
            row.appendChild(document.createElement('td'));
        }
        
        table.appendChild(row);
    }
    
    container.innerHTML = '';
    container.appendChild(table);
}

function updateTrades(tradesData) {
    populateTradesData(tradesData.trades);
}

function populateTradesData(trades) {
    const container = document.getElementById('trades-data');
    container.innerHTML = '';
    
    trades.forEach((trade, i) => {
        const row = document.createElement('div');
        row.className = 'trades-row';

        // hardcode second item selection
        if (i === 1) row.classList.add('trades-row-selected');
        
        const priceClass = trade.color === 'blue' ? 'trades-price-blue' : 'trades-price-red';
        
        row.innerHTML = `
            <span class="trades-cell ${priceClass}">${trade.price.toFixed(2)}</span>
            <span class="trades-cell">${trade.shares.toLocaleString()}</span>
            <span class="trades-cell">${trade.type}</span>
            <span class="trades-cell">${trade.time}</span>
        `;
        
        container.appendChild(row);
    });
}

function updateNews(newsData) {
    populateNewsData('rr-news', newsData['news']);
}

function populateNewsData(tabId, newsItems) {
    const container = document.getElementById(`news-data-${tabId}`);
    container.innerHTML = '';
    
    newsItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'news-row';
        
        row.innerHTML = `
            <span class="news-cell">${item.date}</span>
            <span class="news-cell">${item.time}</span>
            <span class="news-cell">${item.headline}</span>
            <span class="news-cell">${item.source}</span>
        `;
        
        container.appendChild(row);
    });
}

function updateOrderbookHeader(headerInfo) {
    const currentMode = window.orderBookDisplayMode || 'buy';
    const sideData = currentMode === 'buy' ? headerInfo.buyData : headerInfo.sellData;
    
    // Update current side
    const currentSide = (currentMode === 'buy') ? 'buy' : 'sell';

    // Update current price
    const currentPriceElement = document.querySelector('.current-price');
    if (currentPriceElement && sideData.topPrice !== null) {
        currentPriceElement.textContent = `Cur (top ${currentSide}): ${sideData.topPrice.toFixed(2)}`;
    }
    
    // Update arrow and price change
    const priceArrowElement = document.querySelector('.price-arrow');
    const priceChangeElement = document.querySelector('.price-change');
    
    if (sideData.priceChange !== null && sideData.priceChangePercent !== null) {
        // Show arrow and price change
        if (priceArrowElement) {
            priceArrowElement.textContent = sideData.priceChange >= 0 ? '▲' : '▼';
            priceArrowElement.className = sideData.priceChange >= 0 ? 'price-arrow up' : 'price-arrow down';
        }
        
        if (priceChangeElement) {
            const changeSign = sideData.priceChange >= 0 ? '' : '';
            priceChangeElement.textContent = `${changeSign}${Math.abs(sideData.priceChange).toFixed(2)} (${Math.abs(sideData.priceChangePercent).toFixed(2)}%)`;
        }
    } else {
        // Hide arrow and price change when no change
        if (priceArrowElement) {
            priceArrowElement.textContent = '';
            priceArrowElement.className = 'price-arrow';
        }
        if (priceChangeElement) {
            priceChangeElement.textContent = '';
        }
    }
    
    // Update volume
    const volumeValueElement = document.querySelector('.volume-value');
    if (volumeValueElement && sideData.totalVolume !== null) {
        volumeValueElement.textContent = sideData.totalVolume.toLocaleString();
    }
}

function updateYellowBar(yellowBarData) {
    // Update the 7 yellow bar values: bidOrderCount, bidShareCount, bidPrice, separator, askPrice, askShareCount, askOrderCount
    const yellowBarRow = document.querySelector('.yellow-bar-row');
    if (yellowBarRow) {
        const cells = yellowBarRow.querySelectorAll('.yellow-bar-cell');
        if (cells.length >= 7) {
            cells[0].textContent = yellowBarData.bidOrderCount.toLocaleString();
            cells[1].textContent = yellowBarData.bidShareCount.toLocaleString();
            cells[2].textContent = yellowBarData.bidPrice.toFixed(2);
            cells[3].textContent = '-';
            cells[4].textContent = yellowBarData.askPrice.toFixed(2);
            cells[5].textContent = yellowBarData.askShareCount.toLocaleString();
            cells[6].textContent = yellowBarData.askOrderCount.toLocaleString();
        }
    }
}

function updatePriceLevelBarFromOrderbook(bidOrders, askOrders) {
    // Apply filtering to get the orders that are actually displayed
    const filteredBids = applyOrderFiltering(bidOrders || [], 'bid');
    const filteredAsks = applyOrderFiltering(askOrders || [], 'ask');
    
    // Calculate price level data from filtered orders
    const priceLevelBarData = calculatePriceLevelBarData(filteredBids, filteredAsks);
    
    // Log percentage data
    if (DEBUG) {
        console.log('Price Level Bar Data (from filtered orders):', priceLevelBarData);
        
        if (priceLevelBarData.bidLevels) {
            console.log('Top 5 Bid Levels:');
            priceLevelBarData.bidLevels.forEach((level, index) => {
                console.log(`  Bid ${5-index}: Price ${level.price?.toFixed(2)}, Shares ${(level.shareCount || 0).toLocaleString()}, Volume ${Math.round(level.volume || 0).toLocaleString()}, Percentage ${level.percentage?.toFixed(2)}%`);
            });
        }
        
        if (priceLevelBarData.askLevels) {
            console.log('Top 5 Ask Levels:');
            priceLevelBarData.askLevels.forEach((level, index) => {
                console.log(`  Ask ${index+1}: Price ${level.price?.toFixed(2)}, Shares ${(level.shareCount || 0).toLocaleString()}, Volume ${Math.round(level.volume || 0).toLocaleString()}, Percentage ${level.percentage?.toFixed(2)}%`);
            });
        }
        
    // Calculate total percentage to verify it adds up to 100%
    const totalBidPercentage = priceLevelBarData.bidLevels ? 
    priceLevelBarData.bidLevels.reduce((sum, level) => sum + (level.percentage || 0), 0) : 0;
    const totalAskPercentage = priceLevelBarData.askLevels ? 
    priceLevelBarData.askLevels.reduce((sum, level) => sum + (level.percentage || 0), 0) : 0;
        const totalPercentage = totalBidPercentage + totalAskPercentage;
        
        console.log(`Total shares - Bids: ${(priceLevelBarData.totalBidShares || 0).toLocaleString()}, Asks: ${(priceLevelBarData.totalAskShares || 0).toLocaleString()}, All 10 Segments: ${(priceLevelBarData.totalSegmentShares || 0).toLocaleString()}`);
        console.log(`Percentage verification - Bids: ${totalBidPercentage.toFixed(2)}%, Asks: ${totalAskPercentage.toFixed(2)}%, Total: ${totalPercentage.toFixed(2)}% (should be 100.00%)`);
        console.log(`Total volume: ${Math.round(priceLevelBarData.totalVolume || 0).toLocaleString()}`);
    }
    
    const priceScaleContainer = document.querySelector('.price-scale-container');
    if (!priceScaleContainer) return;
    
    const bidLevelsContainer = priceScaleContainer.querySelector('.bid-levels');
    const askLevelsContainer = priceScaleContainer.querySelector('.ask-levels');
    
    if (!bidLevelsContainer || !askLevelsContainer) return;
    
    // Calculate total percentages for each side to set container widths
    const totalBidPercentage = priceLevelBarData.bidLevels ? 
        priceLevelBarData.bidLevels.reduce((sum, level) => sum + (level.percentage || 0), 0) : 0;
    const totalAskPercentage = priceLevelBarData.askLevels ? 
        priceLevelBarData.askLevels.reduce((sum, level) => sum + (level.percentage || 0), 0) : 0;
    
    // Set the width of the containers based on their total percentage
    bidLevelsContainer.style.width = `${totalBidPercentage}%`;
    askLevelsContainer.style.width = `${totalAskPercentage}%`;
    
    // Update bid levels (bid-level-5 to bid-level-1, where bid-level-1 is closest to spread)
    const bidLevelElements = bidLevelsContainer.querySelectorAll('.price-level');
    if (priceLevelBarData.bidLevels && bidLevelElements.length >= 5) {
        // bidLevels array comes from backend in order: worst to best (bid5, bid4, bid3, bid2, bid1)
        // We want to display them as: bid5, bid4, bid3, bid2, bid1 (left to right)
        priceLevelBarData.bidLevels.forEach((level, index) => {
            const element = bidLevelElements[index]; // index 0 = bid-level-5, index 4 = bid-level-1  
            if (element) {
                // Set width based on percentage relative to this container
                const segmentPercentage = level.percentage || 0;
                const relativeWidth = totalBidPercentage > 0 ? (segmentPercentage / totalBidPercentage) * 100 : 0;
                element.style.width = `${Math.max(relativeWidth, 1)}%`; // Minimum 1% for visibility within container
                
                // Set color based on level (5-index gives us 5,4,3,2,1)
                const levelNumber = 5 - index; // Convert array index to level number
                element.className = `price-level bid-level-${levelNumber} ${getLevelColor(levelNumber)}`;
                
                // Add tooltip with volume info
                element.title = `Bid Level ${levelNumber} - Price: ${level.price ? level.price.toFixed(2) : '0.00'}, Volume: ${Math.round(level.volume || 0).toLocaleString()}`;
            }
        });
    }
    
    // Update ask levels (ask-level-1 to ask-level-5, where ask-level-1 is closest to spread)
    const askLevelElements = askLevelsContainer.querySelectorAll('.price-level');
    if (priceLevelBarData.askLevels && askLevelElements.length >= 5) {
        // askLevels array comes from backend in order: best to worst (ask1, ask2, ask3, ask4, ask5)
        // We want to display them as: ask1, ask2, ask3, ask4, ask5 (left to right)
        priceLevelBarData.askLevels.forEach((level, index) => {
            const element = askLevelElements[index]; // index 0 = ask-level-1, index 4 = ask-level-5
            if (element) {
                // Set width based on percentage relative to this container
                const segmentPercentage = level.percentage || 0;
                const relativeWidth = totalAskPercentage > 0 ? (segmentPercentage / totalAskPercentage) * 100 : 0;
                element.style.width = `${Math.max(relativeWidth, 1)}%`; // Minimum 1% for visibility within container
                
                // Set color based on level (index+1 gives us 1,2,3,4,5)  
                const levelNumber = index + 1; // Convert array index to level number
                element.className = `price-level ask-level-${levelNumber} ${getLevelColor(levelNumber)}`;
                
                // Add tooltip with volume info
                element.title = `Ask Level ${levelNumber} - Price: ${level.price ? level.price.toFixed(2) : '0.00'}, Volume: ${Math.round(level.volume || 0).toLocaleString()}`;
            }
        });
    }
}

function calculatePriceLevelBarData(filteredBids, filteredAsks) {
    // Get top 5 unique price levels for bids (highest prices first)
    const bidPriceLevels = getTopPriceLevels(filteredBids, 'bid', 5);
    
    // Get top 5 unique price levels for asks (lowest prices first)  
    const askPriceLevels = getTopPriceLevels(filteredAsks, 'ask', 5);
    
    // Calculate total shares across all 10 segments
    const totalBidShares = bidPriceLevels.reduce((sum, level) => sum + level.shareCount, 0);
    const totalAskShares = askPriceLevels.reduce((sum, level) => sum + level.shareCount, 0);
    const totalSegmentShares = totalBidShares + totalAskShares;
    
    // Calculate percentages for each level
    const bidLevels = bidPriceLevels.map(level => ({
        ...level,
        percentage: totalSegmentShares > 0 ? (level.shareCount / totalSegmentShares) * 100 : 0
    }));
    
    const askLevels = askPriceLevels.map(level => ({
        ...level,
        percentage: totalSegmentShares > 0 ? (level.shareCount / totalSegmentShares) * 100 : 0
    }));
    
    // Reverse bid levels for proper display order (bid5 to bid1)
    bidLevels.reverse();
    
    const totalVolume = bidLevels.reduce((sum, level) => sum + level.volume, 0) +
                       askLevels.reduce((sum, level) => sum + level.volume, 0);
    
    return {
        bidLevels,
        askLevels,
        totalBidShares,
        totalAskShares,
        totalSegmentShares,
        totalVolume
    };
}

function getTopPriceLevels(orders, side, count) {
    if (!orders || orders.length === 0) {
        return Array(count).fill().map(() => ({ price: 0, shareCount: 0, volume: 0 }));
    }
    
    // Group orders by price level
    const priceLevels = new Map();
    
    orders.forEach(order => {
        const price = order.price;
        const size = order.size;
        const volume = price * size;
        
        if (priceLevels.has(price)) {
            const existing = priceLevels.get(price);
            existing.shareCount += size;
            existing.volume += volume;
        } else {
            priceLevels.set(price, {
                price: price,
                shareCount: size,
                volume: volume
            });
        }
    });
    
    // Sort price levels and take top 5
    const sortedLevels = Array.from(priceLevels.values());
    if (side === 'bid') {
        // For bids, sort by price descending (highest first)
        sortedLevels.sort((a, b) => b.price - a.price);
    } else {
        // For asks, sort by price ascending (lowest first)
        sortedLevels.sort((a, b) => a.price - b.price);
    }
    
    // Take top count levels, pad with empty levels if needed
    const result = sortedLevels.slice(0, count);
    while (result.length < count) {
        result.push({ price: 0, shareCount: 0, volume: 0 });
    }
    
    return result;
}

function getLevelColor(level) {
    // Map bid levels to distinct colors - darker colors for closer to spread
    switch (level) {
        case 1: return 'order-dark-blue';
        case 2: return 'order-blue';
        case 3: return 'order-light-blue';
        case 4: return 'order-lightest-blue';
        default: return 'order-cyan';
    }
}

function applyOrderFiltering(orders, side) {
    const dropdownId = side === 'bid' ? 'buy-orders-filter' : 'sell-orders-filter';
    const selectedExchange = document.getElementById(dropdownId).value;
    
    const filteredOrders = (selectedExchange === 'All') ? orders : orders.filter(order => order.exchange === selectedExchange); 
    if (DEBUG) console.log("%d orders filtered on %s side", filteredOrders.length, side);

    return filteredOrders;
}

function updateScrollbarState(maxOrderNumber) {
    const orderbookTable = document.querySelector('.orderbook-table');

    if (maxOrderNumber > maxOrdersBeforeScrolling) {
        if (DEBUG) console.log("Enabling scrollbar");
        orderbookTable.classList.remove('scrollbar-disabled');
        orderbookTable.style.overflowY = 'auto';
    } else {
        if (DEBUG) console.log("Disabling scrollbar");
        orderbookTable.classList.add('scrollbar-disabled');
        orderbookTable.style.overflowY = 'scroll';
    }
}