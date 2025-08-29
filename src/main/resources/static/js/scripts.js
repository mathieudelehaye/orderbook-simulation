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

    // Initialize orderbook data
    initializeOrderbook();
    
    // Initialize timeseries chart
    initializeTimeseries();
    
    // Initialize OHLC data
    initializeOhlc();
    
    // Initialize Trades data
    initializeTrades();
    
    // Initialize News data
    initializeNews();
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

async function initializeOrderbook() {
    try {
        const response = await fetch('data/orderbook-data.json');
        const orderbookData = await response.json();
        
        populateOrders('bid-orders', orderbookData.bids, 'bid');
        populateOrders('ask-orders', orderbookData.asks, 'ask');
    } catch (error) {
        console.error('Error loading orderbook data:', error);
    }
}

function populateOrders(containerId, orders, side) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    orders.forEach(order => {
        const orderRow = document.createElement('div');

        // midpoint currenty hardcoded
        orderRow.className = `order-row ${getOrderColor(order.price, 632.30)}`;
        
        if (side === 'bid') {
            orderRow.innerHTML = `
                <span class="order-cell">${order.price.toFixed(2)}</span>
                <span class="order-cell">${order.exchange}</span>
                <span class="order-cell">${order.size.toLocaleString()}</span>
                <span class="order-cell">${order.time}</span>
            `;
        } else {
            orderRow.innerHTML = `
                <span class="order-cell">${order.time}</span>
                <span class="order-cell">${order.size.toLocaleString()}</span>
                <span class="order-cell">${order.exchange}</span>
                <span class="order-cell">${order.price.toFixed(2)}</span>
            `;
        }
        
        container.appendChild(orderRow);
    });
}

function getOrderColor(price, spreadMid) {
    // Determine color based on price level proximity to spread
    // Closer to spread = blue colors, further = pink/brown
    const distance = Math.round(Math.abs(price - spreadMid) * 100) / 100;

    if (distance <= 0.1) return 'order-blue';
    else if (distance <= 0.3) return 'order-light-blue';
    else if (distance <= 0.5) return 'order-dark-pink';
    else if (distance <= 0.7) return 'order-pink';
    else return 'order-brown';
}

async function initializeTimeseries() {
  try {
    const res = await fetch('data/timeseries-data.json');
    const timeseriesData = await res.json();

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

    new Chart(ctx, {
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
  } catch (err) {
    console.error('Error loading timeseries data:', err);
  }
}

async function initializeOhlc() {
    try {
        const response = await fetch('data/ohlc-data.json');
        const ohlcData = await response.json();
        
        populateOhlcData(ohlcData.data);
    } catch (error) {
        console.error('Error loading OHLC data:', error);
    }
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

async function initializeTrades() {
    try {
        const response = await fetch('data/trades-data.json');
        const tradesData = await response.json();
        
        populateTradesData(tradesData.trades);
    } catch (error) {
        console.error('Error loading trades data:', error);
    }
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

async function initializeNews() {
    try {
        const response = await fetch('data/news-data.json');
        const newsData = await response.json();
        
        populateNewsData('rr-news', newsData['rr-news']);
    } catch (error) {
        console.error('Error loading news data:', error);
    }
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