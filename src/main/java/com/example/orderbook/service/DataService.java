package com.example.orderbook.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class DataService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicInteger dataIndex = new AtomicInteger(0);
    
    private List<Map<String, Object>> orderbookDataList;
    private List<Map<String, Object>> tradesDataList;
    private List<Map<String, Object>> newsDataList;
    
    // Store previous top prices for change calculation
    private Double previousBidTopPrice = null;
    private Double previousAskTopPrice = null;
    private Double previousMiddlePrice = null;

    public DataService() {
        try {
            loadAllData();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void loadAllData() throws IOException {
        orderbookDataList = readJsonFile("data/orderbook-data.json", new TypeReference<List<Map<String, Object>>>() {});
        tradesDataList = readJsonFile("data/trades-data.json", new TypeReference<List<Map<String, Object>>>() {});
        newsDataList = readJsonFile("data/news-data.json", new TypeReference<List<Map<String, Object>>>() {});
    }

    public Map<String, Object> getOrderbookData() throws IOException {
        if (orderbookDataList == null || orderbookDataList.isEmpty()) {
            return Map.of("bids", List.of(), "asks", List.of(), "yellowBar", getEmptyYellowBar(), "headerInfo", getEmptyHeaderInfo());
        }
        int index = dataIndex.get() % orderbookDataList.size();
        Map<String, Object> orderbook = orderbookDataList.get(index);
        
        // Calculate yellow bar data
        Map<String, Object> yellowBar = calculateYellowBarData(orderbook);
        
        // Calculate header info data
        Map<String, Object> headerInfo = calculateHeaderInfo(orderbook);
        
        // Add yellow bar and header info to the response (OHLC data now sent separately)
        Map<String, Object> response = new java.util.HashMap<>(orderbook);
        response.put("yellowBar", yellowBar);
        response.put("headerInfo", headerInfo);
        
        return response;
    }

    public Map<String, Object> getTradesData() throws IOException {
        if (tradesDataList == null || tradesDataList.isEmpty()) {
            return Map.of("trades", List.of());
        }
        int index = dataIndex.get() % tradesDataList.size();
        return tradesDataList.get(index);
    }

    public Map<String, Object> getOhlcData() throws IOException {
        // Calculate OHLC data from current orderbook and trades data instead of reading from JSON
        Map<String, Object> currentOrderbook = getOrderbookData();
        Map<String, Object> calculatedOhlcData = calculateOhlcDataForPopulation(currentOrderbook);
        return calculatedOhlcData;
    }

    public Map<String, Object> getTimeseriesData() throws IOException {
        return readJsonFile("data/timeseries-data.json", new TypeReference<Map<String, Object>>() {});
    }

    public Map<String, Object> getNewsData() throws IOException {
        if (newsDataList == null || newsDataList.isEmpty()) {
            return Map.of("news", List.of());
        }
        int index = dataIndex.get() % newsDataList.size();
        return newsDataList.get(index);
    }

    public void advanceDataIndex() {
        dataIndex.incrementAndGet();
    }

    private <T> T readJsonFile(String filePath, TypeReference<T> typeReference) throws IOException {
        ClassPathResource resource = new ClassPathResource(filePath);
        return objectMapper.readValue(resource.getInputStream(), typeReference);
    }
    
    private Map<String, Object> calculateYellowBarData(Map<String, Object> orderbook) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> bids = (List<Map<String, Object>>) orderbook.get("bids");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> asks = (List<Map<String, Object>>) orderbook.get("asks");
        
        if (bids == null || bids.isEmpty() || asks == null || asks.isEmpty()) {
            return getEmptyYellowBar();
        }
        
        // Find best bid (highest price) and best ask (lowest price)
        Map<String, Object> bestBid = bids.stream()
                .max((b1, b2) -> Double.compare(
                        ((Number) b1.get("price")).doubleValue(),
                        ((Number) b2.get("price")).doubleValue()))
                .orElse(null);
        
        Map<String, Object> bestAsk = asks.stream()
                .min((a1, a2) -> Double.compare(
                        ((Number) a1.get("price")).doubleValue(),
                        ((Number) a2.get("price")).doubleValue()))
                .orElse(null);
        
        if (bestBid == null || bestAsk == null) {
            return getEmptyYellowBar();
        }
        
        double bestBidPrice = ((Number) bestBid.get("price")).doubleValue();
        double bestAskPrice = ((Number) bestAsk.get("price")).doubleValue();
        
        // Count orders at best bid and ask prices
        int bidOrderCount = (int) bids.stream()
                .filter(bid -> Math.abs(((Number) bid.get("price")).doubleValue() - bestBidPrice) < 0.001)
                .count();
        
        int askOrderCount = (int) asks.stream()
                .filter(ask -> Math.abs(((Number) ask.get("price")).doubleValue() - bestAskPrice) < 0.001)
                .count();
        
        // Sum shares at best bid and ask prices
        int bidShareCount = bids.stream()
                .filter(bid -> Math.abs(((Number) bid.get("price")).doubleValue() - bestBidPrice) < 0.001)
                .mapToInt(bid -> ((Number) bid.get("size")).intValue())
                .sum();
        
        int askShareCount = asks.stream()
                .filter(ask -> Math.abs(((Number) ask.get("price")).doubleValue() - bestAskPrice) < 0.001)
                .mapToInt(ask -> ((Number) ask.get("size")).intValue())
                .sum();
        
        return Map.of(
                "bidOrderCount", bidOrderCount,
                "bidShareCount", bidShareCount,
                "bidPrice", bestBidPrice,
                "askPrice", bestAskPrice,
                "askShareCount", askShareCount,
                "askOrderCount", askOrderCount
        );
    }
    
    private Map<String, Object> getEmptyYellowBar() {
        return Map.of(
                "bidOrderCount", 0,
                "bidShareCount", 0,
                "bidPrice", 0.0,
                "askPrice", 0.0,
                "askShareCount", 0,
                "askOrderCount", 0
        );
    }
    
    private Map<String, Object> calculateHeaderInfo(Map<String, Object> orderbook) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> bids = (List<Map<String, Object>>) orderbook.get("bids");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> asks = (List<Map<String, Object>>) orderbook.get("asks");
        
        // Calculate buy side data (best bid price is highest)
        Map<String, Object> buyData = calculateSideData(bids, true, previousBidTopPrice);
        
        // Calculate sell side data (best ask price is lowest)  
        Map<String, Object> sellData = calculateSideData(asks, false, previousAskTopPrice);
        
        // Update previous prices for next iteration
        if (buyData.get("topPrice") != null) {
            previousBidTopPrice = (Double) buyData.get("topPrice");
        }
        if (sellData.get("topPrice") != null) {
            previousAskTopPrice = (Double) sellData.get("topPrice");
        }
        
        return Map.of(
                "buyData", buyData,
                "sellData", sellData
        );
    }
    
    private Map<String, Object> calculateSideData(List<Map<String, Object>> orders, boolean isBuySide, Double previousTopPrice) {
        if (orders == null || orders.isEmpty()) {
            Map<String, Object> result = new java.util.HashMap<>();
            result.put("topPrice", null);
            result.put("priceChange", null);
            result.put("priceChangePercent", null);
            result.put("totalVolume", 0.0);
            return result;
        }
        
        // Find best price (highest for bids, lowest for asks)
        OptionalDouble priceOpt = orders.stream()
                .mapToDouble(order -> ((Number) order.get("price")).doubleValue())
                .reduce(isBuySide ? Double::max : Double::min);
        
        Double topPrice = priceOpt.isPresent() ? priceOpt.getAsDouble() : null;
        
        // Calculate total volume for this side: sum of (price * size) for orders at top price only
        double totalVolume = 0.0;
        if (topPrice != null) {
            totalVolume = orders.stream()
                    .filter(order -> {
                        double price = ((Number) order.get("price")).doubleValue();
                        return Math.abs(price - topPrice) < 0.001; // Match orders at top price
                    })
                    .mapToDouble(order -> {
                        double price = ((Number) order.get("price")).doubleValue();
                        double size = ((Number) order.get("size")).doubleValue();
                        return price * size;
                    })
                    .sum(); 
        }
        
        // Calculate price change if we have previous data
        Double priceChange = null;
        Double priceChangePercent = null;
        
        if (previousTopPrice != null && topPrice != null && !previousTopPrice.equals(topPrice)) {
            priceChange = topPrice - previousTopPrice;
            priceChangePercent = (priceChange / previousTopPrice) * 100.0;
        }
        
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("topPrice", topPrice);
        result.put("priceChange", priceChange);
        result.put("priceChangePercent", priceChangePercent);
        result.put("totalVolume", Math.round(totalVolume));
        return result;
    }
    
    private Map<String, Object> getEmptyHeaderInfo() {
        Map<String, Object> emptySideData = new java.util.HashMap<>();
        emptySideData.put("topPrice", null);
        emptySideData.put("priceChange", null);
        emptySideData.put("priceChangePercent", null);
        emptySideData.put("totalVolume", 0.0);
        
        return Map.of(
                "buyData", emptySideData,
                "sellData", emptySideData
        );
    }
    
    private Map<String, Object> calculateOhlcData(Map<String, Object> orderbook) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> bids = (List<Map<String, Object>>) orderbook.get("bids");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> asks = (List<Map<String, Object>>) orderbook.get("asks");
        
        if (bids == null || bids.isEmpty() || asks == null || asks.isEmpty()) {
            return getEmptyOhlcData();
        }
        
        // Get current trade data for OHLC calculation
        Map<String, Object> currentTradeData = null;
        try {
            currentTradeData = getTradesData();
        } catch (IOException e) {
            return getEmptyOhlcData();
        }
        
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> trades = (List<Map<String, Object>>) currentTradeData.get("trades");
        
        // Calculate OHLC from 5 most recent trade prices
        Map<String, Object> ohlcCandle = calculateOhlcFromTrades(trades);
        
        // Calculate current middle price (best bid + best ask) / 2
        double bestBidPrice = bids.stream()
                .mapToDouble(bid -> ((Number) bid.get("price")).doubleValue())
                .max().orElse(0.0);
        
        double bestAskPrice = asks.stream()
                .mapToDouble(ask -> ((Number) ask.get("price")).doubleValue())
                .min().orElse(Double.MAX_VALUE);
        
        double currentMiddlePrice = (bestBidPrice + bestAskPrice) / 2.0;
        
        // Calculate Last Chg (change from previous middle price)
        Double lastChg = null;
        String lastChgDirection = null;
        
        if (previousMiddlePrice != null && !previousMiddlePrice.equals(currentMiddlePrice)) {
            lastChg = currentMiddlePrice - previousMiddlePrice;
            lastChgDirection = lastChg > 0 ? "up" : "down";
        }
        
        // Update previous middle price for next iteration
        previousMiddlePrice = currentMiddlePrice;
        
        // Calculate Spread (best ask - best bid)
        double spread = bestAskPrice - bestBidPrice;
        
        // Calculate Sprd % = spread / (max ask price - min bid price)
        double maxAskPrice = asks.stream()
                .mapToDouble(ask -> ((Number) ask.get("price")).doubleValue())
                .max().orElse(bestAskPrice);
        
        double minBidPrice = bids.stream()
                .mapToDouble(bid -> ((Number) bid.get("price")).doubleValue())
                .min().orElse(bestBidPrice);
        
        double spreadPercentage = (maxAskPrice - minBidPrice) > 0 ? 
            (spread / (maxAskPrice - minBidPrice)) * 100.0 : 0.0;
        
        // Calculate total trades (sum of trade share numbers)
        int totalTrades = trades != null ? trades.stream()
                .mapToInt(trade -> {
                    Object shares = trade.get("shares");
                    return shares != null ? ((Number) shares).intValue() : 0;
                })
                .sum() : 0;
        
        // Get timestamp from orderbook or current time
        String timestamp = (String) orderbook.get("timestamp");
        if (timestamp == null) {
            timestamp = java.time.LocalTime.now().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss"));
        }
        
        // Build result
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("time", timestamp);
        result.put("open", ohlcCandle.get("open"));
        result.put("high", ohlcCandle.get("high"));
        result.put("low", ohlcCandle.get("low"));
        result.put("close", ohlcCandle.get("close"));
        result.put("lastChg", lastChg);
        result.put("lastChgDirection", lastChgDirection);
        result.put("spread", spread);
        result.put("spreadPercentage", spreadPercentage);
        result.put("trades", totalTrades);
        
        return result;
    }
    
    private Map<String, Object> calculateOhlcDataForPopulation(Map<String, Object> orderbook) {
        // Get the raw OHLC data first
        Map<String, Object> rawOhlcData = calculateOhlcData(orderbook);
        
        // Format it for populateOhlcData function
        List<Map<String, Object>> data = new java.util.ArrayList<>();
        
        // Add Time
        data.add(Map.of("label", "Time", "value", rawOhlcData.get("time")));
        
        // Add Last Chg with arrow
        String lastChgValue = "--";
        if (rawOhlcData.get("lastChg") != null && rawOhlcData.get("lastChgDirection") != null) {
            Double lastChg = (Double) rawOhlcData.get("lastChg");
            String direction = (String) rawOhlcData.get("lastChgDirection");
            String arrow = direction.equals("up") ? " ↑" : direction.equals("down") ? " ↓" : "";
            lastChgValue = String.format("%.2f%s", Math.abs(lastChg), arrow);
        }
        data.add(Map.of("label", "Last Chg", "value", lastChgValue));
        
        // Add Open
        Double open = (Double) rawOhlcData.get("open");
        data.add(Map.of("label", "Open", "value", open != null ? String.format("%.2f", open) : "--"));
        
        // Add Year (using open as placeholder)
        data.add(Map.of("label", "Year", "value", open != null ? String.format("%.2f", open) : "--"));
        
        // Add High
        Double high = (Double) rawOhlcData.get("high");
        data.add(Map.of("label", "High", "value", high != null ? String.format("%.2f", high) : "--"));
        
        // Add VWAP (using close as placeholder)
        Double close = (Double) rawOhlcData.get("close");
        data.add(Map.of("label", "VWAP", "value", close != null ? String.format("%.2f", close) : "--"));
        
        // Add Low
        Double low = (Double) rawOhlcData.get("low");
        data.add(Map.of("label", "Low", "value", low != null ? String.format("%.2f", low) : "--"));
        
        // Add Trades
        Integer trades = (Integer) rawOhlcData.get("trades");
        data.add(Map.of("label", "Trades", "value", trades != null ? String.format("%,d", trades) : "--"));
        
        // Add Trd Hi (same as High)
        data.add(Map.of("label", "Trd Hi", "value", high != null ? String.format("%.2f", high) : "--"));
        
        // Add Spread
        Double spread = (Double) rawOhlcData.get("spread");
        data.add(Map.of("label", "Spread", "value", spread != null ? String.format("%.2f", spread) : "--"));
        
        // Add Trd Lo (same as Low)
        data.add(Map.of("label", "Trd Lo", "value", low != null ? String.format("%.2f", low) : "--"));
        
        // Add Sprd %
        Double spreadPercentage = (Double) rawOhlcData.get("spreadPercentage");
        data.add(Map.of("label", "Sprd %", "value", spreadPercentage != null ? String.format("%.2f%%", spreadPercentage) : "--%"));
        
        return Map.of("data", data);
    }
    
    private Map<String, Object> calculateOhlcFromTrades(List<Map<String, Object>> trades) {
        if (trades == null || trades.isEmpty()) {
            return Map.of("open", 0.0, "high", 0.0, "low", 0.0, "close", 0.0);
        }
        
        // Take the 5 most recent trade prices (or all if less than 5)
        List<Double> recentPrices = trades.stream()
                .limit(5)
                .map(trade -> ((Number) trade.get("price")).doubleValue())
                .collect(java.util.stream.Collectors.toList());
        
        if (recentPrices.isEmpty()) {
            return Map.of("open", 0.0, "high", 0.0, "low", 0.0, "close", 0.0);
        }
        
        double open = recentPrices.get(recentPrices.size() - 1); // First trade price (oldest)
        double close = recentPrices.get(0); // Last trade price (newest)
        double high = recentPrices.stream().mapToDouble(Double::doubleValue).max().orElse(0.0);
        double low = recentPrices.stream().mapToDouble(Double::doubleValue).min().orElse(0.0);
        
        return Map.of(
                "open", open,
                "high", high, 
                "low", low,
                "close", close
        );
    }
    
    private Map<String, Object> getEmptyOhlcData() {
        return Map.of(
                "time", "00:00:00",
                "open", 0.0,
                "high", 0.0,
                "low", 0.0,
                "close", 0.0,
                "lastChg", null,
                "lastChgDirection", null,
                "spread", 0.0,
                "spreadPercentage", 0.0,
                "trades", 0
        );
    }
}